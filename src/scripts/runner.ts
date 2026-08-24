import { Color, Game } from '../core/rules'
import { Level, chooseAction } from '../core/ai'

export const MAX_PLIES = 300

export interface GameResult {
  winner: Color | 'timeout'
  reason: string
  plies: number
  swapUsed: boolean
}

/** Joue une partie complète entre deux IA (self-play) selon les règles courantes. */
export function playGame(black: Level, white: Level, budgetFor: (l: Level) => number): GameResult {
  const game = new Game()
  let swapUsed = false
  while (!game.winner && game.position.moveCount < MAX_PLIES) {
    const level: Level = game.position.turn === 'black' ? black : white
    const action = chooseAction(game.position, level, game.legalMoves(), budgetFor(level))
    if (!action) break
    if (action.kind === 'swap') swapUsed = true
    game.play(action)
  }
  return {
    winner: game.winner ?? 'timeout',
    reason: game.winnerReason ?? 'timeout',
    plies: game.position.moveCount,
    swapUsed,
  }
}
