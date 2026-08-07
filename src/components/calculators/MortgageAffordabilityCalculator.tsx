import { useMemo } from 'preact/hooks';
import { affordabilityRange, loanToValue } from '../../lib/mortgage';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { calculateTakeHome } from '../../lib/take-home';
import {
  FigureRow,
  gbp,
  Headline,
  MoneyInput,
  NumberInput,
  pct,
  ResultActions,
  useUrlState,
} from './ui';

export default function MortgageAffordabilityCalculator() {
  const [state, update] = useUrlState({
    income: 40000,
    income2: 0,
    deposit: 30000,
    commitments: 0,
    rate: 4.5,
    years: 25,
  });

  const result = useMemo(
    () =>
      affordabilityRange({
        annualIncome: Math.max(0, state.income),
        secondAnnualIncome: Math.max(0, state.income2),
        deposit: Math.max(0, state.deposit),
        monthlyCommitments: Math.max(0, state.commitments),
        termYears: Math.max(5, state.years),
        annualRate: Math.max(0.001, state.rate) / 100,
      }),
    [state],
  );

  // Monthly take-home, so the payment can be judged against real income
  // rather than gross — which is what actually determines affordability.
  const monthlyNet = useMemo(() => {
    const first = calculateTakeHome(
      {
        grossSalary: Math.max(0, state.income),
        region: 'england-nireland',
        pension: { method: 'none', kind: 'percent', value: 0 },
        studentLoanPlans: [],
      },
      YEAR,
    ).takeHomeMonthly;
    const second =
      state.income2 > 0
        ? calculateTakeHome(
            {
              grossSalary: state.income2,
              region: 'england-nireland',
              pension: { method: 'none', kind: 'percent', value: 0 },
              studentLoanPlans: [],
            },
            YEAR,
          ).takeHomeMonthly
        : 0;
    return first + second;
  }, [state.income, state.income2]);

  const standard = result.bands[1]!;
  const ltv = loanToValue(standard.maxPropertyPrice, state.deposit);

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="income"
          label="Your annual income"
          value={state.income}
          onInput={(income) => update({ income })}
          step={1000}
        />
        <MoneyInput
          id="income2"
          label="Second applicant's income"
          value={state.income2}
          onInput={(income2) => update({ income2 })}
          step={1000}
          hint="Leave at zero if applying alone."
        />
        <MoneyInput
          id="deposit"
          label="Deposit"
          value={state.deposit}
          onInput={(deposit) => update({ deposit })}
          step={1000}
        />
        <MoneyInput
          id="commitments"
          label="Monthly credit commitments"
          value={state.commitments}
          onInput={(commitments) => update({ commitments })}
          step={25}
          hint="Car finance, loans, credit card minimums. Not rent or bills."
        />
        <NumberInput
          id="rate"
          label="Interest rate (%)"
          value={state.rate}
          onInput={(rate) => update({ rate })}
          step={0.05}
          max={20}
        />
        <NumberInput
          id="years"
          label="Mortgage term (years)"
          value={state.years}
          onInput={(years) => update({ years })}
          step={1}
          max={40}
        />
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={`${gbp(result.bands[0]!.maxPropertyPrice)} – ${gbp(result.bands[3]!.maxPropertyPrice)}`}
          caption="realistic range of property price, depending on the lender"
        />

        <p class="note">
          <strong>There is no single correct answer here.</strong>
          The FCA's mandatory stress test was withdrawn in August 2022, and lenders now set their
          own rules. 4.5 times income is the long-standing high street default, but several
          mainstream lenders go to 5.5 times as standard and higher for particular borrowers. Any
          calculator that gives you one confident number is guessing — this shows the range and
          what each level costs.
        </p>

        <FigureRow
          items={[
            { label: 'Combined income', value: gbp(result.totalIncome) },
            { label: 'Deposit', value: gbp(state.deposit) },
            { label: 'LTV at 4.5×', value: pct(ltv, 0) },
            { label: 'Monthly take-home', value: gbp(monthlyNet) },
          ]}
        />


        <ResultActions />
      </div>

      <div class="calc-detail">
        <div class="table-scroll">
          <table>
            <caption>What each income multiple buys</caption>
            <thead>
              <tr>
                <th scope="col">Lender stance</th>
                <th scope="col">Multiple</th>
                <th scope="col">Max loan</th>
                <th scope="col">Max price</th>
                <th scope="col">Monthly</th>
                <th scope="col">Share of take-home</th>
              </tr>
            </thead>
            <tbody>
              {result.bands.map((band) => (
                <tr key={band.multiple}>
                  <td style="white-space:normal">{band.label}</td>
                  <td>{band.multiple}×</td>
                  <td>{gbp(band.maxLoan)}</td>
                  <td>{gbp(band.maxPropertyPrice)}</td>
                  <td>{gbp(band.monthlyPayment)}</td>
                  <td>{monthlyNet > 0 ? pct(band.monthlyPayment / monthlyNet, 0) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="table-scroll">
          <table>
            <caption>
              Stress test — what the payment becomes if rates rise 1 point to{' '}
              {(result.stressRate * 100).toFixed(2)}%
            </caption>
            <thead>
              <tr>
                <th scope="col">Multiple</th>
                <th scope="col">Payment now</th>
                <th scope="col">Payment if rates rise</th>
                <th scope="col">Extra per month</th>
              </tr>
            </thead>
            <tbody>
              {result.bands.map((band) => (
                <tr key={band.multiple}>
                  <td>{band.multiple}×</td>
                  <td>{gbp(band.monthlyPayment)}</td>
                  <td>{gbp(band.monthlyPaymentAtStressRate)}</td>
                  <td>{gbp(band.monthlyPaymentAtStressRate - band.monthlyPayment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ltv > 0.9 && (
          <p class="warning">
            <strong>Your deposit is under 10%.</strong>
            Above 90% loan-to-value the choice of deals narrows sharply and rates are noticeably
            higher. Getting the deposit to 10% — or 15% — usually saves more than stretching to a
            bigger loan gains you.
          </p>
        )}
      </div>
    </div>
  );
}
