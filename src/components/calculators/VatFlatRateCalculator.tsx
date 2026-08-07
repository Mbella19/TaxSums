import { useMemo } from 'preact/hooks';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { compareFlatRate, effectiveRateOnNetTurnover, FLAT_RATE_SECTORS } from '../../lib/vat';
import { ChoiceGroup, FigureRow, gbp, Headline, MoneyInput, pct, Select, useUrlState } from './ui';

export default function VatFlatRateCalculator() {
  const [state, update] = useUrlState({
    turnover: 80000,
    sector: 'Computer and IT consultancy or data processing',
    goods: 500,
    inputVat: 1000,
    firstYear: false,
  });

  const sectorRate =
    FLAT_RATE_SECTORS.find((s) => s.name === state.sector)?.rate ?? 0.12;

  const result = useMemo(
    () =>
      compareFlatRate(
        {
          turnoverExVat: Math.max(0, state.turnover),
          sectorRate,
          goodsSpendIncVat: Math.max(0, state.goods),
          reclaimableInputVat: Math.max(0, state.inputVat),
          firstYearOfRegistration: state.firstYear,
        },
        YEAR,
      ),
    [state, sectorRate],
  );

  const flatRateWins = result.betterScheme === 'flat-rate';

  /**
   * A negative VAT liability is a reclaim, not a debt. It arises legitimately
   * whenever input VAT exceeds output VAT — a quarter with heavy stock
   * purchases, for instance — so say "reclaim" rather than printing "-£1,000".
   */
  const vatDue = (amount: number) =>
    amount < 0 ? `${gbp(Math.abs(amount))} reclaim` : gbp(amount);

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="turnover"
          label="Annual turnover (excluding VAT)"
          value={state.turnover}
          onInput={(turnover) => update({ turnover })}
          step={5000}
        />

        <Select
          id="sector"
          label="Your trade sector"
          value={state.sector}
          options={FLAT_RATE_SECTORS.map((s) => ({
            value: s.name,
            label: `${s.name} — ${(s.rate * 100).toFixed(1)}%`,
          }))}
          onInput={(sector) => update({ sector })}
          span
        />

        <MoneyInput
          id="goods"
          label="Annual spend on goods (inc VAT)"
          value={state.goods}
          onInput={(goods) => update({ goods })}
          step={100}
          hint="Physical goods only. Software, travel, rent, accountancy and subcontractors do not count."
        />

        <MoneyInput
          id="input-vat"
          label="VAT you could reclaim normally"
          value={state.inputVat}
          onInput={(inputVat) => update({ inputVat })}
          step={100}
          hint="Your annual input VAT under standard accounting."
        />

        <ChoiceGroup
          legend="First year of VAT registration?"
          name="first-year"
          value={state.firstYear ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes — 1% discount' },
          ]}
          onInput={(value) => update({ firstYear: value === 'yes' })}
        />
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={gbp(Math.abs(result.flatRateBetterBy))}
          caption={
            flatRateWins
              ? 'a year better off on the Flat Rate Scheme'
              : 'a year better off on standard VAT accounting'
          }
        />

        <FigureRow
          items={[
            { label: 'Flat rate applied', value: pct(result.appliedRate, 1) },
            {
              label: 'Really, of net sales',
              value: pct(effectiveRateOnNetTurnover(result.appliedRate, YEAR), 1),
            },
            { label: 'VAT due — flat rate', value: vatDue(result.flatRateVatDue) },
            { label: 'VAT due — standard', value: vatDue(result.standardVatDue) },
          ]}
        />

        {result.isLimitedCostTrader && (
          <p class="warning">
            <strong>You are a limited cost trader.</strong>
            You spend {gbp(state.goods)} a year on goods, below the{' '}
            {gbp(result.limitedCostTraderThreshold)} threshold (2% of gross turnover, or £1,000,
            whichever is greater). That puts you on{' '}
            {pct(YEAR.vat.limitedCostTraderRate, 1)} regardless of your sector — which is{' '}
            {pct(effectiveRateOnNetTurnover(YEAR.vat.limitedCostTraderRate, YEAR), 1)} of your net
            sales. This rule was introduced in 2017 specifically to stop consultants and
            contractors profiting from the scheme, and it makes the Flat Rate Scheme a poor deal
            for most service businesses.
          </p>
        )}

        <p class="note">
          <strong>The percentage is not what it looks like.</strong>
          The flat rate applies to your VAT-<em>inclusive</em> turnover, so a{' '}
          {pct(result.appliedRate, 1)} rate is really{' '}
          {pct(effectiveRateOnNetTurnover(result.appliedRate, YEAR), 1)} of what you actually
          invoice before VAT. On {gbp(state.turnover)} of net sales you charge{' '}
          {gbp(result.vatCharged)} of VAT and hand over {gbp(result.flatRateVatDue)} of it.
        </p>

        {!result.eligibleToJoin && (
          <p class="warning">
            <strong>You cannot join the scheme.</strong>
            Turnover must be {gbp(YEAR.vat.flatRateJoinThreshold)} or less excluding VAT to join,
            and you must leave once gross turnover passes {gbp(YEAR.vat.flatRateLeaveThreshold)}.
          </p>
        )}

        <div class="table-scroll">
          <table>
            <caption>Flat Rate Scheme against standard VAT accounting</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">Flat rate</th>
                <th scope="col">Standard</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>VAT charged to customers</td>
                <td>{gbp(result.vatCharged)}</td>
                <td>{gbp(result.vatCharged)}</td>
              </tr>
              <tr>
                <td>VAT reclaimed on purchases</td>
                <td>{gbp(0)}</td>
                <td>{gbp(state.inputVat)}</td>
              </tr>
              <tr>
                <td>Rate applied</td>
                <td>{pct(result.appliedRate, 1)} of gross</td>
                <td>{pct(YEAR.vat.standardRate, 0)} of net</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>VAT payable to HMRC</td>
                <td>{vatDue(result.flatRateVatDue)}</td>
                <td>{vatDue(result.standardVatDue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
