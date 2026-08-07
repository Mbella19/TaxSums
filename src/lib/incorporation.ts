import type { Region, TaxYear } from '../data/types';
import { roundToPence } from './bands';
import { calculateIncomeTax, personalAllowanceFor } from './income-tax';
import {
  calculateEmployeeNi,
  calculateEmployerNi,
  calculateSelfEmployedNi,
} from './national-insurance';

export interface SoleTraderResult {
  readonly profit: number;
  readonly incomeTax: number;
  readonly class4Ni: number;
  readonly totalTax: number;
  readonly takeHome: number;
}

export function calculateSoleTrader(
  rawProfit: number,
  year: TaxYear,
  region: Region = 'england-nireland',
): SoleTraderResult {
  // A trading loss is not negative take-home pay; it is simply nothing to tax.
  const profit = Math.max(0, rawProfit);
  const incomeTax = calculateIncomeTax({ grossIncome: profit, region }, year).total;
  const class4Ni = calculateSelfEmployedNi(profit, year).class4Total;

  return {
    profit,
    incomeTax,
    class4Ni,
    totalTax: roundToPence(incomeTax + class4Ni),
    takeHome: roundToPence(profit - incomeTax - class4Ni),
  };
}

/**
 * Corporation tax with marginal relief.
 *
 * Between the limits the effective marginal rate is 26.5%, higher than the
 * 25% headline — a fact that surprises most company directors.
 */
export function calculateCorporationTax(
  profit: number,
  year: TaxYear,
  associatedCompanies = 1,
): { readonly tax: number; readonly effectiveRate: number; readonly marginalReliefApplied: boolean } {
  const { smallProfitsRate, mainRate, lowerLimit, upperLimit, marginalReliefFraction } =
    year.corporationTax;

  // The limits are divided between associated companies.
  const divisor = Math.max(1, associatedCompanies);
  const lower = lowerLimit / divisor;
  const upper = upperLimit / divisor;

  if (profit <= 0) return { tax: 0, effectiveRate: 0, marginalReliefApplied: false };

  if (profit <= lower) {
    const tax = roundToPence(profit * smallProfitsRate);
    return { tax, effectiveRate: smallProfitsRate, marginalReliefApplied: false };
  }

  if (profit > upper) {
    const tax = roundToPence(profit * mainRate);
    return { tax, effectiveRate: mainRate, marginalReliefApplied: false };
  }

  // Main rate on everything, less marginal relief of F × (upper − profit).
  const relief = marginalReliefFraction * (upper - profit);
  const tax = roundToPence(profit * mainRate - relief);
  return { tax, effectiveRate: tax / profit, marginalReliefApplied: true };
}

/** Dividend tax, charged on top of all other income. */
export function calculateDividendTax(
  dividends: number,
  otherTaxableIncome: number,
  year: TaxYear,
): { readonly tax: number; readonly allowanceUsed: number } {
  const { allowance, ordinaryRate, upperRate, additionalRate } = year.incomeTax.dividend;
  if (dividends <= 0) return { tax: 0, allowanceUsed: 0 };

  const allowanceUsed = Math.min(dividends, allowance);
  const taxable = dividends - allowanceUsed;

  // Dividends sit at the top of the income stack. Note the band thresholds used
  // are always the UK ones: dividend income is not devolved, so a Scottish
  // director pays Scottish rates on salary but UK rates on dividends.
  const bands = year.incomeTax.bands['england-nireland'];
  const rates = [ordinaryRate, upperRate, additionalRate];

  let remaining = taxable;
  let tax = 0;
  // Where in the band stack the dividends begin. The dividend allowance still
  // uses up band space even though no tax is charged on it.
  let position = otherTaxableIncome + allowanceUsed;

  for (let i = 0; i < bands.length && remaining > 0; i += 1) {
    const bandTop = bands[i]!.upTo ?? Infinity;
    if (position >= bandTop) continue;
    const slice = Math.min(remaining, bandTop - position);
    tax += slice * rates[i]!;
    remaining -= slice;
    position += slice;
  }

  return { tax: roundToPence(tax), allowanceUsed };
}

export interface LimitedCompanyResult {
  readonly profit: number;
  readonly salary: number;
  readonly employerNi: number;
  readonly employeeNi: number;
  readonly salaryIncomeTax: number;
  readonly profitAfterSalary: number;
  readonly corporationTax: number;
  readonly corporationTaxRate: number;
  readonly dividendsAvailable: number;
  readonly dividendsDrawn: number;
  /** Profit left in the company. Personal tax on it is deferred, not avoided. */
  readonly retainedInCompany: number;
  readonly dividendTax: number;
  readonly totalTax: number;
  readonly takeHome: number;
  readonly employmentAllowanceClaimed: boolean;
  /** Salary below the Lower Earnings Limit earns no State Pension credit. */
  readonly qualifiesForStatePensionYear: boolean;
}

