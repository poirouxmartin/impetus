import { Action, BREAKTHROUGH_DELAY, Color, Dir, Position } from './rules'

export const DIR_NAMES: Dir[] = ['up', 'down', 'left', 'right']
const DELTA = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const

const S = 9
const RANGE = 3
const WIN = 1_000_000
const MAX_PLY = 64
const TT_MAX = 2_000_000

const EMPTY = 0
const BLACK = 1
const WHITE = 2

const STONE = 100
const ADV_MAX = 24
const HANGING = 42

const KIND_PLACE = 0
const KIND_SLIDE = 1
const KIND_SWAP = 2

interface Move {
  kind: typeof KIND_PLACE | typeof KIND_SLIDE | typeof KIND_SWAP
  from: number
  to: number
  dir: number
  capture: boolean
}

interface St {
  b: Int8Array
  res: [number, number]
  cnt: [number, number]
  turn: 1 | 2
  mc: number
  sw: boolean
  key: number
  key2: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(0x6711ce)
const zCell: [Uint32Array, Uint32Array] = [
  new Uint32Array(S * S),
  new Uint32Array(S * S),
]
for (let i = 0; i < S * S; i++) {
  zCell[0][i] = (rand() * 4294967296) >>> 0
  zCell[1][i] = (rand() * 4294967296) >>> 0
}
const zRes: [Uint32Array, Uint32Array] = [
  new Uint32Array(16),
  new Uint32Array(16),
]
for (let i = 0; i < 16; i++) {
  zRes[0][i] = (rand() * 4294967296) >>> 0
  zRes[1][i] = (rand() * 4294967296) >>> 0
}
const zTurn = [(rand() * 4294967296) >>> 0, (rand() * 4294967296) >>> 0]

const homeRowOf = (side: 1 | 2): number => (side === BLACK ? 0 : S - 1)
const targetRowOf = (side: 1 | 2): number => (side === BLACK ? S - 1 : 0)
const other = (side: 1 | 2): 1 | 2 => (side === BLACK ? WHITE : BLACK)

function computeKeys(st: St): void {
  let k1 = 0
  let k2 = 0
  for (let i = 0; i < S * S; i++) {
    const c = st.b[i]
    if (c !== EMPTY) {
      k1 ^= zCell[c - 1][i]
      k2 ^= zCell[c - 1][i]
    }
  }
  k1 ^= zRes[0][st.res[0]]
  k2 ^= zRes[1][st.res[0]]
  k1 ^= zRes[0][st.res[1]] >>> 3
  k2 ^= zRes[1][st.res[1]] << 5
  k1 ^= zTurn[st.turn - 1]
  st.key = k1 | 1
  st.key2 = k2
}

function fromPosition(pos: Position): St {
  const b = new Int8Array(S * S)
  const cnt: [number, number] = [0, 0]
  for (let i = 0; i < S * S; i++) {
    if (pos.cells[i] === 'black') {
      b[i] = BLACK
      cnt[0]++
    } else if (pos.cells[i] === 'white') {
      b[i] = WHITE
      cnt[1]++
    }
  }
  const st: St = {
    b,
    res: [pos.reserves.black, pos.reserves.white],
    cnt,
    turn: pos.turn === 'black' ? BLACK : WHITE,
    mc: pos.moveCount,
    sw: pos.swapped,
    key: 0,
    key2: 0,
  }
  computeKeys(st)
  return st
}

interface Undo {
  captured: Cell
  key: number
  key2: number
  turn: 1 | 2
  mc: number
  sw: boolean
  resB: number
  resW: number
}

type Cell = number

function applyMove(st: St, m: Move): Undo {
  const u: Undo = {
    captured: EMPTY,
    key: st.key,
    key2: st.key2,
    turn: st.turn,
    mc: st.mc,
    sw: st.sw,
    resB: st.res[0],
    resW: st.res[1],
  }
  const me = st.turn
  const opp = other(me)
  if (m.kind === KIND_PLACE) {
    st.b[m.to] = me
    st.res[me - 1]--
    st.cnt[me - 1]++
    st.key ^= zCell[me - 1][m.to]
    st.key2 ^= zCell[me - 1][m.to]
  } else if (m.kind === KIND_SLIDE) {
    st.b[m.from] = EMPTY
    st.key ^= zCell[me - 1][m.from]
    st.key2 ^= zCell[me - 1][m.from]
    if (m.capture) {
      u.captured = st.b[m.to]
      st.cnt[opp - 1]--
      st.key ^= zCell[opp - 1][m.to]
      st.key2 ^= zCell[opp - 1][m.to]
    }
    st.b[m.to] = me
    st.key ^= zCell[me - 1][m.to]
    st.key2 ^= zCell[me - 1][m.to]
  } else {
    // Swap : l'unique pierre sur le plateau appartient à l'ADVERSAIRE (le premier
    // joueur) — on la retire, on pose la nôtre en miroir, réserves noir +1 / blanc -1.
    const origin = st.b.indexOf(opp)
    st.b[origin] = EMPTY
    st.cnt[opp - 1]--
    st.key ^= zCell[opp - 1][origin]
    st.key2 ^= zCell[opp - 1][origin]
    const mirrorR = S - 1 - Math.floor(origin / S)
    const mirrorC = S - 1 - (origin % S)
    const mirror = mirrorR * S + mirrorC
    st.b[mirror] = me
    st.cnt[me - 1]++
    st.key ^= zCell[me - 1][mirror]
    st.key2 ^= zCell[me - 1][mirror]
    st.res[0]++
    st.res[1]--
  }
  st.turn = opp
  st.mc++
  if (m.kind === KIND_SWAP) st.sw = true
  st.key ^= zTurn[u.turn - 1] ^ zTurn[st.turn - 1]
  st.key2 ^= zTurn[u.turn - 1] ^ zTurn[st.turn - 1]
  return u
}

function unmakeMove(st: St, m: Move, u: Undo): void {
  const me = u.turn
  const opp = other(me)
  st.turn = u.turn
  st.mc = u.mc
  st.sw = u.sw
  st.res[0] = u.resB
  st.res[1] = u.resW
  if (m.kind === KIND_PLACE) {
    st.b[m.to] = EMPTY
    st.cnt[me - 1]--
  } else if (m.kind === KIND_SLIDE) {
    st.b[m.to] = m.capture ? u.captured : EMPTY
    if (m.capture) st.cnt[opp - 1]++
    st.b[m.from] = me
  } else {
    // Défaire le swap : retirer notre pierre du miroir, restaurer celle de l'adversaire à l'origine.
    const originMirror = st.b.indexOf(me)
    st.b[originMirror] = EMPTY
    st.cnt[me - 1]--
    const srcR = S - 1 - Math.floor(originMirror / S)
    const srcC = S - 1 - (originMirror % S)
    st.b[srcR * S + srcC] = opp
    st.cnt[opp - 1]++
  }
  st.key = u.key
  st.key2 = u.key2
}

function genMoves(st: St, out: Move[], capsOnly: boolean): void {
  out.length = 0
  const me = st.turn
  if (!capsOnly && st.mc === 1 && !st.sw) {
    out.push({ kind: KIND_SWAP, from: -1, to: -1, dir: -1, capture: false })
  }
  if (!capsOnly && st.res[me - 1] > 0) {
    const hr = homeRowOf(me) * S
    for (let c = 0; c < S; c++) {
      if (st.b[hr + c] === EMPTY) {
        out.push({ kind: KIND_PLACE, from: -1, to: hr + c, dir: -1, capture: false })
      }
    }
  }
  for (let i = 0; i < S * S; i++) {
    if (st.b[i] !== me) continue
    const r = Math.floor(i / S)
    const c = i % S
    for (let d = 0; d < 4; d++) {
      let lr = r
      let lc = c
      let captured = false
      for (let step = 1; step <= RANGE; step++) {
        const nr = r + DELTA[d][0] * step
        const nc = c + DELTA[d][1] * step
        if (nr < 0 || nr >= S || nc < 0 || nc >= S) break
        const occ = st.b[nr * S + nc]
        if (occ === EMPTY) {
          lr = nr
          lc = nc
          continue
        }
        if (occ !== me) {
          out.push({ kind: KIND_SLIDE, from: i, to: nr * S + nc, dir: d, capture: true })
          captured = true
        }
        break
      }
      if (!captured && (lr !== r || lc !== c)) {
        if (capsOnly && !(targetRowOf(me) === lr)) continue
        out.push({ kind: KIND_SLIDE, from: i, to: lr * S + lc, dir: d, capture: false })
      }
    }
  }
}

function isWinAfter(
  st: St,
  m: Move,
  u: Undo,
  me: 1 | 2,
): boolean {
  // Percée immédiate uniquement hors mode différé ; en différé, la victoire est
  // résolue à l'entrée du nœud suivant (breachRow).
  if (!BREAKTHROUGH_DELAY && m.kind === KIND_SLIDE && Math.floor(m.to / S) === targetRowOf(me)) {
    return true
  }
  if (u.captured !== EMPTY) {
    const opp = other(me)
    if (st.cnt[opp - 1] === 0 && st.res[opp - 1] === 0) return true
  }
  return false
}

/** Percée différée : `side` occupe sa rangée cible — l'adversaire n'a pas capturé, il perd. */
function breachRow(st: St, side: 1 | 2): boolean {
  const base = targetRowOf(side) * S
  for (let c = 0; c < S; c++) {
    if (st.b[base + c] === side) return true
  }
  return false
}

const distToTarget = (i: number, side: 1 | 2): number =>
  Math.abs(Math.floor(i / S) - targetRowOf(side))

const hangingBuf = new Int8Array(S * S)

function evaluate(st: St): number {
  const hanging = hangingBuf
  hanging.fill(0)
  for (let i = 0; i < S * S; i++) {
    const c = st.b[i]
    if (c === EMPTY) continue
    const r = Math.floor(i / S)
    const col = i % S
    for (let d = 0; d < 4; d++) {
      for (let step = 1; step <= RANGE; step++) {
        const nr = r + DELTA[d][0] * step
        const nc = col + DELTA[d][1] * step
        if (nr < 0 || nr >= S || nc < 0 || nc >= S) break
        const occ = st.b[nr * S + nc]
        if (occ === EMPTY) continue
        if (occ !== c) hanging[nr * S + nc] = 1
        break
      }
    }
  }
  let score = 0
  for (let i = 0; i < S * S; i++) {
    const c = st.b[i]
    if (c === EMPTY) continue
    const side = c as 1 | 2
    const sign = side === BLACK ? 1 : -1
    const dist = distToTarget(i, side)
    score += sign * STONE
    score += sign * ((ADV_MAX * (S - 1 - dist)) / (S - 1))
    if (dist === 1) score += sign * 30
    else if (dist === 2) score += sign * 15
    if (BREAKTHROUGH_DELAY && dist === 0) score += sign * 260
    // menace de promotion : couloir droit dégagé vers la rangée cible (dist ≤ portée)
    if (dist >= 1 && dist <= RANGE) {
      const tr = targetRowOf(side)
      const r = Math.floor(i / S)
      const col2 = i % S
      const dr = tr > r ? 1 : -1
      let clear = true
      for (let s2 = 1; s2 < dist; s2++) {
        if (st.b[(r + dr * s2) * S + col2] !== EMPTY) {
          clear = false
          break
        }
      }
      if (clear) {
        const landing = st.b[tr * S + col2]
        if (landing !== side) score += sign * (dist === 1 ? 110 : dist === 2 ? 55 : 25)
      }
    }
    if (hanging[i]) score -= sign * HANGING
  }
  score += (st.res[0] - st.res[1]) * 58
  return st.turn === BLACK ? score : -score
}

export function notation(action: Action): string {
  const sq = (i: number): string => 'abcdefghi'[i % S] + (Math.floor(i / S) + 1)
  if (action.kind === 'place') return `poser ${sq(action.row * S + action.col)}`
  if (action.kind === 'swap') return 'échanger (swap)'
  return `${sq(action.row * S + action.col)}→${sq(
    slideDestIndexFromAction(action),
  )}`
}

/** Applique un coup via le moteur interne et retourne la Position résultante (parité avec rules). */
export function engineApply(pos: Position, action: Action): Position {
  const st = fromPosition(pos)
  const moves: Move[] = []
  genMoves(st, moves, false)
  const target = notation(action)
  const m = moves.find((x) => notation(moveToAction(x)) === target)
  if (!m) throw new Error(`coup introuvable dans le moteur : ${target}`)
  applyMove(st, m)
  const cells: (Color | null)[] = []
  for (let i = 0; i < S * S; i++) {
    cells.push(st.b[i] === BLACK ? 'black' : st.b[i] === WHITE ? 'white' : null)
  }
  return {
    cells,
    reserves: { black: st.res[0], white: st.res[1] },
    turn: st.turn === BLACK ? 'black' : 'white',
    moveCount: st.mc,
    swapped: st.sw,
  }
}

/** Clé Zobrist d'une position (parité moteur/rules dans les tests). */
export function engineKey(pos: Position): number {
  return fromPosition(pos).key
}

function slideDestIndexFromAction(a: Extract<Action, { kind: 'slide' }>): number {
  const d = DIR_NAMES.indexOf(a.dir)
  const r0 = a.row
  const c0 = a.col
  for (let step = RANGE; step >= 1; step--) {
    const nr = r0 + DELTA[d][0] * step
    const nc = c0 + DELTA[d][1] * step
    if (nr >= 0 && nr < S && nc >= 0 && nc < S) return nr * S + nc
  }
  return r0 * S + c0
}

interface TTEntry {
  key2: number
  d: number
  f: 0 | 1 | 2
  s: number
  m: Move | null
}

let tt = new Map<number, TTEntry>()
const killers: (Move | null)[][] = Array.from({ length: MAX_PLY }, () => [null, null])
const history = new Int32Array(S * S)

let nodes = 0
let deadline = 0

class TimeoutErr extends Error {}

function timeCheck(): void {
  if ((nodes & 1023) === 0 && Date.now() > deadline) throw new TimeoutErr()
}

/** Applique un coup en garantissant le défaire même si le timeout interrompt la recherche. */
function withMove<T>(st: St, m: Move, fn: (u: Undo) => T): T {
  const u = applyMove(st, m)
  try {
    return fn(u)
  } finally {
    unmakeMove(st, m, u)
  }
}

function orderMoves(st: St, moves: Move[], ttMove: Move | null, ply: number): void {
  const me = st.turn
  const victimSide = other(me)
  const k = killers[ply]
  const score = (m: Move): number => {
    if (
      ttMove &&
      m.kind === ttMove.kind &&
      m.from === ttMove.from &&
      m.to === ttMove.to &&
      m.dir === ttMove.dir
    ) {
      return 1_000_000
    }
    if (m.capture) return 800 + (S - 1 - distToTarget(m.to, victimSide)) * 8
    if (m.kind === KIND_SLIDE) {
      let s = (distToTarget(m.from, me) - distToTarget(m.to, me)) * 12
      if (k[0] && k[0].kind === m.kind && k[0].to === m.to) s += 300
      else if (k[1] && k[1].kind === m.kind && k[1].to === m.to) s += 290
      s += Math.min(250, history[m.to])
      if (distToTarget(m.to, me) <= 2) s += 120
      return s
    }
    if (m.kind === KIND_SWAP) return 5
    return 15
  }
  moves.sort((a, b) => score(b) - score(a))
}

function quiesce(st: St, alpha: number, beta: number, qd: number): number {
  nodes++
  timeCheck()
  if (BREAKTHROUGH_DELAY && breachRow(st, st.turn)) return WIN - st.mc - 2
  const stand = evaluate(st)
  if (stand >= beta) return beta
  if (stand > alpha) alpha = stand
  if (qd <= 0) return alpha
  const moves: Move[] = []
  genMoves(st, moves, true)
  orderMoves(st, moves, null, 0)
  const me = st.turn
  for (const m of moves) {
    const sc = withMove(st, m, (u) =>
      isWinAfter(st, m, u, me) ? WIN - MAX_PLY : -quiesce(st, -beta, -alpha, qd - 1),
    )
    if (sc >= beta) return beta
    if (sc > alpha) alpha = sc
  }
  return alpha
}

function search(st: St, depth: number, alpha: number, beta: number, ply: number): number {
  nodes++
  timeCheck()
  if (BREAKTHROUGH_DELAY && breachRow(st, st.turn)) return WIN - ply
  const alphaOrig = alpha
  const e = tt.get(st.key)
  if (e && e.key2 === st.key2 && e.d >= depth) {
    let s = e.s
    if (s > WIN - MAX_PLY) s -= ply
    else if (s < -(WIN - MAX_PLY)) s += ply
    if (e.f === 0) return s
    if (e.f === 1 && s > alpha) alpha = s
    else if (e.f === 2 && s < beta) beta = s
    if (alpha >= beta) return s
  }
  if (depth <= 0) return quiesce(st, alpha, beta, 8)
  const moves: Move[] = []
  genMoves(st, moves, false)
  if (moves.length === 0) return -(WIN - ply)
  const ttMove = e?.key2 === st.key2 ? e.m : null
  orderMoves(st, moves, ttMove, ply)
  let best = -Infinity
  let bestMove: Move | null = null
  const me = st.turn
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]
    // PVS : fenêtre nulle sur les coups non-pincipaux, re-recherche si elle tombe dedans.
    let sc: number
    if (i === 0) {
      sc = withMove(st, m, (u) =>
        isWinAfter(st, m, u, me) ? WIN - ply - 1 : -search(st, depth - 1, -beta, -alpha, ply + 1),
      )
    } else {
      const probe = withMove(st, m, (u) =>
        isWinAfter(st, m, u, me) ? WIN - ply - 1 : -search(st, depth - 1, -alpha - 1, -alpha, ply + 1),
      )
      sc = probe
      if (probe > alpha && probe < beta) {
        sc = withMove(st, m, () => -search(st, depth - 1, -beta, -alpha, ply + 1))
      }
    }
    if (sc > best) {
      best = sc
      bestMove = m
    }
    if (best > alpha) alpha = best
    if (alpha >= beta) {
      if (!m.capture && m.kind !== KIND_SWAP) {
        history[m.to] += depth * depth
        const k = killers[ply]
        if (!k[0] || k[0].to !== m.to || k[0].kind !== m.kind) {
          k[1] = k[0]
          k[0] = m
        }
      }
      break
    }
  }
  const f: 0 | 1 | 2 = best <= alphaOrig ? 2 : best >= beta ? 1 : 0
  let sStore = best
  if (sStore > WIN - MAX_PLY) sStore += ply
  else if (sStore < -(WIN - MAX_PLY)) sStore -= ply
  if (tt.size > TT_MAX) tt.clear()
  tt.set(st.key, { key2: st.key2, d: depth, f, s: sStore, m: bestMove })
  return best
}

