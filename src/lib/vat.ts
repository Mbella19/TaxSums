import type { TaxYear } from '../data/types';
import { roundToPence } from './bands';

export interface FlatRateInput {
  /** Annual turnover excluding VAT. */
  readonly turnoverExVat: number;
  /** The sector percentage from HMRC's table, as a decimal. */
  readonly sectorRate: number;
  /** Annual spend on goods (not services) including VAT. */
  readonly goodsSpendIncVat?: number;
  /** VAT you would reclaim on purchases under standard accounting. */
  readonly reclaimableInputVat?: number;
  /** First year of VAT registration attracts a 1 percentage point discount. */
  readonly firstYearOfRegistration?: boolean;
}

export interface FlatRateResult {
  readonly turnoverExVat: number;
  readonly vatCharged: number;
  readonly grossTurnover: number;
  readonly appliedRate: number;
  readonly isLimitedCostTrader: boolean;
  readonly limitedCostTraderThreshold: number;
  readonly firstYearDiscountApplied: boolean;
  readonly flatRateVatDue: number;
  readonly standardVatDue: number;
  readonly flatRateBetterBy: number;
  readonly betterScheme: 'flat-rate' | 'standard' | 'level';
  readonly eligibleToJoin: boolean;
  readonly mustLeave: boolean;
}

/**
 * VAT Flat Rate Scheme against standard VAT accounting.
 *
 * Under the flat rate scheme you charge customers the normal 20% but hand HMRC
 * a fixed percentage of your VAT-INCLUSIVE turnover, and reclaim nothing on
 * purchases. Two traps:
 *
 *  1. The percentage applies to gross turnover, not net. A "14.5% sector rate"
 *     is really 17.4% of your net sales.
 *  2. If you spend little on goods you are a "limited cost trader" and pay
 *     16.5% regardless of sector — which is 19.8% of net turnover, and almost
 *     always worse than standard accounting. This catches most consultants and
 *     contractors, who were the scheme's main users before 2017.
 */
export function compareFlatRate(input: FlatRateInput, year: TaxYear): FlatRateResult {
  const {
    turnoverExVat,
    sectorRate,
    goodsSpendIncVat = 0,
    reclaimableInputVat = 0,
    firstYearOfRegistration = false,
  } = input;

  const {
    standardRate,
    limitedCostTraderRate,
    limitedCostTraderGoodsPercentage,
    limitedCostTraderGoodsFloor,
    firstYearDiscount,
    flatRateJoinThreshold,
    flatRateLeaveThreshold,
  } = year.vat;

  const vatCharged = turnoverExVat * standardRate;
  const grossTurnover = turnoverExVat + vatCharged;

  // Limited cost trader: goods spend below 2% of gross turnover, or below
  // £1,000 a year, whichever is greater.
  const limitedCostTraderThreshold = Math.max(
    grossTurnover * limitedCostTraderGoodsPercentage,
    limitedCostTraderGoodsFloor,
  );
  const isLimitedCostTrader = goodsSpendIncVat < limitedCostTraderThreshold;

  let appliedRate = isLimitedCostTrader ? limitedCostTraderRate : sectorRate;
  if (firstYearOfRegistration) appliedRate -= firstYearDiscount;

  const flatRateVatDue = grossTurnover * appliedRate;
  const standardVatDue = vatCharged - reclaimableInputVat;
  const flatRateBetterBy = standardVatDue - flatRateVatDue;

  return {
    turnoverExVat,
    vatCharged: roundToPence(vatCharged),
    grossTurnover: roundToPence(grossTurnover),
    appliedRate,
    isLimitedCostTrader,
    limitedCostTraderThreshold: roundToPence(limitedCostTraderThreshold),
    firstYearDiscountApplied: firstYearOfRegistration,
    flatRateVatDue: roundToPence(flatRateVatDue),
    standardVatDue: roundToPence(standardVatDue),
    flatRateBetterBy: roundToPence(flatRateBetterBy),
    betterScheme:
      Math.abs(flatRateBetterBy) < 0.01 ? 'level' : flatRateBetterBy > 0 ? 'flat-rate' : 'standard',
    eligibleToJoin: turnoverExVat <= flatRateJoinThreshold,
    mustLeave: grossTurnover > flatRateLeaveThreshold,
  };
}

