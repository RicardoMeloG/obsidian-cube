import type { ReactNode } from 'react'
import { ArrowUpRight, Globe } from 'lucide-react'
import type { ChannelKind } from '@/kernel/compositions'
import { FaceActions, Heading } from '../blocks'
import { rise } from '../motion'
import type { TemplateProps } from '../blocks'
import { GithubMark, LinkedinMark, StageIcon } from '../StageIcon'
import './channels.css'

const CHANNEL_ICONS: Record<ChannelKind, ReactNode> = {
  email: <StageIcon id="mail" size={20} />,
  github: <GithubMark size={19} />,
  linkedin: <LinkedinMark size={18} />,
  web: <Globe aria-hidden size={19} strokeWidth={1.6} />,
}

// channels — the ways to reach the owner as large rows. The CV request form
// arrives with the security stage (spec 011, E-7).
export function Channels({ composition, face, counter, onOpenDetail }: TemplateProps<'channels'>) {
  return (
    <div className="ch-left" style={rise(0)}>
      <Heading face={face} counter={counter} />
      {composition.availability && (
        <p className="ch-availability">
          <span aria-hidden />
          {composition.availability}
        </p>
      )}
      <ul className="ch-channels">
        {composition.channels.map((channel, index) => (
          <li key={index}>
            <a className="focus-ring" href={channel.href} target={/^https?:/.test(channel.href) ? '_blank' : undefined} rel="noreferrer">
              <span className="st-tile">{CHANNEL_ICONS[channel.kind]}</span>
              <span>
                <strong>{channel.label}</strong>
                <small>{channel.text}</small>
              </span>
              <ArrowUpRight aria-hidden size={18} strokeWidth={1.6} />
            </a>
          </li>
        ))}
      </ul>
      <FaceActions face={face} onOpenDetail={onOpenDetail} />
    </div>
  )
}
