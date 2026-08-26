import { Game, type Action } from '../core/rules'
import { chooseAction } from '../core/ai'
import { chooseActionMCTS } from '../core/mcts'

function duel(nameA: string, playA: (g: Game) => Action | null, nameB: string, playB: (g: Game) => Action | null, games: number): void {
  let winsA = 0
  let winsB = 0
  let draws = 0
  for (let i = 0; i < games; i++) {
    const g = new Game()
    while (!g.winner && g.position.moveCount < 200) {
      const play = g.position.turn === 'black' ? playA : playB
      const a = play(g)
      if (!a || !g.play(a)) break
    }
    if (g.winner === 'black') winsA++
    else if (g.winner === 'white') winsB++
    else draws++
  }
  console.log(`${nameA} vs ${nameB} : ${winsA}/${winsB} (+${draws} non finies) (${games})`)
}

const aiNormal = (g: Game) => chooseAction(g.position, 'normal', g.legalMoves(), 200)
const nn = (budget: number) => (g: Game) => chooseActionMCTS(g.position, g.legalMoves(), budget)

duel('NN-MCTS(900)', nn(900), 'Normal', aiNormal, 6)
duel('NN-MCTS(900)', nn(900), 'MCTS-heur', (g) => chooseActionMCTS(g.position, g.legalMoves(), 900), 6)
