import { Game } from '../core/rules'
import { analyse } from '../core/engine'

const WIN = 1_000_000

/** Suit le meilleur coup du moteur coup par coup et vérifie la ligne annoncée contre rules.ts. */
const g = new Game()
const line: string[] = []
for (let ply = 0; ply < 60; ply++) {
  const a = analyse(g.position, 6000)
  if (!a || !a.best) break
  const cp = a.scoreBlackCp
  const mate = Math.abs(a.best.score) >= WIN - 64
  line.push(`${ply + 1}. ${a.best.notation} (${mate ? 'MAT' : (cp / 100).toFixed(1)})`)
  if (!g.play(a.best.action)) {
    line.push('→ COUP ILLÉGAL selon rules.ts !')
    break
  }
  if (g.winner) {
    line.push(`→ partie finie : ${g.winner} ${g.winnerReason} au coup ${g.position.moveCount}`)
    break
  }
}
console.log(line.join('\n'))
