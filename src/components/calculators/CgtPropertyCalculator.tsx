import { useMemo } from 'preact/hooks';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import { calculatePropertyGain } from '../../lib/capital-gains';
import {
  ChoiceGroup,
  FigureRow,
  gbp,
  Headline,
  MoneyInput,
  NumberInput,
  pct,
  ResultActions,
  useUrlState,
} from './ui';

export default function CgtPropertyCalculator() {
  const [state, update] = useUrlState({
    salePrice: 350000,
    purchasePrice: 220000,
    improvements: 0,
    costs: 8000,
    income: 45000,
    owners: 1,
    livedIn: false,
    monthsOwned: 120,
    monthsLived: 0,
  });

  const result = useMemo(
    () =>
      calculatePropertyGain(
        {
          salePrice: Math.max(0, state.salePrice),
          purchasePrice: Math.max(0, state.purchasePrice),
          improvementCosts: Math.max(0, state.improvements),
          buyingAndSellingCosts: Math.max(0, state.costs),
          annualIncome: Math.max(0, state.income),
          owners: Math.max(1, state.owners),
          ...(state.livedIn
            ? {
                monthsOwned: Math.max(1, state.monthsOwned),
                monthsAsMainResidence: Math.max(0, state.monthsLived),
              }
            : {}),
        },
        YEAR,
      ),
    [state],
  );

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="sale"
          label="Sale price"
          value={state.salePrice}
          onInput={(salePrice) => update({ salePrice })}
          step={5000}
        />
        <MoneyInput
          id="purchase"
          label="What you paid for it"
          value={state.purchasePrice}
          onInput={(purchasePrice) => update({ purchasePrice })}
          step={5000}
        />
        <MoneyInput
          id="improvements"
          label="Capital improvements"
          value={state.improvements}
          onInput={(improvements) => update({ improvements })}
          step={1000}
          hint="Extensions and new kitchens count. Repairs, redecoration and replacing like with like do not."
        />
        <MoneyInput
          id="costs"
          label="Buying and selling costs"
          value={state.costs}
          onInput={(costs) => update({ costs })}
          step={500}
          hint="Legal fees, estate agent fees, surveys, and the stamp duty you paid when you bought."
        />
        <MoneyInput
          id="income"
          label="Your other income this year"
          value={state.income}
          onInput={(income) => update({ income })}
          step={1000}
          hint="Determines how much of the gain is taxed at 18% rather than 24%."
        />
        <NumberInput
          id="owners"
          label="Number of owners"
          value={state.owners}
          onInput={(owners) => update({ owners })}
          min={1}
          max={4}
          hint="Each owner gets their own £3,000 exemption."
        />

        <ChoiceGroup
          legend="Did you ever live in it as your main home?"
          name="lived-in"
          value={state.livedIn ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes, for a while' },
          ]}
          onInput={(value) => update({ livedIn: value === 'yes' })}
          span
          hint="Any period it was genuinely your main home earns Private Residence Relief for that share of the gain. Answer no if it was always let or a second home."
        />

        {state.livedIn && (
          <>
            <NumberInput
              id="months-owned"
              label="Months you owned it"
              value={state.monthsOwned}
              onInput={(monthsOwned) => update({ monthsOwned })}
              min={1}
            />
            <NumberInput
              id="months-lived"
              label="Months it was your main home"
              value={state.monthsLived}
              onInput={(monthsLived) => update({ monthsLived })}
              min={0}
              hint="The final 9 months always qualify, even after you moved out."
            />
          </>
        )}
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={gbp(result.totalTax)}
          caption={`Capital Gains Tax on a ${gbp(result.grossGain)} gain`}
        />

        <FigureRow
          items={[
            { label: 'Gross gain', value: gbp(result.grossGain) },
            ...(result.privateResidenceRelief > 0
              ? [{ label: 'Residence relief', value: gbp(result.privateResidenceRelief) }]
              : []),
            { label: 'Taxable gain', value: gbp(result.taxableGain) },
            { label: 'Effective rate', value: pct(result.effectiveRate, 1) },
          ]}
        />

        {result.totalTax > 0 && (
          <p class="warning">
            <strong>You have {result.reportingDeadlineDays} days to report and pay.</strong>
            A residential property gain must be reported to HMRC and the tax paid within{' '}
            {result.reportingDeadlineDays} days of completion, using a Capital Gains Tax on UK
            property account. This is separate from your Self Assessment return, and late filing
            penalties start immediately.
          </p>
        )}

        {result.basicRateGain > 0 && result.higherRateGain > 0 && (
          <p class="note">
            <strong>Your gain is taxed at two rates.</strong>
            The gain sits on top of your income. {gbp(result.basicRateGain)} of it fits in what is
            left of your basic rate band and is taxed at{' '}
            {pct(YEAR.capitalGains.residentialBasicRate, 0)}; the remaining{' '}
            {gbp(result.higherRateGain)} is taxed at{' '}
            {pct(YEAR.capitalGains.residentialHigherRate, 0)}. Calculators that apply a single rate
            to the whole gain get this wrong.
          </p>
        )}


        <ResultActions />
      </div>

      <div class="calc-detail">
        <div class="table-scroll">
          <table>
            <caption>How the tax was worked out{result.perOwner ? ', per owner' : ''}</caption>
            <tbody>
              <tr>
                <td>Sale price</td>
                <td>{gbp(state.salePrice)}</td>
              </tr>
              <tr>
                <td>Less purchase price</td>
                <td>−{gbp(state.purchasePrice)}</td>
              </tr>
              <tr>
                <td>Less improvements and costs</td>
                <td>−{gbp(state.improvements + state.costs)}</td>
              </tr>
              <tr>
                <td>Gross gain</td>
                <td>{gbp(result.grossGain)}</td>
              </tr>
              {result.privateResidenceRelief > 0 && (
                <tr>
                  <td>Less Private Residence Relief</td>
                  <td>−{gbp(result.privateResidenceRelief)}</td>
                </tr>
              )}
              <tr>
                <td>
                  Less annual exempt amount{result.perOwner ? ` (× ${state.owners} owners)` : ''}
                </td>
                <td>
                  −{gbp(result.annualExemptAmount * (result.perOwner ? state.owners : 1))}
                </td>
              </tr>
              <tr>
                <td>
                  Taxed at {pct(YEAR.capitalGains.residentialBasicRate, 0)}
                </td>
                <td>
                  {gbp(result.basicRateGain)} → {gbp(result.basicRateTax)}
                </td>
              </tr>
              <tr>
                <td>
                  Taxed at {pct(YEAR.capitalGains.residentialHigherRate, 0)}
                </td>
                <td>
                  {gbp(result.higherRateGain)} → {gbp(result.higherRateTax)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Capital Gains Tax due</td>
                <td>{gbp(result.totalTax)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
