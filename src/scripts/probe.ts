import { initialState } from '../core/rules'
import { analyse } from '../core/engine'

const budget = Number(process.argv[2]) || 8000
const a = analyse(initialState(), budget)
if (!a) {
  console.log('aucune analyse')
} else {
  console.log(
    `position initiale — score Noir ${a.scoreBlackCp} cp · profondeur ${a.depth} · nœuds ${a.nodes} · meilleur ${a.best?.notation} (${a.best?.score} cp)`,
  )
  for (const l of a.lines.slice(0, 3)) console.log(`  ${l.notation} → ${l.score} cp`)
}
