import type { TaxYear } from '../types';
import { TAX_YEAR_2026_27 } from './2026-27';

/**
 * Every tax year the site knows about.
 *
 * Adding a year: create the data file, import it here, done. No calculator
 * changes — `TaxYear` is the contract and TypeScript enforces completeness.
 */
export const TAX_YEARS: Readonly<Record<string, TaxYear>> = {
  '2026-27': TAX_YEAR_2026_27,
};

export const CURRENT_TAX_YEAR = TAX_YEAR_2026_27;

export function getTaxYear(id: string): TaxYear {
  const year = TAX_YEARS[id];
  if (!year) {
    throw new Error(
      `Unknown tax year "${id}". Known years: ${Object.keys(TAX_YEARS).join(', ')}`,
    );
  }
  return year;
}

export { TAX_YEAR_2026_27 };
