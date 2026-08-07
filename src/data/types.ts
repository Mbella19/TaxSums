/**
 * The shape every tax year must satisfy.
 *
 * This is the site's moat. Rates change every Budget; the calculators must not.
 * A new tax year is a new file in `src/data/tax-years/` implementing `TaxYear` —
 * no calculator code changes, and TypeScript will refuse to compile a year that
 * has forgotten a field.
 */

/**
 * One slice of a progressive scale.
 *
 * `upTo` is the INCLUSIVE upper bound of the band, expressed in whatever the
 * scale measures (taxable income after allowances for income tax; gross
 * consideration for property taxes). `null` means "and everything above".
 *
 * Bands must be listed in ascending order with no gaps. `walkBands` in
 * src/lib/bands.ts is the only place that interprets them.
 */
export interface Band {
  readonly upTo: number | null;
  /** Decimal fraction, e.g. 0.2 for 20%. */
  readonly rate: number;
  readonly label: string;
}

/** Where a figure came from, so the page can cite it and show its age. */
export interface Source {
  readonly title: string;
  readonly url: string;
  /** ISO date the figure was last checked against the source. */
  readonly verifiedOn: string;
}

/** Which income tax regime applies. Wales sets rates equal to rUK for 2026/27. */
export type Region = 'england-nireland' | 'scotland' | 'wales';

export type StudentLoanPlan = 'plan1' | 'plan2' | 'plan4' | 'plan5';
export type PostgradPlan = 'postgrad';
export type LoanPlan = StudentLoanPlan | PostgradPlan;

export interface LoanPlanRates {
  readonly label: string;
  readonly threshold: number;
  readonly rate: number;
  readonly description: string;
}

export interface IncomeTax {
  readonly personalAllowance: number;
  /** Adjusted net income at which the personal allowance starts to taper. */
  readonly taperThreshold: number;
  /** £1 of allowance lost per £`taperDivisor` over the threshold. */
  readonly taperDivisor: number;
  /** Bands measured on taxable income (i.e. after the personal allowance). */
  readonly bands: Readonly<Record<Region, readonly Band[]>>;
  readonly dividend: {
    readonly allowance: number;
    readonly ordinaryRate: number;
    readonly upperRate: number;
    readonly additionalRate: number;
  };
  readonly savings: {
    /** Personal savings allowance by taxpayer marginal band. */
    readonly allowanceBasic: number;
    readonly allowanceHigher: number;
    readonly allowanceAdditional: number;
    /** 0% starter rate band for savings, reduced by non-savings income. */
    readonly starterRateBand: number;
  };
}

export interface NationalInsurance {
  readonly lowerEarningsLimit: number;
  readonly employee: {
    readonly primaryThreshold: number;
    readonly upperEarningsLimit: number;
    readonly mainRate: number;
    readonly upperRate: number;
  };
  readonly employer: {
    readonly secondaryThreshold: number;
    readonly rate: number;
    readonly employmentAllowance: number;
    /** Class 1A on benefits in kind. */
    readonly class1aRate: number;
    /** Under-21s and apprentices under 25 attract no employer NI below this. */
    readonly upperSecondaryThreshold: number;
  };
  readonly selfEmployed: {
    readonly class4LowerLimit: number;
    readonly class4UpperLimit: number;
    readonly class4MainRate: number;
    readonly class4UpperRate: number;
    readonly smallProfitsThreshold: number;
    readonly class2VoluntaryWeekly: number;
  };
}

export interface Pensions {
  readonly annualAllowance: number;
  readonly taperAdjustedIncomeThreshold: number;
  readonly taperThresholdIncome: number;
  readonly minimumTaperedAllowance: number;
  readonly moneyPurchaseAnnualAllowance: number;
  /**
   * Announced at Autumn Budget 2025: NI relief on salary-sacrificed pension
   * contributions capped at £2,000/yr. Null until it takes effect in 2029/30 —
   * the take-home calculator offers it as a "what will change" toggle.
   */
  readonly salarySacrificeNicCap: number | null;
}

