import { Check } from 'lucide-react'
import { Fragment } from 'react'
import { CONTROL_STATES } from '@/kernel/compositions'
import { RichText } from '@/features/content/RichText'
import { FaceActions, Heading } from '../blocks'
import { rise } from '../motion'
import type { TemplateProps } from '../blocks'
import { StageIcon } from '../StageIcon'
import './ledger.css'

// ledger — callouts on the left, a register of rows as a console on the
// right; the tally counts the rows by status.
export function Ledger({ composition, face, counter, onOpenDetail }: TemplateProps<'ledger'>) {
  const { console: register } = composition
  const tally = CONTROL_STATES.map((status) => ({ status, count: register.rows.filter((row) => row.status === status).length })).filter(
    (entry) => entry.count > 0,
  )
  return (
    <>
      <div className="le-left" style={rise(0)}>
        <Heading face={face} counter={counter} />
        {composition.callouts.map((callout, index) => (
          <div className="le-callout" key={index}>
            <span className="st-tile">
              <StageIcon id={callout.icon} size={18} />
            </span>
            <div>
              <small>{callout.label}</small>
              {callout.title && <strong>{callout.title}</strong>}
              <RichText html={callout.text} />
            </div>
          </div>
        ))}
      </div>

      <article className="st-panel le-console" style={rise(1)}>
        <header className="le-console__bar">
          <span aria-hidden className="le-console__dots">
            <i />
            <i />
            <i />
          </span>
          <span>{register.title}</span>
        </header>
        <div className="le-console__body">
          {register.command && (
            <p className="le-console__command">
              <span aria-hidden>$</span> {register.command}
            </p>
          )}
          <ul>
            {register.rows.map((row, index) => (
              <li key={`${row.id}-${index}`} data-status={row.status}>
                <span className="le-status">{register.statusLabels[row.status]}</span>
                <code>{breakAfterDots(row.id)}</code>
                <span className="le-text">{row.text}</span>
              </li>
            ))}
          </ul>
          <p className="le-console__tally">
            <Check aria-hidden size={14} strokeWidth={2} />
            {tally.map((entry) => `${register.statusLabels[entry.status]} ${entry.count}`).join(' · ')}
          </p>
        </div>
        <FaceActions face={face} onOpenDetail={onOpenDetail} />
      </article>
    </>
  )
}

// A control's id (`content.sanitize`) may wrap after each dot, not inside a word.
function breakAfterDots(id: string) {
  const parts = id.split('.')
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          .<wbr />
        </>
      )}
    </Fragment>
  ))
}
