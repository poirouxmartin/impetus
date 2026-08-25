import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } })
await p.goto('http://localhost:5273', { waitUntil: 'networkidle' })
await p.click("[data-view='rules']")
await p.waitForTimeout(300)
await p.screenshot({ path: 'shots/check-rules.png' })
await b.close()
