import type { Band, PropertyTaxRules, Region, TaxYear } from '../data/types';
import { roundToPence, totalCharge, walkBands, type BandCharge } from './bands';

export interface PropertyTaxInput {
  readonly price: number;
  readonly region: Region;
  /** Buying while already owning another dwelling anywhere in the world. */
  readonly additionalProperty?: boolean;
  readonly firstTimeBuyer?: boolean;
  /** England and Northern Ireland only. */
  readonly nonUkResident?: boolean;
}

export interface PropertyTaxResult {
  readonly rules: PropertyTaxRules;
  readonly price: number;
  readonly bands: readonly BandCharge[];
  /** Scotland's ADS is a separate flat charge rather than a band adjustment. */
  readonly flatSurcharge: number;
  readonly flatSurchargeLabel: string | null;
  readonly total: number;
  readonly effectiveRate: number;
  /** True when first-time buyer relief was actually applied. */
  readonly firstTimeBuyerReliefApplied: boolean;
  /**
   * Set when the buyer says they are a first-time buyer but the price is above
   * the relief's cut-off. Drives the cliff-edge warning, which is the single
   * most valuable thing this calculator can tell someone.
   */
  readonly firstTimeBuyerReliefLost: {
    readonly maximumPrice: number;
    readonly taxIfPriceWereAtLimit: number;
    readonly extraTaxFromLosingRelief: number;
  } | null;
}

/** Add a flat percentage to every band, including the nil-rate band. */
function addSurcharge(bands: readonly Band[], surcharge: number): Band[] {
  return bands.map((band) => ({ ...band, rate: band.rate + surcharge }));
}

/**
 * Stamp duty across all three UK regimes.
 *
 * The nations do not merely use different numbers — they use different shapes,
 * which is why one generic "stamp duty calculator" so often gets the devolved
 * cases wrong:
 *
 *   England/NI  SDLT  additional property adds 5pp to every band
 *   Scotland    LBTT  ADS is a flat 8% of the whole price, charged separately
 *   Wales       LTT   additional property uses an entirely different table
 *
 * First-time buyer relief differs again: England caps it at £500,000 with a
 * hard cliff, Scotland has no cap at all, and Wales has no relief.
 */
export function calculatePropertyTax(input: PropertyTaxInput, year: TaxYear): PropertyTaxResult {
  const { price, region, additionalProperty = false, firstTimeBuyer = false, nonUkResident = false } = input;
  const rules = year.propertyTax[region];

  const relief = rules.firstTimeBuyerRelief;
  const wantsRelief = firstTimeBuyer && !additionalProperty && relief !== null;
  const reliefWithinLimit =
    wantsRelief && (relief.maximumPrice === null || price <= relief.maximumPrice);

  let bands: readonly Band[];
  let flatSurcharge = 0;
  let flatSurchargeLabel: string | null = null;

  if (reliefWithinLimit) {
    bands = relief.bands;
  } else if (additionalProperty && price >= rules.additionalProperty.minimumPrice) {
    switch (rules.additionalProperty.kind) {
      case 'surcharge':
        bands = addSurcharge(rules.standardBands, rules.additionalProperty.rate);
        break;
      case 'separate-bands':
        bands = rules.additionalProperty.bands;
        break;
      case 'flat':
        bands = rules.standardBands;
        flatSurcharge = price * rules.additionalProperty.rate;
        flatSurchargeLabel = `Additional Dwelling Supplement (${(rules.additionalProperty.rate * 100).toFixed(0)}% of the full price)`;
        break;
    }
  } else {
    bands = rules.standardBands;
  }

  if (nonUkResident && rules.nonResidentSurcharge !== null) {
    bands = addSurcharge(bands, rules.nonResidentSurcharge);
  }

  const charges = walkBands(price, bands);
  const total = roundToPence(totalCharge(charges) + flatSurcharge);

  // Work out what the cliff cost them, if they fell off it.
  let firstTimeBuyerReliefLost: PropertyTaxResult['firstTimeBuyerReliefLost'] = null;
  if (wantsRelief && !reliefWithinLimit && relief.maximumPrice !== null) {
    const atLimit = roundToPence(totalCharge(walkBands(relief.maximumPrice, relief.bands)));
    const standardHere = roundToPence(totalCharge(walkBands(price, rules.standardBands)));
    const reliefValueHere = roundToPence(
      standardHere - totalCharge(walkBands(price, relief.bands)),
    );
    firstTimeBuyerReliefLost = {
      maximumPrice: relief.maximumPrice,
      taxIfPriceWereAtLimit: atLimit,
      extraTaxFromLosingRelief: reliefValueHere,
    };
  }

  return {
    rules,
    price,
    bands: charges,
    flatSurcharge: roundToPence(flatSurcharge),
    flatSurchargeLabel,
    total,
    effectiveRate: price > 0 ? total / price : 0,
    firstTimeBuyerReliefApplied: reliefWithinLimit,
    firstTimeBuyerReliefLost,
  };
}

/**
 * The price just below a first-time buyer cliff where the tax jumps.
 *
 * England's relief vanishes entirely at £500,000.01 rather than tapering, so a
 * £1 increase in an offer can cost £5,000. Returns null where no cliff exists.
 */
export function firstTimeBuyerCliff(
  region: Region,
  year: TaxYear,
): { readonly limit: number; readonly taxAtLimit: number; readonly taxJustAbove: number; readonly jump: number } | null {
  const rules = year.propertyTax[region];
  const relief = rules.firstTimeBuyerRelief;
  if (!relief || relief.maximumPrice === null) return null;

  const taxAtLimit = roundToPence(totalCharge(walkBands(relief.maximumPrice, relief.bands)));
  const taxJustAbove = roundToPence(
    totalCharge(walkBands(relief.maximumPrice + 1, rules.standardBands)),
  );

  return {
    limit: relief.maximumPrice,
    taxAtLimit,
    taxJustAbove,
    jump: roundToPence(taxJustAbove - taxAtLimit),
  };
}
