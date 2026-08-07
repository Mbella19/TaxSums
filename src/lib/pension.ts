import type { TaxYear } from '../data/types';
import { roundToPence } from './bands';

/**
 * How a pension contribution gets its tax relief. The three arrangements
 * produce materially different take-home pay for the same headline
 * contribution, and conflating them is the most common error in UK salary
 * calculators.
 */
export type PensionMethod = 'none' | 'salary-sacrifice' | 'net-pay' | 'relief-at-source';

export interface PensionInput {
  readonly method: PensionMethod;
  readonly kind: 'percent' | 'amount';
  /** Percentage of gross salary, or a fixed annual amount. */
  readonly value: number;
  /** Employer contribution, for the total-into-pension figure. */
  readonly employerPercent?: number;
}

export interface PensionEffect {
  readonly method: PensionMethod;
  /** Total landing in the pension from the employee side, including any relief. */
  readonly grossContribution: number;
  /** What actually leaves the employee's pay. */
  readonly costToEmployee: number;
  /** Basic rate relief added by the provider (relief at source only). */
  readonly reliefAtSourceTopUp: number;
  readonly employerContribution: number;
  readonly totalIntoPension: number;
  /** Reduces the base for both income tax and National Insurance. */
  readonly reducesGrossForTaxAndNi: number;
  /** Reduces the base for income tax only. */
  readonly reducesGrossForTaxOnly: number;
  /** Widens the basic rate band instead of reducing taxable income. */
  readonly basicRateBandExtension: number;
  /** Reduces adjusted net income, so it can rescue the personal allowance. */
  readonly reducesAdjustedNetIncome: number;
}

export function resolvePension(
  grossSalary: number,
  input: PensionInput,
  year: TaxYear,
): PensionEffect {
  const basicRate = year.incomeTax.bands['england-nireland'][0]!.rate;
  const grossContribution =
    input.method === 'none'
      ? 0
      : input.kind === 'percent'
        ? (grossSalary * input.value) / 100
        : input.value;

  const employerContribution = ((input.employerPercent ?? 0) / 100) * grossSalary;

  const empty = {
    method: input.method,
    grossContribution: roundToPence(grossContribution),
    employerContribution: roundToPence(employerContribution),
    totalIntoPension: roundToPence(grossContribution + employerContribution),
  };

  switch (input.method) {
    case 'none':
      return {
        ...empty,
        grossContribution: 0,
        totalIntoPension: roundToPence(employerContribution),
        costToEmployee: 0,
        reliefAtSourceTopUp: 0,
        reducesGrossForTaxAndNi: 0,
        reducesGrossForTaxOnly: 0,
        basicRateBandExtension: 0,
        reducesAdjustedNetIncome: 0,
      };

    // Salary is given up before it is ever paid, so it never appears for
    // income tax OR National Insurance. The only arrangement that saves NI.
    case 'salary-sacrifice':
      return {
        ...empty,
        costToEmployee: roundToPence(grossContribution),
        reliefAtSourceTopUp: 0,
        reducesGrossForTaxAndNi: roundToPence(grossContribution),
        reducesGrossForTaxOnly: 0,
        basicRateBandExtension: 0,
        reducesAdjustedNetIncome: roundToPence(grossContribution),
      };

    // Deducted from gross pay before income tax but after NI is worked out.
    // Full relief is immediate at the employee's marginal rate; no NI saving.
    case 'net-pay':
      return {
        ...empty,
        costToEmployee: roundToPence(grossContribution),
        reliefAtSourceTopUp: 0,
        reducesGrossForTaxAndNi: 0,
        reducesGrossForTaxOnly: roundToPence(grossContribution),
        basicRateBandExtension: 0,
        reducesAdjustedNetIncome: roundToPence(grossContribution),
      };

    // Taken from pay that has already been taxed. The provider reclaims basic
    // rate relief, so the employee pays 80% of the gross contribution. Higher
    // and additional rate relief is not automatic — it comes from widening the
    // basic rate band, claimed through Self Assessment.
    case 'relief-at-source': {
      const topUp = grossContribution * basicRate;
      return {
        ...empty,
        costToEmployee: roundToPence(grossContribution - topUp),
        reliefAtSourceTopUp: roundToPence(topUp),
        reducesGrossForTaxAndNi: 0,
        reducesGrossForTaxOnly: 0,
        basicRateBandExtension: roundToPence(grossContribution),
        reducesAdjustedNetIncome: roundToPence(grossContribution),
      };
    }
  }
}

export interface AnnualAllowanceResult {
  readonly allowance: number;
  readonly tapered: boolean;
  readonly excess: number;
}

/**
 * The annual allowance tapers for high earners: £1 of allowance lost per £2 of
 * adjusted income over the threshold, but only if threshold income is also
 * breached, and never below the floor.
 */
export function annualAllowanceFor(
  adjustedIncome: number,
  thresholdIncome: number,
  contributions: number,
  year: TaxYear,
): AnnualAllowanceResult {
  const {
    annualAllowance,
    taperAdjustedIncomeThreshold,
    taperThresholdIncome,
    minimumTaperedAllowance,
  } = year.pensions;

  const taperApplies =
    thresholdIncome > taperThresholdIncome && adjustedIncome > taperAdjustedIncomeThreshold;

  const allowance = taperApplies
    ? Math.max(
        minimumTaperedAllowance,
        annualAllowance - (adjustedIncome - taperAdjustedIncomeThreshold) / 2,
      )
    : annualAllowance;

  return {
    allowance: roundToPence(allowance),
    tapered: taperApplies,
    excess: roundToPence(Math.max(0, contributions - allowance)),
  };
}
