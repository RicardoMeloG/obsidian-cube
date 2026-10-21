import { cx } from './cx'

type SegmentedControlProps<Value extends string> = {
  label: string
  options: readonly { value: Value; label: string }[]
  value: Value
  onChange: (value: Value) => void
  className?: string
}

// A small set of mutually exclusive buttons (the language switch). Each
// option is a toggle button, so assistive technology hears which is on.
export function SegmentedControl<Value extends string>({ label, options, value, onChange, className }: SegmentedControlProps<Value>) {
  return (
    <div
      aria-label={label}
      className={cx('inline-flex gap-[0.25em] rounded-[0.75em] border border-ink-100/9 bg-night-950/48 p-[0.2em]', className)}
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            aria-pressed={active}
            className={cx(
              'focus-ring min-w-[3em] cursor-pointer rounded-[0.65em] border-0 px-[0.5em] text-control',
              active ? 'bg-ice-300/14 text-ink-50/94' : 'bg-transparent text-ink-300/64',
            )}
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
