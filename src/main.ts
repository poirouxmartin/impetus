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
  other,
  slideDestination,
} from './core/rules'
import { Level, chooseAction } from './core/ai'
import { Analysis as EngineAnalysis, analyse } from './core/engine'
import {
  GameRecord,
  LevelKey,
  StorageLike,
  applyResult,
  emptyProfile,
  loadHistory,
  loadProfile,
  saveHistory,
  saveProfile,
} from './platform/store'
import { ReplayViewer } from './ui/replay'
import { renderHistory, renderRatings } from './ui/profile'
import { connectNet, type NetClient, type ServerMsg } from './net/client'

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
const liveCb = document.getElementById('live') as HTMLInputElement
const evalLineEl = document.getElementById('eval-line')!
const linesEl = document.getElementById('lines')!
const infoEl = document.getElementById('engine-info')!
const barWhite = document.getElementById('evalbar-white')!
const histBody = document.getElementById('hist-body')!
const replayCanvas = document.getElementById('replay-canvas') as HTMLCanvasElement
const replayInfo = document.getElementById('rp-info')!
const replayCard = document.getElementById('replay-card') as HTMLElement
const pseudoInput = document.getElementById('pseudo-input') as HTMLInputElement
const pseudoSave = document.getElementById('pseudo-save') as HTMLButtonElement
const ratingsList = document.getElementById('ratings-list')!
const resetStats = document.getElementById('reset-stats') as HTMLButtonElement
const onlineGroup = document.getElementById('online-group') as HTMLElement
const netStatusEl = document.getElementById('net-status')!
const roomCodeInput = document.getElementById('room-code') as HTMLInputElement
const roomCreate = document.getElementById('room-create') as HTMLButtonElement
const roomJoin = document.getElementById('room-join') as HTMLButtonElement
const resignBtn = document.getElementById('resign') as HTMLButtonElement
const authZone = document.getElementById('auth-zone') as HTMLElement
const authNameInput = document.getElementById('auth-name') as HTMLInputElement
const authPassInput = document.getElementById('auth-pass') as HTMLInputElement
const authLoginBtn = document.getElementById('auth-login') as HTMLButtonElement
const authRegisterBtn = document.getElementById('auth-register') as HTMLButtonElement
const authStatusEl = document.getElementById('auth-status')!
const clkBlack = document.getElementById('clk-black') as HTMLElement
const clkWhite = document.getElementById('clk-white') as HTMLElement
const clocksEl = document.getElementById('clocks') as HTMLElement
const clockSel = document.getElementById('clock-sel') as HTMLSelectElement
const quickBtn = document.getElementById('quick') as HTMLButtonElement
const rematchBtn = document.getElementById('rematch') as HTMLButtonElement

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
let mode: 'ai' | 'hotseat' | 'online' = 'ai'
let humanSide: Color = 'black'
let level: Level = 'normal'
let aiThinking = false
let analysis: EngineAnalysis | null = null
let liveOn = false
let online: { net: NetClient; code: string; color: Color; oppName: string } | null = null
let currentNet: NetClient | null = null
let clockSnap: { black: number; white: number; ts: number; turn: Color; running: boolean } | null = null
let inQueue = false

const store: StorageLike = window.localStorage
let profile = loadProfile(store)
let historyRecords = loadHistory(store)
let gameId = 1
let recorded = false
let movesLog: Action[] = []

interface AuthState {
  token: string
  name: string
  rating: number
}
let auth: AuthState | null = (() => {
  try {
    const raw = store.getItem('impetus.auth.v1')
    return raw ? (JSON.parse(raw) as AuthState) : null
  } catch {
    return null
  }
})()

function saveAuth(): void {
  if (auth) store.setItem('impetus.auth.v1', JSON.stringify(auth))
  else store.removeItem('impetus.auth.v1')
}

function renderAuthZone(): void {
  if (auth) {
    authZone.innerHTML = `<div class="authed-line"><span>👤 ${auth.name}</span><span class="elo">${auth.rating}</span></div>`
    authStatusEl.textContent = 'Compte connecté — parties rapides classées.'
    authStatusEl.className = 'ok'
  }
}

