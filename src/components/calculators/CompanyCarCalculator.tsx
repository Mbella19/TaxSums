import { useMemo } from 'preact/hooks';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { appropriatePercentage, calculateCompanyCar, type FuelType } from '../../lib/company-car';
import { ChoiceGroup, FigureRow, gbp, Headline, MoneyInput, NumberInput, pct, useUrlState } from './ui';

const FUEL_TYPES = [
  { value: 'electric' as const, label: 'Electric' },
  { value: 'plug-in-hybrid' as const, label: 'Plug-in hybrid' },
  { value: 'petrol' as const, label: 'Petrol' },
  { value: 'diesel-rde2' as const, label: 'Diesel (RDE2)' },
  { value: 'diesel' as const, label: 'Diesel (older)' },
];

export default function CompanyCarCalculator() {
  const [state, update] = useUrlState({
    listPrice: 40000,
    fuelType: 'electric' as FuelType,
    co2: 0,
    range: 40,
    salary: 45000,
    fuel: false,
  });

  const isElectric = state.fuelType === 'electric';
  const isHybrid = state.fuelType === 'plug-in-hybrid';

  const input = useMemo(
    () => ({
      listPrice: Math.max(0, state.listPrice),
      fuelType: state.fuelType,
      co2: isElectric ? 0 : Math.max(0, state.co2),
      electricRange: state.range,
      salary: Math.max(0, state.salary),
      privateFuelProvided: state.fuel,
    }),
    [state, isElectric],
  );

  const result = useMemo(() => calculateCompanyCar(input, YEAR), [input]);

  // Compare against an electric equivalent, which is the decision most
  // people are actually making.
  const electricEquivalent = useMemo(
    () =>
      calculateCompanyCar(
        { ...input, fuelType: 'electric', co2: 0, privateFuelProvided: false },
        YEAR,
      ),
    [input],
  );

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="list-price"
          label="P11D value"
          value={state.listPrice}
          onInput={(listPrice) => update({ listPrice })}
          step={1000}
          hint="List price including VAT, delivery and options — not what the company paid."
        />

        <MoneyInput
          id="salary"
          label="Your annual salary"
          value={state.salary}
          onInput={(salary) => update({ salary })}
          step={1000}
        />

        <ChoiceGroup
          legend="Fuel type"
          name="fuel-type"
          value={state.fuelType}
          options={FUEL_TYPES}
          onInput={(value) => update({ fuelType: value })}
          span
          hint={
            state.fuelType === 'diesel'
              ? 'Diesels that do not meet the RDE2 standard pay a 4 percentage point supplement.'
              : undefined
          }
        />

        {!isElectric && (
          <NumberInput
            id="co2"
            label="CO2 emissions (g/km)"
            value={state.co2}
            onInput={(co2) => update({ co2 })}
            max={500}
            hint="On the V5C registration document."
          />
        )}

        {isHybrid && (
          <NumberInput
            id="range"
            label="Electric-only range (miles)"
            value={state.range}
            onInput={(range) => update({ range })}
            max={200}
            hint="For a plug-in hybrid this matters far more than CO2."
          />
        )}

        {!isElectric && (
          <ChoiceGroup
            legend="Does your employer pay for private fuel?"
            name="fuel"
            value={state.fuel ? 'yes' : 'no'}
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ]}
            onInput={(value) => update({ fuel: value === 'yes' })}
          />
        )}
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={gbp(result.employeeTaxMonthly)}
          caption={`per month in tax, ${gbp(result.employeeTax)} a year`}
        />

        <FigureRow
          items={[
            { label: 'Appropriate %', value: pct(result.appropriatePercentage, 0) },
            { label: 'Taxable benefit', value: gbp(result.totalBenefit) },
            ...(result.fuelBenefit > 0
              ? [{ label: 'Of which fuel', value: gbp(result.fuelBenefit) }]
              : []),
            { label: 'Employer Class 1A', value: gbp(result.employerClass1a) },
          ]}
        />

        {!isElectric && electricEquivalent.employeeTax < result.employeeTax && (
          <p class="note">
            <strong>An electric car at the same price would cost you {gbp(electricEquivalent.employeeTax)} a year.</strong>
            That is {gbp(result.employeeTax - electricEquivalent.employeeTax)} less than this car,
            because zero-emission vehicles are charged at just{' '}
            {pct(YEAR.companyCars.zeroEmissionPercentage, 0)} for {YEAR.label}. The rate rises by
            one point a year to 2027/28 and then two points a year, so the gap narrows over time —
            but it is still the single biggest lever on company car tax.
          </p>
        )}

        {result.dieselSupplementApplied && (
          <p class="warning">
            <strong>The 4% diesel supplement applies.</strong>
            Diesel cars that do not meet the RDE2 emissions standard pay four extra percentage
            points, capped at {pct(YEAR.companyCars.maximumPercentage, 0)}. Most diesels registered
            from 2021 do meet RDE2 — check before assuming, because it is worth{' '}
            {gbp(state.listPrice * 0.04 * 0.4)} a year to a higher rate taxpayer on this car.
          </p>
        )}

        {result.fuelBenefit > 0 && (
          <p class="warning">
            <strong>Free private fuel is rarely worth having.</strong>
            The charge is a flat {gbp(YEAR.companyCars.fuelBenefitMultiplier)} multiplied by your
            car's {pct(result.appropriatePercentage, 0)}, whatever your actual mileage. You are
            paying {gbp(result.employeeTax - (result.carBenefit * result.effectiveTaxRate))} a year
            in tax for it. Unless you do very high private mileage, paying for your own fuel is
            cheaper.
          </p>
        )}

        <div class="table-scroll">
          <table>
            <caption>How the benefit was worked out</caption>
            <tbody>
              <tr>
                <td>P11D value</td>
                <td>{gbp(state.listPrice)}</td>
              </tr>
              <tr>
                <td>Appropriate percentage</td>
                <td>{pct(result.appropriatePercentage, 0)}</td>
              </tr>
              <tr>
                <td>Car benefit</td>
                <td>{gbp(result.carBenefit)}</td>
              </tr>
              {result.fuelBenefit > 0 && (
                <tr>
                  <td>
                    Fuel benefit ({gbp(YEAR.companyCars.fuelBenefitMultiplier)} ×{' '}
                    {pct(result.appropriatePercentage, 0)})
                  </td>
                  <td>{gbp(result.fuelBenefit)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Tax you pay</td>
                <td>{gbp(result.employeeTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="table-scroll">
          <table>
            <caption>{YEAR.label} appropriate percentages</caption>
            <thead>
              <tr>
                <th scope="col">Car</th>
                <th scope="col">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Electric (0 g/km)</td>
                <td>{pct(YEAR.companyCars.zeroEmissionPercentage, 0)}</td>
              </tr>
              {YEAR.companyCars.hybridBands.map((band) => (
                <tr key={band.minElectricRange}>
                  <td>
                    Plug-in hybrid,{' '}
                    {band.maxElectricRange === null
                      ? `${band.minElectricRange}+ mile range`
                      : `${band.minElectricRange}–${band.maxElectricRange} mile range`}
                  </td>
                  <td>{pct(band.percentage, 0)}</td>
                </tr>
              ))}
              <tr>
                <td>Petrol, 51–54 g/km</td>
                <td>
                  {pct(appropriatePercentage({ fuelType: 'petrol', co2: 52 }, YEAR).percentage, 0)}
                </td>
              </tr>
              <tr>
                <td>Petrol, 100–104 g/km</td>
                <td>
                  {pct(appropriatePercentage({ fuelType: 'petrol', co2: 102 }, YEAR).percentage, 0)}
                </td>
              </tr>
              <tr>
                <td>Petrol, 155 g/km and above</td>
                <td>{pct(YEAR.companyCars.maximumPercentage, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
