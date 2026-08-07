import { describe, expect, it } from 'vitest';
import { TAX_YEAR_2026_27 as YEAR } from '../src/data/tax-years';
import { calculatePropertyGain } from '../src/lib/capital-gains';
import { appropriatePercentage, calculateCompanyCar } from '../src/lib/company-car';
import {
  calculateCorporationTax,
  calculateLimitedCompany,
  calculateSoleTrader,
  compareTradingStructures,
  marginalExtractionRates,
  optimalDirectorSalary,
} from '../src/lib/incorporation';
import { amortise, affordabilityRange, monthlyPayment, overpaymentSaving } from '../src/lib/mortgage';
import { calculateStatutoryRedundancy, calculateTerminationTax } from '../src/lib/redundancy';
import { compareFlatRate } from '../src/lib/vat';

describe('corporation tax', () => {
  it('charges the small profits rate up to £50,000', () => {
    expect(calculateCorporationTax(50_000, YEAR).tax).toBe(9_500);
  });

  it('charges the main rate above £250,000', () => {
    expect(calculateCorporationTax(300_000, YEAR).tax).toBe(75_000);
  });

  it('applies marginal relief between the limits', () => {
    // 100,000 × 25% − 3/200 × (250,000 − 100,000).
    expect(calculateCorporationTax(100_000, YEAR).tax).toBe(22_750);
    expect(calculateCorporationTax(100_000, YEAR).marginalReliefApplied).toBe(true);
  });

  it('produces a 26.5% effective marginal rate in the relief band', () => {
    const at = (p: number) => calculateCorporationTax(p, YEAR).tax;
    expect((at(101_000) - at(100_000)) / 1_000).toBeCloseTo(0.265, 6);
  });

  it('divides the limits between associated companies', () => {
    // Two companies share the £50,000 lower limit, so £30,000 is already
    // in the marginal band.
    expect(calculateCorporationTax(30_000, YEAR, 2).marginalReliefApplied).toBe(true);
    expect(calculateCorporationTax(30_000, YEAR, 1).marginalReliefApplied).toBe(false);
  });
});

