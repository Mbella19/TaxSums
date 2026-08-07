import type { LoanPlan, TaxYear } from '../data/types';

export interface LoanRepayment {
  readonly plan: LoanPlan;
  readonly label: string;
  readonly threshold: number;
  readonly rate: number;
  readonly earningsAboveThreshold: number;
  readonly annual: number;
  readonly monthly: number;
}

export interface StudentLoanResult {
  readonly repayments: readonly LoanRepayment[];
  readonly total: number;
}

/** Only one undergraduate plan can apply at a time; a postgraduate loan stacks on top. */
const UNDERGRADUATE_PLANS: readonly LoanPlan[] = ['plan1', 'plan2', 'plan4', 'plan5'];

/**
 * Student loan repayments.
 *
 * Two things most calculators get wrong:
 *
 *  1. A Postgraduate Loan is repaid *alongside* an undergraduate plan, not
 *     instead of it. Someone on Plan 2 with a master's loan pays 9% over
 *     £29,385 *and* 6% over £21,000 — up to 15% at the margin.
 *  2. Repayments are calculated on gross earnings and rounded DOWN to whole
 *     pounds, so a £1 pay rise often changes nothing.
 *
 * Salary sacrifice reduces the earnings figure used here; net-pay and
 * relief-at-source pension contributions do not.
 */
export function calculateStudentLoans(
  earnings: number,
  plans: readonly LoanPlan[],
  year: TaxYear,
): StudentLoanResult {
  const undergraduate = plans.filter((p) => UNDERGRADUATE_PLANS.includes(p));
  if (undergraduate.length > 1) {
    throw new Error(
      `Only one undergraduate plan can apply at a time, received: ${undergraduate.join(', ')}`,
    );
  }

  const repayments: LoanRepayment[] = [];

  for (const plan of plans) {
    const rates = year.studentLoans[plan];
    const earningsAboveThreshold = Math.max(0, earnings - rates.threshold);
    // HMRC rounds each plan's repayment down to whole pounds.
    const annual = Math.floor(earningsAboveThreshold * rates.rate);

    repayments.push({
      plan,
      label: rates.label,
      threshold: rates.threshold,
      rate: rates.rate,
      earningsAboveThreshold,
      annual,
      monthly: Math.floor((earningsAboveThreshold * rates.rate) / 12),
    });
  }

  return {
    repayments,
    total: repayments.reduce((sum, r) => sum + r.annual, 0),
  };
}
