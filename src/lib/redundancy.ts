import type { Region, TaxYear } from '../data/types';
import { roundToPence } from './bands';
import { calculateIncomeTax } from './income-tax';
import { calculateEmployeeNi } from './national-insurance';

export interface RedundancyInput {
  readonly age: number;
  readonly yearsOfService: number;
  readonly weeklyPay: number;
  readonly northernIreland?: boolean;
}

export interface RedundancyBreakdownRow {
  readonly ageDuringYear: number;
  readonly weeks: number;
}

export interface RedundancyResult {
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
  readonly weeklyPayUsed: number;
  readonly weeklyPayCapped: boolean;
  readonly cap: number;
  readonly yearsCounted: number;
  readonly yearsCapped: boolean;
  readonly totalWeeks: number;
  readonly breakdown: readonly RedundancyBreakdownRow[];
  readonly statutoryPay: number;
}

/** Two years' continuous service is the qualifying minimum. */
const MINIMUM_YEARS = 2;

/**
 * Statutory redundancy pay.
 *
 * Weeks are earned per year of service at a rate set by the employee's age
 * *during that year*, not their age when made redundant. Only the most recent
 * 20 years count — which favours the employee, since those are the years most
 * likely to fall in the 1.5-week band.
 *
 * Weekly pay is capped (£751 in Great Britain for 2026/27, £783 in Northern
 * Ireland), so the statutory maximum is 20 × 1.5 × £751 = £22,530.
 */
export function calculateStatutoryRedundancy(
  input: RedundancyInput,
  year: TaxYear,
): RedundancyResult {
  const { age, yearsOfService, weeklyPay, northernIreland = false } = input;
  const {
    weeklyPayCap,
    weeklyPayCapNorthernIreland,
    maximumYears,
    weeksPerYearUnder22,
    weeksPerYear22to40,
    weeksPerYear41Plus,
  } = year.redundancy;

  const cap = northernIreland ? weeklyPayCapNorthernIreland : weeklyPayCap;
  const weeklyPayUsed = Math.min(weeklyPay, cap);

  if (yearsOfService < MINIMUM_YEARS) {
    return {
      eligible: false,
      ineligibleReason: `Statutory redundancy pay needs at least ${MINIMUM_YEARS} years of continuous service.`,
      weeklyPayUsed,
      weeklyPayCapped: weeklyPay > cap,
      cap,
      yearsCounted: 0,
      yearsCapped: false,
      totalWeeks: 0,
      breakdown: [],
      statutoryPay: 0,
    };
  }

  const yearsCounted = Math.min(Math.floor(yearsOfService), maximumYears);
  const breakdown: RedundancyBreakdownRow[] = [];
  let totalWeeks = 0;

  // Walk backwards from the redundancy date, one year of service at a time.
  for (let k = 1; k <= yearsCounted; k += 1) {
    const ageDuringYear = age - k;
    const weeks =
      ageDuringYear >= 41
        ? weeksPerYear41Plus
        : ageDuringYear >= 22
          ? weeksPerYear22to40
          : weeksPerYearUnder22;
    breakdown.push({ ageDuringYear, weeks });
    totalWeeks += weeks;
  }

  return {
    eligible: true,
    ineligibleReason: null,
    weeklyPayUsed,
    weeklyPayCapped: weeklyPay > cap,
    cap,
    yearsCounted,
    yearsCapped: Math.floor(yearsOfService) > maximumYears,
    totalWeeks,
    breakdown,
    statutoryPay: roundToPence(totalWeeks * weeklyPayUsed),
  };
}

export interface TerminationPackageInput {
  /** Statutory or enhanced redundancy pay — qualifies for the exemption. */
  readonly redundancyPay: number;
  /** Payment in lieu of notice. Fully taxable and NI-able under the PENP rules. */
  readonly payInLieuOfNotice?: number;
  /** Outstanding holiday pay. Ordinary earnings — fully taxable. */
  readonly holidayPay?: number;
  /** Other salary paid in the same tax year, which sets the marginal rate. */
  readonly otherIncomeThisTaxYear?: number;
  readonly region?: Region;
}

export interface TerminationPackageResult {
  readonly totalPackage: number;
  readonly exemptAmount: number;
  readonly taxableRedundancy: number;
  readonly fullyTaxableElements: number;
  readonly incomeTax: number;
  readonly nationalInsurance: number;
  readonly netPackage: number;
  readonly exemption: number;
}

/**
 * Tax on a redundancy package.
 *
 * The reason this tool exists: gov.uk's own redundancy calculator returns the
 * statutory entitlement and stops. What people actually want to know is what
 * lands in their account, and the £30,000 exemption is widely misunderstood:
 *
 *  - It covers the redundancy payment, not the whole package.
 *  - Notice pay and holiday pay fall outside it entirely and bear NI too.
 *  - It is one £30,000 across all payments from the same employment.
 */
export function calculateTerminationTax(
  input: TerminationPackageInput,
  year: TaxYear,
): TerminationPackageResult {
  const {
    redundancyPay,
    payInLieuOfNotice = 0,
    holidayPay = 0,
    otherIncomeThisTaxYear = 0,
    region = 'england-nireland',
  } = input;

  const exemption = year.redundancy.terminationPaymentExemption;
  const exemptAmount = Math.min(redundancyPay, exemption);
  const taxableRedundancy = Math.max(0, redundancyPay - exemption);
  const fullyTaxableElements = payInLieuOfNotice + holidayPay;

  // Everything taxable is stacked on top of the year's other income.
  const taxableAddition = taxableRedundancy + fullyTaxableElements;
  const taxBefore = calculateIncomeTax({ grossIncome: otherIncomeThisTaxYear, region }, year).total;
  const taxAfter = calculateIncomeTax(
    { grossIncome: otherIncomeThisTaxYear + taxableAddition, region },
    year,
  ).total;
  const incomeTax = roundToPence(taxAfter - taxBefore);

  // NI applies to notice and holiday pay but not to the redundancy payment,
  // however much of it exceeds £30,000.
  const niBefore = calculateEmployeeNi(otherIncomeThisTaxYear, year).total;
  const niAfter = calculateEmployeeNi(otherIncomeThisTaxYear + fullyTaxableElements, year).total;
  const nationalInsurance = roundToPence(niAfter - niBefore);

  const totalPackage = redundancyPay + fullyTaxableElements;

  return {
    totalPackage: roundToPence(totalPackage),
    exemptAmount: roundToPence(exemptAmount),
    taxableRedundancy: roundToPence(taxableRedundancy),
    fullyTaxableElements: roundToPence(fullyTaxableElements),
    incomeTax,
    nationalInsurance,
    netPackage: roundToPence(totalPackage - incomeTax - nationalInsurance),
    exemption,
  };
}
