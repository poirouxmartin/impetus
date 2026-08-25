import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
await p.goto('http://localhost:5273', { waitUntil: 'networkidle' })

const center = (row, col) => ({ x: col * 70 + 35, y: row * 70 + 35 })
// hotseat : Noir en bas (flipped) → rangée plateau r rendue à l'écran en 8 - r
const S = (r) => 8 - r
const click = async (row, col) => {
  await p.click('#board', { position: center(S(row), col) })
  await p.waitForTimeout(250)
}
const status = () => p.textContent('#status')
const banner = () => p.textContent('#banner')

// --- Percée différée (standard v1.2, case décochée) ---
await p.click('#tile-local')
await p.waitForTimeout(200)
await p.click('#new')
await p.waitForTimeout(200)

const moves = [
  [0, 4], [8, 0], [0, 4], [3, 4], [8, 1], [3, 4], [6, 4], [8, 2], [6, 4], [8, 4],
]
for (const [r, c] of moves) await click(r, c)

const st1 = (await status())?.trim()
console.log('après arrivée :', st1)
if (!st1?.includes('percée en attente')) throw new Error('la percée devrait être en attente')

await click(8, 3) // Blanc pose ailleurs (ne capture pas)
const b1 = (await banner())?.replace(/\s+/g, ' ').trim()
console.log('banner :', b1)
if (!b1?.includes('Noir gagne')) throw new Error('Noir devrait gagner par percée différée')

// --- Variante immédiate (case cochée) : arrivée = victoire instantanée ---
await p.check('#delayed')
await p.click('#new')
for (const [r, c] of moves) await click(r, c)

const b2 = (await banner())?.replace(/\s+/g, ' ').trim()
console.log('banner immédiate :', b2)
if (!b2?.includes('Noir gagne')) throw new Error('Noir devrait gagner immédiatement en variante')

await b.close()
console.log('OK — percée différée standard + variante immédiate câblées')
