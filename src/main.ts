import '../style.css'
import {
  Action,
  Color,
  Destination,
  Dir,
  Game,
  SIZE,
  idx,
  slideDestination,
} from './core/rules'

const LOGICAL = 630
const CELL = LOGICAL / SIZE
const ANIM_MS = 160

const canvas = document.getElementById('board') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const statusEl = document.getElementById('status')!
const newBtn = document.getElementById('new') as HTMLButtonElement
const undoBtn = document.getElementById('undo') as HTMLButtonElement
const swapBtn = document.getElementById('swap') as HTMLButtonElement

const NAME: Record<Color, string> = { black: 'Noir', white: 'Blanc' }

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

function refresh(): void {
  places = game.placeSquares()
  swapBtn.hidden = !game.swapAvailable()
  undoBtn.disabled = !game.canUndo()
  const w = game.winner
  if (w) {
    statusEl.innerHTML = `<span class="winner">${NAME[w]} gagne !</span>`
  } else {
    const r = game.position.reserves
    statusEl.textContent = `Tour : ${NAME[game.position.turn]} · Réserves — Noir : ${r.black} · Blanc : ${r.white}`
  }
}

function tryPlay(a: Action): void {
  let move: Omit<Anim, 'start'> | null = null
  if (a.kind === 'slide') {
    const d = slideDestination(game.position.cells, a.row, a.col, a.dir, game.position.turn)
    if (!d) return
    move = {
      color: game.position.turn,
      from: [a.row, a.col],
      to: [d.row, d.col],
      captured: d.capture ? [d.row, d.col] : null,
    }
  }
  if (!game.play(a)) return
  if (move) anim = { ...move, start: performance.now() }
  selected = null
  dests = new Map()
  refresh()
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

  // Rangées de départ légèrement teintées
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  ctx.fillRect(0, 0, LOGICAL, CELL)
  ctx.fillRect(0, (SIZE - 1) * CELL, LOGICAL, CELL)

  // Grille
  ctx.strokeStyle = '#3a4049'
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

  // Progression de l'animation
  let k = 1
  if (anim) {
    const t = Math.min(1, (now - anim.start) / ANIM_MS)
    k = easeOut(t)
    if (t >= 1) anim = null
  }

  // Cases de pose possibles
  if (!game.winner && !anim) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    for (const i of places) {
      const [x, y] = center(Math.floor(i / SIZE), i % SIZE)
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Pierres
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

  // Pierre en mouvement
  if (anim && k < 1) {
    const [x1, y1] = center(anim.from[0], anim.from[1])
    const [x2, y2] = center(anim.to[0], anim.to[1])
    drawStoneAt(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, anim.color)
  }

  // Sélection et destinations
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

  // Voile de fin de partie
  if (game.winner) {
    ctx.fillStyle = 'rgba(10,12,15,0.45)'
    ctx.fillRect(0, 0, LOGICAL, LOGICAL)
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
  if (anim || game.winner) return
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

swapBtn.addEventListener('click', () => tryPlay({ kind: 'swap' }))

undoBtn.addEventListener('click', () => {
  game.undo()
  anim = null
  selected = null
  dests = new Map()
  refresh()
})

newBtn.addEventListener('click', () => {
  game = new Game()
  anim = null
  selected = null
  dests = new Map()
  refresh()
})

refresh()
requestAnimationFrame(render)
