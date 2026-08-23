import { Variant, estimateComplexity, initialStateV, solve } from '../core/solver'

const deadlineSec = Number(process.argv[2]) || 25
const playouts = Number(process.argv[3]) || 400

console.log(`=== Complexité du jeu standard (9×9, réserve 10) — ${playouts} playouts aléatoires ===`)
const std: Variant = { size: 9, reserve: 10 }
const c = estimateComplexity(std, playouts)
console.log(`Branching moyen : ${c.avgBranching.toFixed(1)} coups`)
console.log(`Longueur moyenne : ${c.avgPlies.toFixed(1)} plies`)
console.log(`Arbre de jeu ≈ 10^${c.log10Tree.toFixed(1)}`)
console.log(`États (borne haute) ≈ 10^${c.log10StatesUpperBound.toFixed(1)}`)
console.log(`Positions uniques échantillonnées : ${c.uniquePositions}`)
console.log('')

const frontier: Variant[] = [
  { size: 4, reserve: 1 },
  { size: 4, reserve: 2 },
  { size: 4, reserve: 3 },
  { size: 5, reserve: 1 },
  { size: 5, reserve: 2 },
  { size: 5, reserve: 3 },
  { size: 6, reserve: 2 },
  { size: 6, reserve: 3 },
  { size: 6, reserve: 4 },
  { size: 7, reserve: 2 },
  { size: 7, reserve: 3 },
]

console.log(`=== Frontière de résolubilité (échéance ${deadlineSec}s par variante) ===`)
for (const v of frontier) {
  const label = `${v.size}×${v.size} réserve ${v.reserve}`
  const r = solve(v, initialStateV(v), { deadlineMs: deadlineSec * 1000 })
  if (r.status === 'exact') {
    console.log(
      `${label} → RÉSOLU en ${(r.ms / 1000).toFixed(2)}s · ${r.nodes.toLocaleString('fr-FR')} nœuds · ${
        r.blackWinsWithPerfectPlay ? 'Noir gagne' : 'Blanc gagne'
      } au jeu parfait`,
    )
  } else {
    console.log(
      `${label} → NON RÉSOLU après ${(r.ms / 1000).toFixed(1)}s (${r.nodes.toLocaleString('fr-FR')} nœuds explorés)`,
    )
  }
}
