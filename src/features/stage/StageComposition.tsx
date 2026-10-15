import type { ResolvedFace } from '@/kernel/visualContent'
import { Case } from './templates/Case'
import { Catalog } from './templates/Catalog'
import { Channels } from './templates/Channels'
import { Ledger } from './templates/Ledger'
import { Reading } from './templates/Reading'
import { Showcase } from './templates/Showcase'

type StageCompositionProps = {
  face: ResolvedFace
  counter: string
  onOpenDetail: (trigger?: HTMLElement) => void
}

// The face's composition: the template its content chose (spec 011, AD-01).
export function StageComposition({ face, counter, onOpenDetail }: StageCompositionProps) {
  const { composition } = face
  const shared = { face, counter, onOpenDetail }
  switch (composition.template) {
    case 'showcase':
      return <Showcase {...shared} composition={composition} />
    case 'catalog':
      return <Catalog {...shared} composition={composition} />
    case 'case':
      return <Case {...shared} composition={composition} />
    case 'ledger':
      return <Ledger {...shared} composition={composition} />
    case 'reading':
      return <Reading {...shared} composition={composition} />
    case 'channels':
      return <Channels {...shared} composition={composition} />
  }
}