function moveToAction(m: Move): Action {
  if (m.kind === KIND_PLACE) {
    return { kind: 'place', row: Math.floor(m.to / S), col: m.to % S }
  }
  if (m.kind === KIND_SLIDE) {
    return {
      kind: 'slide',
      row: Math.floor(m.from / S),
      col: m.from % S,
      dir: DIR_NAMES[m.dir],
    }
  }
  return { kind: 'swap' }
}

export interface AnalysisLine {
  action: Action
  notation: string
  score: number
}

export interface Analysis {
  lines: AnalysisLine[]
  best: AnalysisLine | null
  scoreBlackCp: number
  depth: number
  nodes: number
  ms: number
  turn: Color
  /** Variation principale reconstruite depuis la table de transposition. */
  pv: string[]
}

const STEP_CAP_MS = 3000
const MAX_DEPTH = 64

export class Analyzer {
  private st: St
  private rootPos: Position
  private rootTurn: Color
  private rootMoves: Move[]
  private scored: { m: Move; s: number }[] = []
  private depth = 0
  private cumNodes = 0
  private cumMs = 0
  private store = new Map<number, TTEntry>()

  constructor(pos: Position) {
    this.st = fromPosition(pos)
    this.rootPos = pos
    this.rootTurn = pos.turn
    this.rootMoves = []
    genMoves(this.st, this.rootMoves, false)
    this.scored = this.rootMoves.map((m) => ({ m, s: -Infinity }))
    for (const k of killers) {
      k[0] = null
      k[1] = null
    }
    history.fill(0)
  }

