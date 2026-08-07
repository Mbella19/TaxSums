import { describe, expect, it } from 'vitest';
import { TAX_YEAR_2026_27 as YEAR } from '../src/data/tax-years';
import { calculateStudentLoans } from '../src/lib/student-loans';
import { calculateTakeHome, type TakeHomeInput } from '../src/lib/take-home';

const base: TakeHomeInput = {
  grossSalary: 50_000,
  region: 'england-nireland',
  pension: { method: 'none', kind: 'percent', value: 0 },
  studentLoanPlans: [],
};

const takeHome = (overrides: Partial<TakeHomeInput> = {}) =>
  calculateTakeHome({ ...base, ...overrides }, YEAR);

describe('take-home pay', () => {
  it('matches the published figure for £50,000', () => {
    const result = takeHome();
    expect(result.incomeTax.total).toBe(7_486);
    expect(result.nationalInsurance.total).toBe(2_994.4);
    expect(result.takeHomeAnnual).toBe(39_519.6);
    expect(result.takeHomeMonthly).toBe(3_293.3);
  });

  it('matches the published figure for £150,000', () => {
    const result = takeHome({ grossSalary: 150_000 });
    expect(result.incomeTax.total).toBe(53_703);
    expect(result.nationalInsurance.total).toBe(5_010.6);
    expect(result.takeHomeAnnual).toBe(91_286.4);
  });

  it('gives everything back on a salary below the allowance', () => {
    expect(takeHome({ grossSalary: 12_000 }).takeHomeAnnual).toBe(12_000);
  });
});

describe('the three pension arrangements', () => {
  const contribution = { kind: 'amount' as const, value: 5_000 };

  it('salary sacrifice alone reduces the National Insurance base', () => {
    const sacrifice = takeHome({ pension: { method: 'salary-sacrifice', ...contribution } });
    const netPay = takeHome({ pension: { method: 'net-pay', ...contribution } });

    // Both give full income tax relief at 20%…
    expect(sacrifice.incomeTax.total).toBe(6_486);
    expect(netPay.incomeTax.total).toBe(6_486);

    // …but only sacrifice escapes the 8% employee NI on £5,000.
    expect(netPay.nationalInsurance.total - sacrifice.nationalInsurance.total).toBeCloseTo(400, 2);
    expect(sacrifice.takeHomeAnnual - netPay.takeHomeAnnual).toBeCloseTo(400, 2);
  });

  it('leaves a basic rate taxpayer identical under net pay and relief at source', () => {
    const netPay = takeHome({ pension: { method: 'net-pay', ...contribution } });
    const reliefAtSource = takeHome({ pension: { method: 'relief-at-source', ...contribution } });

    // Relief at source shows more tax but a smaller cash contribution — the
    // provider has already reclaimed the 20%. Take-home must come out equal.
    expect(reliefAtSource.incomeTax.total).toBeGreaterThan(netPay.incomeTax.total);
    expect(reliefAtSource.pension.costToEmployee).toBe(4_000);
    expect(netPay.pension.costToEmployee).toBe(5_000);
    expect(reliefAtSource.takeHomeAnnual).toBeCloseTo(netPay.takeHomeAnnual, 2);
  });

  it('gives a higher rate taxpayer the same result either way', () => {
    const netPay = takeHome({
      grossSalary: 60_000,
      pension: { method: 'net-pay', ...contribution },
    });
    const reliefAtSource = takeHome({
      grossSalary: 60_000,
      pension: { method: 'relief-at-source', ...contribution },
    });

    expect(netPay.takeHomeAnnual).toBeCloseTo(42_357.4, 2);
    expect(reliefAtSource.takeHomeAnnual).toBeCloseTo(42_357.4, 2);
  });

  it('saves only 2% NI when the sacrifice sits above the upper earnings limit', () => {
    const sacrifice = takeHome({
      grossSalary: 60_000,
      pension: { method: 'salary-sacrifice', ...contribution },
    });
    const netPay = takeHome({
      grossSalary: 60_000,
      pension: { method: 'net-pay', ...contribution },
    });

    // £5,000 × 2%, not × 8% — the sacrificed pay came off the top.
    expect(sacrifice.takeHomeAnnual - netPay.takeHomeAnnual).toBeCloseTo(100, 2);
  });

  it('adds the provider top-up to the total going into the pension', () => {
    const result = takeHome({ pension: { method: 'relief-at-source', ...contribution } });
    expect(result.pension.reliefAtSourceTopUp).toBe(1_000);
    expect(result.pension.totalIntoPension).toBe(5_000);
  });
});

