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
      className={cx('inline-flex gap-1 rounded-md border border-ice-300/16 bg-night-950/48 p-[0.22rem]', className)}
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            aria-pressed={active}
            className={cx(
              'focus-ring min-w-[2.2rem] cursor-pointer rounded-sm border-0 px-[0.48rem] py-[0.35rem] text-control',
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
