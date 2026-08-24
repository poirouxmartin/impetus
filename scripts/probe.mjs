import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://localhost:5273', { waitUntil: 'networkidle' })
await page.click('#tile-ai')
await page.waitForTimeout(400)

const found = await page.evaluate(() => {
  const hits = []
  for (const el of document.querySelectorAll('*')) {
    const t = (el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && /—|–/.test(n.textContent ?? ''))) ? (el.textContent ?? '').trim().slice(0, 30) : null
    if (t === null) continue
    const r = el.getBoundingClientRect()
    if (r.top >= 90 && r.top <= 140 && r.left <= 60) {
      hits.push(`${el.tagName}.${el.className} rect=${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)} hidden=${el.hidden} display=${getComputedStyle(el).display} texte="${t}"`)
    }
  }
  return hits
})
console.log(found.join('\n') || 'aucun élément avec tiret dans la zone')
await browser.close()
