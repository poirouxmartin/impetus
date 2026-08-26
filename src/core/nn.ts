/**
 * Petit réseau policy+value (AlphaZero-lite) en TypeScript pur.
 * Entrée  : 81×2 (pierres) + réserves normalisées + trait + swap = 166
 * Sorties : policy 406 (81 poses + 81×4 glisses + swap, softmax masquée) · value tanh [-1,1]
 */
import { type Action, type Position, SIZE } from './rules'

export const NN_IN = 166
export const NN_H1 = 96
export const NN_H2 = 64
export const NN_OUT = 406

export interface NnWeights {
  w1: number[][]
  b1: number[]
  w2: number[][]
  b2: number[]
  wp: number[][]
  bp: number[]
    wv: number[]
    bv: number[]
  }

export const DIR_INDEX: Record<string, number> = { up: 0, down: 1, left: 2, right: 3 }

/** Index de sortie policy pour une action (0..405). */
export function moveIndex(a: Action): number {
  if (a.kind === 'place') return a.row * SIZE + a.col
  if (a.kind === 'swap') return NN_OUT - 1
  const base = 81 + (a.row * SIZE + a.col) * 4
  return base + DIR_INDEX[a.dir]
}

/** Encodage plat d'une position (166 valeurs). */
export function encodeInput(pos: Position): Float64Array {
  const x = new Float64Array(NN_IN)
  for (let i = 0; i < SIZE * SIZE; i++) {
    const c = pos.cells[i]
    if (c === 'black') x[i] = 1
    else if (c === 'white') x[SIZE * SIZE + i] = 1
  }
  x[162] = pos.reserves.black / 15
  x[163] = pos.reserves.white / 15
  x[164] = pos.turn === 'black' ? 1 : 0
  x[165] = pos.swapped ? 1 : 0
  return x
}

