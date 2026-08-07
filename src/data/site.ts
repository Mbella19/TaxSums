/**
 * The site map, as data.
 *
 * Navigation, footers, category pages, breadcrumbs and every "related tools"
 * block are generated from this one list. That matters for more than tidiness:
 * internal links are how Google discovers and ranks pages, and hand-written
 * link blocks rot the moment a URL changes.
 */

export interface Category {
  readonly slug: string;
  readonly title: string;
  readonly navTitle: string;
  readonly description: string;
}

export interface Tool {
  readonly slug: string;
  readonly category: string;
  /** Browser tab and search result title. Unique across the site. */
  readonly title: string;
  /** The single H1. */
  readonly h1: string;
  readonly metaDescription: string;
  /** Short label for cards and nav. */
  readonly shortName: string;
  /** One sentence under the H1. */
  readonly standfirst: string;
  /** Slugs of two to five closely related tools. */
  readonly related: readonly string[];
  /** Key in the tax year's `sources` map, for the verified-on line. */
  readonly sourceKey: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'salary-and-tax',
    title: 'Salary and tax calculators',
    navTitle: 'Salary & tax',
    description:
      'Work out take-home pay, the tax on a company car and what a redundancy package is worth after tax, for the 2026/27 tax year.',
  },
  {
    slug: 'property',
    title: 'Property tax calculators',
    navTitle: 'Property',
    description:
      'Stamp duty across England, Scotland and Wales, plus Capital Gains Tax when you sell a property that is not your main home.',
  },
  {
    slug: 'mortgages',
    title: 'Mortgage calculators',
    navTitle: 'Mortgages',
    description:
      'See what overpaying saves you and how much you could realistically borrow, with the assumptions shown rather than hidden.',
  },
  {
    slug: 'business',
    title: 'Business tax calculators',
    navTitle: 'Business',
    description:
      'Compare trading as a sole trader with running a limited company, and check whether the VAT Flat Rate Scheme is worth joining.',
  },
];

