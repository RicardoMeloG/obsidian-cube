import { PremiumCubePrototype } from './features/premium-cube/PremiumCubePrototype'
import { isWorldId } from './features/premium-cube/scene/vector-worlds/registry'
import { VectorWorldShowcase } from './features/premium-cube/VectorWorldShowcase'
import './App.css'

function readBgShowcaseFlag() {
  if (typeof window === 'undefined') return false
  const bg = new URLSearchParams(window.location.search).get('bg')
  if (!bg) return false
  return bg === 'only' || isWorldId(bg)
}

function App() {
  return readBgShowcaseFlag() ? <VectorWorldShowcase /> : <PremiumCubePrototype />
}

export default App
