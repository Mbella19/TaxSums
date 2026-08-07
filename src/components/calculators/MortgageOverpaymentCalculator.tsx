import { useMemo } from 'preact/hooks';
import { monthlyPayment, overpaymentSaving } from '../../lib/mortgage';
import { FigureRow, gbp, Headline, MoneyInput, NumberInput, plural, useUrlState } from './ui';

export default function MortgageOverpaymentCalculator() {
  const [state, update] = useUrlState({
    balance: 200000,
    rate: 4.5,
    years: 25,
    overpayment: 200,
    lumpSum: 0,
  });

  const terms = useMemo(
    () => ({
      balance: Math.max(0, state.balance),
      annualRate: Math.max(0, state.rate) / 100,
      termMonths: Math.max(1, Math.round(state.years * 12)),
    }),
    [state.balance, state.rate, state.years],
  );

  const result = useMemo(
    () => overpaymentSaving(terms, Math.max(0, state.overpayment), Math.max(0, state.lumpSum)),
    [terms, state.overpayment, state.lumpSum],
  );

  const payment = monthlyPayment(terms);
  const newTermYears = Math.floor(result.withOverpayment.monthsToRepay / 12);
  const newTermMonths = result.withOverpayment.monthsToRepay % 12;

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="balance"
          label="Outstanding balance"
          value={state.balance}
          onInput={(balance) => update({ balance })}
          step={1000}
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
          label="Years remaining"
          value={state.years}
          onInput={(years) => update({ years })}
          step={1}
          max={40}
        />
        <MoneyInput
          id="overpayment"
          label="Extra per month"
          value={state.overpayment}
          onInput={(overpayment) => update({ overpayment })}
          step={25}
          hint="On top of your normal payment."
        />
        <MoneyInput
          id="lump-sum"
          label="One-off lump sum"
          value={state.lumpSum}
          onInput={(lumpSum) => update({ lumpSum })}
          step={500}
          hint="Paid now, if you have savings to put in."
        />
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={gbp(result.interestSaved)}
          caption={
            result.monthsSaved > 0
              ? `saved in interest, and ${plural(result.yearsSaved, 'year')} ${result.monthsSavedRemainder} months off your mortgage`
              : 'saved in interest'
          }
        />

        <FigureRow
          items={[
            { label: 'Normal payment', value: `${gbp(payment)}/mo` },
            {
              label: 'New payment',
              value: `${gbp(payment + Math.max(0, state.overpayment))}/mo`,
            },
            {
              label: 'Paid off in',
              value: `${newTermYears}y ${newTermMonths}m`,
            },
            { label: 'Total overpaid', value: gbp(result.totalOverpaid) },
          ]}
        />

        {result.exceedsTypicalErcAllowance && (
          <p class="warning">
            <strong>Check your early repayment charge first.</strong>
            Most fixed-rate deals let you overpay 10% of the balance each year without penalty —
            about {gbp(result.typicalErcAllowance)} in your case. Your plan would put in{' '}
            {gbp(result.annualOverpayment)} a year, which could trigger a charge of typically 1% to
            5% of the excess. Check your mortgage offer, or spread the overpayment across more
            years.
          </p>
        )}

        {result.interestSaved > 0 && (
          <p class="note">
            <strong>Is it worth it?</strong>
            You would put in {gbp(result.totalOverpaid)} and save {gbp(result.interestSaved)} in
            interest. That is effectively a guaranteed, tax-free return equal to your mortgage rate
            of {state.rate}%. Compare it against what a savings account pays you after tax — if
            savings beat your mortgage rate, saving may be the better call, and it keeps the money
            accessible.
          </p>
        )}

        <div class="table-scroll">
          <table>
            <caption>With and without overpaying</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">As it stands</th>
                <th scope="col">Overpaying</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Time to repay</td>
                <td>
                  {Math.floor(result.baseline.monthsToRepay / 12)}y{' '}
                  {result.baseline.monthsToRepay % 12}m
                </td>
                <td>
                  {newTermYears}y {newTermMonths}m
                </td>
                <td>
                  −{result.yearsSaved}y {result.monthsSavedRemainder}m
                </td>
              </tr>
              <tr>
                <td>Total interest</td>
                <td>{gbp(result.baseline.totalInterest)}</td>
                <td>{gbp(result.withOverpayment.totalInterest)}</td>
                <td>−{gbp(result.interestSaved)}</td>
              </tr>
              <tr>
                <td>Total paid</td>
                <td>{gbp(result.baseline.totalPaid)}</td>
                <td>{gbp(result.withOverpayment.totalPaid)}</td>
                <td>−{gbp(result.baseline.totalPaid - result.withOverpayment.totalPaid)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
