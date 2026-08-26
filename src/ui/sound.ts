/** Sons de jeu synthétisés (WebAudio, aucun asset). Préférence persistée. */
const STORAGE_KEY = 'impetus.sound.v1'

let ctx: AudioContext | null = null
let enabled = true

try {
  enabled = localStorage.getItem(STORAGE_KEY) !== 'off'
} catch {
  /* stockage indisponible */
}

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface ToneOpts {
  freq: number
  to?: number
  dur: number
  type?: OscillatorType
  gain?: number
  delay?: number
}

function tone({ freq, to, dur, type = 'triangle', gain = 0.18, delay = 0 }: ToneOpts): void {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** Poser une pierre : « pouf » doux et mat. */
export function playPlace(): void {
  tone({ freq: 150, to: 118, dur: 0.07, type: 'sine', gain: 0.11 })
}

/** Glisser : souffle bref descendant. */
export function playSlide(): void {
  tone({ freq: 420, to: 190, dur: 0.13, type: 'sine', gain: 0.12 })
}

/** Capture : double percussion plus sèche. */
export function playCapture(): void {
  tone({ freq: 260, to: 130, dur: 0.1, type: 'triangle', gain: 0.26 })
  tone({ freq: 130, to: 90, dur: 0.14, type: 'sine', gain: 0.2, delay: 0.05 })
}

/** Victoire (pour le joueur) : arpège montant. */
export function playWin(): void {
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.14, delay: i * 0.09 }))
}

/** Défaite : descente grave. */
export function playLoss(): void {
  tone({ freq: 330, to: 165, dur: 0.5, type: 'sine', gain: 0.16 })
  tone({ freq: 220, to: 110, dur: 0.6, type: 'triangle', gain: 0.1, delay: 0.12 })
}

export function isSoundOn(): boolean {
  return enabled
}

export function setSoundOn(v: boolean): void {
  enabled = v
  try {
    localStorage.setItem(STORAGE_KEY, v ? 'on' : 'off')
  } catch {
    /* stockage indisponible */
  }
}
