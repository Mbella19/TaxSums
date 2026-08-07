import type { Region, TaxYear } from '../data/types';
import { roundToPence } from './bands';
import { calculateIncomeTax, personalAllowanceFor } from './income-tax';

export interface PropertyGainInput {
  readonly salePrice: number;
  readonly purchasePrice: number;
  /** Capital improvements — extensions, new kitchen. Not repairs or decorating. */
  readonly improvementCosts?: number;
  /** Legal fees, estate agent fees, stamp duty paid on purchase, survey fees. */
  readonly buyingAndSellingCosts?: number;
  /** Total months owned. */
  readonly monthsOwned?: number;
  /** Months it was your only or main residence. */
  readonly monthsAsMainResidence?: number;
  /** Other taxable income in the year of disposal, which sets the CGT rate. */
  readonly annualIncome: number;
  readonly region?: Region;
  /** Split the gain between joint owners, each with their own exemption. */
  readonly owners?: number;
}

export interface PropertyGainResult {
  readonly grossGain: number;
  readonly privateResidenceRelief: number;
  readonly gainAfterRelief: number;
  readonly annualExemptAmount: number;
  readonly taxableGain: number;
  readonly basicRateGain: number;
  readonly basicRateTax: number;
  readonly higherRateGain: number;
  readonly higherRateTax: number;
  readonly totalTax: number;
  readonly netProceeds: number;
  readonly effectiveRate: number;
  readonly perOwner: boolean;
  readonly reportingDeadlineDays: number;
}

/**
 * The final period of ownership always qualifies for Private Residence Relief,
 * even if you had already moved out.
 */
const FINAL_PERIOD_EXEMPTION_MONTHS = 9;

/**
 * Capital Gains Tax on residential property.
 *
 * Residential property is taxed at 18% and 24% rather than the rates that apply
 * to other assets, and the gain stacks on top of income — so a large gain is
 * routinely taxed partly at each rate. Calculators that apply a single rate to
 * the whole gain overstate the bill for most basic rate taxpayers and
 * understate it for some.
 *
 * A residential property gain must be reported and paid within 60 days of
 * completion, separately from the Self Assessment return.
 */
export function calculatePropertyGain(
  input: PropertyGainInput,
  year: TaxYear,
): PropertyGainResult {
  const {
    salePrice,
    purchasePrice,
    improvementCosts = 0,
    buyingAndSellingCosts = 0,
    monthsOwned = 0,
    monthsAsMainResidence = 0,
    annualIncome,
    region = 'england-nireland',
    owners = 1,
  } = input;

  const grossGain = Math.max(0, salePrice - purchasePrice - improvementCosts - buyingAndSellingCosts);

  // Private Residence Relief is time-apportioned, plus the final 9 months.
  let privateResidenceRelief = 0;
  if (monthsOwned > 0 && monthsAsMainResidence > 0) {
    const qualifyingMonths = Math.min(
      monthsOwned,
      monthsAsMainResidence + FINAL_PERIOD_EXEMPTION_MONTHS,
    );
    privateResidenceRelief = (grossGain * qualifyingMonths) / monthsOwned;
  }

  const gainAfterRelief = Math.max(0, grossGain - privateResidenceRelief);

  // Each owner gets their own annual exempt amount and their own band space.
  const gainPerOwner = gainAfterRelief / Math.max(1, owners);
  const { annualExemptAmount, residentialBasicRate, residentialHigherRate, propertyReportingDays } =
    year.capitalGains;

  const taxableGainPerOwner = Math.max(0, gainPerOwner - annualExemptAmount);

  // Headroom left in the basic rate band after income.
  const allowance = personalAllowanceFor(annualIncome, year);
  const taxableIncome = Math.max(0, annualIncome - allowance);
  const basicRateLimit = year.incomeTax.bands[region][0]!.upTo ?? 0;
  const headroom = Math.max(0, basicRateLimit - taxableIncome);

  const basicRateGain = Math.min(taxableGainPerOwner, headroom);
  const higherRateGain = Math.max(0, taxableGainPerOwner - basicRateGain);

  const basicRateTax = basicRateGain * residentialBasicRate;
  const higherRateTax = higherRateGain * residentialHigherRate;
  const totalTaxPerOwner = basicRateTax + higherRateTax;
  const totalTax = totalTaxPerOwner * Math.max(1, owners);

  return {
    grossGain: roundToPence(grossGain),
    privateResidenceRelief: roundToPence(privateResidenceRelief),
    gainAfterRelief: roundToPence(gainAfterRelief),
    annualExemptAmount,
    taxableGain: roundToPence(taxableGainPerOwner * Math.max(1, owners)),
    basicRateGain: roundToPence(basicRateGain),
    basicRateTax: roundToPence(basicRateTax),
    higherRateGain: roundToPence(higherRateGain),
    higherRateTax: roundToPence(higherRateTax),
    totalTax: roundToPence(totalTax),
    netProceeds: roundToPence(grossGain - totalTax),
    effectiveRate: grossGain > 0 ? totalTax / grossGain : 0,
    perOwner: owners > 1,
    reportingDeadlineDays: propertyReportingDays,
  };
}

/** Silence an unused-import warning while keeping the helper available. */
export const _incomeTaxHelper = calculateIncomeTax;