export const TOOLS: readonly Tool[] = [
  {
    slug: 'take-home-pay-calculator',
    category: 'salary-and-tax',
    title: 'Take-Home Pay Calculator 2026/27 – Salary After Tax, NI and Student Loan',
    h1: 'Take-home pay calculator',
    metaDescription:
      'Work out your 2026/27 take-home pay after income tax, National Insurance, student loan and pension. Handles salary sacrifice, all five loan plans and the £100k allowance taper.',
    shortName: 'Take-home pay',
    standfirst:
      'Enter your salary to see exactly what reaches your bank account, and how each deduction was worked out.',
    related: [
      'take-home-pay-calculator/scotland',
      'company-car-tax-calculator',
      'sole-trader-vs-limited-company-calculator',
      'redundancy-pay-calculator',
    ],
    sourceKey: 'payeAndNi',
  },
  {
    slug: 'take-home-pay-calculator/scotland',
    category: 'salary-and-tax',
    title: 'Scottish Salary Calculator 2026/27 – Take-Home Pay After Tax',
    h1: 'Scottish take-home pay calculator',
    metaDescription:
      'Take-home pay using the six Scottish income tax bands for 2026/27, from the 19% starter rate to the 48% top rate, with a side-by-side comparison against the rest of the UK.',
    shortName: 'Scottish take-home pay',
    standfirst:
      'Scotland sets its own income tax rates. See what you keep, and exactly how much more or less that is than the rest of the UK.',
    related: [
      'take-home-pay-calculator',
      'stamp-duty-calculator/scotland',
      'sole-trader-vs-limited-company-calculator',
    ],
    sourceKey: 'scottishIncomeTax',
  },
  {
    slug: 'stamp-duty-calculator',
    category: 'property',
    title: 'Stamp Duty Calculator 2026 – SDLT on Second Homes and First-Time Buyers',
    h1: 'Stamp duty calculator',
    metaDescription:
      'Calculate SDLT in England and Northern Ireland, including the 5% additional property surcharge, the 2% non-resident surcharge and the first-time buyer cliff edge at £500,000.',
    shortName: 'Stamp duty (England & NI)',
    standfirst:
      'Stamp Duty Land Tax for England and Northern Ireland, with every band shown and the first-time buyer cliff edge flagged before it catches you.',
    related: [
      'stamp-duty-calculator/scotland',
      'stamp-duty-calculator/wales',
      'mortgage-affordability-calculator',
      'capital-gains-tax-property-calculator',
    ],
    sourceKey: 'sdlt',
  },
  {
    slug: 'stamp-duty-calculator/scotland',
    category: 'property',
    title: 'LBTT Calculator Scotland 2026/27 – Land and Buildings Transaction Tax',
    h1: 'LBTT calculator for Scotland',
    metaDescription:
      'Work out Land and Buildings Transaction Tax on a Scottish property purchase, including the 8% Additional Dwelling Supplement and first-time buyer relief with no upper price limit.',
    shortName: 'LBTT (Scotland)',
    standfirst:
      'Scotland charges LBTT, not stamp duty. The bands are different, the second-home supplement is 8% of the whole price, and first-time buyer relief has no price cap.',
    related: [
      'stamp-duty-calculator',
      'stamp-duty-calculator/wales',
      'take-home-pay-calculator/scotland',
      'mortgage-affordability-calculator',
    ],
    sourceKey: 'lbtt',
  },
  {
    slug: 'stamp-duty-calculator/wales',
    category: 'property',
    title: 'LTT Calculator Wales 2026 – Land Transaction Tax Rates and Higher Rates',
    h1: 'LTT calculator for Wales',
    metaDescription:
      'Calculate Land Transaction Tax on a Welsh property, using the main residential rates or the separate higher-rate bands that apply to second homes and buy-to-lets.',
    shortName: 'LTT (Wales)',
    standfirst:
      'Wales charges LTT. It has the highest nil-rate band in the UK at £225,000, no first-time buyer relief, and a completely separate band table for additional properties.',
    related: [
      'stamp-duty-calculator',
      'stamp-duty-calculator/scotland',
      'mortgage-affordability-calculator',
    ],
    sourceKey: 'ltt',
  },
  {
    slug: 'mortgage-overpayment-calculator',
    category: 'mortgages',
    title: 'Mortgage Overpayment Calculator – What Does £200 a Month Extra Save?',
    h1: 'Mortgage overpayment calculator',
    metaDescription:
      'See how much interest you save and how many years you cut off your mortgage by overpaying, with the full schedule and a warning if you would breach the usual 10% annual limit.',
    shortName: 'Mortgage overpayment',
    standfirst:
      'Put in what you can afford each month and see the interest saved and the years knocked off the term.',
    related: [
      'mortgage-affordability-calculator',
      'stamp-duty-calculator',
      'take-home-pay-calculator',
    ],
    sourceKey: 'payeAndNi',
  },
  {
    slug: 'mortgage-affordability-calculator',
    category: 'mortgages',
    title: 'Mortgage Affordability Calculator 2026 – How Much Can I Borrow?',
    h1: 'Mortgage affordability calculator',
    metaDescription:
      'How much you could borrow, shown as an honest range from 4x to 5.5x income rather than one invented number, with the stress-tested monthly payment for each.',
    shortName: 'Mortgage affordability',
    standfirst:
      'There is no single correct answer to how much you can borrow. Here is the realistic range, and what each level costs per month.',
    related: [
      'mortgage-overpayment-calculator',
      'stamp-duty-calculator',
      'take-home-pay-calculator',
    ],
    sourceKey: 'payeAndNi',
  },
  {
    slug: 'sole-trader-vs-limited-company-calculator',
    category: 'business',
    title: 'Sole Trader vs Limited Company Calculator 2026/27 – Which Pays Less Tax?',
    h1: 'Sole trader vs limited company calculator',
    metaDescription:
      'Compare the tax on the same profit as a sole trader and as a limited company for 2026/27, including the new 10.75% and 35.75% dividend rates and the Employment Allowance trap.',
    shortName: 'Sole trader vs limited',
    standfirst:
      'Compare both routes on the same profit, with the 2026/27 dividend rates and the traps that most comparisons leave out.',
    related: [
      'vat-flat-rate-calculator',
      'take-home-pay-calculator',
      'company-car-tax-calculator',
    ],
    sourceKey: 'corporationTax',
  },
  {
    slug: 'vat-flat-rate-calculator',
    category: 'business',
    title: 'VAT Flat Rate Scheme Calculator 2026 – Flat Rate vs Standard VAT',
    h1: 'VAT Flat Rate Scheme calculator',
    metaDescription:
      'Compare the VAT Flat Rate Scheme against standard VAT accounting, including the limited cost trader test that puts most consultants on 16.5% regardless of sector.',
    shortName: 'VAT flat rate',
    standfirst:
      'Work out whether the Flat Rate Scheme actually saves you money, and whether the limited cost trader rule catches you.',
    related: [
      'sole-trader-vs-limited-company-calculator',
      'company-car-tax-calculator',
      'take-home-pay-calculator',
    ],
    sourceKey: 'vat',
  },
  {
    slug: 'redundancy-pay-calculator',
    category: 'salary-and-tax',
    title: 'Redundancy Pay Calculator 2026/27 – Statutory Pay and Tax on Your Package',
    h1: 'Redundancy pay calculator',
    metaDescription:
      'Work out statutory redundancy pay using the 2026/27 £751 weekly cap, then see the tax on your whole package including the £30,000 exemption and taxable notice pay.',
    shortName: 'Redundancy pay',
    standfirst:
      "Your statutory entitlement, and then the part gov.uk's own calculator leaves out: how much tax comes off the package.",
    related: [
      'take-home-pay-calculator',
      'mortgage-affordability-calculator',
      'company-car-tax-calculator',
    ],
    sourceKey: 'redundancy',
  },
  {
    slug: 'company-car-tax-calculator',
    category: 'salary-and-tax',
    title: 'Company Car Tax Calculator 2026/27 – Electric and Petrol BIK',
    h1: 'Company car tax calculator',
    metaDescription:
      'Calculate company car benefit in kind tax for 2026/27, with the 4% electric rate, plug-in hybrid bands by electric range, the diesel supplement and employer Class 1A.',
    shortName: 'Company car tax',
    standfirst:
      'Work out the benefit in kind on a company car, what it costs you each month, and what it costs your employer.',
    related: [
      'take-home-pay-calculator',
      'sole-trader-vs-limited-company-calculator',
      'redundancy-pay-calculator',
    ],
    sourceKey: 'companyCars',
  },
  {
    slug: 'capital-gains-tax-property-calculator',
    category: 'property',
    title: 'Capital Gains Tax on Property Calculator 2026/27 – 18% and 24% Rates',
    h1: 'Capital Gains Tax on property calculator',
    metaDescription:
      'Work out CGT when selling a second home or buy-to-let, with the gain split correctly across the 18% and 24% rates, Private Residence Relief and the 60-day deadline.',
    shortName: 'CGT on property',
    standfirst:
      'Selling a property that is not your main home? Work out the gain, the reliefs and the tax at the right split of 18% and 24%.',
    related: [
      'stamp-duty-calculator',
      'mortgage-overpayment-calculator',
      'take-home-pay-calculator',
    ],
    sourceKey: 'capitalGains',
  },
];

