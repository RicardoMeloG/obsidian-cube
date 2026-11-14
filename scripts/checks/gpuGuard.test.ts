// @vitest-environment node
import type { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { fitsOnGpu, gpuMemory, gpuProcesses } from '../lib/gpu-guard.mjs'

// One large GPU job at a time (AGENTS.md, Working Method): the change audit
// measures the card before loading a model and stops when it does not fit.
const smi = (out: string) => (() => out) as unknown as typeof execFileSync

describe('gpu guard', () => {
  it('reads free and total memory from nvidia-smi', () => {
    expect(gpuMemory(smi('6400, 24564\n'))).toEqual({ freeMb: 6400, totalMb: 24564 })
  })

  it('refuses a 17 GB model when another job holds 14 GB of a 24 GB card', () => {
    const verdict = fitsOnGpu(17000, { freeMb: 10300, totalMb: 24564 })
    expect(verdict.fits).toBe(false)
    expect(verdict.reason).toMatch(/10300 MB free/)
  })

  it('accepts the model on a free card, with its margin', () => {
    expect(fitsOnGpu(17000, { freeMb: 22000, totalMb: 24564 }).fits).toBe(true)
    expect(fitsOnGpu(17000, { freeMb: 17200, totalMb: 24564 }).fits).toBe(false)
  })

  it('does not block where memory cannot be measured, and says so', () => {
    expect(gpuMemory((() => { throw new Error('no nvidia-smi') }) as unknown as typeof execFileSync)).toBeNull()
    expect(fitsOnGpu(17000, null)).toEqual({ fits: true, reason: 'nvidia-smi not available: memory not measured' })
  })

  it('lists the processes that hold the card', () => {
    expect(gpuProcesses(smi('20168, python.exe, 8000 MiB\n'))).toEqual(['20168, python.exe, 8000 MiB'])
  })
})