describe('sole trader vs limited company', () => {
  it('taxes a sole trader on income tax plus Class 4 NI', () => {
    const result = calculateSoleTrader(60_000, YEAR);
    expect(result.incomeTax).toBe(11_432);
    expect(result.class4Ni).toBeCloseTo(2_456.6, 2);
    expect(result.takeHome).toBeCloseTo(46_111.4, 2);
  });

  it('denies the Employment Allowance to a sole director company', () => {
    const soleDirector = calculateLimitedCompany(60_000, YEAR, {
      soleDirectorNoOtherEmployees: true,
    });
    const withStaff = calculateLimitedCompany(60_000, YEAR, {
      soleDirectorNoOtherEmployees: false,
    });

    expect(soleDirector.employmentAllowanceClaimed).toBe(false);
    expect(soleDirector.employerNi).toBeCloseTo(1_135.5, 2);
    expect(withStaff.employmentAllowanceClaimed).toBe(true);
    expect(withStaff.employerNi).toBe(0);
    expect(withStaff.takeHome).toBeGreaterThan(soleDirector.takeHome);
  });

  it('charges the 2026/27 dividend rates', () => {
    const result = calculateLimitedCompany(60_000, YEAR, { salary: 12_570 });
    // Basic rate dividends at 10.75%, up from 8.75% in 2025/26.
    expect(result.dividendTax).toBeGreaterThan(0);
    expect(result.corporationTax).toBeCloseTo(8_795.96, 2);
  });

  it('finds incorporation barely worthwhile at £60,000 once costs are counted', () => {
    const comparison = compareTradingStructures(60_000, YEAR);
    // The 2026/27 dividend rise plus 15% employer NI has all but closed the
    // gap at this profit level — before any accountancy fees.
    expect(Math.abs(comparison.advantage)).toBeLessThan(500);
    expect(comparison.betterOption).toBe('sole-trader');
  });

  it('shows full extraction from a company costing MORE at high profits', () => {
    // The 2026/27 result that surprises people. Above the £50,000 corporation
    // tax lower limit, extracted profit bears 26.5% CT and then 35.75%
    // dividend tax — 52.8% combined — against a sole trader's 40% + 2%.
    const comparison = compareTradingStructures(150_000, YEAR);
    expect(comparison.limitedCompany.takeHome).toBeLessThan(comparison.soleTrader.takeHome);
    expect(comparison.betterOption).toBe('sole-trader');
  });

  it('quantifies why full extraction is expensive', () => {
    const rates = marginalExtractionRates(YEAR);
    expect(rates.marginalCorporationTax).toBeCloseTo(0.265, 6);
    expect(rates.companyCombined).toBeCloseTo(0.528, 3);
    expect(rates.soleTraderHigher).toBeCloseTo(0.42, 6);
    expect(rates.companyCombined).toBeGreaterThan(rates.soleTraderHigher);
  });

  it('lets a director retain profit instead of drawing it', () => {
    const drawEverything = calculateLimitedCompany(150_000, YEAR);
    const drawWhatYouNeed = calculateLimitedCompany(150_000, YEAR, { dividendsToDraw: 30_000 });

    expect(drawEverything.retainedInCompany).toBe(0);
    expect(drawWhatYouNeed.retainedInCompany).toBeGreaterThan(70_000);
    // Drawing less means less dividend tax now — deferred, not avoided.
    expect(drawWhatYouNeed.dividendTax).toBeLessThan(drawEverything.dividendTax);
    expect(drawWhatYouNeed.takeHome).toBeLessThan(drawEverything.takeHome);
  });

  it('cannot draw more than the company has', () => {
    const result = calculateLimitedCompany(60_000, YEAR, { dividendsToDraw: 999_999 });
    expect(result.dividendsDrawn).toBe(result.dividendsAvailable);
    expect(result.retainedInCompany).toBe(0);
  });

  it('cannot pay a salary the company cannot afford', () => {
    // Found by fuzzing the live calculator: a £5,000-profit company asked for a
    // £50,000 salary reported £39,520 of take-home — cash that does not exist.
    const result = calculateLimitedCompany(5_000, YEAR, { salary: 50_000 });
    expect(result.salary).toBeLessThanOrEqual(5_000);
    expect(result.takeHome).toBeLessThanOrEqual(5_000);
    // Salary plus the employer NI on it can never exceed the profit available.
    expect(result.salary + result.employerNi).toBeLessThanOrEqual(5_000 + 0.01);
  });

  it('funds the largest salary the profit actually supports', () => {
    // Above the £5,000 secondary threshold, S + (S − 5,000) × 15% = profit.
    const result = calculateLimitedCompany(20_000, YEAR, { salary: 99_999 });
    expect(result.salary).toBeCloseTo((20_000 + 5_000 * 0.15) / 1.15, 2);
    expect(result.salary + result.employerNi).toBeCloseTo(20_000, 2);
  });

  it('treats a loss as nothing to tax, never as negative take-home', () => {
    const company = calculateLimitedCompany(-50_000, YEAR);
    const sole = calculateSoleTrader(-50_000, YEAR);
    const comparison = compareTradingStructures(-50_000, YEAR);

    expect(company.takeHome).toBe(0);
    expect(company.salary).toBe(0);
    expect(sole.takeHome).toBe(0);
    expect(comparison.advantage).toBe(0);
  });

  it('still recommends a salary when profit is tiny', () => {
    // Guards a -Infinity seed that used to survive when no candidate salary fit.
    const result = optimalDirectorSalary(1_000, YEAR);
    expect(Number.isFinite(result.takeHome)).toBe(true);
    expect(result.takeHome).toBeGreaterThanOrEqual(0);
  });

  it('picks the personal allowance as the optimal director salary', () => {
    const result = optimalDirectorSalary(60_000, YEAR);
    expect(result.salary).toBe(12_570);
    expect(result.reasoning).toMatch(/Lower Earnings Limit/);
  });

  it('warns when a salary is below the Lower Earnings Limit', () => {
    const result = calculateLimitedCompany(60_000, YEAR, { salary: 5_000 });
    expect(result.qualifiesForStatePensionYear).toBe(false);
  });
});

