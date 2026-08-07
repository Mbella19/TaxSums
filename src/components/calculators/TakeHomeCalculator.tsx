import { useMemo } from 'preact/hooks';
import type { LoanPlan, Region } from '../../data/types';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { calculateTakeHome } from '../../lib/take-home';
import type { PensionMethod } from '../../lib/pension';
import {
  Breakdown,
  ChoiceGroup,
  CheckGroup,
  FigureRow,
  gbp,
  Headline,
  MoneyInput,
  NumberInput,
  pct,
  ResultActions,
  Select,
  useUrlState,
} from './ui';

interface Props {
  /** Locks the region selector, for the Scotland-specific page. */
  fixedRegion?: Region;
}

const REGIONS = [
  { value: 'england-nireland' as const, label: 'England / NI' },
  { value: 'scotland' as const, label: 'Scotland' },
  { value: 'wales' as const, label: 'Wales' },
];

const PENSION_METHODS = [
  { value: 'none' as const, label: 'No pension' },
  { value: 'salary-sacrifice' as const, label: 'Salary sacrifice' },
  { value: 'net-pay' as const, label: 'Net pay' },
  { value: 'relief-at-source' as const, label: 'Relief at source' },
];

const LOAN_PLANS = [
  { value: 'plan1', label: 'Plan 1' },
  { value: 'plan2', label: 'Plan 2' },
  { value: 'plan4', label: 'Plan 4' },
  { value: 'plan5', label: 'Plan 5' },
  { value: 'postgrad', label: 'Postgraduate' },
];

const UNDERGRADUATE: readonly string[] = ['plan1', 'plan2', 'plan4', 'plan5'];

const PENSION_EXPLAINERS: Record<PensionMethod, string> = {
  none: '',
  'salary-sacrifice':
    'You give up salary before it is paid, so it escapes income tax and National Insurance. The only arrangement that saves NI.',
  'net-pay':
    'Taken from your gross pay before income tax but after National Insurance. Full tax relief straight away, no NI saving.',
  'relief-at-source':
    'Taken from pay that has already been taxed. Your provider reclaims 20%, so you pay 80% of the contribution. Higher rate relief must be claimed from HMRC.',
};

