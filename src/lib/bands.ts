import type { Band } from '../data/types';

export interface BandCharge {
  readonly label: string;
  readonly rate: number;
  /** Inclusive lower bound of the slice actually used. */
  readonly from: number;
  /** Inclusive upper bound of the slice actually used. */
  readonly to: number;
  /** How much of `amount` fell in this band. */
  readonly amount: number;
  readonly charge: number;
}

/**
 * Apply a progressive band table to an amount.
 *
 * The single place in the codebase that interprets `Band.upTo`. Every
 * progressive tax on the site — income tax, SDLT, LBTT, LTT — routes through
 * here, so a rounding or boundary bug can only exist in one place.
 *
 * Bands whose slice is empty are omitted from the result, which keeps the
 * "how this was worked out" tables on each page free of noise rows.
 */
export function walkBands(amount: number, bands: readonly Band[]): BandCharge[] {
  if (amount <= 0) return [];

  const charges: BandCharge[] = [];
  let lowerBound = 0;

  for (const band of bands) {
    const upperBound = band.upTo ?? Infinity;
    const amountInBand = Math.min(amount, upperBound) - lowerBound;

    if (amountInBand > 0) {
      charges.push({
        label: band.label,
        rate: band.rate,
        from: lowerBound,
        to: Math.min(amount, upperBound),
        amount: amountInBand,
        charge: amountInBand * band.rate,
      });
    }

    lowerBound = upperBound;
    if (amount <= upperBound) break;
  }

  return charges;
}

export function totalCharge(charges: readonly BandCharge[]): number {
  return charges.reduce((sum, c) => sum + c.charge, 0);
}

/**
 * Shift a band table upward by `extension`.
 *
 * Used for relief-at-source pension contributions, which do not reduce taxable
 * income but do widen the basic rate band by the grossed-up contribution.
 */
export function extendBasicRateBand(bands: readonly Band[], extension: number): Band[] {
  if (extension <= 0) return [...bands];
  return bands.map((band) => ({
    ...band,
    upTo: band.upTo === null ? null : band.upTo + extension,
  }));
}

/** Round to whole pence, avoiding binary floating-point drift. */
export function roundToPence(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
