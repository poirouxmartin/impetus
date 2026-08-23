import { applyAction, Color, initialState, type Position } from '../core/rules'
import type { Action } from '../core/rules'
import type { GameRecord } from '../platform/store'

const N = 9
const CELL = 52

export class ReplayViewer {
  private positions: Position[] = []
  private index = 0
  private timer: number | null = null
  private ctx: CanvasRenderingContext2D

  constructor(
    canvas: HTMLCanvasElement,
    private infoEl: HTMLElement,
  ) {
    this.ctx = canvas.getContext('2d')!
  }

  load(record: GameRecord): void {
    this.stop()
    let pos = initialState()
    const list: Position[] = [pos]
    for (const raw of record.moves) {
      const m = raw as Action
      pos = applyAction(pos, m)
      list.push(pos)
    }
    this.positions = list
    this.index = 0
    this.render()
    this.info()
  }

  get total(): number {
    return this.positions.length - 1
  }

  go(i: number): void {
    this.stop()
    this.index = Math.max(0, Math.min(this.total, i))
    this.render()
    this.info()
  }

  step(delta: number): void {
    this.go(this.index + delta)
  }

  toggle(): void {
    if (this.timer !== null) this.stop()
    else this.timer = window.setInterval(() => {
      if (this.index >= this.total) this.stop()
      else {
        this.index++
        this.render()
        this.info()
      }
    }, 650)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private info(): void {
    this.infoEl.textContent = `coup ${this.index} / ${this.total}`
  }

  private drawStone(x: number, y: number, color: Color): void {
    const radius = CELL * 0.38
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color === 'black' ? '#15181d' : '#eceae6'
    ctx.fill()
    ctx.strokeStyle = color === 'black' ? '#000' : '#7a7f87'
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
    ctx.fillStyle = '#171b22'
    ctx.fillRect(0, 0, logical, logical)

    if (this.index > 0) {
      const prev = this.positions[this.index - 1]
      const cur = this.positions[this.index]
      for (let i = 0; i < cur.cells.length; i++) {
        if (prev.cells[i] !== cur.cells[i]) {
          const [x, y] = this.center(Math.floor(i / N), i % N)
          ctx.fillStyle = 'rgba(126,231,135,0.18)'
          ctx.fillRect((i % N) * CELL + 1, Math.floor(i / N) * CELL + 1, CELL - 2, CELL - 2)
          void x
          void y
        }
      }
    }

    ctx.strokeStyle = '#333944'
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
  if (a.kind === 'place') return `poser ${sq(a.row, a.col)}`
  if (a.kind === 'swap') return 'swap'
  return `${sq(a.row, a.col)}→${a.dir}`
}
