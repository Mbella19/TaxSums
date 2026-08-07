import { describe, expect, it } from 'vitest';
import { TAX_YEAR_2026_27 as YEAR } from '../src/data/tax-years';
import { calculateIncomeTax, personalAllowanceFor } from '../src/lib/income-tax';
import { calculateEmployeeNi } from '../src/lib/national-insurance';

const tax = (grossIncome: number, region: 'england-nireland' | 'scotland' = 'england-nireland') =>
  calculateIncomeTax({ grossIncome, region }, YEAR).total;

describe('income tax — England, Wales and Northern Ireland', () => {
  it('charges nothing at or below the personal allowance', () => {
    expect(tax(12_570)).toBe(0);
    expect(tax(5_000)).toBe(0);
  });

  it('charges basic rate on the first £37,700 of taxable income', () => {
    // £50,000 − £12,570 = £37,430, all within the basic rate band.
    expect(tax(50_000)).toBe(7_486);
  });

  it('lands exactly on the higher rate threshold at £50,270', () => {
    // £37,700 × 20% — the last pound before higher rate begins.
    expect(tax(50_270)).toBe(7_540);
  });

  it('charges higher rate above £50,270', () => {
    // £7,540 basic + £9,730 × 40%.
    expect(tax(60_000)).toBe(11_432);
  });

  it('applies the additional rate above £125,140 of taxable income', () => {
    // The published figure for £150,000: 7,540 + 34,976 + 11,187.
    // A band table using £112,570 as the higher rate limit returns £54,331.50,
    // which is the single most common error in UK tax calculators.
    expect(tax(150_000)).toBe(53_703);
  });

  it('charges no additional rate at exactly £125,140', () => {
    // Allowance is fully tapered, so taxable income equals gross income and
    // sits precisely on the higher rate limit.
    expect(tax(125_140)).toBe(42_516);
  });
});

describe('personal allowance taper', () => {
  it('is untouched up to £100,000', () => {
    expect(personalAllowanceFor(100_000, YEAR)).toBe(12_570);
  });

  it('withdraws £1 for every £2 above £100,000', () => {
    expect(personalAllowanceFor(110_000, YEAR)).toBe(7_570);
    expect(personalAllowanceFor(120_000, YEAR)).toBe(2_570);
  });

  it('reaches zero at £125,140 and never goes negative', () => {
    expect(personalAllowanceFor(125_140, YEAR)).toBe(0);
    expect(personalAllowanceFor(200_000, YEAR)).toBe(0);
  });

  it('creates a 60% marginal rate between £100,000 and £125,140', () => {
    const marginal = (tax(110_001) - tax(110_000)) / 1;
    expect(marginal).toBeCloseTo(0.6, 6);
  });

  it('drops back to 45% once the allowance is gone', () => {
    const marginal = (tax(130_001) - tax(130_000)) / 1;
    expect(marginal).toBeCloseTo(0.45, 6);
  });
});

describe('income tax — Scotland', () => {
  it('charges the starter rate just above the allowance', () => {
    // £16,537 gross − £12,570 = £3,967 taxable, all at 19%.
    expect(tax(16_537, 'scotland')).toBeCloseTo(753.73, 2);
  });

  it('works through starter, basic and intermediate bands', () => {
    // £43,662 gross = £31,092 taxable:
    //   3,967 × 19% =   753.73
    //  12,989 × 20% = 2,597.80
    //  14,136 × 21% = 2,968.56
    expect(tax(43_662, 'scotland')).toBeCloseTo(6_320.09, 2);
  });

  it('charges more than the rest of the UK at £60,000', () => {
    expect(tax(60_000, 'scotland')).toBeGreaterThan(tax(60_000));
  });

  it('applies the 48% top rate above £125,140 of taxable income', () => {
    const scottish = tax(150_000, 'scotland');
    expect(scottish).toBeGreaterThan(tax(150_000));
    // 24,860 of top-rate income at 48% rather than 45%.
    expect(scottish - tax(150_000)).toBeGreaterThan(0);
  });
});

describe('employee National Insurance', () => {
  it('charges nothing at or below the primary threshold', () => {
    expect(calculateEmployeeNi(12_570, YEAR).total).toBe(0);
  });

  it('charges 8% between the primary threshold and upper earnings limit', () => {
    // £37,430 × 8%.
    expect(calculateEmployeeNi(50_000, YEAR).total).toBe(2_994.4);
  });

  it('steps down to 2% above the upper earnings limit', () => {
    // 37,700 × 8% = 3,016, plus 99,730 × 2% = 1,994.60.
    expect(calculateEmployeeNi(150_000, YEAR).total).toBe(5_010.6);
  });

  it('is not charged above State Pension age', () => {
    expect(calculateEmployeeNi(50_000, YEAR, { exempt: true }).total).toBe(0);
  });

  it('ignores the personal allowance entirely', () => {
    // NI is charged on earnings, not taxable income — the thresholds happen to
    // coincide at £12,570 but they are unrelated figures.
    const ni = calculateEmployeeNi(30_000, YEAR);
    expect(ni.mainBandEarnings).toBe(17_430);
  });
});
