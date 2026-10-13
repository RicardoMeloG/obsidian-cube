import { lazy, Suspense } from 'react'
import { PremiumCubePrototype } from './Experience'
import { isWorldId } from '@/features/scene/vector-worlds/registry'
import '@/App.css'

// Dev-only world showcase (?bg=<world>, ?bg=only, ?tune=1). Loaded lazily and
// only in development so the tuning tooling never ships to visitors.
const VectorWorldShowcase = lazy(() =>
  import('@/features/dev/VectorWorldShowcase').then((module) => ({ default: module.VectorWorldShowcase })),
)

function readBgShowcaseFlag() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  const bg = new URLSearchParams(window.location.search).get('bg')
  if (!bg) return false
  return bg === 'only' || isWorldId(bg)
}

function App() {
  if (readBgShowcaseFlag()) {
    return (
      <Suspense fallback={null}>
        <VectorWorldShowcase />
      </Suspense>
    )
  }
  return <PremiumCubePrototype />
}

export default App
