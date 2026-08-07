import type { TaxYear } from '../types';

/**
 * Tax year 2026/27 — 6 April 2026 to 5 April 2027.
 *
 * Reflects the Autumn Budget of 26 November 2025. Every figure below was
 * checked against the source listed in `sources` on 7 August 2026.
 *
 * Notable changes from 2025/26:
 *  - Dividend ordinary and upper rates up 2pp to 10.75% / 35.75%.
 *  - Income tax and NI thresholds frozen for a further three years, to 2030/31.
 *  - Scottish starter and basic band limits uprated 7.4%; higher, advanced and
 *    top thresholds frozen.
 *  - Company car zero-emission percentage up to 4%; bands at 75 g/km and above
 *    frozen at 2025/26 levels, which is why 70–74 and 75–79 both sit at 21%.
 *  - Approved mileage rate up to 55p, its first change since 2011.
 *  - Redundancy weekly pay cap up 4.4% to £751.
 */

/**
 * Band limits are measured on TAXABLE income — income after the personal
 * allowance — because that is how ITA 2007 and HMRC's PAYE tables define them.
 *
 * The top boundary is the one that trips people up. The additional rate limit
 * is £125,140 of *taxable* income, not £112,570 (£125,140 less a full personal
 * allowance). The two coincide only for someone whose allowance is intact, and
 * anyone reaching this band has lost theirs entirely to the taper. Getting this
 * wrong overstates tax on a £150,000 salary by £628.50.
 *
 * Cross-check: £150,000 → £7,540 basic + £34,976 higher + £11,187 additional
 * = £53,703, which is the published figure.
 */
const RUK_BANDS = [
  { upTo: 37_700, rate: 0.2, label: 'Basic rate' },
  { upTo: 125_140, rate: 0.4, label: 'Higher rate' },
  { upTo: null, rate: 0.45, label: 'Additional rate' },
] as const;

/**
 * Scottish bands, also on taxable income. The gross-income equivalents quoted
 * by the Scottish Government (which assume a full £12,570 allowance) are
 * £12,571–16,537 / –29,526 / –43,662 / –75,000 / –125,140 / above.
 */
const SCOTLAND_BANDS = [
  { upTo: 3_967, rate: 0.19, label: 'Starter rate' },
  { upTo: 16_956, rate: 0.2, label: 'Scottish basic rate' },
  { upTo: 31_092, rate: 0.21, label: 'Intermediate rate' },
  { upTo: 62_430, rate: 0.42, label: 'Higher rate' },
  { upTo: 125_140, rate: 0.45, label: 'Advanced rate' },
  { upTo: null, rate: 0.48, label: 'Top rate' },
] as const;

