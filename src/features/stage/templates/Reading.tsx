import { FileText } from 'lucide-react'
import { RichText } from '@/features/content/RichText'
import { FaceActions, Heading, MaybeLink, SectionLabel } from '../blocks'
import { rise } from '../motion'
import type { TemplateProps } from '../blocks'
import { StageIcon } from '../StageIcon'
import './reading.css'

// reading — the heading and the distinctions on the left, the question and
// its chain on the right with the document under it; the centre stays clear
// for the cube (spec 011, E-3).
export function Reading({ composition, face, counter, onOpenDetail }: TemplateProps<'reading'>) {
  const { document } = composition
  return (
    <>
      <div className="rd-margin" style={rise(0)}>
        <Heading face={face} counter={counter} size="m" />
        <SectionLabel>{composition.distinctionsTitle}</SectionLabel>
        <dl className="rd-distinctions">
          {composition.distinctions.map((item, index) => (
            <div key={index}>
              <dt>{item.term}</dt>
              <RichText as="dd" html={item.text} />
            </div>
          ))}
        </dl>
      </div>

      <div className="rd-right">
        <article className="st-panel st-panel--glass rd-column" style={rise(1)}>
          <small className="rd-question__label">{composition.questionLabel}</small>
          <RichText as="blockquote" className="rd-question" html={composition.question} />
          <ol className="rd-chain">
            {composition.chain.map((link, index) => (
              <li key={index}>
                <span className="rd-chain__node">
                  <StageIcon id={link.icon} size={16} />
                </span>
                <small>{link.label}</small>
                <RichText html={link.text} />
              </li>
            ))}
          </ol>
        </article>

        <aside className="st-panel rd-notes" style={rise(2)}>
          <MaybeLink className="rd-notes__doc" href={document.href}>
            <span className="rd-notes__icon">
              <FileText aria-hidden size={26} strokeWidth={1.3} />
            </span>
            <span>
              <small>{document.label}</small>
              <strong>{document.title}</strong>
              {document.meta && <span className="rd-notes__meta">{document.meta}</span>}
            </span>
          </MaybeLink>
          <FaceActions face={face} onOpenDetail={onOpenDetail} />
        </aside>
      </div>
    </>
  )
}
