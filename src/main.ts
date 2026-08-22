import '../style.css'
import {
  Action,
  Color,
  Destination,
  Dir,
  Game,
  SIZE,
  START_RESERVE,
  WinReason,
  idx,
  slideDestination,
} from './core/rules'
import { Level, chooseAction } from './core/ai'

const LOGICAL = 630
const CELL = LOGICAL / SIZE
const ANIM_MS = 160

const canvas = document.getElementById('board') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const statusEl = document.getElementById('status')!
const reservesEl = document.getElementById('reserves')!
const bannerEl = document.getElementById('banner')!
const bannerTitle = document.querySelector('#banner .title')!
const bannerSub = document.querySelector('#banner .sub')!
const sideLabel = document.getElementById('side-label') as HTMLElement
const levelLabel = document.getElementById('level-label') as HTMLElement
const newBtn = document.getElementById('new') as HTMLButtonElement
const undoBtn = document.getElementById('undo') as HTMLButtonElement
const swapBtn = document.getElementById('swap') as HTMLButtonElement
const modeSel = document.getElementById('mode') as HTMLSelectElement
const sideSel = document.getElementById('side') as HTMLSelectElement
const levelSel = document.getElementById('level') as HTMLSelectElement

const NAME: Record<Color, string> = { black: 'Noir', white: 'Blanc' }
const REASON: Record<WinReason, string> = {
  'percée': 'par percée',
  'anéantissement': 'par anéantissement',
  'immobilisation': 'par immobilisation',
}

interface Anim {
  color: Color
  from: [number, number]
  to: [number, number]
  captured: [number, number] | null
  start: number
}

let game = new Game()
let selected: number | null = null
let dests = new Map<Dir, Destination>()
let places: Set<number> = new Set()
let anim: Anim | null = null
let lastMove: { from: [number, number] | null; to: [number, number] } | null = null
let mode: 'ai' | 'hotseat' = 'ai'
let humanSide: Color = 'black'
let level: Level = 'normal'
let aiThinking = false

function stonesOnBoard(color: Color): number {
  let n = 0
  for (const c of game.position.cells) if (c === color) n++
  return n
}

function isAiTurn(): boolean {
  return mode === 'ai' && !game.winner && game.position.turn !== humanSide
}

function refresh(): void {
  places = game.placeSquares()
  const pos = game.position
  const w = game.winner

  sideLabel.hidden = levelLabel.hidden = mode !== 'ai'
  swapBtn.hidden = !(game.swapAvailable() && (mode === 'hotseat' || pos.turn === humanSide))
  undoBtn.disabled = !game.canUndo() || aiThinking

  if (w) {
    const reason = REASON[game.winnerReason ?? 'percée']
    statusEl.innerHTML =
      `<span class="winner">${NAME[w]} gagne</span><span class="reason">${reason}</span>`
    bannerTitle.textContent = `${NAME[w]} gagne`
    bannerSub.textContent = `${reason} · Nouvelle partie ?`
    bannerEl.hidden = false
  } else if (aiThinking) {
    statusEl.innerHTML = `L'IA réfléchit<span class="dots"></span>`
    bannerEl.hidden = true
  } else {
    statusEl.textContent = `Tour : ${NAME[pos.turn]}`
    bannerEl.hidden = true
  }

  reservesEl.innerHTML = pipRow('black') + pipRow('white')
}

function pipRow(color: Color): string {
  const reserve = game.position.reserves[color]
  const captured = START_RESERVE - reserve - stonesOnBoard(color)
  const filled = Array.from({ length: reserve }, () => `<span class="pip ${color}"></span>`).join('')
  const ghosts = Array.from({ length: captured }, () => '<span class="pip ghost"></span>').join('')
  const cap = captured > 0 ? `<span class="cap">−${captured}</span>` : ''
  return (
    `<div class="side-row"><span class="tag ${color}">${NAME[color]}</span>` +
    `<span class="pips">${filled}${ghosts}</span>${cap}</div>`
  )
}

function scheduleAi(): void {
  aiThinking = true
  refresh()
  setTimeout(() => {
    const action = chooseAction(game.position, level, game.legalMoves())
    aiThinking = false
    if (action) tryPlay(action)
    else refresh()
  }, 320)
}

function afterMove(): void {
  refresh()
  if (isAiTurn() && !aiThinking) scheduleAi()
}

function tryPlay(a: Action): void {
  let move: Omit<Anim, 'start'> | null = null
  let last: typeof lastMove = null
  if (a.kind === 'slide') {
    const d = slideDestination(game.position.cells, a.row, a.col, a.dir, game.position.turn)
    if (!d) return
    move = {
      color: game.position.turn,
      from: [a.row, a.col],
      to: [d.row, d.col],
      captured: d.capture ? [d.row, d.col] : null,
    }
    last = { from: [a.row, a.col], to: [d.row, d.col] }
  } else if (a.kind === 'place') {
    last = { from: null, to: [a.row, a.col] }
  }
  if (!game.play(a)) return
  if (move) anim = { ...move, start: performance.now() }
  lastMove = last
  selected = null
  dests = new Map()
  afterMove()
}

function resetView(): void {
  anim = null
  selected = null
  dests = new Map()
  lastMove = null
}

function center(r: number, c: number): [number, number] {
  return [c * CELL + CELL / 2, r * CELL + CELL / 2]
}

function stoneGradient(x: number, y: number, radius: number, color: Color): CanvasGradient {
  const grad = ctx.createRadialGradient(
    x - radius * 0.4,
    y - radius * 0.5,
    radius * 0.2,
    x,
    y,
    radius,
  )
  if (color === 'black') {
    grad.addColorStop(0, '#4a4f57')
    grad.addColorStop(1, '#101216')
  } else {
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, '#b9bdc4')
  }
  return grad
}

