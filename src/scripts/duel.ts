import { Color, Game } from '../core/rules'
import { chooseAction } from '../core/ai'
import { analyse } from '../core/engine'

const BUDGET = Number(process.argv[2]) || 500
const GAMES = Number(process.argv[3]) || 6

function engineMove(g: Game): ReturnType<typeof chooseAction> {
  const a = analyse(g.position, BUDGET)
  const keys = new Set(g.legalMoves().map((x) => JSON.stringify(x)))
  return a?.lines.find((l) => keys.has(JSON.stringify(l.action)))?.action ?? null
}

function playGame(blackIsEngine: boolean): { winner: Color | null; plies: number } {
  const g = new Game()
  while (!g.winner && g.position.moveCount < 200) {
    const engineTurn = (g.position.turn === 'black') === blackIsEngine
    const legal = g.legalMoves()
    const action = engineTurn ? engineMove(g) : chooseAction(g.position, 'difficile', legal)
    if (!action) break
    g.play(action)
  }
  return { winner: g.winner, plies: g.position.moveCount }
}

let engineWins = 0
let oldWins = 0
for (let i = 0; i < GAMES * 2; i++) {
  const blackIsEngine = i % 2 === 0
  const r = playGame(blackIsEngine)
  const engineWon =
    (blackIsEngine && r.winner === 'black') || (!blackIsEngine && r.winner === 'white')
  if (engineWon) engineWins++
  else oldWins++
  process.stdout.write(`\rpartie ${i + 1}/${GAMES * 2}`)
}
console.log('')
console.log(
  `Nouveau moteur (${BUDGET} ms/coup) : ${engineWins} victoires — ancien Difficile : ${oldWins} sur ${GAMES * 2} parties`,
)