export default function TakeHomeCalculator({ fixedRegion }: Props) {
  const [state, update] = useUrlState({
    salary: 45000,
    region: (fixedRegion ?? 'england-nireland') as Region,
    pensionMethod: 'none' as PensionMethod,
    pensionPercent: 5,
    loans: [] as string[],
    bik: 0,
    overSpa: false,
  });

  const region = fixedRegion ?? state.region;

  const result = useMemo(
    () =>
      calculateTakeHome(
        {
          grossSalary: Math.max(0, state.salary),
          region,
          pension: {
            method: state.pensionMethod,
            kind: 'percent',
            value: state.pensionPercent,
          },
          studentLoanPlans: state.loans as LoanPlan[],
          benefitsInKind: Math.max(0, state.bik),
          overStatePensionAge: state.overSpa,
        },
        YEAR,
      ),
    [state, region],
  );

  // Only one undergraduate plan can apply at a time; selecting a second
  // replaces the first rather than throwing.
  const setLoans = (next: string[]) => {
    const undergrad = next.filter((p) => UNDERGRADUATE.includes(p));
    const cleaned =
      undergrad.length > 1
        ? [
            ...next.filter((p) => !UNDERGRADUATE.includes(p)),
            undergrad[undergrad.length - 1]!,
          ]
        : next;
    update({ loans: cleaned });
  };

  const inTaper =
    result.incomeTax.adjustedNetIncome > YEAR.incomeTax.taperThreshold &&
    result.incomeTax.personalAllowance > 0;

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="salary"
          label="Gross annual salary"
          value={state.salary}
          onInput={(salary) => update({ salary })}
          step={500}
        />

        {!fixedRegion && (
          <ChoiceGroup
            legend="Where you live"
            name="region"
            value={state.region}
            options={REGIONS}
            onInput={(value) => update({ region: value })}
            hint="Scotland sets its own income tax bands."
          />
        )}

        <ChoiceGroup
          legend="Pension arrangement"
          name="pension"
          value={state.pensionMethod}
          options={PENSION_METHODS}
          onInput={(value) => update({ pensionMethod: value })}
          span
          hint={PENSION_EXPLAINERS[state.pensionMethod] || 'Ask your payroll team which one your scheme uses — it changes your take-home pay.'}
        />

        {state.pensionMethod !== 'none' && (
          <NumberInput
            id="pension-percent"
            label="Your contribution (% of salary)"
            value={state.pensionPercent}
            onInput={(pensionPercent) => update({ pensionPercent })}
            min={0}
            max={100}
            step={0.5}
            hint="The total going into the pension, before any relief is added."
          />
        )}

        <CheckGroup
          legend="Student loans"
          values={state.loans}
          options={LOAN_PLANS}
          onInput={setLoans}
          span
          hint="Plan 4 is the Scottish plan. A postgraduate loan is repaid alongside an undergraduate plan, not instead of it."
        />

        <MoneyInput
          id="bik"
          label="Taxable benefits in kind"
          value={state.bik}
          onInput={(bik) => update({ bik })}
          step={100}
          hint="Company car, medical insurance. Taxed as income, but you pay no NI on them."
        />

        <Select
          id="over-spa"
          label="Over State Pension age?"
          value={state.overSpa ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes — no employee NI' },
          ]}
          onInput={(value) => update({ overSpa: value === 'yes' })}
        />
      </div>

      {/*
        aria-live so a screen reader announces the new figure when an input
        changes. "polite" rather than "assertive" — it should not interrupt
        someone mid-way through typing a salary.
      */}
      <div class="calc-result" aria-live="polite">
        <Headline
          amount={gbp(result.takeHomeMonthly)}
          caption="per month"
          sub={`${gbp(result.takeHomeAnnual)} a year · ${gbp(result.takeHomeWeekly)} a week · ${gbp(result.takeHomeDaily)} a day`}
        />

        <Breakdown
          segments={[
            { label: 'You keep', amount: result.takeHomeAnnual, tone: 'keep' },
            { label: 'Income tax', amount: result.incomeTax.total, tone: 'tax' },
            { label: 'NI', amount: result.nationalInsurance.total, tone: 'ni' },
            { label: 'Student loan', amount: result.studentLoans.total, tone: 'loan' },
            { label: 'Pension', amount: result.pension.costToEmployee, tone: 'pension' },
          ]}
        />

        <FigureRow
          items={[
            { label: 'Income tax', value: gbp(result.incomeTax.total) },
            { label: 'National Insurance', value: gbp(result.nationalInsurance.total) },
            ...(result.studentLoans.total > 0
              ? [{ label: 'Student loan', value: gbp(result.studentLoans.total) }]
              : []),
            ...(result.pension.costToEmployee > 0
              ? [{ label: 'Pension', value: gbp(result.pension.costToEmployee) }]
              : []),
            { label: 'Effective rate', value: pct(result.effectiveRate) },
            { label: 'Marginal rate', value: pct(result.marginalRate) },
          ]}
        />

        {inTaper && (
          <p class="warning">
            <strong>You are in the £100,000 tax trap.</strong>
            You have lost {gbp(result.incomeTax.personalAllowanceLost)} of your personal allowance,
            and every extra pound you earn is taxed at {pct(result.marginalRate)}. A pension
            contribution here gets relief at that same rate —{' '}
            <a href="/guides/the-100k-tax-trap/">how the trap works</a>.
          </p>
        )}

        {result.pension.reliefAtSourceTopUp > 0 && (
          <p class="note">
            <strong>Your pension gets more than you pay in.</strong>
            You pay {gbp(result.pension.costToEmployee)} and your provider adds{' '}
            {gbp(result.pension.reliefAtSourceTopUp)} in basic rate relief, so{' '}
            {gbp(result.pension.grossContribution)} lands in the pension.
            {result.marginalRate > 0.3 &&
              ' As a higher rate taxpayer you must claim the rest from HMRC yourself — it does not happen automatically.'}
          </p>
        )}


        <ResultActions />
      </div>

      <div class="calc-detail">
        <div class="table-scroll">
          <table>
            <caption>How this was worked out</caption>
            <thead>
              <tr>
                <th scope="col">Band</th>
                <th scope="col">Amount taxed</th>
                <th scope="col">Rate</th>
                <th scope="col">Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Personal allowance</td>
                <td>{gbp(result.incomeTax.personalAllowance)}</td>
                <td>0%</td>
                <td>{gbp(0)}</td>
              </tr>
              {result.incomeTax.bands.map((band) => (
                <tr key={band.label}>
                  <td>{band.label}</td>
                  <td>{gbp(band.amount)}</td>
                  <td>{pct(band.rate)}</td>
                  <td>{gbp(band.charge)}</td>
                </tr>
              ))}
              {result.nationalInsurance.mainBandCharge > 0 && (
                <tr>
                  <td>National Insurance</td>
                  <td>{gbp(result.nationalInsurance.mainBandEarnings)}</td>
                  <td>{pct(YEAR.nationalInsurance.employee.mainRate)}</td>
                  <td>{gbp(result.nationalInsurance.mainBandCharge)}</td>
                </tr>
              )}
              {result.nationalInsurance.upperBandCharge > 0 && (
                <tr>
                  <td>National Insurance (above upper limit)</td>
                  <td>{gbp(result.nationalInsurance.upperBandEarnings)}</td>
                  <td>{pct(YEAR.nationalInsurance.employee.upperRate)}</td>
                  <td>{gbp(result.nationalInsurance.upperBandCharge)}</td>
                </tr>
              )}
              {result.studentLoans.repayments
                .filter((loan) => loan.annual > 0)
                .map((loan) => (
                  <tr key={loan.plan}>
                    <td>
                      {loan.label} (above {gbp(loan.threshold)})
                    </td>
                    <td>{gbp(loan.earningsAboveThreshold)}</td>
                    <td>{pct(loan.rate)}</td>
                    <td>{gbp(loan.annual)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Take-home pay</td>
                <td colSpan={2}>{gbp(result.grossSalary)} gross</td>
                <td>{gbp(result.takeHomeAnnual)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="table-scroll">
          <table>
            <caption>Take-home pay by period</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Gross</th>
                <th scope="col">Take home</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Year</td>
                <td>{gbp(result.grossSalary)}</td>
                <td>{gbp(result.takeHomeAnnual)}</td>
              </tr>
              <tr>
                <td>Month</td>
                <td>{gbp(result.grossSalary / 12)}</td>
                <td>{gbp(result.takeHomeMonthly)}</td>
              </tr>
              <tr>
                <td>Week</td>
                <td>{gbp(result.grossSalary / 52)}</td>
                <td>{gbp(result.takeHomeWeekly)}</td>
              </tr>
              <tr>
                <td>Day (260 working days)</td>
                <td>{gbp(result.grossSalary / 260)}</td>
                <td>{gbp(result.takeHomeDaily)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