function drawStoneAt(x: number, y: number, color: Color, scale = 1): void {
  const radius = CELL * 0.38 * scale
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = stoneGradient(x, y, radius, color)
  ctx.fill()
  ctx.strokeStyle = color === 'black' ? '#000' : '#8a8e95'
  ctx.lineWidth = 1
  ctx.stroke()
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function render(now: number): void {
  requestAnimationFrame(render)
  ctx.clearRect(0, 0, LOGICAL, LOGICAL)

  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  ctx.fillRect(0, 0, LOGICAL, CELL)
  ctx.fillRect(0, (SIZE - 1) * CELL, LOGICAL, CELL)

  ctx.strokeStyle = '#343b45'
  ctx.lineWidth = 1
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath()
    ctx.moveTo(i * CELL + 0.5, 0)
    ctx.lineTo(i * CELL + 0.5, LOGICAL)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * CELL + 0.5)
    ctx.lineTo(LOGICAL, i * CELL + 0.5)
    ctx.stroke()
  }

  let k = 1
  if (anim) {
    const t = Math.min(1, (now - anim.start) / ANIM_MS)
    k = easeOut(t)
    if (t >= 1) anim = null
  }

  if (!game.winner && !anim) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    for (const i of places) {
      const [x, y] = center(Math.floor(i / SIZE), i % SIZE)
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const skip = anim ? idx(anim.to[0], anim.to[1]) : -1
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const color = game.position.cells[idx(r, c)]
      if (!color || idx(r, c) === skip) continue
      if (anim?.captured && anim.captured[0] === r && anim.captured[1] === c) {
        drawStoneAt(...center(r, c), color, Math.max(0, 1 - k))
        continue
      }
      drawStoneAt(...center(r, c), color)
    }
  }

  if (anim && k < 1) {
    const [x1, y1] = center(anim.from[0], anim.from[1])
    const [x2, y2] = center(anim.to[0], anim.to[1])
    drawStoneAt(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, anim.color)
  }

  if (lastMove && !anim) {
    const [tx, ty] = center(lastMove.to[0], lastMove.to[1])
    ctx.strokeStyle = 'rgba(126,231,135,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(tx, ty, CELL * 0.46, 0, Math.PI * 2)
    ctx.stroke()
    if (lastMove.from) {
      const [fx, fy] = center(lastMove.from[0], lastMove.from[1])
      ctx.strokeStyle = 'rgba(126,231,135,0.28)'
      ctx.beginPath()
      ctx.arc(fx, fy, CELL * 0.18, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  if (selected !== null && !anim) {
    const [sx, sy] = center(Math.floor(selected / SIZE), selected % SIZE)
    ctx.strokeStyle = '#7ee787'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(sx, sy, CELL * 0.42, 0, Math.PI * 2)
    ctx.stroke()
    for (const d of dests.values()) {
      const [dx, dy] = center(d.row, d.col)
      ctx.beginPath()
      ctx.arc(dx, dy, CELL * 0.16, 0, Math.PI * 2)
      ctx.fillStyle = d.capture ? 'rgba(255,107,107,0.85)' : 'rgba(126,231,135,0.75)'
      ctx.fill()
    }
  }
}

function hitCell(e: PointerEvent): { r: number; c: number } | null {
  const rect = canvas.getBoundingClientRect()
  const x = ((e.clientX - rect.left) * LOGICAL) / rect.width
  const y = ((e.clientY - rect.top) * LOGICAL) / rect.height
  const c = Math.floor(x / CELL)
  const r = Math.floor(y / CELL)
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null
  return { r, c }
}

canvas.addEventListener('pointerdown', (e) => {
  if (aiThinking || anim || game.winner || isAiTurn()) return
  const cell = hitCell(e)
  if (!cell) return
  const i = idx(cell.r, cell.c)

  const occ = game.position.cells[i]
  if (occ === game.position.turn) {
    const d = game.slideDestinations(cell.r, cell.c)
    if (d.size > 0) {
      if (selected === i) {
        selected = null
        dests = new Map()
      } else {
        selected = i
        dests = d
      }
      return
    }
  }

  if (selected !== null) {
    for (const [dir, d] of dests) {
      if (d.row === cell.r && d.col === cell.c) {
        tryPlay({ kind: 'slide', row: Math.floor(selected / SIZE), col: selected % SIZE, dir })
        return
      }
    }
  }

  if (places.has(i)) {
    tryPlay({ kind: 'place', row: cell.r, col: cell.c })
    return
  }

  selected = null
  dests = new Map()
})

swapBtn.addEventListener('click', () => {
  if (!aiThinking) tryPlay({ kind: 'swap' })
})

undoBtn.addEventListener('click', () => {
  if (aiThinking) return
  game.undo()
  if (mode === 'ai' && game.canUndo() && game.position.turn !== humanSide) game.undo()
  resetView()
  afterMove()
})

newBtn.addEventListener('click', () => {
  game = new Game()
  resetView()
  afterMove()
})

modeSel.addEventListener('change', () => {
  if (aiThinking) {
    modeSel.value = mode
    return
  }
  mode = modeSel.value as 'ai' | 'hotseat'
  afterMove()
})

sideSel.addEventListener('change', () => {
  if (aiThinking) {
    sideSel.value = humanSide
    return
  }
  humanSide = sideSel.value as Color
  afterMove()
})

levelSel.addEventListener('change', () => {
  level = levelSel.value as Level
})

refresh()
requestAnimationFrame(render)