export const TAX_YEAR_2026_27: TaxYear = {
  id: '2026-27',
  label: '2026/27',
  startsOn: '2026-04-06',
  endsOn: '2027-04-05',

  incomeTax: {
    personalAllowance: 12_570,
    taperThreshold: 100_000,
    taperDivisor: 2,
    bands: {
      'england-nireland': RUK_BANDS,
      wales: RUK_BANDS,
      scotland: SCOTLAND_BANDS,
    },
    dividend: {
      allowance: 500,
      // Up 2 percentage points from 6 April 2026 (Autumn Budget 2025).
      ordinaryRate: 0.1075,
      upperRate: 0.3575,
      additionalRate: 0.3935,
    },
    savings: {
      allowanceBasic: 1_000,
      allowanceHigher: 500,
      allowanceAdditional: 0,
      starterRateBand: 5_000,
    },
  },

  nationalInsurance: {
    lowerEarningsLimit: 6_708,
    employee: {
      primaryThreshold: 12_570,
      upperEarningsLimit: 50_270,
      mainRate: 0.08,
      upperRate: 0.02,
    },
    employer: {
      secondaryThreshold: 5_000,
      rate: 0.15,
      employmentAllowance: 10_500,
      class1aRate: 0.15,
      upperSecondaryThreshold: 50_270,
    },
    selfEmployed: {
      class4LowerLimit: 12_570,
      class4UpperLimit: 50_270,
      class4MainRate: 0.06,
      class4UpperRate: 0.02,
      // Class 2 was abolished from April 2024. Below the small profits
      // threshold you may pay voluntarily to protect your State Pension record.
      smallProfitsThreshold: 7_105,
      class2VoluntaryWeekly: 3.65,
    },
  },

  studentLoans: {
    plan1: {
      label: 'Plan 1',
      threshold: 26_900,
      rate: 0.09,
      description:
        'Courses started before September 2012 in England or Wales, or any Scottish or Northern Irish course.',
    },
    plan2: {
      label: 'Plan 2',
      threshold: 29_385,
      rate: 0.09,
      description: 'Courses started between September 2012 and July 2023 in England or Wales.',
    },
    plan4: {
      label: 'Plan 4',
      threshold: 33_795,
      rate: 0.09,
      description: 'Scottish students funded by SAAS.',
    },
    plan5: {
      label: 'Plan 5',
      threshold: 25_000,
      rate: 0.09,
      description: 'Undergraduate courses started on or after 1 August 2023 in England.',
    },
    postgrad: {
      label: 'Postgraduate Loan',
      threshold: 21_000,
      rate: 0.06,
      description:
        "Master's and doctoral loans. Repaid alongside — not instead of — any undergraduate plan.",
    },
  },

  pensions: {
    annualAllowance: 60_000,
    taperAdjustedIncomeThreshold: 260_000,
    taperThresholdIncome: 200_000,
    minimumTaperedAllowance: 10_000,
    moneyPurchaseAnnualAllowance: 10_000,
    // Announced at Autumn Budget 2025 but not in force until April 2029.
    salarySacrificeNicCap: null,
  },

  propertyTax: {
    'england-nireland': {
      name: 'Stamp Duty Land Tax',
      abbreviation: 'SDLT',
      authority: 'HMRC',
      standardBands: [
        { upTo: 125_000, rate: 0, label: 'Nil rate' },
        { upTo: 250_000, rate: 0.02, label: '2% band' },
        { upTo: 925_000, rate: 0.05, label: '5% band' },
        { upTo: 1_500_000, rate: 0.1, label: '10% band' },
        { upTo: null, rate: 0.12, label: '12% band' },
      ],
      additionalProperty: { kind: 'surcharge', rate: 0.05, minimumPrice: 40_000 },
      nonResidentSurcharge: 0.02,
      firstTimeBuyerRelief: {
        nilRateBand: 300_000,
        // A hard cliff, not a taper: at £500,001 the relief vanishes entirely
        // and the standard bands apply to the whole price.
        maximumPrice: 500_000,
        bands: [
          { upTo: 300_000, rate: 0, label: 'First-time buyer nil rate' },
          { upTo: null, rate: 0.05, label: '5% band' },
        ],
      },
    },
    scotland: {
      name: 'Land and Buildings Transaction Tax',
      abbreviation: 'LBTT',
      authority: 'Revenue Scotland',
      standardBands: [
        { upTo: 145_000, rate: 0, label: 'Nil rate' },
        { upTo: 250_000, rate: 0.02, label: '2% band' },
        { upTo: 325_000, rate: 0.05, label: '5% band' },
        { upTo: 750_000, rate: 0.1, label: '10% band' },
        { upTo: null, rate: 0.12, label: '12% band' },
      ],
      // The Additional Dwelling Supplement is a flat 8% of the whole price,
      // charged on top of the banded LBTT — not added to each band.
      additionalProperty: { kind: 'flat', rate: 0.08, minimumPrice: 40_000 },
      nonResidentSurcharge: null,
      firstTimeBuyerRelief: {
        nilRateBand: 175_000,
        // Unlike England, Scotland puts no upper price limit on the relief.
        maximumPrice: null,
        bands: [
          { upTo: 175_000, rate: 0, label: 'First-time buyer nil rate' },
          { upTo: 250_000, rate: 0.02, label: '2% band' },
          { upTo: 325_000, rate: 0.05, label: '5% band' },
          { upTo: 750_000, rate: 0.1, label: '10% band' },
          { upTo: null, rate: 0.12, label: '12% band' },
        ],
      },
    },
    wales: {
      name: 'Land Transaction Tax',
      abbreviation: 'LTT',
      authority: 'Welsh Revenue Authority',
      standardBands: [
        { upTo: 225_000, rate: 0, label: 'Nil rate' },
        { upTo: 400_000, rate: 0.06, label: '6% band' },
        { upTo: 750_000, rate: 0.075, label: '7.5% band' },
        { upTo: 1_500_000, rate: 0.1, label: '10% band' },
        { upTo: null, rate: 0.12, label: '12% band' },
      ],
      // Wales replaced its flat 4% surcharge with a full second band table
      // on 11 December 2024.
      additionalProperty: {
        kind: 'separate-bands',
        minimumPrice: 40_000,
        bands: [
          { upTo: 180_000, rate: 0.05, label: '5% band' },
          { upTo: 250_000, rate: 0.085, label: '8.5% band' },
          { upTo: 400_000, rate: 0.1, label: '10% band' },
          { upTo: 750_000, rate: 0.125, label: '12.5% band' },
          { upTo: 1_500_000, rate: 0.15, label: '15% band' },
          { upTo: null, rate: 0.17, label: '17% band' },
        ],
      },
      nonResidentSurcharge: null,
      // Wales has no first-time buyer relief. Its £225,000 nil-rate band is the
      // highest in the UK, so most Welsh first-time buyers pay nothing anyway.
      firstTimeBuyerRelief: null,
    },
  },

  capitalGains: {
    annualExemptAmount: 3_000,
    residentialBasicRate: 0.18,
    residentialHigherRate: 0.24,
    otherBasicRate: 0.18,
    otherHigherRate: 0.24,
    propertyReportingDays: 60,
  },

  corporationTax: {
    smallProfitsRate: 0.19,
    mainRate: 0.25,
    lowerLimit: 50_000,
    upperLimit: 250_000,
    // 3/200. Produces a 26.5% effective marginal rate between the limits.
    marginalReliefFraction: 0.015,
  },

  redundancy: {
    weeklyPayCap: 751,
    weeklyPayCapNorthernIreland: 783,
    maximumYears: 20,
    weeksPerYearUnder22: 0.5,
    weeksPerYear22to40: 1,
    weeksPerYear41Plus: 1.5,
    terminationPaymentExemption: 30_000,
  },

  companyCars: {
    zeroEmissionPercentage: 0.04,
    hybridBands: [
      { minElectricRange: 130, maxElectricRange: null, percentage: 0.04 },
      { minElectricRange: 70, maxElectricRange: 129, percentage: 0.07 },
      { minElectricRange: 40, maxElectricRange: 69, percentage: 0.1 },
      { minElectricRange: 30, maxElectricRange: 39, percentage: 0.14 },
      { minElectricRange: 0, maxElectricRange: 29, percentage: 0.16 },
    ],
    // Bands below 75 g/km rose 1pp from 2025/26; 75 g/km and above are frozen
    // until April 2028. That freeze is why 70–74 and 75–79 both sit at 21%.
    co2Bands: [
      { upTo: 54, percentage: 0.17 },
      { upTo: 59, percentage: 0.18 },
      { upTo: 64, percentage: 0.19 },
      { upTo: 69, percentage: 0.2 },
      { upTo: 74, percentage: 0.21 },
      { upTo: 79, percentage: 0.21 },
      { upTo: 84, percentage: 0.22 },
      { upTo: 89, percentage: 0.23 },
      { upTo: 94, percentage: 0.24 },
      { upTo: 99, percentage: 0.25 },
      { upTo: 104, percentage: 0.26 },
      { upTo: 109, percentage: 0.27 },
      { upTo: 114, percentage: 0.28 },
      { upTo: 119, percentage: 0.29 },
      { upTo: 124, percentage: 0.3 },
      { upTo: 129, percentage: 0.31 },
      { upTo: 134, percentage: 0.32 },
      { upTo: 139, percentage: 0.33 },
      { upTo: 144, percentage: 0.34 },
      { upTo: 149, percentage: 0.35 },
      { upTo: 154, percentage: 0.36 },
      { upTo: null, percentage: 0.37 },
    ],
    dieselSupplement: 0.04,
    maximumPercentage: 0.37,
    fuelBenefitMultiplier: 29_200,
    vanBenefitCharge: 4_170,
    vanFuelBenefitCharge: 798,
  },

  vat: {
    standardRate: 0.2,
    registrationThreshold: 90_000,
    deregistrationThreshold: 88_000,
    flatRateJoinThreshold: 150_000,
    flatRateLeaveThreshold: 230_000,
    limitedCostTraderRate: 0.165,
    limitedCostTraderGoodsPercentage: 0.02,
    limitedCostTraderGoodsFloor: 1_000,
    firstYearDiscount: 0.01,
  },

  childBenefit: {
    eldestWeekly: 27.05,
    additionalWeekly: 17.9,
    hicbcThreshold: 60_000,
    hicbcUpperThreshold: 80_000,
  },

  mileage: {
    // Raised from 45p — the first change to the approved rate since 2011.
    carFirst10000: 0.55,
    carAfter10000: 0.25,
    motorcycle: 0.24,
    bicycle: 0.2,
    passengerRate: 0.05,
  },

  sources: {
    payeAndNi: {
      title: 'Rates and thresholds for employers 2026 to 2027',
      url: 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027',
      verifiedOn: '2026-08-07',
    },
    scottishIncomeTax: {
      title: 'Scottish Income Tax 2026 to 2027: technical factsheet',
      url: 'https://www.gov.scot/publications/scottish-income-tax-technical-factsheet/',
      verifiedOn: '2026-08-07',
    },
    studentLoans: {
      title: 'Rates and thresholds for employers 2026 to 2027: student loan deductions',
      url: 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027',
      verifiedOn: '2026-08-07',
    },
    sdlt: {
      title: 'Stamp Duty Land Tax: rates for residential property',
      url: 'https://www.gov.uk/stamp-duty-land-tax/residential-property-rates',
      verifiedOn: '2026-08-07',
    },
    lbtt: {
      title: 'LBTT residential property rates',
      url: 'https://revenue.scot/taxes/land-buildings-transaction-tax/residential-property',
      verifiedOn: '2026-08-07',
    },
    ltt: {
      title: 'Land Transaction Tax rates and bands',
      url: 'https://www.gov.wales/land-transaction-tax-rates-and-bands',
      verifiedOn: '2026-08-07',
    },
    capitalGains: {
      title: 'Capital Gains Tax: rates and allowances',
      url: 'https://www.gov.uk/capital-gains-tax/rates',
      verifiedOn: '2026-08-07',
    },
    corporationTax: {
      title: 'Corporation Tax rates and reliefs',
      url: 'https://www.gov.uk/corporation-tax-rates',
      verifiedOn: '2026-08-07',
    },
    dividends: {
      title: 'Tax on dividends',
      url: 'https://www.gov.uk/tax-on-dividends',
      verifiedOn: '2026-08-07',
    },
    redundancy: {
      title: 'Redundancy: your rights — redundancy pay',
      url: 'https://www.gov.uk/redundancy-your-rights/redundancy-pay',
      verifiedOn: '2026-08-07',
    },
    companyCars: {
      title: 'Company car benefit: the appropriate percentage (480: Appendix 2)',
      url: 'https://www.gov.uk/guidance/company-car-benefit-the-appropriate-percentage-480-appendix-2',
      verifiedOn: '2026-08-07',
    },
    vat: {
      title: 'VAT Flat Rate Scheme',
      url: 'https://www.gov.uk/vat-flat-rate-scheme',
      verifiedOn: '2026-08-07',
    },
    pensions: {
      title: 'Tax on your private pension contributions: annual allowance',
      url: 'https://www.gov.uk/tax-on-your-private-pension/annual-allowance',
      verifiedOn: '2026-08-07',
    },
    childBenefit: {
      title: 'High Income Child Benefit Charge',
      url: 'https://www.gov.uk/child-benefit-tax-charge',
      verifiedOn: '2026-08-07',
    },
    mileage: {
      title: 'Travel — mileage and fuel rates and allowances',
      url: 'https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances',
      verifiedOn: '2026-08-07',
    },
  },
};
