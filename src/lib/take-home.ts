import type { LoanPlan, Region, TaxYear } from '../data/types';
import { roundToPence } from './bands';
import { calculateIncomeTax, type IncomeTaxResult } from './income-tax';
import { calculateEmployeeNi, type EmployeeNiResult } from './national-insurance';
import { resolvePension, type PensionEffect, type PensionInput } from './pension';
import { calculateStudentLoans, type StudentLoanResult } from './student-loans';

export interface TakeHomeInput {
  readonly grossSalary: number;
  readonly region: Region;
  readonly pension: PensionInput;
  readonly studentLoanPlans: readonly LoanPlan[];
  /** Over State Pension age: income tax still applies, employee NI does not. */
  readonly overStatePensionAge?: boolean;
  /** Taxable benefits in kind, e.g. a company car. Taxed, but no employee NI. */
  readonly benefitsInKind?: number;
  /**
   * Model the Autumn Budget 2025 salary sacrifice cap that takes effect in
   * April 2029: NI relief limited to the first £2,000 sacrificed. Has no effect
   * unless the tax year defines the cap or this override is supplied.
   */
  readonly applySalarySacrificeNicCap?: boolean;
}

export interface TakeHomeResult {
  readonly grossSalary: number;
  readonly pension: PensionEffect;
  readonly incomeTax: IncomeTaxResult;
  readonly nationalInsurance: EmployeeNiResult;
  readonly studentLoans: StudentLoanResult;
  readonly totalDeductions: number;
  readonly takeHomeAnnual: number;
  readonly takeHomeMonthly: number;
  readonly takeHomeWeekly: number;
  readonly takeHomeDaily: number;
  /** Total tax and NI as a share of gross salary. */
  readonly effectiveRate: number;
  /** Tax, NI and student loan on the next £1 earned. */
  readonly marginalRate: number;
}

/** Working days assumed when showing a daily figure. */
const WORKING_DAYS_PER_YEAR = 260;

/**
 * Full take-home pay calculation.
 *
 * Order matters and is easy to get wrong. Each deduction has its own base:
 *
 *   income tax  — gross, less salary sacrifice and net-pay contributions,
 *                 plus benefits in kind, less the personal allowance
 *   employee NI — gross, less salary sacrifice ONLY. No allowance, no BIK.
 *   student loan— gross, less salary sacrifice ONLY. Rounded down.
 *
 * That is why the same 5% pension contribution produces three different
 * take-home figures depending on the arrangement.
 */
export function calculateTakeHome(input: TakeHomeInput, year: TaxYear): TakeHomeResult {
  const {
    grossSalary,
    region,
    studentLoanPlans,
    overStatePensionAge = false,
    benefitsInKind = 0,
  } = input;

  const pension = resolvePension(grossSalary, input.pension, year);

  // Salary sacrifice is the only arrangement that reduces the NI and student
  // loan base, because the salary is legally never paid.
  const earningsForNi = Math.max(0, grossSalary - pension.reducesGrossForTaxAndNi);

  const incomeTax = calculateIncomeTax(
    {
      grossIncome: grossSalary,
      region,
      deductibleFromGross: pension.reducesGrossForTaxAndNi + pension.reducesGrossForTaxOnly,
      basicRateBandExtension: pension.basicRateBandExtension,
      reducesAdjustedNetIncome:
        pension.reducesAdjustedNetIncome -
        pension.reducesGrossForTaxAndNi -
        pension.reducesGrossForTaxOnly,
      benefitsInKind,
    },
    year,
  );

  const nationalInsurance = calculateEmployeeNi(earningsForNi, year, {
    exempt: overStatePensionAge,
  });

  const nicCap = year.pensions.salarySacrificeNicCap;
  const capApplies =
    (input.applySalarySacrificeNicCap ?? nicCap !== null) &&
    input.pension.method === 'salary-sacrifice';

  // Above the cap, sacrificed salary still escapes income tax but is charged
  // employee NI at the marginal rate.
  let nicCapCharge = 0;
  if (capApplies) {
    const cap = nicCap ?? 2_000;
    const sacrificedAboveCap = Math.max(0, pension.reducesGrossForTaxAndNi - cap);
    const { upperEarningsLimit, mainRate, upperRate } = year.nationalInsurance.employee;
    nicCapCharge =
      sacrificedAboveCap * (earningsForNi >= upperEarningsLimit ? upperRate : mainRate);
  }

  const studentLoans = calculateStudentLoans(earningsForNi, studentLoanPlans, year);

  const niTotal = roundToPence(nationalInsurance.total + nicCapCharge);
  const totalDeductions = roundToPence(
    incomeTax.total + niTotal + studentLoans.total + pension.costToEmployee,
  );
  const takeHomeAnnual = roundToPence(grossSalary - totalDeductions);

  return {
    grossSalary,
    pension,
    incomeTax,
    nationalInsurance: { ...nationalInsurance, total: niTotal },
    studentLoans,
    totalDeductions,
    takeHomeAnnual,
    takeHomeMonthly: roundToPence(takeHomeAnnual / 12),
    takeHomeWeekly: roundToPence(takeHomeAnnual / 52),
    takeHomeDaily: roundToPence(takeHomeAnnual / WORKING_DAYS_PER_YEAR),
    effectiveRate:
      grossSalary > 0 ? (incomeTax.total + niTotal + studentLoans.total) / grossSalary : 0,
    marginalRate: marginalDeductionRate(input, year),
  };
}

/**
 * Deduction rate on the next £1 of salary — tax, NI and student loan combined.
 *
 * Measured with a £100 step rather than £1 because student loan repayments are
 * rounded down to whole pounds; a £1 step reads as 0% almost everywhere.
 */
export function marginalDeductionRate(input: TakeHomeInput, year: TaxYear): number {
  const step = 100;
  const at = (salary: number) => {
    const pension = resolvePension(salary, input.pension, year);
    const earningsForNi = Math.max(0, salary - pension.reducesGrossForTaxAndNi);
    const tax = calculateIncomeTax(
      {
        grossIncome: salary,
        region: input.region,
        deductibleFromGross: pension.reducesGrossForTaxAndNi + pension.reducesGrossForTaxOnly,
        basicRateBandExtension: pension.basicRateBandExtension,
        reducesAdjustedNetIncome:
          pension.reducesAdjustedNetIncome -
          pension.reducesGrossForTaxAndNi -
          pension.reducesGrossForTaxOnly,
        benefitsInKind: input.benefitsInKind ?? 0,
      },
      year,
    ).total;
    const ni = calculateEmployeeNi(earningsForNi, year, {
      exempt: input.overStatePensionAge ?? false,
    }).total;
    const loans = calculateStudentLoans(earningsForNi, input.studentLoanPlans, year).total;
    return tax + ni + loans;
  };

  return (at(input.grossSalary + step) - at(input.grossSalary)) / step;
}
