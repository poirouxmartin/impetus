import { Game, type Action } from '../core/rules'
import { chooseAction } from '../core/ai'
import { chooseActionMCTS } from '../core/mcts'
import type { Level } from '../core/ai'

function duel(nameA: string, playA: (g: Game) => Action | null, nameB: string, playB: (g: Game) => Action | null, games: number): void {
  let winsA = 0
  let winsB = 0
  let plies = 0
  for (let i = 0; i < games; i++) {
    const g = new Game()
    while (!g.winner && g.position.moveCount < 200) {
      const play = g.position.turn === 'black' ? playA : playB
      const a = play(g)
      if (!a || !g.play(a)) break
    }
    plies += g.position.moveCount
    if (g.winner === 'black') winsA++
    else if (g.winner === 'white') winsB++
  }
  console.log(
    `${nameA} vs ${nameB} : ${winsA}/${winsB} (${games}) · ${Math.round(plies / games)} plies`,
  )
}

const aiLevel = (l: Level, budget = 200) => (g: Game) => chooseAction(g.position, l, g.legalMoves(), budget)
const mcts = (budget = 900) => (g: Game) => chooseActionMCTS(g.position, g.legalMoves(), budget)

duel('MCTS(900)', mcts(), 'Facile', aiLevel('facile'), 6)
duel('MCTS(900)', mcts(), 'Normal', aiLevel('normal'), 6)
duel('MCTS(900)', mcts(), 'Difficile(200)', aiLevel('difficile', 200), 6)
