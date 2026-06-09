type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

const MASTER_VOLUME = 0.28
const GLASS_FUNDAMENTAL = 704

let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null
let dynamicsLimiter: DynamicsCompressorNode | null = null
let dragOscillator: OscillatorNode | null = null
let dragOvertone: OscillatorNode | null = null
let dragFilter: BiquadFilterNode | null = null
let dragGain: GainNode | null = null
let dragRequested = false

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function scheduleGlassVoice(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  gain: number,
  duration: number,
  detune = 0,
) {
  const oscillator = context.createOscillator()
  const voiceGain = context.createGain()
  const now = context.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, now)
  oscillator.detune.setValueAtTime(detune, now)

  voiceGain.gain.setValueAtTime(0.0001, now)
  voiceGain.gain.exponentialRampToValueAtTime(gain, now + 0.026)
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  oscillator.connect(voiceGain)
  voiceGain.connect(destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.08)
}

function playGlassResonance(baseFrequency: number, intensity: number, duration: number) {
  if (!audioContext || !masterGain) {
    return
  }

  const context = audioContext
  const filter = context.createBiquadFilter()
  const resonanceGain = context.createGain()

  filter.type = 'bandpass'
  filter.frequency.value = baseFrequency * 1.42
  filter.Q.value = 9.5
  resonanceGain.gain.value = clamp(intensity, 0.08, 1)

  filter.connect(resonanceGain)
  resonanceGain.connect(masterGain)

  scheduleGlassVoice(context, filter, baseFrequency, 0.052, duration, -3)
  scheduleGlassVoice(context, filter, baseFrequency * 1.006, 0.026, duration * 0.92, 4)
  scheduleGlassVoice(context, filter, baseFrequency * 1.98, 0.017, duration * 0.64, -8)
  scheduleGlassVoice(context, filter, baseFrequency * 2.73, 0.008, duration * 0.42, 6)
}

function getAudioContext() {
  if (audioContext) {
    return audioContext
  }

  const AudioContextConstructor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext

  if (!AudioContextConstructor) {
    return null
  }

  audioContext = new AudioContextConstructor()
  masterGain = audioContext.createGain()
  dynamicsLimiter = audioContext.createDynamicsCompressor()
  masterGain.gain.value = MASTER_VOLUME
  dynamicsLimiter.threshold.value = -18
  dynamicsLimiter.knee.value = 12
  dynamicsLimiter.ratio.value = 7
  dynamicsLimiter.attack.value = 0.006
  dynamicsLimiter.release.value = 0.16
  masterGain.connect(dynamicsLimiter)
  dynamicsLimiter.connect(audioContext.destination)

  return audioContext
}

async function unlockAudio() {
  const context = getAudioContext()

  if (!context) {
    return null
  }

  if (context.state === 'suspended') {
    await context.resume()
  }

  return context
}

export async function startCubeDragSound() {
  dragRequested = true
  const context = await unlockAudio()

  if (!context || dragOscillator || !masterGain || !dragRequested) {
    return
  }

  dragOscillator = context.createOscillator()
  dragOvertone = context.createOscillator()
  dragFilter = context.createBiquadFilter()
  dragGain = context.createGain()

  dragOscillator.type = 'sine'
  dragOvertone.type = 'sine'
  dragOscillator.frequency.value = GLASS_FUNDAMENTAL
  dragOvertone.frequency.value = GLASS_FUNDAMENTAL * 1.006
  dragOscillator.detune.value = -4
  dragOvertone.detune.value = 5
  dragFilter.type = 'bandpass'
  dragFilter.frequency.value = GLASS_FUNDAMENTAL
  dragFilter.Q.value = 11
  dragGain.gain.value = 0.0001

  dragOscillator.connect(dragFilter)
  dragOvertone.connect(dragFilter)
  dragFilter.connect(dragGain)
  dragGain.connect(masterGain)
  dragOscillator.start()
  dragOvertone.start()
}

export function updateCubeDragSound(pointerSpeed: number) {
  if (!audioContext || !dragOscillator || !dragFilter || !dragGain) {
    return
  }

  const intensity = clamp(pointerSpeed / 42, 0, 1)
  const now = audioContext.currentTime

  dragOscillator.frequency.setTargetAtTime(GLASS_FUNDAMENTAL + intensity * 34, now, 0.07)
  dragOvertone?.frequency.setTargetAtTime(GLASS_FUNDAMENTAL * 1.006 + intensity * 41, now, 0.08)
  dragFilter.frequency.setTargetAtTime(GLASS_FUNDAMENTAL + intensity * 110, now, 0.08)
  dragGain.gain.setTargetAtTime(0.007 + intensity * 0.038, now, 0.05)
}

export function stopCubeDragSound() {
  dragRequested = false

  if (!audioContext || !dragOscillator || !dragGain) {
    return
  }

  const oscillator = dragOscillator
  const overtone = dragOvertone
  const gain = dragGain
  const now = audioContext.currentTime

  gain.gain.cancelScheduledValues(now)
  gain.gain.setTargetAtTime(0.0001, now, 0.035)
  oscillator.stop(now + 0.14)
  overtone?.stop(now + 0.14)

  dragOscillator = null
  dragOvertone = null
  dragFilter = null
  dragGain = null
}

export function playCubeDragTickSound(pointerSpeed: number) {
  if (!audioContext || !masterGain) {
    return
  }

  const intensity = clamp(pointerSpeed / 54, 0.12, 1)
  playGlassResonance(GLASS_FUNDAMENTAL + intensity * 96, 0.42 + intensity * 0.42, 0.62)
}

export async function playCubeFaceClickSound() {
  const context = await unlockAudio()

  if (!context || !masterGain) {
    return
  }

  playGlassResonance(GLASS_FUNDAMENTAL * 1.18, 0.94, 0.88)
}

export async function playCubeTransitionSound() {
  const context = await unlockAudio()

  if (!context || !masterGain) {
    return
  }

  playGlassResonance(GLASS_FUNDAMENTAL * 0.92, 0.88, 1.24)
  window.setTimeout(() => {
    playGlassResonance(GLASS_FUNDAMENTAL * 1.31, 0.56, 0.86)
  }, 180)
}
