import { useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronRight, FileText } from 'lucide-react'
import type { SiteContent } from '@/kernel/siteContent'
import { cx } from '@/ui/cx'
import type {
  AgenticFace,
  ContactFace,
  ProductsFace,
  ResearchFace,
  SecurityFace,
  StageFace,
  SystemsFace,
} from './conceptContent'
import { GithubMark, LinkedinMark, StageIcon } from './StageIcon'

type FaceProps<Face> = {
  face: Face
  counter: string
  identity: SiteContent['identity']
  onOpenDetail: (trigger?: HTMLElement) => void
}

// One composition per face, built from the same few blocks (panel, heading,
// icon row, chips, buttons) so the faces differ in shape, not in style.
export function StageFaceView(props: FaceProps<StageFace>) {
  const { face } = props
  switch (face.kind) {
    case 'agentic':
      return <AgenticLayout {...props} face={face} />
    case 'products':
      return <ProductsLayout {...props} face={face} />
    case 'systems':
      return <SystemsLayout {...props} face={face} />
    case 'security':
      return <SecurityLayout {...props} face={face} />
    case 'research':
      return <ResearchLayout {...props} face={face} />
    case 'contact':
      return <ContactLayout {...props} face={face} />
  }
}

// Order in which a block rises when the face enters (stage.css).
const rise = (order: number) => ({ '--i': order }) as CSSProperties

function Heading({ eyebrow, counter, title, summary, size = 'l' }: { eyebrow: string; counter?: string; title: [string, string]; summary?: string; size?: 'l' | 'm' }) {
  return (
    <div className="st-heading">
      <div className="st-heading__top">
        <p className="st-eyebrow">
          <span aria-hidden className="st-eyebrow__mark" />
          {eyebrow}
        </p>
        {counter && <span className="st-counter">{counter}</span>}
      </div>
      <h2 className={cx('st-title', size === 'm' && 'st-title--m')}>
        <span>{title[0]}</span>
        <span className="st-title__accent">{title[1]}</span>
      </h2>
      {summary && <p className="st-summary">{summary}</p>}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="st-chips">
      {items.map((chip) => (
        <li key={chip}>{chip}</li>
      ))}
    </ul>
  )
}

function Button({ children, primary, onClick, icon }: { children: ReactNode; primary?: boolean; onClick?: (trigger: HTMLElement) => void; icon?: ReactNode }) {
  return (
    <button className={cx('st-button focus-ring', primary && 'st-button--primary')} type="button" onClick={(event) => onClick?.(event.currentTarget)}>
      {icon}
      <span>{children}</span>
      <ChevronRight aria-hidden size={16} strokeWidth={1.8} />
    </button>
  )
}

function SectionLabel({ children, trail }: { children: ReactNode; trail?: string }) {
  return (
    <div className="st-label">
      <span>{children}</span>
      {trail && <small>{trail}</small>}
    </div>
  )
}

