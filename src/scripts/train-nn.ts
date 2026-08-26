/**
 * Entraîne le réseau sur un dataset et exporte les poids.
 * Usage : node dist/train-nn.cjs [dataset=data/nn-dataset.json] [époques=12] [lr=0.05]
 */
import { readFileSync, writeFileSync } from 'fs'
import {
  encodeInput,
  moveIndex,
  randomWeights,
  serializeWeights,
  trainBatch,
  type NnWeights,
  type TrainSample,
} from '../core/nn'
import { initialState } from '../core/rules'

const datasetPath = process.argv[2] || 'data/nn-dataset.json'
const epochs = Number(process.argv[3]) || 12
let lr = Number(process.argv[4]) || 0.05

interface RawSample {
  x: number[]
  legal: number[]
  pi: number[]
  z: number
}

const raw = JSON.parse(readFileSync(datasetPath, 'utf8')) as { games: number; samples: RawSample[] }
console.log(`dataset : ${raw.samples.length} échantillons (${raw.games} parties)`)

// positions de départ pour un test de cohérence (l'eval doit être ~0 à l'ouverture)
const startIdx = moveIndex({ kind: 'place', row: 0, col: 4 } as import('../core/rules').Action)

const w: NnWeights = randomWeights()
const vel = {
  w1: w.w1.map((r) => new Array(r.length).fill(0)),
  b1: new Array(w.b1.length).fill(0),
  w2: w.w2.map((r) => new Array(r.length).fill(0)),
  b2: new Array(w.b2.length).fill(0),
  wp: w.wp.map((r) => new Array(r.length).fill(0)),
  bp: new Array(w.bp.length).fill(0),
  wv: new Array(w.wv.length).fill(0),
  bv: new Array(w.bv.length).fill(0),
}

const samples: TrainSample[] = raw.samples.map((s) => ({
  x: Float64Array.from(s.x),
  legal: s.legal,
  pi: s.pi,
  z: s.z,
}))

function evalLoss(list: TrainSample[]): { policy: number; value: number } {
  // forward seul (sans gradient) sur un sous-ensemble
  const sub = list.filter((_, i) => i % 7 === 0)
  let ce = 0
  let mse = 0
  for (const s of sub) {
    const { logits, value } = (() => {
      // réutilise forward via trainBatch à lr 0 sur 1 échantillon ? trop détourné :
      // petit forward local
      const h1 = new Float64Array(w.w1.length)
      for (let j = 0; j < w.w1.length; j++) {
        let sum = w.b1[j]
        for (let i = 0; i < s.x.length; i++) sum += w.w1[j][i] * s.x[i]
        h1[j] = sum > 0 ? sum : 0
      }
      const h2 = new Float64Array(w.w2.length)
      for (let j = 0; j < w.w2.length; j++) {
        let sum = w.b2[j]
        for (let i = 0; i < h1.length; i++) sum += w.w2[j][i] * h1[i]
        h2[j] = sum > 0 ? sum : 0
      }
      const logits = new Float64Array(w.wp.length)
      for (let k = 0; k < w.wp.length; k++) {
        let sum = w.bp[k]
        for (let i = 0; i < h2.length; i++) sum += w.wp[k][i] * h2[i]
        logits[k] = sum
      }
      let vs = w.bv[0]
      let norm = 0
      for (let i = 0; i < h2.length; i++) norm += h2[i] * h2[i]
      norm = Math.sqrt(norm) + 1e-6
      for (let i = 0; i < h2.length; i++) vs += (w.wv[i] * h2[i]) / norm
      return { logits, value: Math.max(-1, Math.min(1, vs)) }
    })()
    let max = -Infinity
    for (const k of s.legal) if (logits[k] > max) max = logits[k]
    let sum = 0
    for (const k of s.legal) sum += Math.exp(logits[k] - max)
    for (let li = 0; li < s.legal.length; li++) {
      ce += -s.pi[li] * Math.log(Math.max(1e-9, Math.exp(logits[s.legal[li]] - max) / sum))
    }
    mse += (value - s.z) * (value - s.z)
  }
  return { policy: ce / sub.length, value: mse / sub.length }
}

let train = samples
let holdout: TrainSample[] = []
if (samples.length > 500) {
  const cut = Math.floor(samples.length * 0.9)
  train = samples.slice(0, cut)
  holdout = samples.slice(cut)
}

for (let ep = 1; ep <= epochs; ep++) {
  const shuffled = [...train].sort(() => Math.random() - 0.5)
  const batch: TrainSample[] = []
  let epochLoss = 0
  let batches = 0
  for (const s of shuffled) {
    batch.push(s)
    if (batch.length === 32) {
      epochLoss += trainBatch(w, vel, batch, lr, 0.9)
      batches++
      batch.length = 0
    }
  }
  if (batch.length > 0) {
    epochLoss += trainBatch(w, vel, batch, lr, 0.9)
    batches++
  }
  const ho = holdout.length > 0 ? evalLoss(holdout) : evalLoss(train.slice(0, 200))
  console.log(
    `époque ${ep}/${epochs} · loss ${(epochLoss / batches).toFixed(3)} · holdout CE ${ho.policy.toFixed(3)} MSE ${ho.value.toFixed(3)}`,
  )
  lr *= 0.85
}

const sanity = encodeInput(initialState())
const { value } = (() => {
  const h1 = new Float64Array(w.w1.length)
  for (let j = 0; j < w.w1.length; j++) {
    let sum = w.b1[j]
    for (let i = 0; i < sanity.length; i++) sum += w.w1[j][i] * sanity[i]
    h1[j] = sum > 0 ? sum : 0
  }
  const h2 = new Float64Array(w.w2.length)
  for (let j = 0; j < w.w2.length; j++) {
    let sum = w.b2[j]
    for (let i = 0; i < h1.length; i++) sum += w.w2[j][i] * h1[i]
    h2[j] = sum > 0 ? sum : 0
  }
  let vs = w.bv[0]
  for (let i = 0; i < h2.length; i++) vs += w.wv[i] * h2[i]
  return { value: Math.tanh(vs) }
})()
console.log(`cohérence : value(ouverture) = ${value.toFixed(3)} (attendu ≈ 0) · index e1 = ${startIdx}`)

writeFileSync('src/core/nn-weights.json', serializeWeights(w))
console.log('poids exportés : src/core/nn-weights.json')
