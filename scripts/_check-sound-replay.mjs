import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
const errors = []
p.on('pageerror', (e) => errors.push(String(e)))
p.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
const demo = JSON.stringify([
  {
    id: 1,
    ts: Date.now(),
    level: 'normal',
    color: 'black',
    result: 'win',
    reason: 'par percée',
    plies: 3,
    moves: [
      { kind: 'place', row: 0, col: 4 },
      { kind: 'place', row: 8, col: 0 },
      { kind: 'slide', row: 0, col: 4, dir: 'down' },
    ],
  },
])
await p.addInitScript((d) => {
  localStorage.setItem('impetus.history.v1', d)
}, demo)
await p.goto('http://localhost:5273', { waitUntil: 'networkidle' })

// partie rapide hotseat : 2 coups
await p.click('#tile-local')
await p.waitForTimeout(300)
const S = (r) => 8 - r
await p.click('#board', { position: { x: 4 * 70 + 35, y: S(0) * 70 + 35 } })
await p.waitForTimeout(200)
await p.click('#board', { position: { x: 0 * 70 + 35, y: S(8) * 70 + 35 } })
await p.waitForTimeout(200)

// audio : contexte créé et running après geste utilisateur
const audio = await p.evaluate(() => {
  const AC = window.AudioContext
  return AC ? 'AudioContext disponible' : 'absent'
})
console.log('audio:', audio)

// replay : ouvrir l'historique, naviguer au clavier
await p.click("[data-view='history']")
await p.waitForTimeout(200)
await p.click('#hist-body button.mini')
await p.waitForTimeout(200)
const info0 = await p.textContent('#rp-info')
await p.keyboard.press('ArrowRight')
await p.keyboard.press('ArrowRight')
const info2 = await p.textContent('#rp-info')
await p.keyboard.press('End')
const infoEnd = await p.textContent('#rp-info')
await p.keyboard.press('Home')
const infoHome = await p.textContent('#rp-info')
console.log('replay:', { info0, info2, infoEnd, infoHome })

console.log('erreurs console:', errors.length ? errors : 'aucune')
await b.close()