// AGENTIC — a live case and the operating model on the left, three numbered
// proofs on the right; the cube stays in view between them.
function AgenticLayout({ face, counter, onOpenDetail }: FaceProps<AgenticFace>) {
  return (
    <>
      <article className="st-panel ag-left" style={rise(0)}>
        <Heading eyebrow={face.eyebrow} counter={counter} title={face.title} summary={face.summary} />
        <div className="ag-featured">
          <span className="ag-featured__glyph">
            <StageIcon id="box" size={26} />
          </span>
          <div>
            <small className="ag-featured__label">{face.featured.label}</small>
            <strong>{face.featured.title}</strong>
            <p>{face.featured.text}</p>
            <Chips items={face.featured.chips} />
          </div>
          <ArrowUpRight aria-hidden className="ag-featured__go" size={18} strokeWidth={1.6} />
        </div>
        <SectionLabel>{face.modelTitle}</SectionLabel>
        <ol className="ag-model">
          {face.model.map((step) => (
            <li key={step.label}>
              <span className="st-tile">
                <StageIcon id={step.icon} size={17} />
              </span>
              <strong>{step.label}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </article>

      <article className="st-panel ag-right" style={rise(1)}>
        <SectionLabel trail={face.proofsTrail}>{face.proofsTitle}</SectionLabel>
        <ol className="ag-proofs">
          {face.proofs.map((proof, index) => (
            <li key={proof.title}>
              <span className="ag-proofs__number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <small>{proof.kind}</small>
                <strong>{proof.title}</strong>
                <p>{proof.text}</p>
                <Chips items={proof.chips} />
              </div>
              <span className="ag-proofs__icon">
                <StageIcon id={proof.icon} size={20} />
              </span>
            </li>
          ))}
        </ol>
        <div className="st-actions st-actions--stack">
          <Button primary onClick={onOpenDetail} icon={<GithubMark size={16} />}>
            {face.primary}
          </Button>
          <Button onClick={onOpenDetail} icon={<FileText aria-hidden size={16} strokeWidth={1.6} />}>
            {face.secondary}
          </Button>
        </div>
      </article>
    </>
  )
}

// PRODUCTS — a catalogue on the left and the chosen product's sheet, with its
// screenshot, laid over the cube as frosted glass.
function ProductsLayout({ face, counter, onOpenDetail }: FaceProps<ProductsFace>) {
  const [selectedId, setSelectedId] = useState(face.products[0].id)
  const product = face.products.find((item) => item.id === selectedId) ?? face.products[0]
  return (
    <>
      <article className="st-panel pr-list" style={rise(0)}>
        <Heading eyebrow={face.eyebrow} counter={counter} title={face.title} summary={face.summary} size="m" />
        <SectionLabel>{face.listTitle}</SectionLabel>
        <ul className="pr-items">
          {face.products.map((item) => (
            <li key={item.id}>
              <button
                className={cx('pr-item focus-ring', item.id === product.id && 'is-selected')}
                type="button"
                aria-pressed={item.id === product.id}
                onClick={() => setSelectedId(item.id)}
              >
                <img src={item.thumb} alt="" width={160} height={160} />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.meta} · {item.status}
                  </small>
                </span>
                <ChevronRight aria-hidden size={16} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      </article>

      <article className="st-panel st-panel--glass pr-detail" style={rise(1)} key={product.id}>
        <header className="pr-detail__head">
          <div>
            <p className="st-eyebrow">
              <span aria-hidden className="st-eyebrow__mark" />
              {product.meta}
            </p>
            <h3>{product.name}</h3>
            <p>{product.text}</p>
          </div>
          <span className="pr-status">
            <span aria-hidden />
            {product.status}
          </span>
        </header>
        <div className="pr-detail__body">
          <figure className="pr-shot">
            <img src={product.image} alt={product.name} width={1080} height={720} />
          </figure>
          <dl className="pr-facts">
            {product.facts.map((fact) => (
              <div key={fact.label}>
                <dt>
                  <StageIcon id={fact.icon} size={16} />
                  {fact.label}
                </dt>
                <dd>{fact.text}</dd>
              </div>
            ))}
            <Chips items={product.chips} />
          </dl>
        </div>
        <div className="st-actions">
          <Button primary onClick={onOpenDetail} icon={<GithubMark size={16} />}>
            {face.primary}
          </Button>
          <Button onClick={onOpenDetail}>{face.secondary}</Button>
        </div>
      </article>
    </>
  )
}

// SYSTEMS — the case on the left, a migration map on the right, and the story
// (context → constraint → decision → result) as one band across the bottom.
function SystemsLayout({ face, counter, onOpenDetail }: FaceProps<SystemsFace>) {
  return (
    <>
      <div className="sy-head" style={rise(0)}>
        <Heading eyebrow={face.eyebrow} counter={counter} title={face.title} summary={face.summary} />
        <p className="sy-case">
          <span>{face.caseLabel}</span>
          {face.caseName}
        </p>
        <div className="sy-compare">
          <div>
            <small>{face.before.title}</small>
            <ul>
              {face.before.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <ChevronRight aria-hidden className="sy-compare__arrow" size={20} strokeWidth={1.6} />
          <div className="is-after">
            <small>{face.after.title}</small>
            <ul>
              {face.after.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <article className="st-panel sy-map" style={rise(1)}>
        <SectionLabel trail={face.mapNote}>{face.mapTitle}</SectionLabel>
        <ul className="sy-modules" aria-label={face.mapTitle}>
          {face.modules.map((state, index) => (
            <li key={index} data-state={state} />
          ))}
        </ul>
        <ul className="sy-legend">
          <li data-state="migrated">{face.legend.migrated}</li>
          <li data-state="active">{face.legend.active}</li>
          <li data-state="pending">{face.legend.pending}</li>
        </ul>
      </article>

      <article className="st-panel st-panel--glass sy-band" style={rise(2)}>
        <ol className="sy-steps">
          {face.steps.map((step, index) => (
            <li key={step.label}>
              <span className="sy-steps__node">
                <StageIcon id={step.icon} size={18} />
              </span>
              <small>
                {String(index + 1).padStart(2, '0')} · {step.label}
              </small>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <Button primary onClick={onOpenDetail}>
          {face.primary}
        </Button>
      </article>
    </>
  )
}

// SECURITY — the boundary and the decision on the left, and the register of
// controls as a console on the right.
function SecurityLayout({ face, counter, onOpenDetail }: FaceProps<SecurityFace>) {
  return (
    <>
      <div className="se-left" style={rise(0)}>
        <Heading eyebrow={face.eyebrow} counter={counter} title={face.title} summary={face.summary} />
        <div className="se-callout">
          <span className="st-tile">
            <StageIcon id="shield" size={18} />
          </span>
          <div>
            <small>{face.boundary.label}</small>
            <p>{face.boundary.text}</p>
          </div>
        </div>
        <div className="se-callout">
          <span className="st-tile">
            <StageIcon id="key" size={18} />
          </span>
          <div>
            <small>{face.decision.label}</small>
            <strong>{face.decision.title}</strong>
            <p>{face.decision.text}</p>
          </div>
        </div>
      </div>

      <article className="st-panel se-console" style={rise(1)}>
        <header className="se-console__bar">
          <span aria-hidden className="se-console__dots">
            <i />
            <i />
            <i />
          </span>
          <span>{face.consoleTitle}</span>
        </header>
        <div className="se-console__body">
          <p className="se-console__command">
            <span aria-hidden>$</span> {face.command}
          </p>
          <ul>
            {face.controls.map((control) => (
              <li key={control.id} data-status={control.status}>
                <span className="se-status">{face.statusLabels[control.status]}</span>
                <code>{control.id}</code>
                <span className="se-text">{control.text}</span>
              </li>
            ))}
          </ul>
          <p className="se-console__tally">
            <Check aria-hidden size={14} strokeWidth={2} /> {face.tally}
          </p>
        </div>
        <div className="st-actions">
          <Button primary onClick={onOpenDetail}>
            {face.primary}
          </Button>
        </div>
      </article>
    </>
  )
}

// RESEARCH — a reading column over the cube (question, thesis, objection,
// limit), with the distinctions and the public notes in the margins.
function ResearchLayout({ face, counter, onOpenDetail }: FaceProps<ResearchFace>) {
  return (
    <>
      <div className="re-margin" style={rise(0)}>
        <Heading eyebrow={face.eyebrow} counter={counter} title={face.title} summary={face.summary} size="m" />
        <SectionLabel>{face.distinctionsTitle}</SectionLabel>
        <dl className="re-distinctions">
          {face.distinctions.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </div>

      <article className="st-panel st-panel--glass re-column" style={rise(1)}>
        <small className="re-question__label">{face.questionLabel}</small>
        <blockquote className="re-question">{face.question}</blockquote>
        <ol className="re-chain">
          {face.chain.map((link) => (
            <li key={link.label}>
              <span className="re-chain__node">
                <StageIcon id={link.icon} size={16} />
              </span>
              <small>{link.label}</small>
              <p>{link.text}</p>
            </li>
          ))}
        </ol>
      </article>

      <aside className="st-panel re-notes" style={rise(2)}>
        <span className="re-notes__doc">
          <FileText aria-hidden size={30} strokeWidth={1.3} />
        </span>
        <small>{face.notes.label}</small>
        <strong>{face.notes.title}</strong>
        <p>{face.notes.meta}</p>
        <Button primary onClick={onOpenDetail}>
          {face.primary}
        </Button>
      </aside>
    </>
  )
}

// CONTACT — the channels as large rows on the left, the CV request on the
// right; the cube stays in view.
function ContactLayout({ face, counter, identity }: FaceProps<ContactFace>) {
  const [sent, setSent] = useState(false)
  const [human, setHuman] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSent(true)
  }
  const channelIcon = { email: <StageIcon id="mail" size={20} />, github: <GithubMark size={19} />, linkedin: <LinkedinMark size={18} /> }
  const channelHref = { email: '#email', github: `https://github.com/${identity.handle}`, linkedin: '#linkedin' }
  return (
    <>
      <div className="co-left" style={rise(0)}>
        <Heading eyebrow={face.eyebrow} counter={counter} title={face.title} summary={face.summary} />
        <p className="co-availability">
          <span aria-hidden />
          {face.availability}
        </p>
        <ul className="co-channels">
          {face.channels.map((channel) => (
            <li key={channel.id}>
              <a className="focus-ring" href={channelHref[channel.id]} target={channel.id === 'github' ? '_blank' : undefined} rel="noreferrer">
                <span className="st-tile">{channelIcon[channel.id]}</span>
                <span>
                  <strong>{channel.label}</strong>
                  <small>{channel.text}</small>
                </span>
                <ArrowUpRight aria-hidden size={18} strokeWidth={1.6} />
              </a>
            </li>
          ))}
        </ul>
      </div>

      <form className="st-panel co-form" style={rise(1)} onSubmit={submit}>
        <div className="co-form__head">
          <span className="st-tile">
            <FileText aria-hidden size={18} strokeWidth={1.6} />
          </span>
          <div>
            <strong>{face.form.title}</strong>
            <p>{face.form.text}</p>
          </div>
        </div>
        <label>
          <span>{face.form.fields.name}</span>
          <input autoComplete="name" />
        </label>
        <label>
          <span>{face.form.fields.company}</span>
          <input autoComplete="organization" />
        </label>
        <label>
          <span>{face.form.fields.email}</span>
          <input type="email" autoComplete="email" />
        </label>
        <button className={cx('co-human focus-ring', human && 'is-checked')} type="button" aria-pressed={human} onClick={() => setHuman(!human)}>
          <span aria-hidden>{human && <Check size={14} strokeWidth={2.4} />}</span>
          {face.form.human}
        </button>
        <button className="st-button st-button--primary focus-ring co-submit" type="submit">
          <span>{face.form.submit}</span>
          <ChevronRight aria-hidden size={16} strokeWidth={1.8} />
        </button>
        <small className="co-note">{sent ? face.form.sent : face.form.note}</small>
      </form>
    </>
  )
}
