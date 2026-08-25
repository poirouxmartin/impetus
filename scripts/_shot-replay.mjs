import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
p.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 300)))
p.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 300))
})
const demo = JSON.stringify([
  {
    id: 1,
    ts: Date.now(),
    level: 'normal',
    color: 'black',
    result: 'win',
    reason: 'par percée',
    plies: 6,
    clock: { cadence: '3 min + 2 s', left: { black: 142000, white: 96000 } },
    moves: [
      { kind: 'place', row: 0, col: 4 },
      { kind: 'place', row: 8, col: 0 },
      { kind: 'slide', row: 0, col: 4, dir: 'down' },
      { kind: 'place', row: 8, col: 1 },
      { kind: 'slide', row: 3, col: 4, dir: 'down' },
      { kind: 'slide', row: 8, col: 1, dir: 'right' },
    ],
  },
])
await p.addInitScript((d) => {
  localStorage.setItem('impetus.history.v1', d)
}, demo)
await p.goto('http://localhost:5273', { waitUntil: 'networkidle' })

// account card fix
await p.click("[data-view='history']")
await p.waitForTimeout(200)
await p.click('#hist-body button.mini')
await p.waitForTimeout(300)
await p.screenshot({ path: 'shots/check-replay.png', clip: { x: 180, y: 80, width: 800, height: 800 } })

// gap jeu + account padding
await p.click('#room-code', { force: true }).catch(() => {})
await b.close()