export interface LimitedCompanyOptions {
  readonly salary?: number;
  /**
   * A company whose only employee is also a director cannot claim the
   * Employment Allowance. This is the single most common error in sole trader
   * vs limited comparisons, and it is worth up to £10,500.
   */
  readonly soleDirectorNoOtherEmployees?: boolean;
  readonly associatedCompanies?: number;
  readonly region?: Region;
  /**
   * Dividends the director actually draws. Anything left stays in the company.
   *
   * This is where the real limited company advantage lives, and where most
   * comparisons quietly cheat: they assume full extraction, find the company
   * barely ahead, and stop. A director who only draws what they need defers
   * dividend tax on the rest — which is the whole point of incorporating.
   *
   * Undefined means draw everything, which is the honest like-for-like
   * comparison against a sole trader, who has no choice in the matter.
   */
  readonly dividendsToDraw?: number;
}

/**
 * The largest salary a company with `profit` available can actually fund,
 * once the employer National Insurance on that salary is paid too.
 *
 * Below the secondary threshold there is no employer NI, so the whole profit is
 * available. Above it, solving `S + (S − ST) × rate = profit` for S gives
 * `S = (profit + ST × rate) / (1 + rate)`.
 */
function affordableSalary(profit: number, year: TaxYear): number {
  const { secondaryThreshold, rate } = year.nationalInsurance.employer;
  if (profit <= secondaryThreshold) return Math.max(0, profit);
  return (profit + secondaryThreshold * rate) / (1 + rate);
}

export function calculateLimitedCompany(
  rawProfit: number,
  year: TaxYear,
  options: LimitedCompanyOptions = {},
): LimitedCompanyResult {
  const {
    soleDirectorNoOtherEmployees = true,
    associatedCompanies = 1,
    region = 'england-nireland',
  } = options;

  // A company cannot distribute a loss, and it cannot pay a salary out of money
  // it does not have. Without these clamps a £5,000-profit company asked for a
  // £50,000 salary reports a £39,520 take-home — cash that does not exist.
  const profit = Math.max(0, rawProfit);
  const requestedSalary = Math.max(0, options.salary ?? year.incomeTax.personalAllowance);
  const salary = Math.min(requestedSalary, affordableSalary(profit, year));

  const canClaimEmploymentAllowance = !soleDirectorNoOtherEmployees;
  const employerNiResult = calculateEmployerNi(salary, year, {
    employmentAllowance: canClaimEmploymentAllowance,
  });
  const employeeNi = calculateEmployeeNi(salary, year).total;
  const salaryIncomeTax = calculateIncomeTax({ grossIncome: salary, region }, year).total;

  // Salary and employer NI are both deductible against corporation tax.
  const profitAfterSalary = Math.max(0, profit - salary - employerNiResult.total);
  const ct = calculateCorporationTax(profitAfterSalary, year, associatedCompanies);
  const dividendsAvailable = Math.max(0, profitAfterSalary - ct.tax);
  const dividendsDrawn =
    options.dividendsToDraw === undefined
      ? dividendsAvailable
      : Math.min(Math.max(0, options.dividendsToDraw), dividendsAvailable);
  const retainedInCompany = roundToPence(dividendsAvailable - dividendsDrawn);

  // Dividends stack on top of salary, after the personal allowance.
  const allowance = personalAllowanceFor(salary + dividendsDrawn, year);
  const otherTaxableIncome = Math.max(0, salary - allowance);
  // Dividend rates are not devolved, so `region` deliberately plays no part
  // here — a Scottish director pays Scottish rates on salary but UK rates on
  // dividends.
  const dividend = calculateDividendTax(
    Math.max(0, dividendsDrawn - Math.max(0, allowance - salary)),
    otherTaxableIncome,
    year,
  );

  const totalTax = roundToPence(
    employerNiResult.total + employeeNi + salaryIncomeTax + ct.tax + dividend.tax,
  );

  // Cash actually reaching the director this year.
  const takeHome = roundToPence(
    salary - employeeNi - salaryIncomeTax + dividendsDrawn - dividend.tax,
  );

  return {
    profit,
    salary,
    employerNi: employerNiResult.total,
    employeeNi,
    salaryIncomeTax,
    profitAfterSalary: roundToPence(profitAfterSalary),
    corporationTax: ct.tax,
    corporationTaxRate: ct.effectiveRate,
    dividendsAvailable: roundToPence(dividendsAvailable),
    dividendsDrawn: roundToPence(dividendsDrawn),
    retainedInCompany,
    dividendTax: dividend.tax,
    totalTax,
    takeHome,
    employmentAllowanceClaimed: employerNiResult.allowanceUsed > 0,
    qualifiesForStatePensionYear: salary >= year.nationalInsurance.lowerEarningsLimit,
  };
}

export interface ComparisonResult {
  readonly profit: number;
  readonly soleTrader: SoleTraderResult;
  readonly limitedCompany: LimitedCompanyResult;
  /** Positive when incorporating leaves more in hand. */
  readonly advantage: number;
  readonly betterOption: 'sole-trader' | 'limited-company' | 'level';
  /** Profit left in the company, on which personal tax is deferred. */
  readonly retainedInCompany: number;
  /**
   * Typical extra cost of running a company — accounts, confirmation statement,
   * payroll. Compared against the raw tax saving, because a £900 saving that
   * costs £1,200 in accountancy fees is not a saving.
   */
  readonly assumedExtraCosts: number;
  readonly advantageAfterCosts: number;
}

