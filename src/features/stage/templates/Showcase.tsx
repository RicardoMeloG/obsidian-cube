import { ArrowUpRight } from 'lucide-react'
import { RichText } from '@/features/content/RichText'
import { Chips, FaceActions, Heading, MaybeLink, SectionLabel } from '../blocks'
import { ordinal, rise } from '../motion'
import type { TemplateProps } from '../blocks'
import { StageIcon } from '../StageIcon'
import './showcase.css'

// showcase — a featured case and a list of steps on the left, numbered proofs
// on the right; the cube stays in view between them.
export function Showcase({ composition, face, counter, onOpenDetail }: TemplateProps<'showcase'>) {
  const { featured } = composition
  return (
    <>
      <article className="st-panel sh-left" style={rise(0)}>
        <Heading face={face} counter={counter} />
        <MaybeLink className="sh-featured" href={featured.href}>
          <span className="sh-featured__glyph">
            <StageIcon id={featured.icon} size={26} />
          </span>
          <div>
            <small className="sh-featured__label">{featured.label}</small>
            <strong>{featured.title}</strong>
            <RichText html={featured.text} />
            <Chips items={featured.chips} />
          </div>
          {featured.href && <ArrowUpRight aria-hidden className="sh-featured__go" size={18} strokeWidth={1.6} />}
        </MaybeLink>
        <SectionLabel>{composition.stepsTitle}</SectionLabel>
        <ol className="sh-steps">
          {composition.steps.map((step, index) => (
            <li key={index}>
              <span className="st-tile">
                <StageIcon id={step.icon} size={17} />
              </span>
              <strong>{step.label}</strong>
              <RichText html={step.text} />
            </li>
          ))}
        </ol>
      </article>

      <article className="st-panel sh-right" style={rise(1)}>
        <SectionLabel trail={composition.proofsTrail}>{composition.proofsTitle}</SectionLabel>
        <ol className="sh-proofs">
          {composition.proofs.map((proof, index) => (
            <li key={index}>
              <MaybeLink className="sh-proof" href={proof.href}>
                <span className="sh-proofs__number">{ordinal(index)}</span>
                <div>
                  <small>{proof.kind}</small>
                  <strong>{proof.title}</strong>
                  <RichText html={proof.text} />
                  <Chips items={proof.chips} />
                </div>
                <span className="sh-proofs__icon">
                  <StageIcon id={proof.icon} size={20} />
                </span>
              </MaybeLink>
            </li>
          ))}
        </ol>
        <FaceActions face={face} stack onOpenDetail={onOpenDetail} />
      </article>
    </>
  )
}