function handleAuthOk(token: string, p: { name: string; rating: number }): void {
  auth = { token, name: p.name, rating: p.rating }
  saveAuth()
  renderAuthZone()
}

const replayer = new ReplayViewer(replayCanvas, replayInfo)

function stonesOnBoard(color: Color): number {
  let n = 0
  for (const c of game.position.cells) if (c === color) n++
  return n
}

function isAiTurn(): boolean {
  return mode === 'ai' && !game.winner && game.position.turn !== humanSide
}

function currentLevelKey(): LevelKey {
  if (mode === 'online') return 'online'
  return mode === 'ai' ? level : 'hotseat'
}

function displayName(color: Color): string {
  if (mode === 'online' && online) {
    return `${NAME[color]} (${color === online.color ? 'toi' : online.oppName || 'adversaire'})`
  }
  return NAME[color]
}

function netStatus(text: string): void {
  netStatusEl.textContent = text
}

const NET_PORT = 8787

function netUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.hostname}:${NET_PORT}`
}

function canLocalPlay(): boolean {
  if (anim || aiThinking || game.winner) return false
  if (mode === 'ai') return !isAiTurn()
  if (mode === 'online') return !!online && game.position.turn === online.color
  return true
}

function submitAction(a: Action): void {
  if (mode === 'online' && online) {
    online.net.send({ type: 'move', action: a })
    return
  }
  tryPlay(a)
}

function handleNet(msg: ServerMsg): void {
  switch (msg.type) {
    case 'auth-ok':
      handleAuthOk(msg.token, msg.profile)
      return
    case 'auth-error':
      authStatusEl.textContent = `⚠ ${msg.message}`
      authStatusEl.className = ''
      return
    case 'ranked':
      if (auth) {
        auth.rating = msg.rating
        saveAuth()
        renderAuthZone()
      }
      netStatus(`Partie classée : ${msg.delta > 0 ? '+' : ''}${msg.delta} Elo → ${msg.rating}`)
      return
    case 'joined':
      if (!currentNet) return
      online = { net: currentNet, code: msg.code, color: msg.color, oppName: msg.oppName }
      humanSide = msg.color
      game = new Game()
      movesLog = []
      recorded = false
      resetView()
      if (msg.state.clock) {
        clockSnap = { ...msg.state.clock, turn: msg.state.turn, running: !game.winner }
      } else clockSnap = null
      if (msg.myRating != null && auth) {
        auth.rating = msg.myRating
        saveAuth()
      }
      refresh()
      netStatus(
        online.oppName
          ? `Salon ${msg.code} · adversaire : ${online.oppName}`
          : `Salon ${msg.code} — en attente d'un adversaire…`,
      )
      break
    case 'move':
    case 'ack':
      tryPlay(msg.action)
      if (msg.clock) clockSnap = { ...msg.clock, turn: game.position.turn, running: !game.winner }
      break
    case 'state':
      if (msg.clock && !game.winner) {
        clockSnap = { ...msg.clock, turn: game.position.turn, running: true }
      }
      break
    case 'gameover':
      game.winner = msg.winner
      game.winnerReason = msg.reason as WinReason
      if (clockSnap) clockSnap.running = false
      refresh()
      break
    case 'queued':
      inQueue = true
      quickBtn.textContent = '✕ Annuler la recherche'
      netStatus(`Recherche d'un adversaire… (${msg.count ?? 1} en file)`)
      break
    case 'queue-left':
      inQueue = false
      quickBtn.textContent = '⚡ Partie rapide'
      netStatus('Recherche annulée.')
      break
    case 'rematch-wait':
      netStatus('Revanche proposée — en attente de l’adversaire…')
      break
    case 'oppJoined':
      if (online) online.oppName = msg.name
      netStatus(`${msg.name} a rejoint la partie`)
      refresh()
      break
    case 'opponentLeft':
      netStatus('Adversaire déconnecté')
      if (!game.winner) {
        bannerTitle.textContent = 'Partie interrompue'
        bannerSub.textContent = "L'adversaire s'est déconnecté"
        bannerEl.hidden = false
      }
      break
    case 'error':
      netStatus(`⚠ ${msg.message}`)
      break
    default:
      break
  }
}

