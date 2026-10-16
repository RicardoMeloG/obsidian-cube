import { ChevronRight } from 'lucide-react'
import { RichText } from '@/features/content/RichText'
import { FaceActions, Heading, SectionLabel } from '../blocks'
import { ordinal, rise } from '../motion'
import type { TemplateProps } from '../blocks'
import { StageIcon } from '../StageIcon'
import './case.css'

// case — the case and its before/after on the left, a status map on the
// right when there is real data for it, and the story (one step per item) as
// a band across the bottom.
export function Case({ composition, face, counter, onOpenDetail }: TemplateProps<'case'>) {
  const { map } = composition
  return (
    <>
      <div className="cs-head" style={rise(0)}>
        <Heading face={face} counter={counter} />
        <p className="cs-case">
          <span>{composition.caseLabel}</span>
          {composition.caseName}
        </p>
        <div className="cs-compare">
          <div>
            <small>{composition.before.title}</small>
            <ul>
              {composition.before.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <ChevronRight aria-hidden className="cs-compare__arrow" size={20} strokeWidth={1.6} />
          <div className="is-after">
            <small>{composition.after.title}</small>
            <ul>
              {composition.after.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {map && (
        <article className="st-panel cs-map" style={rise(1)}>
          <SectionLabel trail={map.note}>{map.title}</SectionLabel>
          <ul className="cs-cells" aria-label={map.title}>
            {map.cells.map((state, index) => (
              <li key={index} data-state={state} aria-label={map.legend[state]} />
            ))}
          </ul>
          <ul className="cs-legend">
            <li data-state="done">{map.legend.done}</li>
            <li data-state="active">{map.legend.active}</li>
            <li data-state="pending">{map.legend.pending}</li>
          </ul>
        </article>
      )}

      <article className="st-panel st-panel--glass cs-band" style={rise(2)}>
        <ol className="cs-steps">
          {composition.steps.map((step, index) => (
            <li key={index}>
              <span className="cs-steps__node">
                <StageIcon id={step.icon} size={18} />
              </span>
              <small>
                {ordinal(index)} · {step.label}
              </small>
              <RichText html={step.text} />
            </li>
          ))}
        </ol>
        <FaceActions face={face} stack onOpenDetail={onOpenDetail} />
      </article>
    </>
  )
}
