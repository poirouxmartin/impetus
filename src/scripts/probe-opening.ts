import { Game } from '../core/rules'
import { analyse } from '../core/engine'

const WIN = 1_000_000

function probe(name: string, g: Game, budget = 8000): void {
  const a = analyse(g.position, budget)
  if (!a) return
  const mate = Math.abs(a.best?.score ?? 0) >= WIN - 64
  console.log(
    `${name} — trait ${g.position.turn} · prof ${a.depth} · score(Noir) ${a.scoreBlackCp}${mate ? ' ← MAT ANNONCÉ' : ''} · nœuds ${a.nodes}`,
  )
}

const g1 = new Game()
g1.play({ kind: 'place', row: 0, col: 1 })
probe('après 1. b1', g1)

const g2 = new Game()
g2.play({ kind: 'place', row: 0, col: 1 })
g2.play({ kind: 'swap' })
probe('après 1. b1 échange', g2)

const g3 = new Game()
g3.play({ kind: 'place', row: 0, col: 1 })
g3.play({ kind: 'place', row: 8, col: 4 })
probe('après 1. b1 d9', g3)

const g4 = new Game()
g4.play({ kind: 'place', row: 0, col: 4 })
g4.play({ kind: 'swap' })
g4.play({ kind: 'place', row: 0, col: 6 })
probe('après 1. e1 échange 2. g1', g4)