function openNet(): void {
  if (online) {
    online.net.close()
    online = null
  } else if (currentNet) {
    currentNet.close()
  }
  const wasAuth = auth?.token
  currentNet = connectNet(
    netUrl(),
    handleNet,
    () => {
      if (wasAuth) currentNet!.send({ type: 'auth', token: wasAuth })
    },
    () => {
      if (online && !game.winner) {
        online = null
        netStatus('Connexion perdue')
      }
    },
  )
}

function leaveOnline(): void {
  if (online) online.net.close()
  else currentNet?.close()
  online = null
  currentNet = null
}

function refresh(): void {
  places = game.placeSquares()
  const pos = game.position
  const w = game.winner

  sideLabel.hidden = levelLabel.hidden = mode !== 'ai'
  swapBtn.hidden = !(game.swapAvailable() && (mode === 'hotseat' || pos.turn === humanSide))
  undoBtn.disabled = !game.canUndo() || aiThinking || mode === 'online'

  if (w) {
    const reasonText = (game.winnerReason && REASON[game.winnerReason]) || game.winnerReason || 'victoire'
    let eloNote = ''
    if (!recorded) {
      const result: 'win' | 'loss' =
        mode === 'ai' ? (w === humanSide ? 'win' : 'loss') : 'win'
      const colorForRecord: Color = mode === 'ai' ? humanSide : 'black'
      const delta = applyResult(profile, currentLevelKey(), result)
      saveProfile(store, profile)
      const rec: GameRecord = {
        id: gameId,
        ts: Date.now(),
        level: currentLevelKey(),
        color: colorForRecord,
        result,
        reason: reasonText,
        plies: pos.moveCount,
        moves: movesLog,
      }
      historyRecords.unshift(rec)
      saveHistory(store, historyRecords)
      recorded = true
      if (delta !== 0) eloNote = ` · ${delta > 0 ? '+' : ''}${delta} Elo`
    }
    statusEl.innerHTML =
      `<span class="winner">${displayName(w)} gagne</span><span class="reason"> — ${reasonText}</span>`
    bannerTitle.textContent = `${displayName(w)} gagne`
    bannerSub.textContent = `${reasonText}${eloNote} · Nouvelle partie ?`
    bannerEl.hidden = false
  } else if (aiThinking) {
    statusEl.innerHTML = `L'IA réfléchit<span class="dots"></span>`
    bannerEl.hidden = true
  } else {
    statusEl.textContent =
      mode === 'online' && online
        ? `Toi : ${displayName(online.color)} · Trait : ${displayName(pos.turn)}`
        : `Tour : ${NAME[pos.turn]}`
    bannerEl.hidden = true
  }

  resignBtn.hidden = !(mode === 'online' && online && !w)
  rematchBtn.hidden = !(mode === 'online' && online && !!w)
  clocksEl.hidden = mode !== 'online' || !clockSnap

  reservesEl.innerHTML = pipRow('black') + pipRow('white')
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function renderClocks(): void {
  if (mode !== 'online' || !clockSnap) return
  const now = Date.now()
  const live = (color: Color): number => {
    const base = color === 'black' ? clockSnap!.black : clockSnap!.white
    const running = clockSnap!.running && clockSnap!.turn === color
    return Math.max(0, base - (running ? now - clockSnap!.ts : 0))
  }
  const b = live('black')
  const w = live('white')
  clkBlack.textContent = fmtClock(b)
  clkWhite.textContent = fmtClock(w)
  clkBlack.classList.toggle('active', clockSnap.turn === 'black' && clockSnap.running)
  clkWhite.classList.toggle('active', clockSnap.turn === 'white' && clockSnap.running)
  clkBlack.classList.toggle('low', b < 20000)
  clkWhite.classList.toggle('low', w < 20000)
}

setInterval(renderClocks, 250)

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
    let action: Action | null = null
    const legal = game.legalMoves()
    if (level === 'difficile') {
      const a = analyse(game.position, 900)
      const keyOf = (x: Action): string => JSON.stringify(x)
      const legalKeys = new Set(legal.map(keyOf))
      action =
        a?.lines.find((l) => legalKeys.has(keyOf(l.action)))?.action ??
        chooseAction(game.position, 'normal', legal)
    } else {
      action = chooseAction(game.position, level, legal)
    }
    aiThinking = false
    if (action) tryPlay(action)
    else refresh()
  }, 320)
}

