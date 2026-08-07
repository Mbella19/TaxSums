import { useMemo } from 'preact/hooks';
import { CURRENT_TAX_YEAR as YEAR } from '../../data/tax-years';
import {
  compareTradingStructures,
  marginalExtractionRates,
  optimalDirectorSalary,
} from '../../lib/incorporation';
import { ChoiceGroup, FigureRow, gbp, Headline, MoneyInput, pct, useUrlState } from './ui';

export default function IncorporationCalculator() {
  const [state, update] = useUrlState({
    profit: 60000,
    salary: YEAR.incomeTax.personalAllowance,
    draw: 'everything' as 'everything' | 'some',
    drawAmount: 30000,
    soleDirector: true,
    costs: 1200,
  });

  const options = useMemo(
    () => ({
      salary: Math.max(0, state.salary),
      soleDirectorNoOtherEmployees: state.soleDirector,
      extraCosts: Math.max(0, state.costs),
      ...(state.draw === 'some' ? { dividendsToDraw: Math.max(0, state.drawAmount) } : {}),
    }),
    [state],
  );

  const result = useMemo(
    () => compareTradingStructures(Math.max(0, state.profit), YEAR, options),
    [state.profit, options],
  );

  const optimal = useMemo(
    () => optimalDirectorSalary(Math.max(0, state.profit), YEAR, options),
    [state.profit, options],
  );

  const rates = marginalExtractionRates(YEAR);
  const { soleTrader, limitedCompany } = result;
  const companyWins = result.advantageAfterCosts > 0;

  return (
    <div class="calc">
      <div class="calc-inputs">
        <MoneyInput
          id="profit"
          label="Annual profit before tax"
          value={state.profit}
          onInput={(profit) => update({ profit })}
          step={5000}
          hint="Turnover minus business expenses, before any salary."
        />

        <MoneyInput
          id="salary"
          label="Director's salary"
          value={state.salary}
          onInput={(salary) => update({ salary })}
          step={500}
          hint={optimal.reasoning}
        />

        <ChoiceGroup
          legend="How much do you take out?"
          name="draw"
          value={state.draw}
          options={[
            { value: 'everything', label: 'All of it' },
            { value: 'some', label: 'Only what I need' },
          ]}
          onInput={(value) => update({ draw: value })}
          hint="Leaving profit in the company defers dividend tax — this is where most of the limited company advantage actually comes from."
        />

        {state.draw === 'some' && (
          <MoneyInput
            id="draw-amount"
            label="Dividends drawn per year"
            value={state.drawAmount}
            onInput={(drawAmount) => update({ drawAmount })}
            step={1000}
          />
        )}

        <ChoiceGroup
          legend="Does the company employ anyone besides you?"
          name="sole-director"
          value={state.soleDirector ? 'no' : 'yes'}
          options={[
            { value: 'no', label: 'Just me' },
            { value: 'yes', label: 'Yes, others too' },
          ]}
          onInput={(value) => update({ soleDirector: value === 'no' })}
          hint="A company whose only employee is also its director cannot claim the Employment Allowance."
        />

        <MoneyInput
          id="costs"
          label="Extra cost of running a company"
          value={state.costs}
          onInput={(costs) => update({ costs })}
          step={100}
          hint="Accounts, payroll, confirmation statement."
        />
      </div>

      <div class="calc-result" aria-live="polite">
        <Headline
          amount={`${result.advantageAfterCosts >= 0 ? '+' : '−'}${gbp(Math.abs(result.advantageAfterCosts))}`}
          caption={
            companyWins
              ? 'a year better off as a limited company, after running costs'
              : 'a year better off staying a sole trader, after running costs'
          }
        />

        <FigureRow
          items={[
            { label: 'Sole trader take-home', value: gbp(soleTrader.takeHome) },
            { label: 'Company take-home', value: gbp(limitedCompany.takeHome) },
            ...(limitedCompany.retainedInCompany > 0
              ? [{ label: 'Left in company', value: gbp(limitedCompany.retainedInCompany) }]
              : []),
            { label: 'Running costs', value: gbp(result.assumedExtraCosts) },
          ]}
        />

        {!companyWins && state.draw === 'everything' && (
          <p class="warning">
            <strong>Taking every penny out of a company is expensive in {YEAR.label}.</strong>
            Profit above {gbp(YEAR.corporationTax.lowerLimit)} bears corporation tax at{' '}
            {pct(rates.marginalCorporationTax)} at the margin, and what is left is taxed again as a
            dividend at {pct(YEAR.incomeTax.dividend.upperRate)} — {pct(rates.companyCombined)}{' '}
            combined. A higher rate sole trader pays {pct(rates.soleTraderHigher)}. Try "only what
            I need" above: the company advantage comes from leaving profit in, not from taking it
            all out.
          </p>
        )}

        {!limitedCompany.qualifiesForStatePensionYear && (
          <p class="warning">
            <strong>This salary does not earn a State Pension year.</strong>
            At {gbp(limitedCompany.salary)} you are below the{' '}
            {gbp(YEAR.nationalInsurance.lowerEarningsLimit)} Lower Earnings Limit, so this year
            will not count towards your 35 qualifying years. A salary at or just above the limit
            fixes it at almost no cost.
          </p>
        )}

        {state.soleDirector && limitedCompany.employerNi > 0 && (
          <p class="note">
            <strong>The Employment Allowance does not help you.</strong>
            It is worth up to {gbp(YEAR.nationalInsurance.employer.employmentAllowance)}, but a
            company whose sole employee is also a director cannot claim it. Your company pays{' '}
            {gbp(limitedCompany.employerNi)} of employer National Insurance on the salary. Many
            comparison tools quietly apply the allowance anyway and overstate the case for
            incorporating.
          </p>
        )}

        <div class="table-scroll">
          <table>
            <caption>Side by side on {gbp(state.profit)} of profit</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">Sole trader</th>
                <th scope="col">Limited company</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Salary</td>
                <td>—</td>
                <td>{gbp(limitedCompany.salary)}</td>
              </tr>
              <tr>
                <td>Employer NI</td>
                <td>—</td>
                <td>{gbp(limitedCompany.employerNi)}</td>
              </tr>
              <tr>
                <td>Corporation tax</td>
                <td>—</td>
                <td>
                  {gbp(limitedCompany.corporationTax)} ({pct(limitedCompany.corporationTaxRate)})
                </td>
              </tr>
              <tr>
                <td>Income tax</td>
                <td>{gbp(soleTrader.incomeTax)}</td>
                <td>{gbp(limitedCompany.salaryIncomeTax)}</td>
              </tr>
              <tr>
                <td>Class 4 / employee NI</td>
                <td>{gbp(soleTrader.class4Ni)}</td>
                <td>{gbp(limitedCompany.employeeNi)}</td>
              </tr>
              <tr>
                <td>Dividend tax</td>
                <td>—</td>
                <td>{gbp(limitedCompany.dividendTax)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total tax</td>
                <td>{gbp(soleTrader.totalTax)}</td>
                <td>{gbp(limitedCompany.totalTax)}</td>
              </tr>
              <tr>
                <td>Cash in hand</td>
                <td>{gbp(soleTrader.takeHome)}</td>
                <td>{gbp(limitedCompany.takeHome)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