/** A conservative estimate of annual limited company running costs. */
export const TYPICAL_LIMITED_COMPANY_COSTS = 1_200;

/**
 * Sole trader against limited company on the same profit.
 *
 * The comparison people search for constantly and that almost no free tool
 * gets fully right. Beyond the headline tax it accounts for:
 *  - the Employment Allowance being unavailable to most one-person companies
 *  - 26.5% marginal corporation tax between £50,000 and £250,000
 *  - the 2026/27 dividend rate rise to 10.75% / 35.75%
 *  - salary below the Lower Earnings Limit costing a State Pension year
 *  - the running costs that eat small savings
 */
export function compareTradingStructures(
  rawProfit: number,
  year: TaxYear,
  options: LimitedCompanyOptions & { readonly extraCosts?: number } = {},
): ComparisonResult {
  const { extraCosts = TYPICAL_LIMITED_COMPANY_COSTS, region = 'england-nireland' } = options;

  const profit = Math.max(0, rawProfit);
  const soleTrader = calculateSoleTrader(profit, year, region);
  const limitedCompany = calculateLimitedCompany(profit, year, options);

  const advantage = roundToPence(limitedCompany.takeHome - soleTrader.takeHome);
  const advantageAfterCosts = roundToPence(advantage - extraCosts);

  return {
    profit,
    soleTrader,
    limitedCompany,
    advantage,
    betterOption:
      advantageAfterCosts > 0 ? 'limited-company' : advantageAfterCosts < 0 ? 'sole-trader' : 'level',
    retainedInCompany: limitedCompany.retainedInCompany,
    assumedExtraCosts: extraCosts,
    advantageAfterCosts,
  };
}

/**
 * The marginal cost of taking the next £1 of profit out of a company, against
 * the sole trader equivalent.
 *
 * Explains a result that surprises people in 2026/27: above the £50,000
 * corporation tax lower limit, profit extracted as dividends is charged 26.5%
 * corporation tax and then 35.75% dividend tax, a combined 52.8%. A higher rate
 * sole trader pays 40% plus 2% Class 4 — so full extraction from a company is
 * now the more expensive route at most profit levels.
 */
export function marginalExtractionRates(year: TaxYear): {
  readonly marginalCorporationTax: number;
  readonly companyCombined: number;
  readonly soleTraderHigher: number;
  readonly soleTraderAdditional: number;
} {
  // 25% main rate plus the 3/200 relief clawback gives 26.5% on each extra
  // pound of profit inside the marginal band.
  const marginalCorporationTax =
    year.corporationTax.mainRate + year.corporationTax.marginalReliefFraction;
  const bands = year.incomeTax.bands['england-nireland'];
  const class4Upper = year.nationalInsurance.selfEmployed.class4UpperRate;

  return {
    marginalCorporationTax,
    // Profit is taxed twice: corporation tax, then dividend tax on what is left.
    companyCombined: 1 - (1 - marginalCorporationTax) * (1 - year.incomeTax.dividend.upperRate),
    soleTraderHigher: bands[1]!.rate + class4Upper,
    soleTraderAdditional: bands[2]!.rate + class4Upper,
  };
}

/**
 * Find the salary that leaves the most in the director's hands.
 *
 * Searched rather than derived, because the optimum moves whenever the
 * employer NI rate, the secondary threshold or the dividend rates change — and
 * a search cannot go stale the way a hard-coded "take £12,570" answer does.
 */
export function optimalDirectorSalary(
  profit: number,
  year: TaxYear,
  options: LimitedCompanyOptions = {},
): { readonly salary: number; readonly takeHome: number; readonly reasoning: string } {
  const candidates = [
    year.nationalInsurance.employer.secondaryThreshold,
    year.nationalInsurance.lowerEarningsLimit,
    year.incomeTax.personalAllowance,
  ];

  // Seeded with a real evaluation rather than -Infinity, so a profit too small
  // to fund any candidate salary still returns a usable answer.
  let best = {
    salary: candidates[0]!,
    takeHome: calculateLimitedCompany(profit, year, { ...options, salary: candidates[0]! }).takeHome,
  };
  for (const salary of candidates) {
    const result = calculateLimitedCompany(profit, year, { ...options, salary });
    if (result.takeHome > best.takeHome) best = { salary, takeHome: result.takeHome };
  }

  const belowLel = best.salary < year.nationalInsurance.lowerEarningsLimit;
  return {
    ...best,
    reasoning: belowLel
      ? `£${best.salary.toLocaleString('en-GB')} leaves the most in hand, but it is below the £${year.nationalInsurance.lowerEarningsLimit.toLocaleString('en-GB')} Lower Earnings Limit, so it does not buy a qualifying year towards the State Pension.`
      : `£${best.salary.toLocaleString('en-GB')} leaves the most in hand and is above the Lower Earnings Limit, so it still earns a qualifying year towards the State Pension.`,
  };
}
