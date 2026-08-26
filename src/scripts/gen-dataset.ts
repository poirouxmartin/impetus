/**
 * Génère un dataset d'entraînement par self-play MCTS.
 * Usage : node dist/gen-dataset.cjs [parties=60] [budgetMs=250] [sortie=data/nn-dataset.json]
 */
import { writeFileSync, mkdirSync } from 'fs'
import { Game } from '../core/rules'
import { analyseMCTS } from '../core/mcts'
import { encodeInput, moveIndex } from '../core/nn'

const games = Number(process.argv[2]) || 60
const budget = Number(process.argv[3]) || 250
const out = process.argv[4] || 'data/nn-dataset.json'

const samples: {
  x: number[]
  legal: number[]
  pi: number[]
  z: number
  mover: Color
  ply: number
}[] = []
type Color = 'black' | 'white'
void 0

let done = 0
for (let g = 0; g < games; g++) {
  const game = new Game()
  const recorded: { x: Float64Array; legal: number[]; pi: number[]; mover: Color }[] = []
  while (!game.winner && game.position.moveCount < 200) {
    const legal = game.legalMoves()
    const res = analyseMCTS(game.position, legal, budget)
    if (!res || !res.best) break
    const visits = new Map(res.lines.map((l) => [JSON.stringify(l.move), l.visits]))
    const legalIdx = legal.map(moveIndex)
    const total = res.lines.reduce((s, l) => s + l.visits, 0)
    const pi = legal.map((a) => {
      const v = visits.get(JSON.stringify(a)) ?? 0
      return total > 0 ? v / total : 1 / legal.length
    })
    recorded.push({ x: encodeInput(game.position), legal: legalIdx, pi, mover: game.position.turn })
    if (!game.play(res.best)) break
  }
  const zFor = (mover: Color): number => {
    if (!game.winner) return 0
    return game.winner === mover ? 1 : -1
  }
  for (const r of recorded) {
    samples.push({
      x: Array.from(r.x, (n) => Math.round(n * 1000) / 1000),
      legal: r.legal,
      pi: r.pi.map((n) => Math.round(n * 1000) / 1000),
      z: zFor(r.mover),
      mover: r.mover,
      ply: 0,
    })
  }
  done++
  if (done % 10 === 0) console.log(`parties ${done}/${games} · échantillons ${samples.length}`)
}

mkdirSync('data', { recursive: true })
writeFileSync(out, JSON.stringify({ games, samples }))
console.log(`dataset écrit : ${out} · ${samples.length} échantillons (${games} parties)`)
