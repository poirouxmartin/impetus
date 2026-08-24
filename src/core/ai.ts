import {
  Action,
  BREAKTHROUGH_DELAY,
  Color,
  Position,
  SIZE,
  applyAction,
  hasBreakthrough,
  idx,
  legalActions,
  other,
  slideDestination,
  targetRow,
  winnerAfter,
} from './rules'

export type Level = 'facile' | 'normal' | 'difficile'

const WIN = 1_000_000
const STONE_ON_BOARD = 100
const STONE_IN_RESERVE = 58
const MAX_ADVANCE = 24
/** Percée différée : pierre sur la rangée cible = menace que l'adversaire doit répondre. */
const BREACH_THREAT = 260

function distanceToTarget(row: number, color: Color): number {
  return Math.abs(row - targetRow(color))
}

/** Score statique du point de vue de `me`. */
export function evaluate(pos: Position, me: Color): number {
  const opp = other(me)
  let score = (pos.reserves[me] - pos.reserves[opp]) * STONE_IN_RESERVE
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = pos.cells[idx(r, c)]
      if (!cell) continue
      const side = cell === me ? 1 : -1
      score += side * STONE_ON_BOARD
      score += side * MAX_ADVANCE * ((SIZE - 1 - distanceToTarget(r, cell)) / (SIZE - 1))
      if (BREAKTHROUGH_DELAY && distanceToTarget(r, cell) === 0) score += side * BREACH_THREAT
    }
  }
  return score
}

function moveOrder(pos: Position, a: Action): number {
  if (a.kind === 'swap') return 400
  if (a.kind === 'place') return 20
  const dest = slideDestination(pos.cells, a.row, a.col, a.dir, pos.turn)
  if (!dest) return -Infinity
  let score = 0
  if (dest.capture) score += 800
  if (BREAKTHROUGH_DELAY && dest.row === targetRow(pos.turn)) score += 500
  score += (distanceToTarget(a.row, pos.turn) - distanceToTarget(dest.row, pos.turn)) * 30
  return score
}

function sortedMoves(pos: Position): Action[] {
  return legalActions(pos)
    .map((action) => ({ action, order: moveOrder(pos, action) }))
    .sort((x, y) => y.order - x.order)
    .map((m) => m.action)
}

export function search(pos: Position, depth: number, alpha: number, beta: number): number {
  if (winnerAfter(pos, other(pos.turn)) !== null) return -WIN - depth
  if (depth === 0) return evaluate(pos, pos.turn)
  let best = -Infinity
  for (const action of sortedMoves(pos)) {
    const value = -search(applyAction(pos, action), depth - 1, -beta, -alpha)
    if (value > best) best = value
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best === -Infinity ? -WIN - depth : best
}

export function isImmediateWin(pos: Position, a: Action): boolean {
  const next = applyAction(pos, a)
  const me = pos.turn
  const w = winnerAfter(next, me)
  if (w) return w === me
  // Percée différée : gagnant si aucune riposte adverse n'évacue la menace.
  if (!hasBreakthrough(next, me)) return false
  const opp = other(me)
  for (const r of legalActions(next)) {
    const after = applyAction(next, r)
    if (winnerAfter(after, opp) === opp) return false
    if (!hasBreakthrough(after, me)) return false
  }
  return true
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

const BUDGET_MS: Record<'normal' | 'difficile', number> = { normal: 260, difficile: 1300 }

/**
 * Choisit une action parmi `allowed` (déjà filtrées par les règles du Game).
 * Facile : gagne si possible, sinon aléatoire avec biais capture.
 * Normal / Difficile : approfondissement itératif avec budget temps.
 * `budgetMs` permet de réduire le temps de réflexe (self-play, tests).
 */
export function chooseAction(
  pos: Position,
  level: Level,
  allowed: Action[],
  budgetMs?: number,
): Action | null {
  if (allowed.length === 0) return null
  if (allowed.length === 1) return allowed[0]
  const wins = allowed.filter((a) => isImmediateWin(pos, a))
  if (wins.length > 0) return pickRandom(wins)

  const options =
    level === 'difficile' ? allowed : allowed.filter((a) => a.kind !== 'swap')
  const candidates = options.length > 0 ? options : allowed

  const me = pos.turn
  if (level === 'facile') {
    const captures = candidates.filter(
      (a) =>
        a.kind === 'slide' && slideDestination(pos.cells, a.row, a.col, a.dir, me)?.capture,
    )
    const pool = captures.length > 0 && Math.random() < 0.5 ? captures : candidates
    return pickRandom(pool)
  }

  const budget = Math.max(50, budgetMs ?? BUDGET_MS[level])
  const maxDepth = level === 'difficile' ? 8 : 5
  const deadline = Date.now() + budget

  let ranked = candidates
    .map((action) => ({ action, order: moveOrder(pos, action) }))
    .sort((x, y) => y.order - x.order)
    .map((m) => m.action)
  let bestChoice = ranked[0]

  for (let depth = 2; depth <= maxDepth; depth++) {
    const scored: { action: Action; value: number }[] = []
    let alpha = -Infinity
    let timedOut = false
    for (const action of ranked) {
      const value = -search(applyAction(pos, action), depth - 1, -Infinity, -alpha)
      if (value > alpha) alpha = value
      scored.push({ action, value })
      if (Date.now() > deadline) {
        timedOut = true
        break
      }
    }
    if (scored.length > 0) {
      scored.sort((x, y) => y.value - x.value)
      bestChoice = pickRandom(scored.filter((s) => s.value === scored[0].value)).action
      ranked = scored.map((s) => s.action)
    }
    if (timedOut || alpha >= WIN) break
  }
  return bestChoice
}