export function toolBySlug(slug: string): Tool {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool slug: ${slug}`);
  return tool;
}

export function toolsInCategory(categorySlug: string): readonly Tool[] {
  return TOOLS.filter((t) => t.category === categorySlug);
}

export function categoryBySlug(slug: string): Category {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) throw new Error(`Unknown category slug: ${slug}`);
  return category;
}

export function relatedTools(tool: Tool): readonly Tool[] {
  return tool.related.map(toolBySlug);
}

/** Supporting guides. Each one links into the tools it explains. */
export interface Guide {
  readonly slug: string;
  readonly title: string;
  readonly h1: string;
  readonly metaDescription: string;
  readonly shortName: string;
  readonly relatedTools: readonly string[];
}

export const GUIDES: readonly Guide[] = [
  {
    slug: 'income-tax-rates-2026-27',
    title: 'UK Income Tax Rates and Thresholds 2026/27 – Full Tables',
    h1: 'UK income tax rates and thresholds for 2026/27',
    metaDescription:
      'Every income tax rate, band and allowance for the 2026/27 tax year, for England, Wales, Northern Ireland and Scotland, with National Insurance and dividend rates.',
    shortName: 'Income tax rates 2026/27',
    relatedTools: ['take-home-pay-calculator', 'take-home-pay-calculator/scotland'],
  },
  {
    slug: 'scottish-income-tax-vs-rest-of-uk',
    title: 'Scottish Income Tax vs the Rest of the UK in 2026/27',
    h1: 'Scottish income tax compared with the rest of the UK',
    metaDescription:
      'How Scotland’s six income tax bands compare with the three used elsewhere in the UK in 2026/27, and at what salary a Scottish taxpayer starts paying more.',
    shortName: 'Scotland vs rUK tax',
    relatedTools: ['take-home-pay-calculator/scotland', 'take-home-pay-calculator'],
  },
  {
    slug: 'student-loan-repayment-thresholds',
    title: 'Student Loan Repayment Thresholds 2026/27 – All Plans',
    h1: 'Student loan repayment thresholds for 2026/27',
    metaDescription:
      'The 2026/27 repayment threshold and rate for every UK student loan plan, which plan you are on, and how a postgraduate loan stacks on top of an undergraduate one.',
    shortName: 'Student loan thresholds',
    relatedTools: ['take-home-pay-calculator'],
  },
  {
    slug: 'salary-sacrifice-explained',
    title: 'Salary Sacrifice Explained – And the £2,000 Cap Coming in 2029',
    h1: 'Salary sacrifice, and what changes in 2029',
    metaDescription:
      'How pension salary sacrifice saves National Insurance as well as income tax, how it differs from net pay and relief at source, and the £2,000 cap announced for April 2029.',
    shortName: 'Salary sacrifice',
    relatedTools: ['take-home-pay-calculator'],
  },
  {
    slug: 'the-100k-tax-trap',
    title: 'The £100,000 Tax Trap – Why You Pay 60% Between £100k and £125,140',
    h1: 'The £100,000 tax trap',
    metaDescription:
      'Why earnings between £100,000 and £125,140 are effectively taxed at 60%, how the personal allowance taper causes it, and how a pension contribution escapes it.',
    shortName: 'The £100k trap',
    relatedTools: ['take-home-pay-calculator'],
  },
  {
    slug: 'first-time-buyer-stamp-duty-cliff-edge',
    title: 'First-Time Buyer Stamp Duty: the £500,000 Cliff Edge',
    h1: 'The first-time buyer stamp duty cliff edge',
    metaDescription:
      'First-time buyer stamp duty relief disappears completely above £500,000 rather than tapering, so one extra pound on the price can cost £5,000 in tax.',
    shortName: 'The £500k FTB cliff',
    relatedTools: ['stamp-duty-calculator', 'stamp-duty-calculator/scotland'],
  },
  {
    slug: 'should-i-go-limited',
    title: 'Should I Go Limited in 2026/27? The Numbers After the Dividend Rise',
    h1: 'Should I go limited in 2026/27?',
    metaDescription:
      'The 2026/27 dividend rise and 15% employer National Insurance have changed the answer. When a limited company still pays, and when staying a sole trader is cheaper.',
    shortName: 'Should I go limited?',
    relatedTools: ['sole-trader-vs-limited-company-calculator', 'vat-flat-rate-calculator'],
  },
  {
    slug: 'is-redundancy-pay-taxable',
    title: 'Is Redundancy Pay Taxable? The £30,000 Rule Explained',
    h1: 'Is redundancy pay taxable?',
    metaDescription:
      'The £30,000 exemption covers redundancy pay but not notice pay or holiday pay, and it is one £30,000 across the whole package — not per payment.',
    shortName: 'Is redundancy pay taxable?',
    relatedTools: ['redundancy-pay-calculator', 'take-home-pay-calculator'],
  },
];

export function guideBySlug(slug: string): Guide {
  const guide = GUIDES.find((g) => g.slug === slug);
  if (!guide) throw new Error(`Unknown guide slug: ${slug}`);
  return guide;
}
