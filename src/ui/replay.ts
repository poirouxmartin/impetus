import { applyAction, Color, initialState, type Position } from '../core/rules'
import type { Action } from '../core/rules'
import type { GameRecord } from '../platform/store'
import { BOARD, currentTheme } from './theme'
import { t } from './i18n'
import { evaluate } from '../core/ai'
import { slideDestination } from '../core/rules'
import {
  playCapture,
  playPlace,
  playSlide,
} from './sound'

const N = 9
const CELL = 52

export interface ReplayNames {
  top: string
  bottom: string
  topColor: Color
  bottomColor: Color
}

export interface ReplayElements {
  infoEl: HTMLElement
  nameTopEl: HTMLElement
  nameBottomEl: HTMLElement
  avatarTopEl: HTMLElement
  avatarBottomEl: HTMLElement
  clockTopEl: HTMLElement
  clockBottomEl: HTMLElement
  evalCanvas: HTMLCanvasElement
}

const AVATAR_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8"/></svg>'

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export class ReplayViewer {
  private positions: Position[] = []
  private moves: Action[] = []
  private index = 0
  private timer: number | null = null
  private ctx: CanvasRenderingContext2D
  private els: ReplayElements

  constructor(
    canvas: HTMLCanvasElement,
    els: ReplayElements,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.els = els
    this.els.avatarTopEl.innerHTML = AVATAR_SVG
    this.els.avatarBottomEl.innerHTML = AVATAR_SVG
    this.els.evalCanvas.addEventListener('pointerdown', (e) => {
      const rect = this.els.evalCanvas.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      this.go(Math.round(ratio * this.total))
    })
  }

  load(record: GameRecord, names: ReplayNames): void {
    this.stop()
    let pos = initialState()
    const list: Position[] = [pos]
    for (const raw of record.moves) {
      const m = raw as Action
      pos = applyAction(pos, m)
      list.push(pos)
    }
    this.positions = list
    this.moves = record.moves as Action[]
    this.index = 0
    // bannières : le joueur (record.color) en bas
    this.els.nameTopEl.textContent = names.top
    this.els.nameBottomEl.textContent = names.bottom
    this.els.avatarTopEl.dataset.color = names.topColor
    this.els.avatarBottomEl.dataset.color = names.bottomColor
    const clocks = record.clock
    this.els.clockTopEl.hidden = !clocks
    this.els.clockBottomEl.hidden = !clocks
    if (clocks) {
      this.els.clockTopEl.textContent = fmtClock(clocks.left[names.topColor])
      this.els.clockBottomEl.textContent = fmtClock(clocks.left[names.bottomColor])
    }
    this.render()
    this.info()
    this.drawEval()
  }

  get total(): number {
    return this.positions.length - 1
  }

  go(i: number, withSound = false): void {
    this.stop()
    const next = Math.max(0, Math.min(this.total, i))
    if (withSound && Math.abs(next - this.index) === 1) this.playMoveSound(next)
    this.index = next
    this.render()
    this.info()
    this.drawEval()
  }

  step(delta: number): void {
    this.go(this.index + delta, true)
  }

  toggle(): void {
    if (this.timer !== null) this.stop()
    else
      this.timer = window.setInterval(() => {
        if (this.index >= this.total) this.stop()
        else this.go(this.index + 1, true)
      }, 650)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Son du coup qui mène à la position `index` (place/slide/capture). */
  private playMoveSound(index: number): void {
    const m = this.moves[index - 1]
    if (!m || index < 1) return
    if (m.kind === 'place') playPlace()
    else if (m.kind === 'slide') {
      const prev = this.positions[index - 1]
      const dest = slideDestination(prev.cells, m.row, m.col, m.dir, prev.turn)
      if (dest?.capture) playCapture()
      else playSlide()
    }
  }

  private info(): void {
    this.els.infoEl.textContent = t('replay.info', { i: this.index, total: this.total })
  }

  /** Courbe d'évaluation statique coup par coup, cliquable. */
  private drawEval(): void {
    const cv = this.els.evalCanvas
    const ctx = cv.getContext('2d')!
    if (cv.clientWidth && cv.width !== cv.clientWidth) cv.width = cv.clientWidth
    const w = cv.width
    const h = cv.height
    const T = BOARD[currentTheme()]
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, w, h)
    const n = this.positions.length
    if (n < 2) return
    const yOf = (cp: number): number => {
      const v = Math.tanh(cp / 450)
      return h / 2 - v * (h / 2 - 6)
    }
    // axe médian
    ctx.strokeStyle = T.line
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    // courbe
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const cp = evaluate(this.positions[i], 'black')
      const x = (i / (n - 1)) * (w - 8) + 4
      const y = yOf(cp)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = currentTheme() === 'dark' ? '#D4AF6E' : '#8A3120'
    ctx.lineWidth = 2
    ctx.stroke()
    // marqueur de position courante
    const mx = (this.index / (n - 1)) * (w - 8) + 4
    const my = yOf(evaluate(this.positions[this.index], 'black'))
    ctx.beginPath()
    ctx.arc(mx, my, 4, 0, Math.PI * 2)
    ctx.fillStyle = currentTheme() === 'dark' ? '#D4AF6E' : '#8A3120'
    ctx.fill()
  }

  private drawStone(x: number, y: number, color: Color): void {
    const radius = CELL * 0.38
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    const T = BOARD[currentTheme()]
    ctx.fillStyle = color === 'black' ? T.blackG1 : T.whiteG0
    ctx.fill()
    ctx.strokeStyle = color === 'black' ? T.blackRim : T.whiteRim
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private center(r: number, c: number): [number, number] {
    return [c * CELL + CELL / 2, r * CELL + CELL / 2]
  }

  private render(): void {
    const ctx = this.ctx
    const logical = N * CELL
    ctx.clearRect(0, 0, logical, logical)
    const T = BOARD[currentTheme()]
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, logical, logical)

    if (this.index > 0) {
      const prev = this.positions[this.index - 1]
      const cur = this.positions[this.index]
      for (let i = 0; i < cur.cells.length; i++) {
        if (prev.cells[i] !== cur.cells[i]) {
          ctx.fillStyle = 'rgba(126,231,135,0.18)'
          ctx.fillRect((i % N) * CELL + 1, Math.floor(i / N) * CELL + 1, CELL - 2, CELL - 2)
        }
      }
    }

    ctx.strokeStyle = BOARD[currentTheme()].line
    ctx.lineWidth = 1
    for (let i = 0; i <= N; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL + 0.5, 0)
      ctx.lineTo(i * CELL + 0.5, logical)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL + 0.5)
      ctx.lineTo(logical, i * CELL + 0.5)
      ctx.stroke()
    }

    const cells = this.positions[this.index].cells
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      if (!c) continue
      this.drawStone(...this.center(Math.floor(i / N), i % N), c)
    }
  }
}

export function replayNotation(a: Action): string {
  const sq = (r: number, c: number): string => 'abcdefghi'[c] + (r + 1)
  if (a.kind === 'place') return `${t('notation.place')} ${sq(a.row, a.col)}`
  if (a.kind === 'swap') return 'swap'
  return `${sq(a.row, a.col)}→${a.dir}`
}