describe('mortgages', () => {
  it('computes the standard repayment payment', () => {
    // £200,000 at 4.5% over 25 years.
    expect(monthlyPayment({ balance: 200_000, annualRate: 0.045, termMonths: 300 })).toBeCloseTo(
      1_111.66,
      1,
    );
  });

  it('handles a zero interest rate without dividing by zero', () => {
    expect(monthlyPayment({ balance: 100_000, annualRate: 0, termMonths: 100 })).toBe(1_000);
  });

  it('clears the balance exactly over the term', () => {
    const { summary, schedule } = amortise({
      balance: 200_000,
      annualRate: 0.045,
      termMonths: 300,
    });
    expect(summary.monthsToRepay).toBe(300);
    expect(schedule[schedule.length - 1]!.balance).toBeLessThan(1);
    expect(summary.totalPaid).toBeCloseTo(200_000 + summary.totalInterest, 0);
  });

  it('answers "what does £200 a month extra save me"', () => {
    const result = overpaymentSaving(
      { balance: 200_000, annualRate: 0.045, termMonths: 300 },
      200,
    );
    expect(result.monthsSaved).toBeGreaterThan(50);
    expect(result.interestSaved).toBeGreaterThan(20_000);
    expect(result.withOverpayment.monthsToRepay).toBeLessThan(result.baseline.monthsToRepay);
  });

  it('flags an overpayment plan that would breach the typical 10% allowance', () => {
    const modest = overpaymentSaving({ balance: 200_000, annualRate: 0.045, termMonths: 300 }, 200);
    const large = overpaymentSaving({ balance: 200_000, annualRate: 0.045, termMonths: 300 }, 2_000);

    expect(modest.exceedsTypicalErcAllowance).toBe(false);
    expect(large.exceedsTypicalErcAllowance).toBe(true);
    expect(modest.typicalErcAllowance).toBe(20_000);
  });

  it('offers a range of affordability rather than one invented number', () => {
    const result = affordabilityRange({ annualIncome: 40_000, deposit: 30_000 });
    expect(result.bands).toHaveLength(4);
    expect(result.bands[1]!.multiple).toBe(4.5);
    expect(result.bands[1]!.maxLoan).toBe(180_000);
    expect(result.bands[1]!.maxPropertyPrice).toBe(210_000);
    // The stressed payment must be higher than the headline one.
    expect(result.bands[1]!.monthlyPaymentAtStressRate).toBeGreaterThan(
      result.bands[1]!.monthlyPayment,
    );
  });

  it('combines two incomes', () => {
    const result = affordabilityRange({
      annualIncome: 40_000,
      secondAnnualIncome: 20_000,
      deposit: 0,
    });
    expect(result.bands[1]!.maxLoan).toBe(270_000);
  });
});

describe('statutory redundancy pay', () => {
  it("reproduces Acas's published worked example", () => {
    // Acas: a 45-year-old with 22 years' service on £300 a week gets £6,600 —
    // 1.5 weeks x 4 years aged 41+, plus 1 week x 16 years aged 22-40, with
    // service capped at the most recent 20 years.
    const result = calculateStatutoryRedundancy(
      { age: 45, yearsOfService: 22, weeklyPay: 300 },
      YEAR,
    );
    expect(result.totalWeeks).toBe(22);
    expect(result.statutoryPay).toBe(6_600);
    expect(result.breakdown.filter((r) => r.weeks === 1.5)).toHaveLength(4);
    expect(result.breakdown.filter((r) => r.weeks === 1)).toHaveLength(16);
  });

  it('uses the age during each year of service, not the age at redundancy', () => {
    // 45 with 5 years: years worked at ages 44, 43, 42, 41 and 40.
    const result = calculateStatutoryRedundancy(
      { age: 45, yearsOfService: 5, weeklyPay: 600 },
      YEAR,
    );
    expect(result.totalWeeks).toBe(7); // 1.5 × 4 + 1
    expect(result.statutoryPay).toBe(4_200);
  });

  it('caps weekly pay at £751', () => {
    const result = calculateStatutoryRedundancy(
      { age: 30, yearsOfService: 10, weeklyPay: 800 },
      YEAR,
    );
    expect(result.weeklyPayCapped).toBe(true);
    expect(result.weeklyPayUsed).toBe(751);
    // Ages 29 down to 20: eight full weeks then two half weeks.
    expect(result.totalWeeks).toBe(9);
    expect(result.statutoryPay).toBe(6_759);
  });

  it('reaches the published £22,530 maximum', () => {
    const result = calculateStatutoryRedundancy(
      { age: 61, yearsOfService: 25, weeklyPay: 2_000 },
      YEAR,
    );
    expect(result.yearsCounted).toBe(20);
    expect(result.yearsCapped).toBe(true);
    expect(result.totalWeeks).toBe(30);
    expect(result.statutoryPay).toBe(22_530);
  });

  it('uses the higher Northern Ireland cap', () => {
    const gb = calculateStatutoryRedundancy({ age: 45, yearsOfService: 5, weeklyPay: 900 }, YEAR);
    const ni = calculateStatutoryRedundancy(
      { age: 45, yearsOfService: 5, weeklyPay: 900, northernIreland: true },
      YEAR,
    );
    expect(ni.statutoryPay).toBeGreaterThan(gb.statutoryPay);
  });

  it('needs two years of service', () => {
    const result = calculateStatutoryRedundancy(
      { age: 30, yearsOfService: 1, weeklyPay: 600 },
      YEAR,
    );
    expect(result.eligible).toBe(false);
    expect(result.statutoryPay).toBe(0);
  });
});

