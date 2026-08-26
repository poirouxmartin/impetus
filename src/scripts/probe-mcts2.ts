import { Game, type Action } from '../core/rules'
import { chooseAction } from '../core/ai'
import { chooseActionMCTS } from '../core/mcts'

// nombre de simulations : on instrumente via un budget long et un compteur approximatif
function duel(nameA: string, playA: (g: Game) => Action | null, nameB: string, playB: (g: Game) => Action | null, games: number): void {
  let winsA = 0
  let winsB = 0
  for (let i = 0; i < games; i++) {
    const g = new Game()
    while (!g.winner && g.position.moveCount < 200) {
      const play = g.position.turn === 'black' ? playA : playB
      const a = play(g)
      if (!a || !g.play(a)) break
    }
    if (g.winner === 'black') winsA++
    else if (g.winner === 'white') winsB++
  }
  console.log(`${nameA} vs ${nameB} : ${winsA}/${winsB} (${games})`)
}

const aiLevel = (l: 'normal') => (g: Game) => chooseAction(g.position, l, g.legalMoves(), 200)

duel('MCTS(3000)', (g) => chooseActionMCTS(g.position, g.legalMoves(), 3000), 'Normal', aiLevel('normal'), 4)
duel('MCTS(3000)', (g) => chooseActionMCTS(g.position, g.legalMoves(), 3000), 'MCTS(900)', (g) => chooseActionMCTS(g.position, g.legalMoves(), 900), 4)