/** The flat rate percentage expressed against net turnover, which is the honest comparison. */
export function effectiveRateOnNetTurnover(appliedRate: number, year: TaxYear): number {
  return appliedRate * (1 + year.vat.standardRate);
}

/** HMRC's flat rate percentages by trade sector. */
export const FLAT_RATE_SECTORS: readonly { readonly name: string; readonly rate: number }[] = [
  { name: 'Accountancy or book-keeping', rate: 0.145 },
  { name: 'Advertising', rate: 0.11 },
  { name: 'Agricultural services', rate: 0.11 },
  { name: 'Any other activity not listed elsewhere', rate: 0.12 },
  { name: 'Architect, civil and structural engineer or surveyor', rate: 0.145 },
  { name: 'Boarding or care of animals', rate: 0.12 },
  { name: 'Business services not listed elsewhere', rate: 0.12 },
  { name: 'Catering services including restaurants and takeaways', rate: 0.125 },
  { name: 'Computer and IT consultancy or data processing', rate: 0.145 },
  { name: 'Computer repair services', rate: 0.105 },
  { name: 'Entertainment or journalism', rate: 0.125 },
  { name: 'Estate agency or property management services', rate: 0.12 },
  { name: 'Farming or agriculture not listed elsewhere', rate: 0.065 },
  { name: 'Film, radio, television or video production', rate: 0.13 },
  { name: 'Financial services', rate: 0.135 },
  { name: 'Forestry or fishing', rate: 0.105 },
  { name: 'General building or construction services', rate: 0.095 },
  { name: 'Hairdressing or other beauty treatment services', rate: 0.13 },
  { name: 'Hiring or renting goods', rate: 0.095 },
  { name: 'Hotel or accommodation', rate: 0.105 },
  { name: 'Investigation or security', rate: 0.12 },
  { name: 'Labour-only building or construction services', rate: 0.145 },
  { name: 'Laundry or dry-cleaning services', rate: 0.12 },
  { name: 'Lawyer or legal services', rate: 0.145 },
  { name: 'Library, archive, museum or other cultural activity', rate: 0.095 },
  { name: 'Management consultancy', rate: 0.14 },
  { name: 'Manufacturing fabricated metal products', rate: 0.105 },
  { name: 'Manufacturing food', rate: 0.09 },
  { name: 'Manufacturing not listed elsewhere', rate: 0.095 },
  { name: 'Manufacturing yarn, textiles or clothing', rate: 0.09 },
  { name: 'Membership organisation', rate: 0.08 },
  { name: 'Mining or quarrying', rate: 0.1 },
  { name: 'Packaging', rate: 0.09 },
  { name: 'Photography', rate: 0.11 },
  { name: 'Post offices', rate: 0.05 },
  { name: 'Printing', rate: 0.085 },
  { name: 'Publishing', rate: 0.11 },
  { name: 'Pubs', rate: 0.065 },
  { name: 'Real estate activity not listed elsewhere', rate: 0.14 },
  { name: 'Repairing personal or household goods', rate: 0.1 },
  { name: 'Repairing vehicles', rate: 0.085 },
  { name: 'Retailing food, confectionery, tobacco, newspapers or children’s clothing', rate: 0.04 },
  { name: 'Retailing pharmaceuticals, medical goods, cosmetics or toiletries', rate: 0.08 },
  { name: 'Retailing not listed elsewhere', rate: 0.075 },
  { name: 'Retailing vehicles or fuel', rate: 0.065 },
  { name: 'Secretarial services', rate: 0.13 },
  { name: 'Social work', rate: 0.11 },
  { name: 'Sport or recreation', rate: 0.085 },
  { name: 'Transport or storage, including couriers, freight, removals and taxis', rate: 0.1 },
  { name: 'Travel agency', rate: 0.105 },
  { name: 'Veterinary medicine', rate: 0.11 },
  { name: 'Wholesaling agricultural products', rate: 0.08 },
  { name: 'Wholesaling food', rate: 0.075 },
  { name: 'Wholesaling not listed elsewhere', rate: 0.085 },
];