describe('the £100,000 tax trap', () => {
  it('charges 60% at the margin between £100,000 and £125,140', () => {
    const result = takeHome({ grossSalary: 110_000 });
    // 40% income tax + 20% from losing 50p of allowance, + 2% NI.
    expect(result.marginalRate).toBeCloseTo(0.62, 2);
  });

  it('lets a pension contribution rescue the whole personal allowance', () => {
    const withoutPension = takeHome({ grossSalary: 110_000 });
    const withPension = takeHome({
      grossSalary: 110_000,
      pension: { method: 'salary-sacrifice', kind: 'amount', value: 10_000 },
    });

    expect(withoutPension.incomeTax.personalAllowance).toBe(7_570);
    expect(withPension.incomeTax.personalAllowance).toBe(12_570);

    // £10,000 into the pension cuts the income tax bill by £6,000 — 60% relief.
    expect(withoutPension.incomeTax.total - withPension.incomeTax.total).toBeCloseTo(6_000, 2);
  });

  it('rescues the allowance through relief at source too', () => {
    // Relief at source does not reduce taxable income, but it does reduce
    // adjusted net income — which is what the taper is measured against.
    const result = takeHome({
      grossSalary: 110_000,
      pension: { method: 'relief-at-source', kind: 'amount', value: 10_000 },
    });
    expect(result.incomeTax.personalAllowance).toBe(12_570);
  });
});

describe('student loans', () => {
  it('rounds each repayment down to whole pounds', () => {
    // £615 over the Plan 2 threshold × 9% = £55.35.
    const result = calculateStudentLoans(30_000, ['plan2'], YEAR);
    expect(result.total).toBe(55);
  });

  it('charges nothing below the threshold', () => {
    expect(calculateStudentLoans(24_000, ['plan2'], YEAR).total).toBe(0);
  });

  it('uses the right threshold for each plan', () => {
    expect(calculateStudentLoans(50_000, ['plan1'], YEAR).total).toBe(2_079);
    expect(calculateStudentLoans(50_000, ['plan2'], YEAR).total).toBe(1_855);
    expect(calculateStudentLoans(50_000, ['plan4'], YEAR).total).toBe(1_458);
    expect(calculateStudentLoans(50_000, ['plan5'], YEAR).total).toBe(2_250);
  });

  it('stacks a postgraduate loan on top of an undergraduate plan', () => {
    const result = calculateStudentLoans(50_000, ['plan2', 'postgrad'], YEAR);
    expect(result.repayments).toHaveLength(2);
    // 9% over £29,385 plus 6% over £21,000.
    expect(result.total).toBe(1_855 + 1_740);
  });

  it('refuses two undergraduate plans at once', () => {
    expect(() => calculateStudentLoans(50_000, ['plan1', 'plan2'], YEAR)).toThrow(
      /only one undergraduate plan/i,
    );
  });

  it('is reduced by salary sacrifice but not by other pension arrangements', () => {
    const sacrifice = takeHome({
      pension: { method: 'salary-sacrifice', kind: 'amount', value: 5_000 },
      studentLoanPlans: ['plan2'],
    });
    const netPay = takeHome({
      pension: { method: 'net-pay', kind: 'amount', value: 5_000 },
      studentLoanPlans: ['plan2'],
    });

    expect(sacrifice.studentLoans.total).toBe(1_405); // on £45,000
    expect(netPay.studentLoans.total).toBe(1_855); // on £50,000
  });

  it('reaches a 15% marginal deduction with Plan 2 and a postgraduate loan', () => {
    const result = takeHome({ grossSalary: 40_000, studentLoanPlans: ['plan2', 'postgrad'] });
    // 20% tax + 8% NI + 9% + 6% loans.
    expect(result.marginalRate).toBeCloseTo(0.43, 2);
  });
});

describe('benefits in kind and State Pension age', () => {
  it('taxes a company car but charges no employee NI on it', () => {
    const withCar = takeHome({ grossSalary: 30_000, benefitsInKind: 5_000 });
    const withoutCar = takeHome({ grossSalary: 30_000 });

    // £5,000 of benefit, all within the basic rate band.
    expect(withCar.incomeTax.total - withoutCar.incomeTax.total).toBe(1_000);
    // Employee NI is charged on earnings only — the employer pays Class 1A.
    expect(withCar.nationalInsurance.total).toBe(withoutCar.nationalInsurance.total);
  });

  it('can push an earner into the higher rate band', () => {
    // A £5,000 car on a £50,000 salary is not £1,000 of tax. Total income
    // becomes £55,000, so £4,730 of it is taxed at 40%, not 20%.
    const withCar = takeHome({ benefitsInKind: 5_000 });
    expect(withCar.incomeTax.total).toBe(9_432);
    expect(withCar.incomeTax.total - takeHome().incomeTax.total).toBe(1_946);
  });

  it('stops National Insurance above State Pension age', () => {
    const result = takeHome({ overStatePensionAge: true });
    expect(result.nationalInsurance.total).toBe(0);
    expect(result.incomeTax.total).toBe(7_486);
  });
});
