import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSceneIdle } from './idleCadence'

// The rest that lowers the scene to 30 frames a second (dt-12, C-2): it starts
// only after a stretch without input and with nothing busy, and any input ends it.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let seen: boolean[] = []
function Probe({ busy }: { busy: boolean }) {
  seen.push(useSceneIdle(busy, 1000))
  return null
}

describe('useSceneIdle', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const render = (busy: boolean) => act(() => root.render(<Probe busy={busy} />))
  const idleNow = () => seen[seen.length - 1]

  beforeEach(() => {
    vi.useFakeTimers()
    seen = []
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
  })

  it('rests after the quiet stretch, not before', () => {
    render(false)
    act(() => vi.advanceTimersByTime(999))
    expect(idleNow()).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(idleNow()).toBe(true)
  })

  it('wakes on input and waits a full stretch again', () => {
    render(false)
    act(() => vi.advanceTimersByTime(1000))
    act(() => void window.dispatchEvent(new Event('pointermove')))
    expect(idleNow()).toBe(false)
    act(() => vi.advanceTimersByTime(600))
    act(() => void window.dispatchEvent(new Event('keydown')))
    act(() => vi.advanceTimersByTime(600))
    expect(idleNow()).toBe(false)
    act(() => vi.advanceTimersByTime(400))
    expect(idleNow()).toBe(true)
  })

  it('never rests while the scene is busy, and counts its end as activity', () => {
    render(true)
    act(() => vi.advanceTimersByTime(5000))
    expect(idleNow()).toBe(false)
    render(false)
    act(() => vi.advanceTimersByTime(999))
    expect(idleNow()).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(idleNow()).toBe(true)
    render(true)
    expect(idleNow()).toBe(false)
  })

  it('stops listening once unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    render(false)
    act(() => root.unmount())
    expect(remove.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['pointermove', 'keydown', 'wheel']))
    root = createRoot(container)
  })
})
