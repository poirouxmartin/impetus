import { Game } from '../core/rules'
import { chooseAction } from '../core/ai'
import { analyse } from '../core/engine'

const g = new Game()
g.play({ kind: 'place', row: 0, col: 4 })
g.play({ kind: 'place', row: 8, col: 4 })
g.play({ kind: 'slide', row: 0, col: 4, dir: 'down' })
g.play({ kind: 'slide', row: 8, col: 4, dir: 'up' })
console.log('Ombre : bot NORMAL (noir) vs moteur difficile (blanc, 500ms)')
let shuffles = 0
let lastFrom = ''
for (let ply = 0; ply < 30 && !g.winner; ply++) {
  let a
  if (g.position.turn === 'black') {
    a = chooseAction(g.position, 'normal', g.legalMoves(), 200)
    const nota =
      a?.kind === 'place'
        ? `${'abcdefghi'[a.col]}${a.row + 1}`
        : a?.kind === 'slide'
          ? `${'abcdefghi'[a.col]}${a.row + 1}→`
          : 'swap'
    if (a?.kind === 'slide' && `${a.row},${a.col}` === lastFrom) shuffles++
    if (a?.kind === 'slide') lastFrom = `${a.row},${a.col}`
    console.log(`  ply ${ply} noir : ${nota} ${a?.kind}`)
  } else {
    a = analyse(g.position, 500)?.best?.action
  }
  if (!a || !g.play(a)) break
  if (g.winner) console.log(`  → ${g.winner} ${g.winnerReason} (ply ${g.position.moveCount})`)
}
console.log(`navettes du coureur noir (même origine consécutive) : ${shuffles}`)
