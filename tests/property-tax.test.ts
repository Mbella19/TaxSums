import { describe, expect, it } from 'vitest';
import { TAX_YEAR_2026_27 as YEAR } from '../src/data/tax-years';
import { calculatePropertyTax, firstTimeBuyerCliff } from '../src/lib/property-tax';

const sdlt = (price: number, opts = {}) =>
  calculatePropertyTax({ price, region: 'england-nireland', ...opts }, YEAR).total;
const lbtt = (price: number, opts = {}) =>
  calculatePropertyTax({ price, region: 'scotland', ...opts }, YEAR).total;
const ltt = (price: number, opts = {}) =>
  calculatePropertyTax({ price, region: 'wales', ...opts }, YEAR).total;

describe('SDLT — England and Northern Ireland', () => {
  it('charges nothing up to the nil rate band', () => {
    expect(sdlt(125_000)).toBe(0);
  });

  it('works through the bands', () => {
    // 125,000 × 2%.
    expect(sdlt(250_000)).toBe(2_500);
    // 2,500 + 250,000 × 5%.
    expect(sdlt(500_000)).toBe(15_000);
    // 2,500 + 675,000 × 5%.
    expect(sdlt(925_000)).toBe(36_250);
  });

  it('adds 5 percentage points to every band for an additional property', () => {
    // Equivalent to the standard charge plus 5% of the whole price.
    expect(sdlt(300_000, { additionalProperty: true })).toBe(sdlt(300_000) + 15_000);
    expect(sdlt(300_000, { additionalProperty: true })).toBe(20_000);
  });

  it('does not apply the surcharge below £40,000', () => {
    expect(sdlt(35_000, { additionalProperty: true })).toBe(0);
  });

  it('adds a further 2% for non-UK residents', () => {
    expect(sdlt(300_000, { nonUkResident: true })).toBe(sdlt(300_000) + 6_000);
  });

  it('stacks the additional property and non-resident surcharges', () => {
    // 5% + 2% on top of the standard bands.
    expect(sdlt(300_000, { additionalProperty: true, nonUkResident: true })).toBe(
      sdlt(300_000) + 21_000,
    );
  });
});

describe('SDLT first-time buyer relief and its cliff edge', () => {
  it('charges nothing up to £300,000', () => {
    expect(sdlt(300_000, { firstTimeBuyer: true })).toBe(0);
  });

  it('charges 5% between £300,000 and £500,000', () => {
    expect(sdlt(500_000, { firstTimeBuyer: true })).toBe(10_000);
  });

  it('withdraws the relief entirely one pound over the limit', () => {
    const atLimit = sdlt(500_000, { firstTimeBuyer: true });
    const justOver = sdlt(500_001, { firstTimeBuyer: true });

    expect(atLimit).toBe(10_000);
    expect(justOver).toBe(15_000.05);
    // One pound more on the price costs £5,000 in tax.
    expect(justOver - atLimit).toBeCloseTo(5_000.05, 2);
  });

  it('reports the cliff so the page can warn about it', () => {
    const cliff = firstTimeBuyerCliff('england-nireland', YEAR);
    expect(cliff).toEqual({
      limit: 500_000,
      taxAtLimit: 10_000,
      taxJustAbove: 15_000.05,
      jump: 5_000.05,
    });
  });

  it('explains what was lost when the buyer is over the limit', () => {
    const result = calculatePropertyTax(
      { price: 550_000, region: 'england-nireland', firstTimeBuyer: true },
      YEAR,
    );
    expect(result.firstTimeBuyerReliefApplied).toBe(false);
    expect(result.firstTimeBuyerReliefLost?.maximumPrice).toBe(500_000);
    expect(result.firstTimeBuyerReliefLost?.extraTaxFromLosingRelief).toBeGreaterThan(0);
  });

  it('ignores the relief for someone buying an additional property', () => {
    expect(sdlt(300_000, { firstTimeBuyer: true, additionalProperty: true })).toBe(20_000);
  });
});

describe('LBTT — Scotland', () => {
  it('charges nothing up to £145,000', () => {
    expect(lbtt(145_000)).toBe(0);
  });

  it('works through the bands', () => {
    // 105,000 × 2%.
    expect(lbtt(250_000)).toBe(2_100);
    // 2,100 + 75,000 × 5%.
    expect(lbtt(325_000)).toBe(5_850);
    // 5,850 + 175,000 × 10%.
    expect(lbtt(500_000)).toBe(23_350);
  });

  it('charges ADS as a flat 8% of the whole price, not per band', () => {
    const result = calculatePropertyTax(
      { price: 300_000, region: 'scotland', additionalProperty: true },
      YEAR,
    );
    expect(result.flatSurcharge).toBe(24_000);
    expect(result.total).toBe(4_600 + 24_000);
  });

  it('applies first-time buyer relief with no upper price limit', () => {
    // Unlike England, a £600,000 Scottish purchase still gets the relief.
    const relieved = lbtt(600_000, { firstTimeBuyer: true });
    expect(relieved).toBe(lbtt(600_000) - 600);
    expect(firstTimeBuyerCliff('scotland', YEAR)).toBeNull();
  });

  it('caps the first-time buyer saving at £600', () => {
    expect(lbtt(200_000) - lbtt(200_000, { firstTimeBuyer: true })).toBe(600);
  });

  it('has no non-resident surcharge', () => {
    expect(lbtt(300_000, { nonUkResident: true })).toBe(lbtt(300_000));
  });
});

describe('LTT — Wales', () => {
  it('has the highest nil rate band in the UK', () => {
    expect(ltt(225_000)).toBe(0);
    // A price that would attract SDLT in England is free in Wales.
    expect(sdlt(225_000)).toBeGreaterThan(0);
  });

  it('works through the main bands', () => {
    // 175,000 × 6%.
    expect(ltt(400_000)).toBe(10_500);
    // 10,500 + 350,000 × 7.5%.
    expect(ltt(750_000)).toBe(36_750);
  });

  it('uses an entirely separate band table for additional properties', () => {
    // 180,000 × 5% + 70,000 × 8.5% + 50,000 × 10%.
    expect(ltt(300_000, { additionalProperty: true })).toBe(9_000 + 5_950 + 5_000);
  });

  it('charges the higher rates from the first pound, with no nil band', () => {
    expect(ltt(150_000, { additionalProperty: true })).toBe(7_500);
    expect(ltt(150_000)).toBe(0);
  });

  it('has no first-time buyer relief', () => {
    expect(ltt(300_000, { firstTimeBuyer: true })).toBe(ltt(300_000));
    expect(firstTimeBuyerCliff('wales', YEAR)).toBeNull();
  });
});

describe('cross-nation comparison', () => {
  it('produces genuinely different bills on the same price', () => {
    const price = 400_000;
    expect(sdlt(price)).toBe(10_000);
    expect(lbtt(price)).toBe(13_350);
    expect(ltt(price)).toBe(10_500);
  });
});
