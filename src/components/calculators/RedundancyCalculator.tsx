import { useMemo } from 'preact/hooks';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { calculateStatutoryRedundancy, calculateTerminationTax } from '../../lib/redundancy';
import {
  ChoiceGroup,
  FigureRow,
  gbp,
  Headline,
  MoneyInput,
  NumberInput,
  plural,
  useUrlState,
} from './ui';

export default function RedundancyCalculator() {
  const [state, update] = useUrlState({
    age: 45,
    years: 8,
    weeklyPay: 700,
    nation: 'gb' as 'gb' | 'ni',
    enhanced: 0,
    notice: 0,
    holiday: 0,
    earnedThisYear: 20000,
  });

  const statutory = useMemo(
    () =>
      calculateStatutoryRedundancy(
        {
          age: Math.max(16, state.age),
          yearsOfService: Math.max(0, state.years),
          weeklyPay: Math.max(0, state.weeklyPay),
          northernIreland: state.nation === 'ni',
        },
        YEAR,
      ),
    [state],
  );

  const totalRedundancy = statutory.statutoryPay + Math.max(0, state.enhanced);

  const tax = useMemo(
    () =>
      calculateTerminationTax(
        {
          redundancyPay: totalRedundancy,
          payInLieuOfNotice: Math.max(0, state.notice),
          holidayPay: Math.max(0, state.holiday),
          otherIncomeThisTaxYear: Math.max(0, state.earnedThisYear),
        },
        YEAR,
      ),
    [totalRedundancy, state.notice, state.holiday, state.earnedThisYear],
  );

  return (
    <div class="calc">
      <div class="calc-inputs">
        <NumberInput
          id="age"
          label="Your age"
          value={state.age}
          onInput={(age) => update({ age })}
          min={16}
          max={80}
        />
        <NumberInput
          id="years"
          label="Full years of service"
          value={state.years}
          onInput={(years) => update({ years })}
          min={0}
          max={50}
          hint="Only complete years count. Maximum 20."
        />
        <MoneyInput
          id="weekly-pay"
          label="Gross weekly pay"
          value={state.weeklyPay}
          onInput={(weeklyPay) => update({ weeklyPay })}
          step={10}
          hint={`Capped at ${gbp(statutory.cap)} for the statutory calculation.`}
        />
        <ChoiceGroup
          legend="Where do you work?"
          name="nation"
          value={state.nation}
          options={[
            { value: 'gb', label: 'Great Britain' },
            { value: 'ni', label: 'Northern Ireland' },
          ]}
          onInput={(value) => update({ nation: value })}
          hint="England, Scotland and Wales share one weekly pay cap. Northern Ireland sets its own, and it is higher."
        />
        <MoneyInput
          id="enhanced"
          label="Enhanced or ex-gratia payment"
          value={state.enhanced}
          onInput={(enhanced) => update({ enhanced })}
          step={500}
          hint="Anything your employer pays above the statutory minimum."
        />
        <MoneyInput
          id="notice"
          label="Pay in lieu of notice"
          value={state.notice}
          onInput={(notice) => update({ notice })}
          step={500}
          hint="Fully taxable and subject to National Insurance."
        />
        <MoneyInput
          id="holiday"
          label="Outstanding holiday pay"
          value={state.holiday}
          onInput={(holiday) => update({ holiday })}
          step={100}
        />
        <MoneyInput
          id="earned"
          label="Salary already earned this tax year"
          value={state.earnedThisYear}
          onInput={(earnedThisYear) => update({ earnedThisYear })}
          step={1000}
          hint="Since 6 April. Sets the rate your package is taxed at."
        />
      </div>

      <div class="calc-result" aria-live="polite">
        {statutory.eligible ? (
          <>
            <Headline
              amount={gbp(tax.netPackage)}
              caption={`in your pocket, from a ${gbp(tax.totalPackage)} package`}
            />

            <FigureRow
              items={[
                { label: 'Statutory redundancy', value: gbp(statutory.statutoryPay) },
                { label: 'Weeks entitlement', value: `${statutory.totalWeeks}` },
                { label: 'Income tax', value: gbp(tax.incomeTax) },
                { label: 'National Insurance', value: gbp(tax.nationalInsurance) },
              ]}
            />

            {statutory.weeklyPayCapped && (
              <p class="note">
                <strong>Your weekly pay is capped.</strong>
                You earn {gbp(state.weeklyPay)} a week, but the statutory calculation uses a
                maximum of {gbp(statutory.cap)}. That cap is why the statutory maximum is{' '}
                {gbp(statutory.cap * 30)} however much you earn.
              </p>
            )}

            {statutory.yearsCapped && (
              <p class="note">
                <strong>Only your most recent 20 years count.</strong>
                You have {plural(Math.floor(state.years), 'year')} of service but the statutory
                calculation stops at 20. It counts back from today, so you keep the years most
                likely to fall in the 1.5-week band.
              </p>
            )}

            {tax.taxableRedundancy > 0 && (
              <p class="warning">
                <strong>Part of your redundancy payment is taxable.</strong>
                The first {gbp(tax.exemption)} of redundancy pay is tax free.{' '}
                {gbp(tax.taxableRedundancy)} of yours sits above that and is taxed as income —
                though it still bears no National Insurance.
              </p>
            )}

            {tax.fullyTaxableElements > 0 && (
              <p class="warning">
                <strong>Notice and holiday pay are not covered by the £30,000.</strong>
                {gbp(tax.fullyTaxableElements)} of your package is notice or holiday pay. That is
                ordinary earnings: fully taxable and subject to National Insurance, no matter how
                small the rest of the package is. It is the most common misunderstanding about
                redundancy tax.
              </p>
            )}

            <div class="table-scroll">
              <table>
                <caption>How your statutory entitlement was built up</caption>
                <thead>
                  <tr>
                    <th scope="col">Year of service</th>
                    <th scope="col">Your age that year</th>
                    <th scope="col">Weeks earned</th>
                  </tr>
                </thead>
                <tbody>
                  {statutory.breakdown.map((row, index) => (
                    <tr key={index}>
                      <td>{index === 0 ? 'Most recent' : `${index + 1} years ago`}</td>
                      <td>{row.ageDuringYear}</td>
                      <td>{row.weeks}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>
                      {statutory.totalWeeks} weeks × {gbp(statutory.weeklyPayUsed)}
                    </td>
                    <td>{gbp(statutory.statutoryPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="table-scroll">
              <table>
                <caption>Tax on the whole package</caption>
                <thead>
                  <tr>
                    <th scope="col">Element</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Tax free?</th>
                    <th scope="col">NI?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Redundancy pay</td>
                    <td>{gbp(totalRedundancy)}</td>
                    <td>{gbp(tax.exemptAmount)} of it</td>
                    <td>No NI</td>
                  </tr>
                  <tr>
                    <td>Pay in lieu of notice</td>
                    <td>{gbp(state.notice)}</td>
                    <td>Fully taxable</td>
                    <td>NI due</td>
                  </tr>
                  <tr>
                    <td>Holiday pay</td>
                    <td>{gbp(state.holiday)}</td>
                    <td>Fully taxable</td>
                    <td>NI due</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>Net package</td>
                    <td>{gbp(tax.totalPackage)}</td>
                    <td colSpan={2}>{gbp(tax.netPackage)} after tax and NI</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <p class="warning">
            <strong>No statutory entitlement.</strong>
            {statutory.ineligibleReason} You may still be owed notice pay, holiday pay and anything
            your contract promises, and your employer can always pay more than the minimum.
          </p>
        )}
      </div>
    </div>
  );
}
