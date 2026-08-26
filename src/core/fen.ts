/**
 * Format d'échange Impetus (FEN-like) et liste de coups (PGN-like).
 *
 * FEN   : `IMP <rangées séparées par /> <résNoir> <résBlanc> <trait b|w> <mc> <swap 0|1> <D|I>`
 * Coups : `1. d1 e9 2. e1-e4 ...` (pose = case, glisse = origine-destination, swap = `swap`)
 */
import { type Action, type Color, type Position, SIZE, applyAction, initialState, slideDestination } from './rules'

export function encodeFen(pos: Position, delayed = true): string {
  const rows: string[] = []
  for (let r = 0; r < SIZE; r++) {
    let row = ''
    for (let c = 0; c < SIZE; c++) {
      const cell = pos.cells[r * SIZE + c]
      row += cell === 'black' ? 'b' : cell === 'white' ? 'w' : '.'
    }
    rows.push(row)
  }
  const turn = pos.turn === 'black' ? 'b' : 'w'
  const sw = pos.swapped ? 1 : 0
  const mode = delayed ? 'D' : 'I'
  return `IMP ${rows.join('/')} ${pos.reserves.black} ${pos.reserves.white} ${turn} ${pos.moveCount} ${sw} ${mode}`
}

export interface DecodedFen {
  pos: Position
  delayed: boolean
}

export function decodeFen(s: string): DecodedFen | null {
  const parts = s.trim().split(/\s+/)
  if (parts.length !== 8 || parts[0] !== 'IMP') return null
  const rows = parts[1].split('/')
  if (rows.length !== SIZE) return null
  const cells: (Color | null)[] = []
  for (const row of rows) {
    if (row.length !== SIZE) return null
    for (const ch of row) {
      if (ch === 'b') cells.push('black')
      else if (ch === 'w') cells.push('white')
      else if (ch === '.') cells.push(null)
      else return null
    }
  }
  const resB = Number(parts[2])
  const resW = Number(parts[3])
  if (!Number.isInteger(resB) || !Number.isInteger(resW) || resB < 0 || resW < 0) return null
  const turn: Color = parts[4] === 'b' ? 'black' : parts[4] === 'w' ? 'white' : (null as never)
  if (turn !== 'black' && turn !== 'white') return null
  const mc = Number(parts[5])
  if (!Number.isInteger(mc) || mc < 0) return null
  const sw = parts[6] === '1'
  const delayed = parts[7] === 'D'
  return {
    pos: { cells, reserves: { black: resB, white: resW }, turn, moveCount: mc, swapped: sw },
    delayed,
  }
}

/** Notation neutre (langue-indépendante) : `d1`, `e1-e4`, `swap`. */
export function actionToken(a: Action, pos: Position): string {
  const sq = (r: number, c: number): string => 'abcdefghi'[c] + (r + 1)
  if (a.kind === 'place') return sq(a.row, a.col)
  if (a.kind === 'swap') return 'swap'
  const dest = slideDestination(pos.cells, a.row, a.col, a.dir, pos.turn)
  return dest ? `${sq(a.row, a.col)}-${sq(dest.row, dest.col)}` : sq(a.row, a.col)
}

/** Export de la liste de coups : `1. d1 e9 2. e1-e4 ...` (rejouable). */
export function encodeMoves(moves: Action[]): string {
  const out: string[] = []
  let pos = initialState()
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) out.push(`${i / 2 + 1}.`)
    out.push(actionToken(moves[i], pos))
    pos = applyAction(pos, moves[i])
  }
  return out.join(' ')
}

export interface DecodedMoves {
  moves: Action[]
  error: string | null
}

/** Rejoue une liste de coups tokenisés ; s'arrête au premier coup illégal. */
export function decodeMoves(s: string): DecodedMoves {
  const tokens = s
    .trim()
    .split(/\s+/)
    .filter((tk) => tk !== '.' && !/^\d+\.$/.test(tk))
  const moves: Action[] = []
  let pos = initialState()
  for (const tk of tokens) {
    if (tk === 'swap') {
      const a: Action = { kind: 'swap' }
      try {
        pos = applyAction(pos, a)
        moves.push(a)
      } catch {
        return { moves, error: tk }
      }
      continue
    }
    const m = /^([a-i])([1-9])-([a-i])([1-9])$/.exec(tk)
    if (m) {
      const c1 = m[1].charCodeAt(0) - 97
      const r1 = Number(m[2]) - 1
      const c2 = m[3].charCodeAt(0) - 97
      const r2 = Number(m[4]) - 1
      const dir = r2 > r1 ? 'down' : r2 < r1 ? 'up' : c2 > c1 ? 'right' : 'left'
      const a: Action = { kind: 'slide', row: r1, col: c1, dir }
      try {
        pos = applyAction(pos, a)
        moves.push(a)
      } catch {
        return { moves, error: tk }
      }
      continue
    }
    const p = /^([a-i])([1-9])$/.exec(tk)
    if (p) {
      const a: Action = { kind: 'place', row: Number(p[2]) - 1, col: p[1].charCodeAt(0) - 97 }
      try {
        pos = applyAction(pos, a)
        moves.push(a)
      } catch {
        return { moves, error: tk }
      }
      continue
    }
    return { moves, error: tk }
  }
  return { moves, error: null }
}
