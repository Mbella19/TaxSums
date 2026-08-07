import type { Region, TaxYear } from '../data/types';
import { extendBasicRateBand, roundToPence, totalCharge, walkBands, type BandCharge } from './bands';

export interface IncomeTaxInput {
  /** Employment income before any deduction. */
  readonly grossIncome: number;
  readonly region: Region;
  /**
   * Deducted from gross income before tax is calculated: salary sacrifice and
   * net-pay pension contributions, and anything else relieved at source.
   */
  readonly deductibleFromGross?: number;
  /**
   * Grossed-up relief-at-source pension contributions. These do NOT reduce
   * taxable income; they widen the basic rate band by this amount.
   */
  readonly basicRateBandExtension?: number;
  /**
   * Reduces adjusted net income for the personal allowance taper only.
   * Relief-at-source contributions belong here as well as in
   * `basicRateBandExtension` — they cut adjusted net income without cutting
   * taxable income, which is what makes the £100k trap escapable.
   */
  readonly reducesAdjustedNetIncome?: number;
  /** Taxable benefits in kind. Taxed as income but bear no employee NI. */
  readonly benefitsInKind?: number;
}

export interface IncomeTaxResult {
  readonly grossIncome: number;
  readonly personalAllowance: number;
  readonly personalAllowanceLost: number;
  readonly adjustedNetIncome: number;
  readonly taxableIncome: number;
  readonly bands: readonly BandCharge[];
  readonly total: number;
}

/**
 * The personal allowance tapers away above £100,000 of adjusted net income,
 * at £1 for every £2 over. Between £100,000 and £125,140 that produces a 60%
 * marginal rate in England, Wales and Northern Ireland (and 67.5% in Scotland
 * at the advanced rate) — the "£100k tax trap".
 */
export function personalAllowanceFor(adjustedNetIncome: number, year: TaxYear): number {
  const { personalAllowance, taperThreshold, taperDivisor } = year.incomeTax;
  if (adjustedNetIncome <= taperThreshold) return personalAllowance;
  const reduction = (adjustedNetIncome - taperThreshold) / taperDivisor;
  return Math.max(0, personalAllowance - reduction);
}

export function calculateIncomeTax(input: IncomeTaxInput, year: TaxYear): IncomeTaxResult {
  const {
    grossIncome,
    region,
    deductibleFromGross = 0,
    basicRateBandExtension = 0,
    reducesAdjustedNetIncome = 0,
    benefitsInKind = 0,
  } = input;

  const incomeAfterDeductions = Math.max(0, grossIncome - deductibleFromGross) + benefitsInKind;
  const adjustedNetIncome = Math.max(0, incomeAfterDeductions - reducesAdjustedNetIncome);

  const fullAllowance = year.incomeTax.personalAllowance;
  const personalAllowance = personalAllowanceFor(adjustedNetIncome, year);
  const taxableIncome = Math.max(0, incomeAfterDeductions - personalAllowance);

  const bandTable = year.incomeTax.bands[region];
  const bands = walkBands(
    taxableIncome,
    basicRateBandExtension > 0 ? extendBasicRateBand(bandTable, basicRateBandExtension) : bandTable,
  );

  return {
    grossIncome,
    personalAllowance: roundToPence(personalAllowance),
    personalAllowanceLost: roundToPence(fullAllowance - personalAllowance),
    adjustedNetIncome: roundToPence(adjustedNetIncome),
    taxableIncome: roundToPence(taxableIncome),
    bands,
    total: roundToPence(totalCharge(bands)),
  };
}

/**
 * Effective tax rate on the next £1 earned. Drives the "£100k trap" chart and
 * the marginal-rate readout, which is the figure that actually changes people's
 * decisions about pension contributions.
 */
export function marginalRate(input: IncomeTaxInput, year: TaxYear): number {
  const step = 1;
  const base = calculateIncomeTax(input, year).total;
  const stepped = calculateIncomeTax(
    { ...input, grossIncome: input.grossIncome + step },
    year,
  ).total;
  return (stepped - base) / step;
}
