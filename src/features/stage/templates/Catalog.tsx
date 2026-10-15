import { useState } from 'react'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { RichText } from '@/features/content/RichText'
import { cx } from '@/ui/cx'
import { Chips, FaceActions, Heading, SectionLabel } from '../blocks'
import { rise } from '../motion'
import type { TemplateProps } from '../blocks'
import { StageIcon } from '../StageIcon'
import './catalog.css'

// catalog — the items on the left and the chosen item's sheet on the right,
// with its image; the centre stays clear for the cube (spec 011, E-3).
export function Catalog({ composition, face, counter, onOpenDetail }: TemplateProps<'catalog'>) {
  const [selectedId, setSelectedId] = useState(composition.items[0]?.id)
  const item = composition.items.find((candidate) => candidate.id === selectedId) ?? composition.items[0]
  if (!item) return null
  return (
    <>
      <article className="st-panel ca-list" style={rise(0)}>
        <Heading face={face} counter={counter} size="m" />
        <SectionLabel>{composition.listTitle}</SectionLabel>
        <ul className="ca-items">
          {composition.items.map((candidate) => (
            <li key={candidate.id}>
              <button
                className={cx('ca-item focus-ring', candidate.id === item.id && 'is-selected')}
                type="button"
                aria-pressed={candidate.id === item.id}
                onClick={() => setSelectedId(candidate.id)}
              >
                <img src={candidate.image.thumb ?? candidate.image.src} alt="" width={64} height={40} />
                <span>
                  <strong>{candidate.name}</strong>
                  <small>
                    {candidate.meta} · {candidate.status}
                  </small>
                </span>
                <ChevronRight aria-hidden size={16} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
        <FaceActions face={face} onOpenDetail={onOpenDetail} />
      </article>

      <article className="st-panel st-panel--glass ca-detail" style={rise(1)} key={item.id}>
        <header className="ca-detail__head">
          <div>
            <p className="st-eyebrow">
              <span aria-hidden className="st-eyebrow__mark" />
              {item.meta}
            </p>
            <h3>{item.name}</h3>
          </div>
          <span className="ca-status">
            <span aria-hidden />
            {item.status}
          </span>
        </header>
        <RichText className="ca-text" html={item.text} />
        <div className="ca-detail__body">
          <figure className="ca-shot">
            <img src={item.image.src} alt={item.image.alt} width={item.image.width} height={item.image.height} />
          </figure>
          <dl className="ca-facts">
          {item.facts.map((fact, index) => (
            <div key={index}>
              <dt>
                <StageIcon id={fact.icon} size={16} />
                {fact.label}
              </dt>
              <RichText as="dd" html={fact.text} />
            </div>
          ))}
          </dl>
        </div>
        <Chips items={item.chips} />
        {item.links && item.links.length > 0 && (
          <ul className="ca-links">
            {item.links.map((link) => (
              <li key={link.href}>
                <a className="focus-ring" href={link.href} target={/^https?:/.test(link.href) ? '_blank' : undefined} rel="noreferrer">
                  {link.label}
                  <ArrowUpRight aria-hidden size={15} strokeWidth={1.7} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  )
}
