import { chromium } from 'playwright'

const URL = process.env.SHOT_URL || 'http://localhost:5273'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
await page.goto(URL, { waitUntil: 'networkidle' })

const center = (row, col) => ({ x: col * 70 + 35, y: row * 70 + 35 })
const click = async (row, col) => {
  await page.click('#board', { position: center(row, col) })
  await page.waitForTimeout(250)
}
const status = () => page.textContent('#status')
const banner = () => page.textContent('#banner')

// --- Partie différée ---
await page.click('#tile-local')
await page.check('#delayed')
await page.click('#new')

const moves = [
  [0, 4], [8, 0], [0, 4], [3, 4], [8, 1], [3, 4], [6, 4], [8, 2], [6, 4], [8, 4],
]
for (const [r, c] of moves) {
  await click(r, c)
  console.log(`clic (${r},${c}) →`, (await status())?.trim())
}

const st1 = (await status())?.trim()
console.log('après arrivée :', st1)
if (!st1?.includes('percée en attente')) throw new Error('la percée devrait être en attente')

await click(8, 3) // Blanc pose ailleurs (ne capture pas)
const b1 = (await banner())?.replace(/\s+/g, ' ').trim()
console.log('banner :', b1)
if (!b1?.includes('Noir gagne')) throw new Error('Noir devrait gagner par percée différée')

// --- Partie standard (toggle off) : arrivée = victoire immédiate ---
await page.uncheck('#delayed')
await page.click('#new')
await click(0, 4)
await click(8, 0)
await click(0, 4)
await click(3, 4)
await click(8, 1)
await click(3, 4)
await click(6, 4)
await click(8, 2)
await click(6, 4)
await click(8, 4)

const b2 = (await banner())?.replace(/\s+/g, ' ').trim()
console.log('banner standard :', b2)
if (!b2?.includes('Noir gagne')) throw new Error('Noir devrait gagner immédiatement en standard')

await browser.close()
console.log('OK — percée différée câblée correctement')
