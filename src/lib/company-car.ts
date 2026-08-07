import type { Region, TaxYear } from '../data/types';
import { roundToPence } from './bands';
import { calculateIncomeTax } from './income-tax';

export type FuelType = 'electric' | 'plug-in-hybrid' | 'petrol' | 'diesel' | 'diesel-rde2';

export interface CompanyCarInput {
  /** P11D value: list price including VAT, delivery and options, less capital contributions. */
  readonly listPrice: number;
  readonly fuelType: FuelType;
  readonly co2: number;
  /** Electric-only range in miles. Required for plug-in hybrids. */
  readonly electricRange?: number;
  /** Employer pays for private fuel as well. */
  readonly privateFuelProvided?: boolean;
  /** Annual salary, used to work out the marginal rate the benefit is taxed at. */
  readonly salary: number;
  readonly region?: Region;
}

export interface CompanyCarResult {
  readonly appropriatePercentage: number;
  readonly dieselSupplementApplied: boolean;
  readonly carBenefit: number;
  readonly fuelBenefit: number;
  readonly totalBenefit: number;
  readonly employeeTax: number;
  readonly employeeTaxMonthly: number;
  readonly effectiveTaxRate: number;
  readonly employerClass1a: number;
  readonly employerTotalCost: number;
}

/**
 * The appropriate percentage for a company car.
 *
 * Three separate rules depending on the car:
 *  - zero emission: a single flat percentage (4% in 2026/27)
 *  - 1–50 g/km: banded by electric-only range, NOT by CO2
 *  - 51 g/km and above: a CO2 ladder, plus 4 points for a non-RDE2 diesel
 *
 * The 2026/27 ladder has a flat spot — 70–74 and 75–79 g/km both sit at 21% —
 * because bands at 75 g/km and above were frozen while lower ones rose 1 point.
 */
export function appropriatePercentage(
  input: Pick<CompanyCarInput, 'fuelType' | 'co2' | 'electricRange'>,
  year: TaxYear,
): { readonly percentage: number; readonly dieselSupplementApplied: boolean } {
  const cars = year.companyCars;

  if (input.fuelType === 'electric' || input.co2 === 0) {
    return { percentage: cars.zeroEmissionPercentage, dieselSupplementApplied: false };
  }

  let percentage: number;

  if (input.co2 <= 50) {
    const range = input.electricRange ?? 0;
    const band =
      cars.hybridBands.find(
        (b) => range >= b.minElectricRange && (b.maxElectricRange === null || range <= b.maxElectricRange),
      ) ?? cars.hybridBands[cars.hybridBands.length - 1]!;
    percentage = band.percentage;
  } else {
    const band =
      cars.co2Bands.find((b) => b.upTo === null || input.co2 <= b.upTo) ??
      cars.co2Bands[cars.co2Bands.length - 1]!;
    percentage = band.percentage;
  }

  // Diesels meeting the RDE2 standard escape the supplement; older ones do not.
  const dieselSupplementApplied = input.fuelType === 'diesel';
  if (dieselSupplementApplied) {
    percentage = Math.min(cars.maximumPercentage, percentage + cars.dieselSupplement);
  }

  return { percentage: Math.min(cars.maximumPercentage, percentage), dieselSupplementApplied };
}

export function calculateCompanyCar(input: CompanyCarInput, year: TaxYear): CompanyCarResult {
  const { listPrice, salary, privateFuelProvided = false, region = 'england-nireland' } = input;
  const { percentage, dieselSupplementApplied } = appropriatePercentage(input, year);

  const carBenefit = roundToPence(listPrice * percentage);
  // Electric cars have no fuel benefit charge — electricity is not a fuel for
  // these purposes, so employer-paid charging is not caught here.
  const fuelBenefit =
    privateFuelProvided && input.fuelType !== 'electric'
      ? roundToPence(year.companyCars.fuelBenefitMultiplier * percentage)
      : 0;
  const totalBenefit = roundToPence(carBenefit + fuelBenefit);

  // The benefit is stacked on salary, so it can be taxed across two bands.
  const taxBefore = calculateIncomeTax({ grossIncome: salary, region }, year).total;
  const taxAfter = calculateIncomeTax(
    { grossIncome: salary, region, benefitsInKind: totalBenefit },
    year,
  ).total;
  const employeeTax = roundToPence(taxAfter - taxBefore);

  // Employers pay Class 1A on the benefit; employees pay no NI on it.
  const employerClass1a = roundToPence(totalBenefit * year.nationalInsurance.employer.class1aRate);

  return {
    appropriatePercentage: percentage,
    dieselSupplementApplied,
    carBenefit,
    fuelBenefit,
    totalBenefit,
    employeeTax,
    employeeTaxMonthly: roundToPence(employeeTax / 12),
    effectiveTaxRate: totalBenefit > 0 ? employeeTax / totalBenefit : 0,
    employerClass1a,
    employerTotalCost: employerClass1a,
  };
}

/**
 * Is employer-paid private fuel worth having?
 *
 * The fuel benefit is a flat charge regardless of how much fuel you actually
 * use, so below a certain private mileage it costs more in tax than the fuel is
 * worth. Returns the break-even private mileage.
 */
export function fuelBenefitBreakEven(
  input: CompanyCarInput,
  year: TaxYear,
  pencePerLitre: number,
  milesPerGallon: number,
): { readonly taxCost: number; readonly breakEvenMiles: number } {
  const { percentage } = appropriatePercentage(input, year);
  const benefit = year.companyCars.fuelBenefitMultiplier * percentage;

  const taxBefore = calculateIncomeTax({ grossIncome: input.salary, region: input.region ?? 'england-nireland' }, year).total;
  const taxAfter = calculateIncomeTax(
    { grossIncome: input.salary, region: input.region ?? 'england-nireland', benefitsInKind: benefit },
    year,
  ).total;
  const taxCost = roundToPence(taxAfter - taxBefore);

  const LITRES_PER_GALLON = 4.54609;
  const costPerMile = (pencePerLitre / 100) * (LITRES_PER_GALLON / milesPerGallon);

  return {
    taxCost,
    breakEvenMiles: costPerMile > 0 ? Math.round(taxCost / costPerMile) : 0,
  };
}
