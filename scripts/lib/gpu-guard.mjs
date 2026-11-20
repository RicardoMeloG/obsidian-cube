// One large GPU job at a time (owner, 2026-11-14): before a local model is
// loaded, measure the video memory. A 27B model needs about 17 GB; loading it
// on top of another job spilled into system memory and froze the machine.
// When the free memory does not fit the model, the audit stops and says who
// holds the card, instead of loading anyway.
import { execFileSync } from 'node:child_process'

// The model sizes Ollama reports already include their weights; 256 MB covers its runtime. A larger
// margin refused gemma (19.4 GB) on a card with 19.8 GB free, where it has always run.
const MARGIN_MB = 256

/** Free and total video memory of the first NVIDIA card, or null without nvidia-smi. */
export function gpuMemory(run = execFileSync) {
  try {
    const out = run('nvidia-smi', ['--query-gpu=memory.free,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8' })
    const [free, total] = String(out).split('\n')[0].split(',').map((value) => Number(value.trim()))
    return Number.isFinite(free) && Number.isFinite(total) ? { freeMb: free, totalMb: total } : null
  } catch {
    return null
  }
}

/** The compute processes on the card, for the message. */
export function gpuProcesses(run = execFileSync) {
  try {
    return String(run('nvidia-smi', ['--query-compute-apps=pid,process_name,used_memory', '--format=csv,noheader'], { encoding: 'utf8' }))
      .split('\n').map((line) => line.trim()).filter(Boolean)
  } catch {
    return []
  }
}

/** Whether a model of `sizeMb` fits in what is free, with a margin. */
export function fitsOnGpu(sizeMb, memory) {
  if (!memory) return { fits: true, reason: 'nvidia-smi not available: memory not measured' }
  const needed = sizeMb + MARGIN_MB
  return memory.freeMb >= needed
    ? { fits: true, reason: `${memory.freeMb} MB free, ${needed} MB needed` }
    : { fits: false, reason: `${memory.freeMb} MB free of ${memory.totalMb} MB, ${needed} MB needed` }
}

/** The size Ollama reports for a pulled model, in MB, or null. */
export async function modelSizeMb(model, fetchImpl = fetch) {
  try {
    const response = await fetchImpl('http://127.0.0.1:11434/api/tags')
    const { models = [] } = await response.json()
    const found = models.find((item) => item.name === model || item.model === model)
    return found?.size ? Math.round(found.size / (1024 * 1024)) : null
  } catch {
    return null
  }
}