function afterMove(): void {
  refresh()
  analysis = null
  updateAnalysisPanel()
  if (isAiTurn() && !aiThinking) {
    scheduleAi()
    return
  }
  syncAnalysis()
}

let analysisWorker: Worker | null = null
let analysisGen = 0

function clonePos(): typeof game.position {
  return {
    ...game.position,
    cells: [...game.position.cells],
    reserves: { ...game.position.reserves },
  }
}

function ensureWorker(): Worker {
  if (!analysisWorker) {
    analysisWorker = new Worker(new URL('./core/analysis.worker.ts', import.meta.url), {
      type: 'module',
    })
    analysisWorker.onmessage = (e) => {
      const msg = e.data as { type: string; gen?: number; analysis?: EngineAnalysis }
      if (msg.type === 'progress' && msg.gen === analysisGen && msg.analysis) {
        analysis = msg.analysis
        updateAnalysisPanel()
      }
    }
  }
  return analysisWorker
}

function syncAnalysis(): void {
  const shouldRun = liveOn && !game.winner && !aiThinking && !isAiTurn()
  if (!shouldRun) {
    if (analysisWorker) {
      analysisGen++
      analysisWorker.postMessage({ type: 'stop', gen: analysisGen })
    }
    return
  }
  const w = ensureWorker()
  analysisGen++
  w.postMessage({ type: 'analyse', gen: analysisGen, pos: clonePos() })
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
  } else if (a.kind === 'swap') {
    const originIdx = game.position.cells.findIndex((c) => c !== null)
    if (originIdx >= 0) {
      const or = Math.floor(originIdx / SIZE)
      const oc = originIdx % SIZE
      move = {
        color: other(game.position.turn),
        from: [or, oc],
        to: [SIZE - 1 - or, SIZE - 1 - oc],
        captured: null,
      }
      last = { from: [or, oc], to: move.to }
    }
  }
  if (!game.play(a)) return
  movesLog.push(a)
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

function drawArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const shrink = CELL * 0.34
  const ex = x2 - (dx / len) * shrink
  const ey = y2 - (dy / len) * shrink
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1 + (dx / len) * shrink * 0.6, y1 + (dy / len) * shrink * 0.6)
  ctx.lineTo(ex, ey)
  ctx.stroke()
  const head = CELL * 0.22
  const ang = Math.atan2(dy, dx)
  ctx.beginPath()
  ctx.moveTo(x2 - (dx / len) * (shrink - head * 0.4), y2 - (dy / len) * (shrink - head * 0.4))
  ctx.lineTo(ex - Math.sin(ang) * head * 0.7, ey + Math.cos(ang) * head * 0.7)
  ctx.lineTo(ex + Math.sin(ang) * head * 0.7, ey - Math.cos(ang) * head * 0.7)
  ctx.closePath()
  ctx.fill()
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

  if (analysis && liveOn && !anim && selected === null && !game.winner) {
    const b = analysis.best
    if (b && b.action.kind === 'slide') {
      const dest = slideDestination(
        game.position.cells,
        b.action.row,
        b.action.col,
        b.action.dir,
        game.position.turn,
      )
      if (dest) {
        drawArrow(
          ...center(b.action.row, b.action.col),
          ...center(dest.row, dest.col),
          'rgba(126,231,135,0.85)',
          CELL * 0.12,
        )
      }
    } else if (b && b.action.kind === 'place') {
      const [px, py] = center(b.action.row, b.action.col)
      ctx.strokeStyle = 'rgba(126,231,135,0.8)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(px, py, CELL * 0.3, 0, Math.PI * 2)
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
  if (!canLocalPlay()) return
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
        submitAction({ kind: 'slide', row: Math.floor(selected / SIZE), col: selected % SIZE, dir })
        return
      }
    }
  }

  if (places.has(i)) {
    submitAction({ kind: 'place', row: cell.r, col: cell.c })
    return
  }

  selected = null
  dests = new Map()
})

