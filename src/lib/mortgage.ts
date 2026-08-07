import { roundToPence } from './bands';

export interface MortgageTerms {
  /** Outstanding balance. */
  readonly balance: number;
  /** Annual interest rate as a decimal, e.g. 0.0459 for 4.59%. */
  readonly annualRate: number;
  /** Remaining term in months. */
  readonly termMonths: number;
}

/**
 * Exact contractual payment, unrounded.
 *
 * The simulation uses this rather than the rounded figure: rounding down by
 * half a penny compounds over 300 months into a few pounds of residual balance,
 * which would show up as a spurious extra month on the schedule.
 */
function exactMonthlyPayment(terms: MortgageTerms): number {
  const { balance, annualRate, termMonths } = terms;
  if (termMonths <= 0 || balance <= 0) return 0;

  const r = annualRate / 12;
  if (r === 0) return balance / termMonths;

  return (balance * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Standard repayment mortgage monthly payment, rounded for display. */
export function monthlyPayment(terms: MortgageTerms): number {
  return roundToPence(exactMonthlyPayment(terms));
}

export interface AmortisationSummary {
  readonly monthlyPayment: number;
  readonly monthsToRepay: number;
  readonly totalInterest: number;
  readonly totalPaid: number;
}

export interface AmortisationRow {
  readonly month: number;
  readonly interest: number;
  readonly principal: number;
  readonly overpayment: number;
  readonly balance: number;
}

/**
 * Run a mortgage forward month by month.
 *
 * Simulated rather than solved algebraically so the schedule is available for
 * display, and so a lump sum at a specific month behaves correctly.
 */
export function amortise(
  terms: MortgageTerms,
  options: {
    readonly monthlyOverpayment?: number;
    readonly lumpSum?: number;
    /** Month the lump sum lands, 1-indexed. Defaults to the first month. */
    readonly lumpSumMonth?: number;
    /** Payment to use. Defaults to the contractual payment for these terms. */
    readonly payment?: number;
  } = {},
): { readonly summary: AmortisationSummary; readonly schedule: readonly AmortisationRow[] } {
  const { monthlyOverpayment = 0, lumpSum = 0, lumpSumMonth = 1 } = options;
  const payment = options.payment ?? exactMonthlyPayment(terms);
  const r = terms.annualRate / 12;

  let balance = terms.balance;
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const schedule: AmortisationRow[] = [];

  // Guard against a payment that never clears the interest.
  const maxMonths = terms.termMonths * 2 + 12;

  while (balance > 0.005 && month < maxMonths) {
    month += 1;
    const interest = balance * r;
    const extra = monthlyOverpayment + (month === lumpSumMonth ? lumpSum : 0);

    // Never pay more than is owed.
    const scheduled = Math.min(payment, balance + interest);
    let principal = scheduled - interest;
    let overpayment = Math.min(extra, Math.max(0, balance - principal));

    if (principal <= 0 && extra <= 0) {
      // Interest-only or worse — the balance will never clear.
      break;
    }

    balance = balance - principal - overpayment;
    totalInterest += interest;
    totalPaid += scheduled + overpayment;

    schedule.push({
      month,
      interest: roundToPence(interest),
      principal: roundToPence(principal),
      overpayment: roundToPence(overpayment),
      balance: roundToPence(Math.max(0, balance)),
    });
  }

  return {
    summary: {
      monthlyPayment: payment,
      monthsToRepay: month,
      totalInterest: roundToPence(totalInterest),
      totalPaid: roundToPence(totalPaid),
    },
    schedule,
  };
}

export interface OverpaymentResult {
  readonly baseline: AmortisationSummary;
  readonly withOverpayment: AmortisationSummary;
  readonly interestSaved: number;
  readonly monthsSaved: number;
  readonly yearsSaved: number;
  readonly monthsSavedRemainder: number;
  /** Total extra paid in, so the saving can be judged against it. */
  readonly totalOverpaid: number;
  /**
   * Most fixed deals allow overpayments of 10% of the balance a year before an
   * early repayment charge applies. Flags when the plan would breach that.
   */
  readonly annualOverpayment: number;
  readonly exceedsTypicalErcAllowance: boolean;
  readonly typicalErcAllowance: number;
}

/** Typical annual overpayment allowance on a fixed-rate deal. */
const TYPICAL_ERC_ALLOWANCE = 0.1;

/**
 * "What does £200 a month extra actually save me?"
 *
 * Compares the contractual schedule against the same mortgage with regular
 * overpayments. The contractual payment is held constant, which is how lenders
 * normally treat overpayments by default — the term shortens rather than the
 * payment falling.
 */
export function overpaymentSaving(
  terms: MortgageTerms,
  monthlyOverpayment: number,
  lumpSum = 0,
): OverpaymentResult {
  // Both runs use the same exact payment so the comparison is like for like.
  const payment = exactMonthlyPayment(terms);
  const baseline = amortise(terms, { payment }).summary;
  const withOverpayment = amortise(terms, { payment, monthlyOverpayment, lumpSum }).summary;

  const monthsSaved = baseline.monthsToRepay - withOverpayment.monthsToRepay;
  const annualOverpayment = monthlyOverpayment * 12 + lumpSum;
  const typicalErcAllowance = terms.balance * TYPICAL_ERC_ALLOWANCE;

  return {
    baseline,
    withOverpayment,
    interestSaved: roundToPence(baseline.totalInterest - withOverpayment.totalInterest),
    monthsSaved,
    yearsSaved: Math.floor(monthsSaved / 12),
    monthsSavedRemainder: monthsSaved % 12,
    totalOverpaid: roundToPence(
      monthlyOverpayment * withOverpayment.monthsToRepay + lumpSum,
    ),
    annualOverpayment: roundToPence(annualOverpayment),
    exceedsTypicalErcAllowance: annualOverpayment > typicalErcAllowance,
    typicalErcAllowance: roundToPence(typicalErcAllowance),
  };
}

export interface AffordabilityInput {
  readonly annualIncome: number;
  readonly secondAnnualIncome?: number;
  readonly deposit: number;
  readonly monthlyCommitments?: number;
  readonly termYears?: number;
  /** Rate used for the monthly payment estimate. */
  readonly annualRate?: number;
  /** Lenders test you can still pay at a higher rate than the one you take. */
  readonly stressRate?: number;
}

export interface AffordabilityBand {
  readonly label: string;
  readonly multiple: number;
  readonly maxLoan: number;
  readonly maxPropertyPrice: number;
  readonly monthlyPayment: number;
  readonly monthlyPaymentAtStressRate: number;
}

export interface AffordabilityResult {
  readonly totalIncome: number;
  readonly deposit: number;
  readonly bands: readonly AffordabilityBand[];
  /** Commitments reduce what a lender will advance, roughly £1 of loan per £1. */
  readonly commitmentReduction: number;
  readonly assumedRate: number;
  readonly stressRate: number;
  readonly termYears: number;
}

/**
 * Mortgage affordability, expressed as a range rather than a single number.
 *
 * There is no correct single answer here and any calculator that gives one is
 * guessing. The FCA's mandatory stress test was withdrawn in August 2022, and
 * lenders now set their own rules within MCOB: 4.5x income is the long-standing
 * high-street default, but several mainstream lenders go to 5.5x as standard
 * and higher for particular borrower profiles.
 *
 * So we show what different multiples buy and say plainly that the real figure
 * depends on the lender, the credit file and the stress test.
 */
export function affordabilityRange(input: AffordabilityInput): AffordabilityResult {
  const {
    annualIncome,
    secondAnnualIncome = 0,
    deposit,
    monthlyCommitments = 0,
    termYears = 25,
    annualRate = 0.045,
    stressRate = annualRate + 0.01,
  } = input;

  const totalIncome = annualIncome + secondAnnualIncome;
  // A rough industry convention: each £1/month of commitment reduces the
  // advance by roughly the amount that £1/month would service over the term.
  const commitmentReduction = monthlyCommitments * 12 * 5;

  const multiples: readonly { label: string; multiple: number }[] = [
    { label: 'Cautious', multiple: 4.0 },
    { label: 'High street default', multiple: 4.5 },
    { label: 'Generous', multiple: 5.0 },
    { label: 'Maximum from some lenders', multiple: 5.5 },
  ];

  const termMonths = termYears * 12;

  const bands = multiples.map(({ label, multiple }) => {
    const maxLoan = Math.max(0, totalIncome * multiple - commitmentReduction);
    return {
      label,
      multiple,
      maxLoan: roundToPence(maxLoan),
      maxPropertyPrice: roundToPence(maxLoan + deposit),
      monthlyPayment: monthlyPayment({ balance: maxLoan, annualRate, termMonths }),
      monthlyPaymentAtStressRate: monthlyPayment({
        balance: maxLoan,
        annualRate: stressRate,
        termMonths,
      }),
    };
  });

  return {
    totalIncome,
    deposit,
    bands,
    commitmentReduction: roundToPence(commitmentReduction),
    assumedRate: annualRate,
    stressRate,
    termYears,
  };
}

/** Loan-to-value, which determines which rates a borrower can actually access. */
export function loanToValue(propertyPrice: number, deposit: number): number {
  if (propertyPrice <= 0) return 0;
  return (propertyPrice - deposit) / propertyPrice;
}
