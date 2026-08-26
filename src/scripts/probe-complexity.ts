import { Game, legalActions } from '../core/rules'
import { chooseAction } from '../core/ai'

// === 1. Facteur de branchement moyen + complexité de l'arbre de jeu ===
function treeComplexity(games: number): void {
  let totalMoves = 0
  let totalPlies = 0
  const lengths: number[] = []
  const openings = new Set<string>()
  const earlyPositions = new Set<string>()
  for (let i = 0; i < games; i++) {
    const g = new Game()
    let bProduct = 0 // somme des log10 du branchement
    while (!g.winner && g.position.moveCount < 200) {
      const legal = legalActions(g.position)
      bProduct += Math.log10(Math.max(1, legal.length))
      totalMoves += legal.length
      totalPlies++
      if (g.position.moveCount < 2) openings.add(JSON.stringify(legal[0]))
      if (g.position.moveCount === 8) earlyPositions.add(JSON.stringify(g.position.cells))
      const a = chooseAction(g.position, 'difficile', legal, 150)
      if (!a || !g.play(a)) break
    }
    lengths.push(g.position.moveCount)
    void bProduct
  }
  const bAvg = totalMoves / totalPlies
  const lenAvg = totalPlies / games
  const log10Tree = bAvg * lenAvg
  console.log(`branchement moyen : ${bAvg.toFixed(1)}`)
  console.log(`longueur moyenne : ${Math.round(lenAvg)} plies (max ${Math.max(...lengths)})`)
  console.log(`complexité arbre de jeu ≈ 10^${Math.round(log10Tree)}`)
  console.log(`ouvertures distinctes (1er coup) : ${openings.size}/3 possibles · positions distinctes au coup 4 : ${earlyPositions.size}`)
}
treeComplexity(14)

// === 2. Espace d'états (borne combinatoire) ===
function stateSpace(): void {
  // positions réalisables approximées : pour chaque k pierres sur le plateau (0..20),
  // arrangements colorés + répartitions de réserves + trait
  let log10Total = -Infinity
  for (let k = 0; k <= 20; k++) {
    // C(81,k) × 2^k
    let logC = 0
    for (let j = 0; j < k; j++) logC += Math.log10(81 - j) - Math.log10(j + 1)
    const logK = logC + k * Math.log10(2)
    // réserves : (rB + rW ≤ 20 - k + 20) — approximons 15×15 combinaisons utiles
    const logRes = Math.log10(16 * 16)
    const logTurn = Math.log10(2)
    const total = logK + logRes + logTurn
    if (total > log10Total) log10Total = total
    log10Total = Math.max(log10Total, total)
    void total
  }
  console.log(`espace d'états (borne haute réaliste) ≈ 10^${Math.round(log10Total)}`)
  console.log('repères : Breakthrough ≈ 10^21 · échecs ≈ 10^44 · go ≈ 10^170')
}
stateSpace()

// === 3. Diversité des parties complètes ===
function gameDiversity(games: number): void {
  const sigs = new Set<string>()
  const firstMoves = new Map<string, number>()
  for (let i = 0; i < games; i++) {
    const g = new Game()
    const sig: string[] = []
    while (!g.winner && g.position.moveCount < 200) {
      const a = chooseAction(g.position, 'difficile', legalActions(g.position), 150)
      if (!a || !g.play(a)) break
      sig.push(a.kind === 'place' ? `p${a.row},${a.col}` : a.kind === 'swap' ? 'sw' : `s${a.row},${a.col},${a.dir}`)
      if (g.position.moveCount === 1) firstMoves.set(JSON.stringify(a), (firstMoves.get(JSON.stringify(a)) ?? 0) + 1)
    }
    sigs.add(sig.join(' '))
  }
  console.log(`parties uniques : ${sigs.size}/${games} · répartition 1er coup :`, [...firstMoves.entries()].map(([k, v]) => `${JSON.parse(k).col + 1}:${v}`).join(' '))
}
gameDiversity(14)
