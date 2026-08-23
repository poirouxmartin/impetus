import { Action, Color, Dir, Position } from './rules'

const DIRS: Dir[] = ['up', 'down', 'left', 'right']
const DELTA: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}

export interface Variant {
  size: number
  reserve: number
}

const RANGE = 3

const other = (c: Color): Color => (c === 'black' ? 'white' : 'black')
const idxV = (v: Variant, r: number, c: number): number => r * v.size + c
const inBoardV = (v: Variant, r: number, c: number): boolean =>
  r >= 0 && r < v.size && c >= 0 && c < v.size
const homeRowV = (v: Variant, color: Color): number => (color === 'black' ? 0 : v.size - 1)
const targetRowV = (v: Variant, color: Color): number => (color === 'black' ? v.size - 1 : 0)

export function initialStateV(v: Variant): Position {
  return {
    cells: Array<Color | null>(v.size * v.size).fill(null),
    reserves: { black: v.reserve, white: v.reserve },
    turn: 'black',
    moveCount: 0,
    swapped: false,
  }
}

export function slideDestinationV(
  v: Variant,
  cells: (Color | null)[],
  row: number,
  col: number,
  dir: Dir,
  me: Color,
): { row: number; col: number; capture: boolean } | null {
  const [dr, dc] = DELTA[dir]
  let landedR = row
  let landedC = col
  for (let step = 1; step <= RANGE; step++) {
    const nr = row + dr * step
    const nc = col + dc * step
    if (!inBoardV(v, nr, nc)) break
    const occ = cells[idxV(v, nr, nc)]
    if (occ === null) {
      landedR = nr
      landedC = nc
      continue
    }
    if (occ !== me) return { row: nr, col: nc, capture: true }
    break
  }
  return landedR === row && landedC === col
    ? null
    : { row: landedR, col: landedC, capture: false }
}

export function legalActionsV(v: Variant, pos: Position): Action[] {
  const acts: Action[] = []
  if (pos.moveCount === 1 && !pos.swapped) acts.push({ kind: 'swap' })
  if (pos.reserves[pos.turn] > 0) {
    const hr = homeRowV(v, pos.turn)
    for (let col = 0; col < v.size; col++) {
      if (pos.cells[idxV(v, hr, col)] === null) acts.push({ kind: 'place', row: hr, col })
    }
  }
  for (let row = 0; row < v.size; row++) {
    for (let col = 0; col < v.size; col++) {
      if (pos.cells[idxV(v, row, col)] !== pos.turn) continue
      for (const dir of DIRS) {
        if (slideDestinationV(v, pos.cells, row, col, dir, pos.turn) !== null) {
          acts.push({ kind: 'slide', row, col, dir })
        }
      }
    }
  }
  return acts
}

export function applyActionV(v: Variant, pos: Position, a: Action): Position {
  const cells = [...pos.cells]
  const reserves = { ...pos.reserves }
  switch (a.kind) {
    case 'place':
      cells[idxV(v, a.row, a.col)] = pos.turn
      reserves[pos.turn] -= 1
      break
    case 'slide': {
      const dest = slideDestinationV(v, cells, a.row, a.col, a.dir, pos.turn)!
      cells[idxV(v, a.row, a.col)] = null
      cells[idxV(v, dest.row, dest.col)] = pos.turn
      break
    }
    case 'swap': {
      const origin = pos.cells.findIndex((c) => c !== null)
      cells[origin] = null
      const mirrorR = v.size - 1 - Math.floor(origin / v.size)
      const mirrorC = v.size - 1 - (origin % v.size)
      cells[idxV(v, mirrorR, mirrorC)] = other(pos.turn)
      reserves.black += 1
      reserves.white -= 1
      break
    }
  }
  return { cells, reserves, turn: other(pos.turn), moveCount: pos.moveCount + 1, swapped: false }
}

