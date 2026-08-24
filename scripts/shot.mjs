import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.SHOT_URL || 'http://localhost:5273'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
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

// 5 · mobile lobby
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
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
