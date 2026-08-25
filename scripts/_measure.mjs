import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 900 } })
await p.goto('http://localhost:5273', { waitUntil: 'networkidle' })
const lobby = await p.evaluate(() => {
  const card = document.querySelector('.auth-card')
  const cs = getComputedStyle(card)
  const input = document.getElementById('auth-name')
  const cardRect = card.getBoundingClientRect()
  const inputRect = input.getBoundingClientRect()
  return {
    cardPadding: cs.padding,
    cardWidth: card.offsetWidth,
    inputLeft: inputRect.left - cardRect.left,
    inputRight: cardRect.right - inputRect.right,
    inputWidth: input.offsetWidth,
  }
})
console.log('account:', JSON.stringify(lobby))
await p.click('#tile-ai')
await p.waitForTimeout(300)
const game = await p.evaluate(() => {
  const wrap = document.getElementById('game-wrap')
  const col = document.getElementById('board-column')
  const panel = document.getElementById('panel')
  const colRect = col.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  return {
    wrapGap: getComputedStyle(wrap).gap,
    gapColPanel: panelRect.left - colRect.right,
    boardRight: colRect.right,
    panelLeft: panelRect.left,
  }
})
console.log('game:', JSON.stringify(game))
await b.close()
