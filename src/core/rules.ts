export type Color = 'black' | 'white'
export type Dir = 'up' | 'down' | 'left' | 'right'

export const DIRS: Dir[] = ['up', 'down', 'left', 'right']
export const SIZE = 9
export const START_RESERVE = 10
/** Portée maximale d'une glisse (v1.1 : évite la traversée instantanée d'un plateau vide). */
export const MAX_RANGE = 3

export interface Position {
  cells: (Color | null)[]
  reserves: Record<Color, number>
  turn: Color
  moveCount: number
  swapped: boolean
}

export type Action =
  | { kind: 'place'; row: number; col: number }
  | { kind: 'slide'; row: number; col: number; dir: Dir }
  | { kind: 'swap' }

export interface Destination {
  row: number
  col: number
  capture: boolean
}

export const other = (c: Color): Color => (c === 'black' ? 'white' : 'black')

export const idx = (row: number, col: number): number => row * SIZE + col

export const inBoard = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE

export function homeRow(color: Color): number {
  return color === 'black' ? 0 : SIZE - 1
}

export function targetRow(color: Color): number {
  return color === 'black' ? SIZE - 1 : 0
}

const DELTA: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}

export function initialState(): Position {
  return {
    cells: Array<Color | null>(SIZE * SIZE).fill(null),
    reserves: { black: START_RESERVE, white: START_RESERVE },
    turn: 'black',
    moveCount: 0,
    swapped: false,
  }
}

/**
 * Case d'arrivée d'une glisse depuis (row, col) vers `dir`, d'au plus `range` cases.
 * La pierre avance case par case : obstacle adverse rencontré = capture (même adjacent),
 * obstacle allié ou bord = arrêt juste avant ; sinon elle s'arrête au bout de sa portée.
 * Retourne null si elle ne peut pas avancer d'au moins une case libre (obstacle allié
 * ou bord immédiatement adjacent).
 */
export function slideDestination(
  cells: (Color | null)[],
  row: number,
  col: number,
  dir: Dir,
  me: Color,
  range: number = MAX_RANGE,
): Destination | null {
  const [dr, dc] = DELTA[dir]
  let landedR = row
  let landedC = col
  for (let step = 1; step <= range; step++) {
    const nr = row + dr * step
    const nc = col + dc * step
    if (!inBoard(nr, nc)) break
    const occ = cells[idx(nr, nc)]
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

function isLegal(pos: Position, a: Action): boolean {
  const me = pos.turn
  switch (a.kind) {
    case 'place':
      return (
        pos.reserves[me] > 0 &&
        a.row === homeRow(me) &&
        pos.cells[idx(a.row, a.col)] === null
      )
    case 'slide': {
      if (pos.cells[idx(a.row, a.col)] !== me) return false
      return slideDestination(pos.cells, a.row, a.col, a.dir, me) !== null
    }
    case 'swap':
      return pos.moveCount === 1 && !pos.swapped
  }
}

export function legalActions(pos: Position): Action[] {
  const acts: Action[] = []
  if (isLegal(pos, { kind: 'swap' })) acts.push({ kind: 'swap' })
  if (pos.reserves[pos.turn] > 0) {
    const hr = homeRow(pos.turn)
    for (let col = 0; col < SIZE; col++) {
      if (pos.cells[idx(hr, col)] === null) acts.push({ kind: 'place', row: hr, col })
    }
  }
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if (pos.cells[idx(row, col)] !== pos.turn) continue
      for (const dir of DIRS) {
        if (slideDestination(pos.cells, row, col, dir, pos.turn) !== null) {
          acts.push({ kind: 'slide', row, col, dir })
        }
      }
    }
  }
  return acts
}

export function positionHash(pos: Position): string {
  let board = ''
  for (const c of pos.cells) board += c === null ? '.' : c === 'black' ? 'b' : 'w'
  return `${board}|${pos.reserves.black},${pos.reserves.white}|${pos.turn}`
}

export class IllegalMoveError extends Error {}

/** Applique une action et retourne la nouvelle position. Lance IllegalMoveError si illégal. */
export function applyAction(pos: Position, a: Action): Position {
  if (!isLegal(pos, a)) throw new IllegalMoveError(JSON.stringify(a))
  const cells = [...pos.cells]
  const reserves = { ...pos.reserves }
  let turn = other(pos.turn)
  let swapped = pos.swapped
  switch (a.kind) {
    case 'place':
      cells[idx(a.row, a.col)] = pos.turn
      reserves[pos.turn] -= 1
      break
    case 'slide': {
      const dest = slideDestination(cells, a.row, a.col, a.dir, pos.turn)
      if (!dest) throw new IllegalMoveError(JSON.stringify(a))
      cells[idx(a.row, a.col)] = null
      cells[idx(dest.row, dest.col)] = pos.turn
      break
    }
    case 'swap': {
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] !== null) cells[i] = other(cells[i]!)
      }
      const b = reserves.black
      reserves.black = reserves.white
      reserves.white = b
      turn = 'black'
      swapped = true
      break
    }
  }
  return { cells, reserves, turn, moveCount: pos.moveCount + 1, swapped }
}

