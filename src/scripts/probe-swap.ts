import { Game } from '../core/rules'
import { analyse } from '../core/engine'

const g = new Game()
g.play({ kind: 'place', row: 0, col: 3 }) // 1. d1

const a1 = analyse(g.position, 3000)
console.log('AVANT le coup blanc (mc=1, trait blanc) :')
for (const l of a1?.lines.slice(0, 4) ?? []) console.log(`  ${l.notation} → ${l.score}`)

g.play({ kind: 'swap' }) // le bot échange

const a2 = analyse(g.position, 3000)
console.log('APRÈS le swap (trait noir) :')
for (const l of a2?.lines.slice(0, 4) ?? []) console.log(`  ${l.notation} → ${l.score}`)
console.log(`score noir : ${a2?.scoreBlackCp} cp · profondeur ${a2?.depth}`)