swapBtn.addEventListener('click', () => {
  if (canLocalPlay()) submitAction({ kind: 'swap' })
})

liveCb.addEventListener('change', () => {
  liveOn = liveCb.checked
  analysis = null
  updateAnalysisPanel()
  syncAnalysis()
})

undoBtn.addEventListener('click', () => {
  if (aiThinking || mode === 'online') return
  game.undo()
  if (mode === 'ai' && game.canUndo() && game.position.turn !== humanSide) game.undo()
  movesLog.length = Math.min(movesLog.length, game.position.moveCount)
  resetView()
  afterMove()
})

newBtn.addEventListener('click', () => {
  if (mode === 'online') {
    netStatus('Utilise « Abandonner » pour quitter la partie en ligne.')
    return
  }
  game = new Game()
  gameId++
  recorded = false
  movesLog = []
  resetView()
  afterMove()
})

modeSel.addEventListener('change', () => {
  const prev = mode
  mode = modeSel.value as 'ai' | 'hotseat' | 'online'
  onlineGroup.hidden = mode !== 'online'
  if (prev === 'online' && mode !== 'online') leaveOnline()
  if (mode === 'online') {
    game = new Game()
    movesLog = []
    recorded = false
    resetView()
    netStatus('Crée un salon ou rejoins-en un avec son code.')
  } else if (aiThinking) {
    modeSel.value = mode
    aiThinking = false
  }
  afterMove()
})

roomCreate.addEventListener('click', () => {
  openNet()
  const net = currentNet!
  net.send({ type: 'create', name: profile.pseudo, clock: clockSel.value })
  netStatus('Connexion…')
})

function doAuth(registerMode: boolean): void {
  const name = authNameInput.value.trim()
  const pass = authPassInput.value
  if (!name || !pass) {
    authStatusEl.textContent = '⚠ Pseudo et mot de passe requis'
    return
  }
  openNet()
  const net = currentNet!
  net.send({ type: registerMode ? 'register' : 'login', name, password: pass })
}

authLoginBtn.addEventListener('click', () => doAuth(false))
authRegisterBtn.addEventListener('click', () => doAuth(true))
authPassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doAuth(false)
})

quickBtn.addEventListener('click', () => {
  openNet()
  const net = currentNet!
  if (inQueue) {
    net.send({ type: 'cancel-quick' })
    return
  }
  net.send({ type: 'quick', name: profile.pseudo })
  clockSel.value = '5+0'
})

rematchBtn.addEventListener('click', () => {
  if (mode === 'online' && online) online.net.send({ type: 'rematch' })
})

roomJoin.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (code.length !== 4) {
    netStatus('Le code du salon fait 4 caractères.')
    return
  }
  openNet()
  currentNet!.send({ type: 'join', code, name: profile.pseudo })
  netStatus(`Connexion au salon ${code}…`)
})

roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') roomJoin.click()
})

resignBtn.addEventListener('click', () => {
  if (mode === 'online' && online) online.net.send({ type: 'resign' })
})

levelSel.addEventListener('change', () => {
  level = levelSel.value as Level
})

sideSel.addEventListener('change', () => {
  if (mode === 'online') {
    sideSel.value = humanSide
    return
  }
  if (aiThinking) {
    sideSel.value = humanSide
    return
  }
  humanSide = sideSel.value as Color
  afterMove()
})

/* ==================== NAVIGATION & VUES ==================== */

