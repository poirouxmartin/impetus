import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.SHOT_URL || 'http://localhost:5273'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

// Données de démonstration pour les captures historique / profil
const now = Date.now()
const demoProfile = {
  pseudo: 'Marc',
  created: now - 45 * 864e5,
  levels: {
    facile: { rating: 742, wins: 5, losses: 2, draws: 0 },
    normal: { rating: 1236, wins: 12, losses: 9, draws: 1 },
    difficile: { rating: 1602, wins: 3, losses: 11, draws: 0 },
  },
  curve: {
    facile: [700, 716, 708, 731, 724, 740, 748, 742],
    normal: [1200, 1184, 1201, 1224, 1210, 1236, 1218, 1229, 1236],
    difficile: [1650, 1634, 1618, 1627, 1641, 1625, 1610, 1596, 1602],
  },
}
const demoGames = [
  { result: 'win', level: 'difficile', color: 'black', reason: 'par percée', plies: 41, ago: 2 },
  { result: 'loss', level: 'difficile', color: 'white', reason: 'par percée', plies: 57, ago: 5 },
  { result: 'win', level: 'normal', color: 'white', reason: 'par anéantissement', plies: 33, ago: 26 },
  { result: 'loss', level: 'normal', color: 'black', reason: 'par immobilisation', plies: 72, ago: 30 },
  { result: 'win', level: 'normal', color: 'black', reason: 'par percée', plies: 28, ago: 52 },
  { result: 'draw', level: 'facile', color: 'black', reason: 'par immobilisation', plies: 100, ago: 74 },
  { result: 'win', level: 'facile', color: 'white', reason: 'par anéantissement', plies: 19, ago: 96 },
].map((g, i) => ({
  id: i + 1,
  ts: now - g.ago * 36e5,
  level: g.level,
  color: g.color,
  result: g.result,
  reason: g.reason,
  plies: g.plies,
  moves: [],
}))
const seedStorage = {
  profile: JSON.stringify(demoProfile),
  games: JSON.stringify(demoGames),
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
await page.addInitScript(
  (s) => {
    localStorage.setItem('impetus.profile.v1', s.profile)
    localStorage.setItem('impetus.history.v1', s.games)
  },
  seedStorage,
)
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

// 1 · lobby desktop, thème sombre
await page.screenshot({ path: `${OUT}/1-lobby-dark.png` })

// 2 · lobby desktop, thème clair
await page.click('#theme-toggle')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/2-lobby-light.png` })
await page.click('#theme-toggle')
await page.waitForTimeout(300)

// 3 · vue de partie contre l'IA
await page.click('#tile-ai')
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/3-game-dark.png` })

// 4 · partie, thème clair
await page.click('#theme-toggle')
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/4-game-light.png` })
await page.click('#theme-toggle')
await page.waitForTimeout(200)

// 7 · historique desktop
await page.click("[data-view='history']")
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/7-history-dark.png` })

// 8 · profil desktop
await page.click("[data-view='profile']")
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/8-profile-dark.png` })

// 5 · mobile lobby
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mob.addInitScript(
  (s) => {
    localStorage.setItem('impetus.profile.v1', s.profile)
    localStorage.setItem('impetus.history.v1', s.games)
  },
  seedStorage,
)
await mob.goto(URL, { waitUntil: 'networkidle' })
await mob.waitForTimeout(400)
await mob.screenshot({ path: `${OUT}/5-lobby-mobile.png`, fullPage: true })

// 6 · mobile partie
await mob.click('#tile-ai')
await mob.waitForTimeout(400)
const el = await mob.evaluate(() => {
  const e = document.elementFromPoint(14, 118)
  return e ? `${e.tagName}.${e.className} « ${e.textContent?.slice(0, 40)} »` : 'null'
})
console.log('artefact mobile (14,118) →', el)
await mob.screenshot({ path: `${OUT}/6-game-mobile.png`, fullPage: true })

await browser.close()
console.log('screenshots écrits dans', OUT)

