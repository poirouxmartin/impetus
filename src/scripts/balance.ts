import { Level } from '../core/ai'
import { setRules } from '../core/rules'
import { playGame } from './runner'

interface Variant {
  name: string
  size?: number
  reserve?: number
  range?: number
  occurrences?: number
}

const VARIANTS: Variant[] = [
  { name: 'référence 9·r10·p3·occ2' },
  { name: '7×7', size: 7 },
  { name: '11×11', size: 11 },
  { name: 'portée 2', range: 2 },
  { name: 'portée 4', range: 4 },
  { name: 'réserve 8', reserve: 8 },
  { name: 'réserve 12', reserve: 12 },
  { name: 'ko strict occ1', occurrences: 1 },
  { name: 'occ3', occurrences: 3 },
]

interface Stats {
  black: number
  white: number
  timeout: number
  swaps: number
  plySum: number
  plyMin: number
  plyMax: number
  reasons: Record<string, number>
}

function newStats(): Stats {
  return { black: 0, white: 0, timeout: 0, swaps: 0, plySum: 0, plyMin: Infinity, plyMax: 0, reasons: {} }
}

function accumulate(s: Stats, r: { winner: string; reason: string; plies: number; swapUsed: boolean }): void {
  if (r.winner === 'black') s.black++
  else if (r.winner === 'white') s.white++
  else s.timeout++
  if (r.swapUsed) s.swaps++
  s.plySum += r.plies
  s.plyMin = Math.min(s.plyMin, r.plies)
  s.plyMax = Math.max(s.plyMax, r.plies)
  s.reasons[r.reason] = (s.reasons[r.reason] ?? 0) + 1
}

const pct = (n: number, total: number): string => ((100 * n) / total).toFixed(0).padStart(3) + '%'

function main(): void {
  const games = Number(process.argv[2]) || 12
  const dBudgetMs = Number(process.argv[3]) || 100
  const level: Level = (process.argv[4] as Level) || 'normal'
  const only = process.argv[5]?.split(',').map((s) => Number(s.trim()))
  const variants = VARIANTS.filter((_, i) => !only || only.includes(i))
  const budgetFor = (l: Level): number =>
    l === 'facile' ? 10 : l === 'normal' ? 150 : dBudgetMs

  console.log(
    `Équilibrage Impetus — ${games} parties/variante · niveau ${level} · budget difficile ${dBudgetMs} ms\n`,
  )
  console.log(
    'variante'.padEnd(24) + 'Noir  Blanc  h.délai  pliesø   [min·max]  swap  fins',
  )

  for (const v of variants) {
    setRules(v)
    const s = newStats()
    for (let i = 0; i < games; i++) accumulate(s, playGame(level, level, budgetFor))
    const fins = Object.entries(s.reasons)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(' · ')
    console.log(
      v.name.padEnd(24) +
        pct(s.black, games) +
        '  ' +
        pct(s.white, games) +
        '   ' +
        pct(s.timeout, games) +
        '   ' +
        (s.plySum / games).toFixed(1).padStart(6) +
        '  [' +
        String(s.plyMin).padStart(3) +
        '·' +
        String(s.plyMax).padStart(3) +
        ']  ' +
        pct(s.swaps, games) +
        '  ' +
        fins,
    )
  }
  setRules()
}

main()