function randn(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function mat(r: number, c: number, scale: number): number[][] {
  return Array.from({ length: r }, () => Array.from({ length: c }, () => randn() * scale))
}

function vec(n: number): number[] {
  return new Array(n).fill(0)
}

export function randomWeights(): NnWeights {
  return {
    w1: mat(NN_H1, NN_IN, Math.sqrt(2 / NN_IN)),
    b1: vec(NN_H1),
    w2: mat(NN_H2, NN_H1, Math.sqrt(2 / NN_H1)),
    b2: vec(NN_H2),
    wp: mat(NN_OUT, NN_H2, Math.sqrt(2 / NN_H2)),
    bp: vec(NN_OUT),
    wv: vec(NN_H2),
    bv: [0],
  }
}

export interface ForwardOut {
  h2: Float64Array
  logits: Float64Array
  value: number
}

export function forward(w: NnWeights, x: Float64Array): ForwardOut {
  const h1 = new Float64Array(NN_H1)
  for (let j = 0; j < NN_H1; j++) {
    let s = w.b1[j]
    const row = w.w1[j]
    for (let i = 0; i < NN_IN; i++) s += row[i] * x[i]
    h1[j] = s > 0 ? s : 0
  }
  const h2 = new Float64Array(NN_H2)
  for (let j = 0; j < NN_H2; j++) {
    let s = w.b2[j]
    const row = w.w2[j]
    for (let i = 0; i < NN_H1; i++) s += row[i] * h1[i]
    h2[j] = s > 0 ? s : 0
  }
  const logits = new Float64Array(NN_OUT)
  for (let k = 0; k < NN_OUT; k++) {
    let s = w.bp[k]
    const row = w.wp[k]
    for (let i = 0; i < NN_H2; i++) s += row[i] * h2[i]
    logits[k] = s
  }
  let vs = w.bv[0]
  let norm = 0
  for (let i = 0; i < NN_H2; i++) norm += h2[i] * h2[i]
  norm = Math.sqrt(norm) + 1e-6
  for (let i = 0; i < NN_H2; i++) vs += (w.wv[i] * h2[i]) / norm
  return { h2, logits, value: Math.max(-1, Math.min(1, vs)) }
}

/** Priors softmax (masqués sur les coups légaux) + value, pour le MCTS. */
export function nnPriorsAndValue(
  w: NnWeights,
  pos: Position,
  legal: Action[],
): { priors: number[]; value: number } {
  const { logits, value } = forward(w, encodeInput(pos))
  const idxs = legal.map(moveIndex)
  let max = -Infinity
  for (const k of idxs) if (logits[k] > max) max = logits[k]
  let sum = 0
  const exps = idxs.map((k) => {
    const e = Math.exp(logits[k] - max)
    sum += e
    return e
  })
  const priors = exps.map((e) => e / sum)
  return { priors, value }
}

/* ==================== entraînement ==================== */

export interface TrainSample {
  x: Float64Array
  legal: number[]
  pi: number[]
  z: number
}

/** Un pas SGD sur un minibatch ; retourne la loss moyenne (CE policy + MSE value). */
export function trainBatch(
  w: NnWeights,
  vel: { w1: number[][]; b1: number[]; w2: number[][]; b2: number[]; wp: number[][]; bp: number[]; wv: number[]; bv: number[] },
  batch: TrainSample[],
  lr: number,
  momentum: number,
): number {
  const gw1 = mat(NN_H1, NN_IN, 0)
  const gb1 = vec(NN_H1)
  const gw2 = mat(NN_H2, NN_H1, 0)
  const gb2 = vec(NN_H2)
  const gwp = mat(NN_OUT, NN_H2, 0)
  const gbp = vec(NN_OUT)
  const gwv = vec(NN_H2)
  const gbv = 0
  void gbv
  let gBv = 0
  let loss = 0

  for (const s of batch) {
    // forward
    const h1 = new Float64Array(NN_H1)
    const h1pre = new Float64Array(NN_H1)
    for (let j = 0; j < NN_H1; j++) {
      let sum = w.b1[j]
      const row = w.w1[j]
      for (let i = 0; i < NN_IN; i++) sum += row[i] * s.x[i]
      h1pre[j] = sum
      h1[j] = sum > 0 ? sum : 0
    }
    const h2 = new Float64Array(NN_H2)
    const h2pre = new Float64Array(NN_H2)
    for (let j = 0; j < NN_H2; j++) {
      let sum = w.b2[j]
      const row = w.w2[j]
      for (let i = 0; i < NN_H1; i++) sum += row[i] * h1[i]
      h2pre[j] = sum
      h2[j] = sum > 0 ? sum : 0
    }
    const logits = new Float64Array(NN_OUT)
    for (let k = 0; k < NN_OUT; k++) {
      let sum = w.bp[k]
      const row = w.wp[k]
      for (let i = 0; i < NN_H2; i++) sum += row[i] * h2[i]
      logits[k] = sum
    }
    let vs = w.bv[0]
    let norm = 0
    for (let i = 0; i < NN_H2; i++) norm += h2[i] * h2[i]
    norm = Math.sqrt(norm) + 1e-6
    for (let i = 0; i < NN_H2; i++) vs += (w.wv[i] * h2[i]) / norm
    const v = Math.max(-1, Math.min(1, vs))

    // softmax masquée
    let max = -Infinity
    for (const k of s.legal) if (logits[k] > max) max = logits[k]
    let sum = 0
    const exps = new Map<number, number>()
    for (const k of s.legal) {
      const e = Math.exp(logits[k] - max)
      exps.set(k, e)
      sum += e
    }

    // gradients têtes
    const dlogits = new Float64Array(NN_OUT)
    for (let li = 0; li < s.legal.length; li++) {
      const k = s.legal[li]
      const p = (exps.get(k) ?? 0) / sum
      const pi = s.pi[li]
      loss += -pi * Math.log(Math.max(1e-9, p))
      dlogits[k] += p - pi
    }
    // value : linéaire bornée sur h2 normalisé — croissance contrôlée, jamais saturée dedans
    const inRange = vs > -1 && vs < 1
    const dv = inRange ? (v - s.z) * 0.25 : 0
    loss += (v - s.z) * (v - s.z)

    const dh2 = new Float64Array(NN_H2)
    for (let k = 0; k < NN_OUT; k++) {
      const d = dlogits[k]
      if (d === 0) continue
      const row = gwp[k]
      for (let i = 0; i < NN_H2; i++) row[i] += d * h2[i]
      gbp[k] += d
    }
    const dtanh = inRange ? 1 / norm : 0
    for (let i = 0; i < NN_H2; i++) dh2[i] = dv * w.wv[i] * dtanh
    for (let k = 0; k < NN_OUT; k++) {
      const d = dlogits[k]
      if (d === 0) continue
      for (let i = 0; i < NN_H2; i++) dh2[i] += d * w.wp[k][i]
    }
    for (let i = 0; i < NN_H2; i++) {
      gwv[i] += dv * dtanh * h2[i]
      gBv += dv * dtanh
    }
    // couche 2
    const dh1 = new Float64Array(NN_H1)
    for (let j = 0; j < NN_H2; j++) {
      const d = dh2[j] * (h2pre[j] > 0 ? 1 : 0)
      if (d === 0) continue
      const row = gw2[j]
      for (let i = 0; i < NN_H1; i++) row[i] += d * h1[i]
      gb2[j] += d
      for (let i = 0; i < NN_H1; i++) dh1[i] += d * w.w2[j][i]
    }
    // couche 1
    for (let j = 0; j < NN_H1; j++) {
      const d = dh1[j] * (h1pre[j] > 0 ? 1 : 0)
      if (d === 0) continue
      const row = gw1[j]
      for (let i = 0; i < NN_IN; i++) row[i] += d * s.x[i]
      gb1[j] += d
    }
  }

  const scale = lr / batch.length
  const apply = (wRow: number[], gRow: number[], vRow: number[]): void => {
    for (let i = 0; i < wRow.length; i++) {
      vRow[i] = momentum * vRow[i] - scale * gRow[i]
      wRow[i] += vRow[i]
    }
  }
  for (let j = 0; j < NN_H1; j++) apply(w.w1[j], gw1[j], vel.w1[j])
  apply(w.b1, gb1, vel.b1)
  for (let j = 0; j < NN_H2; j++) apply(w.w2[j], gw2[j], vel.w2[j])
  apply(w.b2, gb2, vel.b2)
  for (let k = 0; k < NN_OUT; k++) apply(w.wp[k], gwp[k], vel.wp[k])
  apply(w.bp, gbp, vel.bp)
  apply(w.wv, gwv, vel.wv)
  apply(w.bv, [gBv], vel.bv)

  return loss / batch.length
}

/** Poids exportés en JSON compact (4 décimales). */
export function serializeWeights(w: NnWeights): string {
  const r4 = (n: number): number => Math.round(n * 10000) / 10000
  return JSON.stringify({
    w1: w.w1.map((r) => r.map(r4)),
    b1: w.b1.map(r4),
    w2: w.w2.map((r) => r.map(r4)),
    b2: w.b2.map(r4),
    wp: w.wp.map((r) => r.map(r4)),
    bp: w.bp.map(r4),
    wv: w.wv.map(r4),
    bv: w.bv.map(r4),
  })
}
