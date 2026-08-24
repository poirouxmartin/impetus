import { Level } from '../core/ai'
import { playGame } from './runner'

function runMatchup(name: string, black: Level, white: Level, games: number): void {
  let blackWins = 0
  let whiteWins = 0
  let timeouts = 0
  let swaps = 0
  const reasons: Record<string, number> = {}
  let plySum = 0
  let plyMin = Infinity
  let plyMax = 0

  for (let i = 0; i < games; i++) {
    const r = playGame(black, white, budgetFor)
    if (r.winner === 'black') blackWins++
    else if (r.winner === 'white') whiteWins++
    else timeouts++
    if (r.swapUsed) swaps++
    reasons[r.reason] = (reasons[r.reason] ?? 0) + 1
    plySum += r.plies
    plyMin = Math.min(plyMin, r.plies)
    plyMax = Math.max(plyMax, r.plies)
    process.stdout.write(`\r${name} — partie ${i + 1}/${games}`)
  }

  const pct = (n: number): string => ((100 * n) / games).toFixed(0) + '%'
  console.log('')
  console.log(`== ${name} (${games} parties) ==`)
  console.log(
    `Noir ${blackWins} (${pct(blackWins)}) · Blanc ${whiteWins} (${pct(whiteWins)}) · non terminées ${timeouts} (${pct(timeouts)})`,
  )
  console.log(
    `Longueur moyenne ${(plySum / games).toFixed(1)} plies [min ${plyMin} · max ${plyMax}] · swaps joués ${swaps}`,
  )
  console.log(`Fins de partie : ${JSON.stringify(reasons)}`)
  console.log('')
}

const games = Number(process.argv[2]) || 16
const dBudgetMs = Number(process.argv[3]) || 350
const budgetFor = (level: Level): number =>
  level === 'facile' ? 10 : level === 'normal' ? 150 : dBudgetMs

console.log(
  `Self-play Impetus — ${games} parties par affrontement · budget Difficile ${dBudgetMs} ms\n`,
)
runMatchup('Facile (Noir) vs Facile (Blanc)', 'facile', 'facile', games)
runMatchup('Normal (Noir) vs Normal (Blanc)', 'normal', 'normal', games)
runMatchup('Difficile (Noir) vs Difficile (Blanc)', 'difficile', 'difficile', games)
runMatchup('Noir Difficile vs Blanc Normal', 'difficile', 'normal', games)
runMatchup('Noir Normal vs Blanc Difficile', 'normal', 'difficile', games)