const navBtns = [...document.querySelectorAll<HTMLButtonElement>('.navbtn')]

function showView(v: string): void {
  document
    .querySelectorAll<HTMLElement>('.view')
    .forEach((s) => s.classList.toggle('active', s.id === `view-${v}`))
  navBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === v))
  if (v === 'history') renderHistoryTab()
  if (v === 'profile') {
    pseudoInput.value = profile.pseudo
    renderRatings(ratingsList, profile)
  }
}

navBtns.forEach((b) => b.addEventListener('click', () => showView(b.dataset.view!)))

function renderHistoryTab(): void {
  renderHistory(histBody, historyRecords, openReplay)
}

const rpStart = document.getElementById('rp-start') as HTMLButtonElement
const rpPrev = document.getElementById('rp-prev') as HTMLButtonElement
const rpNext = document.getElementById('rp-next') as HTMLButtonElement
const rpEnd = document.getElementById('rp-end') as HTMLButtonElement
const rpAuto = document.getElementById('rp-auto') as HTMLButtonElement

function openReplay(rec: GameRecord): void {
  replayCard.hidden = false
  replayer.load(rec)
  replayCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

rpStart.addEventListener('click', () => replayer.go(0))
rpEnd.addEventListener('click', () => replayer.go(replayer.total))
rpPrev.addEventListener('click', () => replayer.step(-1))
rpNext.addEventListener('click', () => replayer.step(1))
rpAuto.addEventListener('click', () => replayer.toggle())

pseudoSave.addEventListener('click', () => {
  profile.pseudo = pseudoInput.value.trim() || 'Joueur'
  saveProfile(store, profile)
  pseudoSave.textContent = '✓'
  setTimeout(() => (pseudoSave.textContent = 'Enregistrer'), 1200)
})

resetStats.addEventListener('click', () => {
  if (!confirm('Effacer définitivement le profil et tout l\'historique local ?')) return
  store.removeItem('impetus.profile.v1')
  store.removeItem('impetus.history.v1')
  profile = emptyProfile()
  historyRecords = []
  pseudoInput.value = profile.pseudo
  renderRatings(ratingsList, profile)
  renderHistoryTab()
})

refresh()
showView('play')
requestAnimationFrame(render)

function fmtCp(cp: number): string {
  const v = cp / 100
  return (v > 0 ? '+' : '') + v.toFixed(1)
}

const WIN_SCORE = 1_000_000
const MATE_THRESHOLD = WIN_SCORE - 64

function fmtScore(cp: number): string {
  return Math.abs(cp) >= MATE_THRESHOLD ? 'percée' : fmtCp(cp)
}

function updateAnalysisPanel(): void {
  if (!liveOn) {
    evalLineEl.textContent = 'Analyse désactivée'
    linesEl.innerHTML = ''
    infoEl.textContent = ''
    barWhite.style.height = '50%'
    return
  }
  const a = analysis
  if (!a) {
    evalLineEl.textContent = '…'
    linesEl.innerHTML = ''
    infoEl.textContent = ''
    return
  }
  const cp = a.scoreBlackCp
  const mate = Math.abs(cp) >= MATE_THRESHOLD
  evalLineEl.textContent = mate
    ? `Percée forcée — ${cp > 0 ? 'Noir' : 'Blanc'} gagne`
    : `Éval (Noir) : ${fmtCp(cp)}`
  barWhite.style.height = mate
    ? cp > 0
      ? '0%'
      : '100%'
    : `${(50 - 50 * Math.tanh(cp / 400)).toFixed(1)}%`
  linesEl.innerHTML = a.lines
    .slice(0, 3)
    .map((l) => {
      const relBlack = a.turn === 'black' ? l.score : -l.score
      return `<div class="line"><span>${l.notation}</span><span class="ls">${fmtScore(relBlack)}</span></div>`
    })
    .join('')
  infoEl.textContent = `profondeur ${a.depth} · ${(a.nodes / 1000).toFixed(0)}k nœuds · ${a.ms} ms`
}

