import { Game } from '../core/rules'
import { chooseAction } from '../core/ai'
import { analyse } from '../core/engine'

// === 1. Pression de répétition en self-play Normal vs Normal (le niveau du bot du user) ===
function repPressure(games: number): void {
  let totalPlies = 0
  let totalBlocked = 0
  let blockedGames = 0
  const lengths: number[] = []
  for (let i = 0; i < games; i++) {
    const g = new Game()
    while (!g.winner && g.position.moveCount < 300) {
      totalBlocked += g.blockedByRepetition().length
      const a = chooseAction(g.position, 'normal', g.legalMoves(), 200)
      if (!a || !g.play(a)) break
    }
    totalPlies += g.position.moveCount
    lengths.push(g.position.moveCount)
    if (g.position.moveCount > 80) blockedGames++
  }
  console.log(
    `Normal×${games} : coups interdits moy/ply ${(totalBlocked / totalPlies).toFixed(2)} · parties >80 plies : ${blockedGames}/${games} · longueur moy ${Math.round(totalPlies / games)} (max ${Math.max(...lengths)})`,
  )
}
repPressure(12)

// === 2. Scénario ombre : coureur noir e4 vs défenseur blanc e6, moteur des deux côtés ===
function shadowScenario(): void {
  const g = new Game()
  // pose forcée : noir e1, blanc e9, puis montage du scénario à la main via l'historique
  g.play({ kind: 'place', row: 0, col: 4 })
  g.play({ kind: 'place', row: 8, col: 4 })
  // noir glisse e1→e4 (3 cases)
  g.play({ kind: 'slide', row: 0, col: 4, dir: 'down' })
  // blanc glisse e9→e6 (3 cases) : le suiveur s'interpose
  g.play({ kind: 'slide', row: 8, col: 4, dir: 'up' })
  console.log('\nOmbre : noir e4 vs blanc e6 (moteur difficile 500ms des deux côtés)')
  for (let ply = 0; ply < 30 && !g.winner; ply++) {
    const a = analyse(g.position, 500)?.best?.action
    if (!a || !g.play(a)) {
      console.log(`  ply ${ply} : blocage`)
      break
    }
    if (ply % 6 === 5 || g.winner) {
      const stones: string[] = []
      g.position.cells.forEach((c, i) => {
        if (c) stones.push(`${c === 'black' ? 'n' : 'b'}${'abcdefghi'[i % 9]}${Math.floor(i / 9) + 1}`)
      })
      console.log(`  ply ${ply + 1} [${g.position.moveCount}] : ${stones.join(' ')}${g.winner ? ` → ${g.winner} ${g.winnerReason}` : ''}`)
    }
  }
}
shadowScenario()