export interface PropertyTaxRules {
  readonly name: string;
  readonly abbreviation: string;
  readonly authority: string;
  readonly standardBands: readonly Band[];
  /**
   * Additional-property treatment differs by nation:
   *  - 'surcharge': flat % added to every band (England/NI: 5%).
   *  - 'flat': flat % of the whole price, charged alongside the standard
   *    calculation (Scotland ADS: 8%).
   *  - 'separate-bands': an entirely different band table (Wales).
   */
  readonly additionalProperty:
    | { readonly kind: 'surcharge'; readonly rate: number; readonly minimumPrice: number }
    | { readonly kind: 'flat'; readonly rate: number; readonly minimumPrice: number }
    | { readonly kind: 'separate-bands'; readonly bands: readonly Band[]; readonly minimumPrice: number };
  /** Extra percentage points for non-UK-resident buyers, if the nation has one. */
  readonly nonResidentSurcharge: number | null;
  readonly firstTimeBuyerRelief:
    | {
        readonly nilRateBand: number;
        /** Above this price the relief is lost entirely, not tapered. Null = no cap. */
        readonly maximumPrice: number | null;
        readonly bands: readonly Band[];
      }
    | null;
}

export interface CapitalGains {
  readonly annualExemptAmount: number;
  readonly residentialBasicRate: number;
  readonly residentialHigherRate: number;
  readonly otherBasicRate: number;
  readonly otherHigherRate: number;
  /** Days from completion to report and pay residential property gains. */
  readonly propertyReportingDays: number;
}

export interface CorporationTax {
  readonly smallProfitsRate: number;
  readonly mainRate: number;
  readonly lowerLimit: number;
  readonly upperLimit: number;
  /** Marginal relief fraction, e.g. 3/200. */
  readonly marginalReliefFraction: number;
}

export interface Redundancy {
  /** Great Britain weekly pay cap. */
  readonly weeklyPayCap: number;
  /** Northern Ireland sets its own, higher, cap. */
  readonly weeklyPayCapNorthernIreland: number;
  readonly maximumYears: number;
  readonly weeksPerYearUnder22: number;
  readonly weeksPerYear22to40: number;
  readonly weeksPerYear41Plus: number;
  /** Tax-free threshold for qualifying termination payments. */
  readonly terminationPaymentExemption: number;
}

export interface CompanyCars {
  /** Appropriate percentage for zero-emission cars. */
  readonly zeroEmissionPercentage: number;
  /** Plug-in hybrids (1–50 g/km) banded by electric-only range in miles. */
  readonly hybridBands: readonly {
    readonly minElectricRange: number;
    readonly maxElectricRange: number | null;
    readonly percentage: number;
  }[];
  /** Petrol and non-RDE2 diesel ladder by CO2 g/km. */
  readonly co2Bands: readonly { readonly upTo: number | null; readonly percentage: number }[];
  /** Added for diesels not meeting RDE2, capped at `maximumPercentage`. */
  readonly dieselSupplement: number;
  readonly maximumPercentage: number;
  readonly fuelBenefitMultiplier: number;
  readonly vanBenefitCharge: number;
  readonly vanFuelBenefitCharge: number;
}

export interface Vat {
  readonly standardRate: number;
  readonly registrationThreshold: number;
  readonly deregistrationThreshold: number;
  readonly flatRateJoinThreshold: number;
  readonly flatRateLeaveThreshold: number;
  readonly limitedCostTraderRate: number;
  /** Goods spend below this % of turnover makes you a limited cost trader… */
  readonly limitedCostTraderGoodsPercentage: number;
  /** …or below this annual amount, whichever is greater. */
  readonly limitedCostTraderGoodsFloor: number;
  readonly firstYearDiscount: number;
}

export interface ChildBenefit {
  readonly eldestWeekly: number;
  readonly additionalWeekly: number;
  /** High Income Child Benefit Charge taper start and full-clawback point. */
  readonly hicbcThreshold: number;
  readonly hicbcUpperThreshold: number;
}

export interface Mileage {
  readonly carFirst10000: number;
  readonly carAfter10000: number;
  readonly motorcycle: number;
  readonly bicycle: number;
  readonly passengerRate: number;
}

export interface TaxYear {
  /** Slug form, e.g. '2026-27'. */
  readonly id: string;
  /** Display form, e.g. '2026/27'. */
  readonly label: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly incomeTax: IncomeTax;
  readonly nationalInsurance: NationalInsurance;
  readonly studentLoans: Readonly<Record<LoanPlan, LoanPlanRates>>;
  readonly pensions: Pensions;
  readonly propertyTax: Readonly<Record<Region, PropertyTaxRules>>;
  readonly capitalGains: CapitalGains;
  readonly corporationTax: CorporationTax;
  readonly redundancy: Redundancy;
  readonly companyCars: CompanyCars;
  readonly vat: Vat;
  readonly childBenefit: ChildBenefit;
  readonly mileage: Mileage;
  /** Keyed by topic so pages can cite the figures they display. */
  readonly sources: Readonly<Record<string, Source>>;
}