  get exhausted(): boolean {
    return this.rootMoves.length === 0
  }

  /** Recherche le palier de profondeur suivant (borné à STEP_CAP_MS pour rester stoppable). */
  step(): Analysis | null {
    if (this.exhausted || this.depth >= MAX_DEPTH) return this.build()
    tt = this.store
    nodes = 0
    deadline = Date.now() + STEP_CAP_MS
    const t0 = Date.now()
    try {
      const cur: { m: Move; s: number }[] = []
      let alpha = -Infinity
      const me = this.st.turn
      for (const { m } of this.scored) {
        const sc = withMove(this.st, m, (u) =>
          isWinAfter(this.st, m, u, me) ? WIN : -search(this.st, this.depth, -Infinity, -alpha, 1),
        )
        cur.push({ m, s: sc })
        if (sc > alpha) alpha = sc
      }
      cur.sort((a, b) => b.s - a.s)
      this.scored = cur
      this.depth++
    } catch (err) {
      if (!(err instanceof TimeoutErr)) throw err
    }
    this.cumNodes += nodes
    this.cumMs += Date.now() - t0
    return this.build()
  }

  private build(): Analysis {
    const lines: AnalysisLine[] = this.scored.map(({ m, s }) => {
      const action = moveToAction(m)
      return { action, notation: notation(action), score: s }
    })
    const best = lines[0] ?? null
    return {
      lines,
      best,
      scoreBlackCp:
        this.rootTurn === 'black' ? (best?.score ?? 0) : -(best?.score ?? 0),
      depth: this.depth,
      nodes: this.cumNodes,
      ms: this.cumMs,
      turn: this.rootTurn,
      pv: this.extractPv(),
    }
  }

