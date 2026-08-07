import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

const money0 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const money2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole pounds for headline figures; pennies only where they matter. */
export function gbp(value: number, decimals: 0 | 2 = 0): string {
  const formatter = decimals === 0 ? money0 : money2;
  return formatter.format(Number.isFinite(value) ? value : 0);
}

export function pct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals).replace(/\.0+$/, '')}%`;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/* ------------------------------------------------------------------ *
 * URL state
 * ------------------------------------------------------------------ */

/**
 * Keep the calculator's inputs in the query string.
 *
 * Two reasons, both practical. A result you can send to your partner or your
 * accountant is worth more than one you have to re-enter, and shared links are
 * the kind of backlink you cannot buy.
 *
 * `replaceState` rather than `pushState`, so typing a salary does not fill the
 * back button with history entries.
 */
/**
 * `boolean` is the union `true | false`, so TypeScript infers the literal type
 * from a `false` default and then rejects every attempt to set it `true`.
 * Numbers and strings widen on their own; booleans need this nudge.
 */
type WidenBooleans<T> = { [K in keyof T]: T[K] extends boolean ? boolean : T[K] };

export function useUrlState<T extends Record<string, string | number | boolean | string[]>>(
  defaults: T,
): [WidenBooleans<T>, (patch: Partial<WidenBooleans<T>>) => void] {
  const [state, setState] = useState<WidenBooleans<T>>(defaults as WidenBooleans<T>);
  const hydrated = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length > 0) {
      // Parsed from an untyped query string, so this stage is genuinely
      // unstructured; the shape is restored on the way back into state.
      const next: Record<string, unknown> = { ...defaults };
      for (const key of Object.keys(defaults)) {
        const raw = params.get(key);
        if (raw === null) continue;
        const fallback = defaults[key];
        if (typeof fallback === 'number') {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) next[key] = parsed;
        } else if (typeof fallback === 'boolean') {
          next[key] = raw === '1' || raw === 'true';
        } else if (Array.isArray(fallback)) {
          next[key] = raw ? raw.split(',').filter(Boolean) : [];
        } else {
          next[key] = raw;
        }
      }
      setState(next as WidenBooleans<T>);
    }
    hydrated.current = true;
    // Defaults are a literal declared at the call site; re-running on identity
    // change would clobber user input on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      const fallback = (defaults as Record<string, unknown>)[key];
      const serialised = Array.isArray(value) ? value.join(',') : String(value);
      const fallbackSerialised = Array.isArray(fallback)
        ? (fallback as string[]).join(',')
        : String(fallback);
      // Only non-default values go in the URL, so shared links stay readable.
      if (serialised !== fallbackSerialised && serialised !== '') params.set(key, serialised);
    }
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [state]);

  const update = (patch: Partial<WidenBooleans<T>>) =>
    setState((current) => ({ ...current, ...patch }));
  return [state, update];
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/**
 * Parse a typed value and hold it inside the field's declared bounds.
 *
 * `min`/`max` attributes only style an input as invalid; they do not stop
 * someone typing or pasting -50000. Without this a negative salary flows
 * straight into the calculation and the page starts quoting negative money.
 */
function clamp(raw: string, min: number, max?: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return min;
  if (parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

interface FieldProps {
  label: string;
  hint?: string;
  id: string;
  span?: boolean;
  children: ComponentChildren;
}

export function Field({ label, hint, id, span, children }: FieldProps) {
  return (
    <div class={`field${span ? ' span-2' : ''}`}>
      <label for={id}>{label}</label>
      {children}
      {hint && <span class="hint">{hint}</span>}
    </div>
  );
}

interface MoneyInputProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onInput: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  span?: boolean;
  prefix?: string;
}

export function MoneyInput({
  id,
  label,
  hint,
  value,
  onInput,
  min = 0,
  max,
  step = 1,
  span,
  prefix = '£',
}: MoneyInputProps) {
  return (
    <Field label={label} hint={hint} id={id} span={span}>
      <div class="prefixed">
        <span aria-hidden="true">{prefix}</span>
        <input
          id={id}
          type="number"
          // Brings up the numeric keypad on mobile without rejecting decimals.
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onInput={(event) => onInput(clamp((event.target as HTMLInputElement).value, min, max))}
        />
      </div>
    </Field>
  );
}

interface NumberInputProps extends Omit<MoneyInputProps, 'prefix'> {
  suffix?: string;
}

export function NumberInput({ id, label, hint, value, onInput, min = 0, max, step = 1, span }: NumberInputProps) {
  return (
    <Field label={label} hint={hint} id={id} span={span}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onInput={(event) => onInput(clamp((event.target as HTMLInputElement).value, min, max))}
      />
    </Field>
  );
}

interface SelectProps<T extends string> {
  id: string;
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onInput: (value: T) => void;
  span?: boolean;
}

export function Select<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  onInput,
  span,
}: SelectProps<T>) {
  return (
    <Field label={label} hint={hint} id={id} span={span}>
      <select
        id={id}
        value={value}
        onChange={(event) => onInput((event.target as HTMLSelectElement).value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface ChoiceProps<T extends string> {
  legend: string;
  hint?: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onInput: (value: T) => void;
  span?: boolean;
}

/** Radio group styled as chips. Bigger tap targets than a native select. */
export function ChoiceGroup<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onInput,
  span,
}: ChoiceProps<T>) {
  return (
    <fieldset class={span ? 'span-2' : undefined}>
      <legend class="fieldset-label">{legend}</legend>
      <div class="choices">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onInput(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint && <span class="hint">{hint}</span>}
    </fieldset>
  );
}

interface CheckGroupProps {
  legend: string;
  hint?: string;
  values: string[];
  options: readonly { value: string; label: string }[];
  onInput: (values: string[]) => void;
  span?: boolean;
}

export function CheckGroup({ legend, hint, values, options, onInput, span }: CheckGroupProps) {
  return (
    <fieldset class={span ? 'span-2' : undefined}>
      <legend class="fieldset-label">{legend}</legend>
      <div class="choices">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={(event) => {
                const checked = (event.target as HTMLInputElement).checked;
                onInput(
                  checked
                    ? [...values, option.value]
                    : values.filter((v) => v !== option.value),
                );
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint && <span class="hint">{hint}</span>}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ *
 * Output
 * ------------------------------------------------------------------ */

interface ResultProps {
  amount: string;
  caption: string;
  children?: ComponentChildren;
}

export function Headline({ amount, caption, children }: ResultProps) {
  return (
    <div class="headline-figure">
      <span class="amount">{amount}</span>
      <span class="caption">{caption}</span>
      {children}
    </div>
  );
}

export function FigureRow({ items }: { items: readonly { label: string; value: string }[] }) {
  return (
    <dl class="figure-row">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