describe('tax on a redundancy package', () => {
  it('exempts the first £30,000 of redundancy pay', () => {
    const result = calculateTerminationTax(
      { redundancyPay: 25_000, otherIncomeThisTaxYear: 30_000 },
      YEAR,
    );
    expect(result.incomeTax).toBe(0);
    expect(result.nationalInsurance).toBe(0);
    expect(result.netPackage).toBe(25_000);
  });

  it('taxes redundancy pay above £30,000 but charges no NI on it', () => {
    const result = calculateTerminationTax(
      { redundancyPay: 50_000, otherIncomeThisTaxYear: 30_000 },
      YEAR,
    );
    expect(result.taxableRedundancy).toBe(20_000);
    expect(result.nationalInsurance).toBe(0);
    expect(result.incomeTax).toBeGreaterThan(0);
  });

  it('taxes notice pay and holiday pay in full, with NI', () => {
    const result = calculateTerminationTax(
      {
        redundancyPay: 10_000,
        payInLieuOfNotice: 5_000,
        holidayPay: 1_000,
        otherIncomeThisTaxYear: 30_000,
      },
      YEAR,
    );
    // The £10,000 redundancy payment is within the exemption; the £6,000 of
    // notice and holiday pay is not, and bears both tax and NI.
    expect(result.exemptAmount).toBe(10_000);
    expect(result.incomeTax).toBeCloseTo(1_200, 2);
    expect(result.nationalInsurance).toBeCloseTo(480, 2);
  });
});

describe('company car benefit', () => {
  it('uses 4% for a zero emission car', () => {
    expect(appropriatePercentage({ fuelType: 'electric', co2: 0 }, YEAR).percentage).toBe(0.04);
  });

  it('bands plug-in hybrids by electric range, not CO2', () => {
    const long = appropriatePercentage(
      { fuelType: 'plug-in-hybrid', co2: 30, electricRange: 140 },
      YEAR,
    );
    const short = appropriatePercentage(
      { fuelType: 'plug-in-hybrid', co2: 30, electricRange: 25 },
      YEAR,
    );
    // Same emissions, four times the tax.
    expect(long.percentage).toBe(0.04);
    expect(short.percentage).toBe(0.16);
  });

  it('reproduces the frozen band flat spot at 70-79 g/km', () => {
    expect(appropriatePercentage({ fuelType: 'petrol', co2: 72 }, YEAR).percentage).toBe(0.21);
    expect(appropriatePercentage({ fuelType: 'petrol', co2: 77 }, YEAR).percentage).toBe(0.21);
  });

  it('adds four points for a diesel that does not meet RDE2', () => {
    expect(appropriatePercentage({ fuelType: 'petrol', co2: 130 }, YEAR).percentage).toBe(0.32);
    expect(appropriatePercentage({ fuelType: 'diesel', co2: 130 }, YEAR).percentage).toBe(0.36);
    expect(appropriatePercentage({ fuelType: 'diesel-rde2', co2: 130 }, YEAR).percentage).toBe(0.32);
  });

  it('caps the appropriate percentage at 37%', () => {
    expect(appropriatePercentage({ fuelType: 'diesel', co2: 200 }, YEAR).percentage).toBe(0.37);
  });

  it('charges the employee income tax and the employer Class 1A', () => {
    const result = calculateCompanyCar(
      { listPrice: 40_000, fuelType: 'electric', co2: 0, salary: 30_000 },
      YEAR,
    );
    expect(result.carBenefit).toBe(1_600);
    expect(result.employeeTax).toBe(320); // 20% of £1,600
    expect(result.employerClass1a).toBe(240); // 15% of £1,600
  });

  it('charges no fuel benefit on an electric car', () => {
    const result = calculateCompanyCar(
      {
        listPrice: 40_000,
        fuelType: 'electric',
        co2: 0,
        salary: 30_000,
        privateFuelProvided: true,
      },
      YEAR,
    );
    expect(result.fuelBenefit).toBe(0);
  });

  it('uses the £29,200 multiplier for private fuel', () => {
    const result = calculateCompanyCar(
      {
        listPrice: 30_000,
        fuelType: 'petrol',
        co2: 130,
        salary: 30_000,
        privateFuelProvided: true,
      },
      YEAR,
    );
    expect(result.fuelBenefit).toBe(29_200 * 0.32);
  });
});

