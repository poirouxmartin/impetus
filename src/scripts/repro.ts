import { Game } from '../core/rules'
import { chooseAction } from '../core/ai'
import { analyse } from '../core/engine'

const WIN = 1_000_000
const BUDGET = Number(process.argv[2]) || 500
const GAMES = Number(process.argv[3]) || 4

function engineMove(g: Game): ReturnType<typeof chooseAction> {
  const a = analyse(g.position, BUDGET)
  const keys = new Set(g.legalMoves().map((x) => JSON.stringify(x)))
  return a?.lines.find((l) => keys.has(JSON.stringify(l.action)))?.action ?? null
}

let flags = 0
void flags
const firstFlagPlies: number[] = []

for (let game = 0; game < GAMES; game++) {
  const blackIsEngine = game % 2 === 0
  const g = new Game()
  let flaggedThisGame = false
  console.log(`— partie ${game + 1} (${blackIsEngine ? 'moteur=Noir' : 'moteur=Blanc'})`)
  const t0 = Date.now()
  while (!g.winner && g.position.moveCount < 160) {
    if ((g.position.turn === 'black') === blackIsEngine) {
      const a = analyse(g.position, BUDGET)
      if (a?.best && Math.abs(a.best.score) >= WIN - 300 && !flaggedThisGame) {
        firstFlagPlies.push(g.position.moveCount)
        flaggedThisGame = true
        console.log(
          `première percée forcée détectée — coup ${g.position.moveCount}, trait ${g.position.turn}, profondeur ${a.depth}`,
        )
      }
      const m = engineMove(g)
      if (!m) break
      g.play(m)
    } else {
      const m = chooseAction(g.position, 'difficile', g.legalMoves(), 350)
      if (!m) break
      g.play(m)
    }
    if (g.position.moveCount < 24 || g.position.moveCount % 10 === 0) {
      console.log(`   ply ${g.position.moveCount} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
    }
  }
  console.log(
    `partie ${game + 1} finie : ${g.winner ?? 'inconnu'} en ${g.position.moveCount} plies (${blackIsEngine ? 'moteur=Noir' : 'moteur=Blanc'})`,
  )
}
if (firstFlagPlies.length > 0) {
  const avg = firstFlagPlies.reduce((s, x) => s + x, 0) / firstFlagPlies.length
  console.log(
    `Première percée forcée : coup moyen ${(avg).toFixed(1)}, min ${Math.min(...firstFlagPlies)}, max ${Math.max(...firstFlagPlies)} (${firstFlagPlies.length}/${GAMES} parties)`,
  )
} else {
  console.log('Aucune percée forcée détectée.')
}