  /** Variation principale : marche sur les meilleurs coups de la TT depuis la racine. */
  private extractPv(maxPlies = 16): string[] {
    const pv: string[] = []
    const st = fromPosition(this.rootPos)
    const seen = new Set<number>([st.key])
    for (let i = 0; i < maxPlies; i++) {
      const e = tt.get(st.key)
      if (!e || e.key2 !== st.key2 || !e.m) break
      const moves: Move[] = []
      genMoves(st, moves, false)
      const m = moves.find(
        (x) => x.kind === e.m!.kind && x.to === e.m!.to && x.from === e.m!.from && x.dir === e.m!.dir,
      )
      if (!m) break
      pv.push(notation(moveToAction(m)))
      applyMove(st, m)
      if (seen.has(st.key)) break
      seen.add(st.key)
    }
    return pv
  }
}

export function analyse(pos: Position, budgetMs: number): Analysis | null {
  const az = new Analyzer(pos)
  if (az.exhausted) return null
  const end = Date.now() + budgetMs
  let out = az.step()
  while (
    out !== null &&
    Date.now() < end &&
    out.depth < MAX_DEPTH &&
    out.best !== null &&
    Math.abs(out.best.score) < WIN - MAX_PLY
  ) {
    const prevDepth = out.depth
    out = az.step()
    if (out && out.depth === prevDepth) break
  }
  return out
}

export function engineActions(pos: Position): Action[] {
  const st = fromPosition(pos)
  const moves: Move[] = []
  genMoves(st, moves, false)
  return moves.map(moveToAction)
}