describe('capital gains tax on property', () => {
  it('splits a gain across the 18% and 24% rates', () => {
    const result = calculatePropertyGain(
      {
        salePrice: 300_000,
        purchasePrice: 200_000,
        buyingAndSellingCosts: 5_000,
        annualIncome: 30_000,
      },
      YEAR,
    );
    expect(result.grossGain).toBe(95_000);
    expect(result.taxableGain).toBe(92_000); // after the £3,000 exemption
    expect(result.basicRateGain).toBe(20_270); // headroom in the basic rate band
    expect(result.totalTax).toBeCloseTo(20_863.8, 2);
  });

  it('charges 24% throughout for a higher rate taxpayer', () => {
    const result = calculatePropertyGain(
      { salePrice: 300_000, purchasePrice: 200_000, annualIncome: 80_000 },
      YEAR,
    );
    expect(result.basicRateGain).toBe(0);
    expect(result.totalTax).toBeCloseTo(97_000 * 0.24, 2);
  });

  it('gives each joint owner their own exemption and band', () => {
    const single = calculatePropertyGain(
      { salePrice: 300_000, purchasePrice: 200_000, annualIncome: 30_000 },
      YEAR,
    );
    const joint = calculatePropertyGain(
      { salePrice: 300_000, purchasePrice: 200_000, annualIncome: 30_000, owners: 2 },
      YEAR,
    );
    expect(joint.totalTax).toBeLessThan(single.totalTax);
  });

  it('applies Private Residence Relief plus the final nine months', () => {
    const result = calculatePropertyGain(
      {
        salePrice: 300_000,
        purchasePrice: 200_000,
        monthsOwned: 120,
        monthsAsMainResidence: 60,
        annualIncome: 30_000,
      },
      YEAR,
    );
    // 69 of 120 months qualify.
    expect(result.privateResidenceRelief).toBeCloseTo(100_000 * (69 / 120), 2);
  });

  it('exempts a gain fully covered by Private Residence Relief', () => {
    const result = calculatePropertyGain(
      {
        salePrice: 400_000,
        purchasePrice: 200_000,
        monthsOwned: 120,
        monthsAsMainResidence: 120,
        annualIncome: 50_000,
      },
      YEAR,
    );
    expect(result.totalTax).toBe(0);
  });
});

describe('VAT flat rate scheme', () => {
  const consultant = { turnoverExVat: 80_000, sectorRate: 0.145, reclaimableInputVat: 1_000 };

  it('catches a consultant as a limited cost trader', () => {
    const result = compareFlatRate({ ...consultant, goodsSpendIncVat: 500 }, YEAR);
    expect(result.isLimitedCostTrader).toBe(true);
    expect(result.appliedRate).toBe(0.165);
    expect(result.limitedCostTraderThreshold).toBe(1_920);
    // 16.5% of gross turnover beats standard accounting for almost nobody.
    expect(result.betterScheme).toBe('standard');
    expect(result.flatRateVatDue).toBe(15_840);
  });

  it('lets a goods-heavy business use its sector rate', () => {
    const result = compareFlatRate({ ...consultant, goodsSpendIncVat: 5_000 }, YEAR);
    expect(result.isLimitedCostTrader).toBe(false);
    expect(result.appliedRate).toBe(0.145);
    expect(result.flatRateVatDue).toBe(13_920);
    expect(result.betterScheme).toBe('flat-rate');
  });

  it('applies the first year discount', () => {
    const result = compareFlatRate(
      { ...consultant, goodsSpendIncVat: 5_000, firstYearOfRegistration: true },
      YEAR,
    );
    expect(result.appliedRate).toBeCloseTo(0.135, 6);
  });

  it('reports scheme eligibility', () => {
    expect(compareFlatRate({ ...consultant, turnoverExVat: 200_000 }, YEAR).eligibleToJoin).toBe(
      false,
    );
    expect(compareFlatRate(consultant, YEAR).eligibleToJoin).toBe(true);
  });
});