export function hashV(_v: Variant, pos: Position): string {
  let board = ''
  for (const c of pos.cells) board += c === null ? '.' : c === 'black' ? 'b' : 'w'
  return `${board}|${pos.reserves.black},${pos.reserves.white}|${pos.turn}`
}

function wonByPrevious(v: Variant, pos: Position, mover: Color): boolean {
  const tr = targetRowV(v, mover)
  for (let col = 0; col < v.size; col++) {
    if (pos.cells[idxV(v, tr, col)] === mover) return true
  }
  const opp = other(mover)
  let oppStones = 0
  for (const c of pos.cells) if (c === opp) oppStones++
  if (oppStones === 0 && pos.reserves[opp] === 0) return true
  if (legalActionsV(v, pos).length === 0) return true
  return false
}

export interface SolveStats {
  nodes: number
  ms: number
  status: 'exact' | 'timeout'
}

class Timeout extends Error {}

/**
 * Valeur exacte (au trait gagne-t-il forcément ?) par exploration exhaustive.
 * Les coups recréant une position du chemin courant sont interdits (anti-cycles),
 * ce qui borne la recherche tout en restant plus strict que la règle des 3 occurrences.
 */
export function solve(
  v: Variant,
  pos: Position,
  opts: { deadlineMs?: number; maxNodes?: number } = {},
): { blackWinsWithPerfectPlay: boolean | null } & SolveStats {
  const start = Date.now()
  const cache = new Map<string, boolean>()
  const path = new Set<string>()
  const stats: SolveStats = { nodes: 0, ms: 0, status: 'exact' }

  const visit = (p: Position): boolean => {
    stats.nodes++
    if (opts.deadlineMs && Date.now() - start > opts.deadlineMs) throw new Timeout()
    if (opts.maxNodes && stats.nodes > opts.maxNodes) throw new Timeout()
    if (wonByPrevious(v, p, other(p.turn))) return false
    const key = hashV(v, p)
    const memo = cache.get(key)
    if (memo !== undefined) return memo
    path.add(key)
    let canWin = false
    for (const a of legalActionsV(v, p)) {
      const next = applyActionV(v, p, a)
      if (path.has(hashV(v, next))) continue
      if (!visit(next)) {
        canWin = true
        break
      }
    }
    path.delete(key)
    cache.set(key, canWin)
    return canWin
  }

  try {
    const value = visit(pos)
    stats.ms = Date.now() - start
    return { blackWinsWithPerfectPlay: pos.turn === 'black' ? value : !value, ...stats }
  } catch (e) {
    if (e instanceof Timeout) {
      stats.ms = Date.now() - start
      stats.status = 'timeout'
      return { blackWinsWithPerfectPlay: null, ...stats }
    }
    throw e
  }
}

export interface ComplexityStats {
  avgBranching: number
  avgPlies: number
  log10Tree: number
  log10StatesUpperBound: number
  uniquePositions: number
}

export function estimateComplexity(v: Variant, playouts: number): ComplexityStats {
  let branchSum = 0
  let branchCount = 0
  let plySum = 0
  const unique = new Set<string>()

  for (let i = 0; i < playouts; i++) {
    let pos = initialStateV(v)
    for (;;) {
      const acts = legalActionsV(v, pos)
      if (acts.length === 0 || wonByPrevious(v, pos, other(pos.turn))) break
      branchSum += acts.length
      branchCount++
      unique.add(hashV(v, pos))
      pos = applyActionV(v, pos, acts[Math.floor(Math.random() * acts.length)])
    }
    plySum += pos.moveCount
  }

  const avgBranching = branchSum / branchCount
  const avgPlies = plySum / playouts
  const log10Tree = avgPlies * Math.log10(avgBranching)
  const log10StatesUpperBound =
    v.size * v.size * Math.log10(3) +
    2 * Math.log10(v.reserve + 1) +
    Math.log10(2)

  return {
    avgBranching,
    avgPlies,
    log10Tree,
    log10StatesUpperBound,
    uniquePositions: unique.size,
  }
}
