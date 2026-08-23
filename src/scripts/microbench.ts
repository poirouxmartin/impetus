import { Game } from '../core/rules'
import { chooseAction } from '../core/ai'
import { analyse } from '../core/engine'

const g = new Game()
for (let ply = 0; ply < 14; ply++) {
  const t0 = Date.now()
  let action
  let label = ''
  const engineTurn = ply % 2 === 0
  if (engineTurn) {
    label = 'moteur'
    const a = analyse(g.position, 400)
    const keys = new Set(g.legalMoves().map((x) => JSON.stringify(x)))
    action =
      a?.lines.find((l) => keys.has(JSON.stringify(l.action)))?.action ??
      chooseAction(g.position, 'normal', g.legalMoves())
  } else {
    label = 'ancienIA'
    action = chooseAction(g.position, 'difficile', g.legalMoves(), 350)
  }
  const dt = Date.now() - t0
  console.log(`ply ${ply} ${label}: ${dt} ms ${action ? JSON.stringify(action) : 'null'}`)
  if (!action) break
  g.play(action)
}
