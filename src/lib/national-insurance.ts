import type { TaxYear } from '../data/types';
import { roundToPence } from './bands';

export interface EmployeeNiResult {
  readonly earnings: number;
  readonly mainBandEarnings: number;
  readonly mainBandCharge: number;
  readonly upperBandEarnings: number;
  readonly upperBandCharge: number;
  readonly total: number;
}

/**
 * Class 1 employee National Insurance.
 *
 * Calculated here on an annual basis, which is what a salary estimator wants.
 * Real payroll assesses NI per pay period and does not true up across the year,
 * so someone with uneven pay — a large bonus month, or a mid-year job change —
 * will see a different figure on their payslip. Every page that surfaces this
 * number says so in its "honest limits" section.
 *
 * Note NI is charged on earnings, not on taxable income: the personal allowance
 * is irrelevant, benefits in kind bear no employee NI (the employer pays Class
 * 1A instead), and only salary sacrifice reduces the NI base among the pension
 * arrangements.
 */
export function calculateEmployeeNi(
  earnings: number,
  year: TaxYear,
  options: { readonly exempt?: boolean } = {},
): EmployeeNiResult {
  const { primaryThreshold, upperEarningsLimit, mainRate, upperRate } =
    year.nationalInsurance.employee;

  if (options.exempt || earnings <= primaryThreshold) {
    return {
      earnings,
      mainBandEarnings: 0,
      mainBandCharge: 0,
      upperBandEarnings: 0,
      upperBandCharge: 0,
      total: 0,
    };
  }

  const mainBandEarnings = Math.min(earnings, upperEarningsLimit) - primaryThreshold;
  const upperBandEarnings = Math.max(0, earnings - upperEarningsLimit);
  const mainBandCharge = mainBandEarnings * mainRate;
  const upperBandCharge = upperBandEarnings * upperRate;

  return {
    earnings,
    mainBandEarnings: roundToPence(mainBandEarnings),
    mainBandCharge: roundToPence(mainBandCharge),
    upperBandEarnings: roundToPence(upperBandEarnings),
    upperBandCharge: roundToPence(upperBandCharge),
    total: roundToPence(mainBandCharge + upperBandCharge),
  };
}

/**
 * Class 1 secondary (employer) National Insurance.
 *
 * `employmentAllowance` defaults to false because the trap that catches most
 * one-person limited companies is that a company whose only employee is also a
 * director cannot claim it. The sole-trader-vs-limited comparison depends on
 * getting this right.
 */
export function calculateEmployerNi(
  earnings: number,
  year: TaxYear,
  options: { readonly employmentAllowance?: boolean } = {},
): { readonly chargeableEarnings: number; readonly gross: number; readonly allowanceUsed: number; readonly total: number } {
  const { secondaryThreshold, rate, employmentAllowance } = year.nationalInsurance.employer;
  const chargeableEarnings = Math.max(0, earnings - secondaryThreshold);
  const gross = chargeableEarnings * rate;
  const allowanceUsed = options.employmentAllowance ? Math.min(gross, employmentAllowance) : 0;

  return {
    chargeableEarnings: roundToPence(chargeableEarnings),
    gross: roundToPence(gross),
    allowanceUsed: roundToPence(allowanceUsed),
    total: roundToPence(Math.max(0, gross - allowanceUsed)),
  };
}

export interface SelfEmployedNiResult {
  readonly profits: number;
  readonly class4MainCharge: number;
  readonly class4UpperCharge: number;
  readonly class4Total: number;
  /** True when profits are too low to earn an automatic State Pension credit. */
  readonly belowSmallProfitsThreshold: boolean;
  readonly voluntaryClass2Annual: number;
}

/**
 * Class 4 National Insurance for the self-employed.
 *
 * Class 2 was abolished from April 2024. Profits above the small profits
 * threshold now earn a State Pension credit automatically with no flat charge;
 * below it, voluntary contributions remain available.
 */
export function calculateSelfEmployedNi(profits: number, year: TaxYear): SelfEmployedNiResult {
  const {
    class4LowerLimit,
    class4UpperLimit,
    class4MainRate,
    class4UpperRate,
    smallProfitsThreshold,
    class2VoluntaryWeekly,
  } = year.nationalInsurance.selfEmployed;

  const mainBand = Math.max(0, Math.min(profits, class4UpperLimit) - class4LowerLimit);
  const upperBand = Math.max(0, profits - class4UpperLimit);
  const class4MainCharge = mainBand * class4MainRate;
  const class4UpperCharge = upperBand * class4UpperRate;

  return {
    profits,
    class4MainCharge: roundToPence(class4MainCharge),
    class4UpperCharge: roundToPence(class4UpperCharge),
    class4Total: roundToPence(class4MainCharge + class4UpperCharge),
    belowSmallProfitsThreshold: profits < smallProfitsThreshold,
    voluntaryClass2Annual: roundToPence(class2VoluntaryWeekly * 52),
  };
}