/**
 * Gagnant après application d'une action par `mover`, sans considération d'historique :
 * percée (pierre sur la rangée adverse), anéantissement (plus de pierres adverses
 * sur le plateau ni en réserve), immobilisation brute (adversaire sans coup légal).
 */
export function winnerAfter(pos: Position, mover: Color): Color | null {
  const opp = other(mover)
  const tr = targetRow(mover)
  for (let col = 0; col < SIZE; col++) {
    if (pos.cells[idx(tr, col)] === mover) return mover
  }
  let oppStones = 0
  for (const c of pos.cells) if (c === opp) oppStones++
  if (oppStones === 0 && pos.reserves[opp] === 0) return mover
  if (legalActions(pos).length === 0) return mover
  return null
}

export type WinReason = 'percée' | 'anéantissement' | 'immobilisation'

export interface Outcome {
  winner: Color
  reason: WinReason
}

/**
 * Résultat complet d'une position après le coup de `mover`, en tenant compte de
 * l'anti-répétition : si l'adversaire n'a plus aucun coup créant une position
 * moins de MAX_OCCURRENCES fois rencontrée, il perd par immobilisation.
 */
export function outcome(
  pos: Position,
  mover: Color,
  reps: ReadonlyMap<string, number>,
): Outcome | null {
  const tr = targetRow(mover)
  for (let col = 0; col < SIZE; col++) {
    if (pos.cells[idx(tr, col)] === mover) return { winner: mover, reason: 'percée' }
  }
  const opp = other(mover)
  let oppStones = 0
  for (const c of pos.cells) if (c === opp) oppStones++
  if (oppStones === 0 && pos.reserves[opp] === 0) {
    return { winner: mover, reason: 'anéantissement' }
  }
  if (legalActions(pos).length === 0) return { winner: mover, reason: 'immobilisation' }
  for (const a of legalActions(pos)) {
    if ((reps.get(positionHash(applyAction(pos, a))) ?? 0) < MAX_OCCURRENCES) return null
  }
  return { winner: mover, reason: 'immobilisation' }
}

const MAX_OCCURRENCES = 2

/**
 * Partie : position courante, historique (undo), anti-répétition
 * (interdiction de créer une 3e occurrence d'une position identique).
 */
export class Game {
  position: Position
  winner: Color | null = null
  winnerReason: WinReason | null = null

  private history: Position[] = []
  private reps = new Map<string, number>()

  constructor() {
    this.position = initialState()
    this.bump(this.position)
  }

  private bump(p: Position): void {
    const h = positionHash(p)
    this.reps.set(h, (this.reps.get(h) ?? 0) + 1)
  }

  private unbump(p: Position): void {
    const h = positionHash(p)
    const n = (this.reps.get(h) ?? 1) - 1
    if (n <= 0) this.reps.delete(h)
    else this.reps.set(h, n)
  }

  /** Joue une action si légal (anti-répétition incluse). Retourne false sinon. */
  play(a: Action): boolean {
    if (this.winner !== null) return false
    let next: Position
    try {
      next = applyAction(this.position, a)
    } catch {
      return false
    }
    if ((this.reps.get(positionHash(next)) ?? 0) >= MAX_OCCURRENCES) return false
    this.history.push(this.position)
    this.bump(next)
    this.position = next
    const result = outcome(next, other(next.turn), this.reps)
    this.winner = result?.winner ?? null
    this.winnerReason = result?.reason ?? null
    return true
  }

  canUndo(): boolean {
    return this.history.length > 0
  }

  undo(): void {
    if (this.history.length === 0) return
    this.unbump(this.position)
    this.position = this.history.pop()!
    this.winner = null
    this.winnerReason = null
  }

  /** Actions légales pour le trait, filtrées par l'anti-répétition. */
  legalMoves(): Action[] {
    if (this.winner !== null) return []
    return legalActions(this.position).filter(
      (a) => (this.reps.get(positionHash(applyAction(this.position, a))) ?? 0) < MAX_OCCURRENCES,
    )
  }

  swapAvailable(): boolean {
    return this.winner === null && isLegal(this.position, { kind: 'swap' })
  }

  /** Destinations de glisse légales (anti-répétition incluse) pour une pierre au trait. */
  slideDestinations(row: number, col: number): Map<Dir, Destination> {
    const result = new Map<Dir, Destination>()
    if (this.winner !== null || this.position.cells[idx(row, col)] !== this.position.turn) {
      return result
    }
    const allowed = new Set(
      this.legalMoves()
        .filter((a): a is Extract<Action, { kind: 'slide' }> => a.kind === 'slide')
        .map((a) => `${a.row},${a.col},${a.dir}`),
    )
    for (const dir of DIRS) {
      if (!allowed.has(`${row},${col},${dir}`)) continue
      const dest = slideDestination(this.position.cells, row, col, dir, this.position.turn)
      if (dest) result.set(dir, dest)
    }
    return result
  }

  /** Cases de pose légales (rangée de départ) pour le trait. */
  placeSquares(): Set<number> {
    const set = new Set<number>()
    for (const a of this.legalMoves()) {
      if (a.kind === 'place') set.add(idx(a.row, a.col))
    }
    return set
  }
}
