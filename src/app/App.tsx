import { lazy, Suspense } from 'react'
import { Experience } from './Experience'
import { isWorldId } from '@/features/scene/vector-worlds/registry'

// Dev-only world showcase (?bg=<world>, ?bg=only, ?tune=1). The DEV guard
// removes it, and its chunk, from the production build.
const VectorWorldShowcase = import.meta.env.DEV
  ? lazy(() => import('@/features/dev/VectorWorldShowcase').then((module) => ({ default: module.VectorWorldShowcase })))
  : null

function readBgShowcaseFlag() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  const bg = new URLSearchParams(window.location.search).get('bg')
  if (!bg) return false
  return bg === 'only' || isWorldId(bg)
}

function App() {
  if (VectorWorldShowcase && readBgShowcaseFlag()) {
    return (
      <Suspense fallback={null}>
        <VectorWorldShowcase />
      </Suspense>
    )
  }
  return <Experience />
}

export default App
