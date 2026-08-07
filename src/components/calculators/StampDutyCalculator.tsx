import { useMemo } from 'preact/hooks';
import type { Region } from '../../data/types';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { calculatePropertyTax, firstTimeBuyerCliff } from '../../lib/property-tax';
import {
  ChoiceGroup,
  FigureRow,
  gbp,
  Headline,
  MoneyInput,
  pct,
  ResultActions,
  useUrlState,
} from './ui';

interface Props {
  region: Region;
}

const REGION_LABEL: Record<Region, string> = {
  'england-nireland': 'England and Northern Ireland',
  scotland: 'Scotland',
  wales: 'Wales',
};

export default function StampDutyCalculator({ region }: Props) {
  const rules = YEAR.propertyTax[region];

  const [state, update] = useUrlState({
    price: 350000,
    buyerType: 'home-mover' as 'home-mover' | 'first-time' | 'additional',
    nonResident: false,
  });

  // Clamped once, then used everywhere — calculation and display alike — so a
  // stray value can never be calculated on one figure and shown as another.
  const price = Math.max(0, state.price);

  const result = useMemo(
    () =>
      calculatePropertyTax(
        {
          price,
          region,
          firstTimeBuyer: state.buyerType === 'first-time',
          additionalProperty: state.buyerType === 'additional',
          nonUkResident: state.nonResident,
        },
        YEAR,
      ),
    [price, state.buyerType, state.nonResident, region],
  );

  const cliff = firstTimeBuyerCliff(region, YEAR);

  // Compare against the other two nations so people can see the difference.
  const elsewhere = (['england-nireland', 'scotland', 'wales'] as Region[])
    .filter((r) => r !== region)
    .map((r) => ({
      region: r,
      name: YEAR.propertyTax[r].abbreviation,
      total: calculatePropertyTax(
        {
          price,
          region: r,
          firstTimeBuyer: state.buyerType === 'first-time',
          additionalProperty: state.buyerType === 'additional',
        },
        YEAR,
      ).total,
    }));

  const buyerOptions = [
    { value: 'home-mover' as const, label: 'Moving home' },
    ...(rules.firstTimeBuyerRelief
      ? [{ value: 'first-time' as const, label: 'First-time buyer' }]
      : []),
    { value: 'additional' as const, label: 'Second home' },
  ];

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="price"
          label="Purchase price"
          value={state.price}
          onInput={(price) => update({ price })}
          step={5000}
        />

        <ChoiceGroup
          legend="What kind of purchase?"
          name="buyer-type"
          value={state.buyerType}
          options={buyerOptions}
          onInput={(value) => update({ buyerType: value })}
          hint={
            rules.firstTimeBuyerRelief === null
              ? `Buy-to-lets count as a second home. ${REGION_LABEL[region]} has no first-time buyer relief — the £${rules.standardBands[0]!.upTo?.toLocaleString('en-GB')} nil-rate band applies to everyone.`
              : 'Buy-to-lets and holiday homes both count as a second home.'
          }
        />

        {rules.nonResidentSurcharge !== null && (
          <ChoiceGroup
            legend="Are you a UK resident?"
            name="residency"
            value={state.nonResident ? 'no' : 'yes'}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            onInput={(value) => update({ nonResident: value === 'no' })}
            hint={`Non-residents pay a further ${pct(rules.nonResidentSurcharge)} on every band. You count as resident if you spent 183 days in the UK in the year before the purchase.`}
          />
        )}
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={gbp(result.total)}
          caption={`${rules.abbreviation} on a ${gbp(price)} purchase`}
        />

        <FigureRow
          items={[
            { label: 'Effective rate', value: pct(result.effectiveRate, 2) },
            { label: 'Total cost', value: gbp(price + result.total) },
            ...(result.flatSurcharge > 0
              ? [{ label: 'Of which supplement', value: gbp(result.flatSurcharge) }]
              : []),
          ]}
        />

        {result.firstTimeBuyerReliefLost && (
          <p class="danger">
            <strong>You have gone over the first-time buyer cliff edge.</strong>
            Relief disappears completely above {gbp(result.firstTimeBuyerReliefLost.maximumPrice)} —
            it does not taper. Buying at exactly{' '}
            {gbp(result.firstTimeBuyerReliefLost.maximumPrice)} would cost{' '}
            {gbp(result.firstTimeBuyerReliefLost.taxIfPriceWereAtLimit)} in stamp duty. At{' '}
            {gbp(price)} you pay {gbp(result.total)}, which is{' '}
            {gbp(result.firstTimeBuyerReliefLost.extraTaxFromLosingRelief)} more than the relief
            would have saved you.{' '}
            <a href="/guides/first-time-buyer-stamp-duty-cliff-edge/">Why this happens</a>.
          </p>
        )}

        {result.firstTimeBuyerReliefApplied && cliff && price > cliff.limit - 25000 && (
          <p class="warning">
            <strong>You are close to the cliff edge.</strong>
            First-time buyer relief vanishes entirely above {gbp(cliff.limit)}. One pound over and
            your bill jumps from {gbp(cliff.taxAtLimit)} to {gbp(cliff.taxJustAbove)} — a{' '}
            {gbp(cliff.jump)} increase. Be careful about raising your offer.
          </p>
        )}


        <ResultActions />
      </div>

      <div class="calc-detail">
        <div class="table-scroll">
          <table>
            <caption>How this was worked out — {rules.name}</caption>
            <thead>
              <tr>
                <th scope="col">Band</th>
                <th scope="col">Portion of price</th>
                <th scope="col">Rate</th>
                <th scope="col">Tax</th>
              </tr>
            </thead>
            <tbody>
              {result.bands.map((band) => (
                <tr key={`${band.from}-${band.rate}`}>
                  <td>
                    {gbp(band.from)} to {gbp(band.to)}
                  </td>
                  <td>{gbp(band.amount)}</td>
                  <td>{pct(band.rate, 2)}</td>
                  <td>{gbp(band.charge)}</td>
                </tr>
              ))}
              {result.flatSurcharge > 0 && (
                <tr>
                  <td style="white-space:normal">{result.flatSurchargeLabel}</td>
                  <td>{gbp(price)}</td>
                  <td>—</td>
                  <td>{gbp(result.flatSurcharge)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total {rules.abbreviation}</td>
                <td colSpan={2}>Payable to {rules.authority}</td>
                <td>{gbp(result.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="table-scroll">
          <table>
            <caption>The same purchase elsewhere in the UK</caption>
            <thead>
              <tr>
                <th scope="col">Where</th>
                <th scope="col">Tax</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{REGION_LABEL[region]}</strong>
                </td>
                <td>
                  <strong>{gbp(result.total)}</strong>
                </td>
                <td>—</td>
              </tr>
              {elsewhere.map((other) => (
                <tr key={other.region}>
                  <td>{REGION_LABEL[other.region]}</td>
                  <td>{gbp(other.total)}</td>
                  <td>
                    {other.total === result.total
                      ? 'Same'
                      : `${other.total > result.total ? '+' : '−'}${gbp(Math.abs(other.total - result.total))}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
