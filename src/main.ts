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
  hasBreakthrough,
  idx,
  other,
  currentRules,
  setRules,
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
import { BOARD, currentTheme, initTheme, toggleTheme, type BoardPalette } from './ui/theme'
import { connectNet, type LobbyRoom, type NetClient, type ServerMsg } from './net/client'
import { initI18n, onLangChange, setLang, getLang, t, type Lang } from './ui/i18n'

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
const delayedLabel = document.getElementById('delayed-label') as HTMLElement
const delayedCb = document.getElementById('delayed') as HTMLInputElement
const hintEl = document.getElementById('rules-hint')!
const newBtn = document.getElementById('new') as HTMLButtonElement
const undoBtn = document.getElementById('undo') as HTMLButtonElement
const swapBtn = document.getElementById('swap') as HTMLButtonElement



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
const netStatusEl = document.getElementById('net-status')!
const roomCodeInput = document.getElementById('room-code') as HTMLInputElement
const roomCreate = document.getElementById('room-create') as HTMLButtonElement
const roomJoin = document.getElementById('room-join') as HTMLButtonElement
const resignBtn = document.getElementById('resign') as HTMLButtonElement
const authNameInput = document.getElementById('auth-name') as HTMLInputElement
const authPassInput = document.getElementById('auth-pass') as HTMLInputElement
const authLoginBtn = document.getElementById('auth-login') as HTMLButtonElement
const authRegisterBtn = document.getElementById('auth-register') as HTMLButtonElement
const authFormEl = document.getElementById('auth-form') as HTMLFormElement
const authInfoEl = document.getElementById('auth-info') as HTMLElement
const authPseudoEl = document.getElementById('auth-pseudo')!
const authEloEl = document.getElementById('auth-elo')!
const authLogoutBtn = document.getElementById('auth-logout') as HTMLButtonElement

authLogoutBtn.addEventListener('click', () => {
  auth = null
  saveAuth()
  renderAuthZone()
})
const authStatusEl = document.getElementById('auth-status')!
const clkTop = document.getElementById('bclock-top') as HTMLElement
const clkBottom = document.getElementById('bclock-bottom') as HTMLElement
const pbnameTop = document.getElementById('pbname-top') as HTMLElement
const pbnameBottom = document.getElementById('pbname-bottom') as HTMLElement
const avatarTop = document.getElementById('avatar-top') as HTMLElement
const avatarBottom = document.getElementById('avatar-bottom') as HTMLElement
const cadenceSel = document.getElementById('cadence') as HTMLSelectElement
const cadenceLabel = document.getElementById('cadence-label') as HTMLElement
const evalbarEl = document.getElementById('evalbar') as HTMLElement
const clockSel = document.getElementById('clock-sel') as HTMLSelectElement
const quickBtn = document.getElementById('quick') as HTMLButtonElement
const quickLabel = quickBtn.querySelector('.t-label') as HTMLElement

function setQuickLabel(text: string): void {
  quickLabel.textContent = text
}
const rematchBtn = document.getElementById('rematch') as HTMLButtonElement
const lobbyEl = document.getElementById('lobby') as HTMLElement
const gameWrap = document.getElementById('game-wrap') as HTMLElement
const lobbyBody = document.getElementById('lobby-body')!
const onlineCountEl = document.getElementById('online-count')!
const tileAi = document.getElementById('tile-ai') as HTMLButtonElement
const tileLocal = document.getElementById('tile-local') as HTMLButtonElement
const backLobbyBtn = document.getElementById('back-lobby') as HTMLButtonElement
const sideSelEl = document.getElementById('side') as HTMLSelectElement
const levelSelEl = document.getElementById('level') as HTMLSelectElement

const colorName = (c: Color): string => t(c === 'black' ? 'name.black' : 'name.white')
const reasonLabel = (r: WinReason | null | undefined): string =>
  r ? t(`reason.${r}`) : t('reason.victoire')

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

interface LocalClock {
  black: number
  white: number
  inc: number
  last: number
  flagged: boolean
}
let localClock: LocalClock | null = null
let flagReason: string | null = null

function initLocalClock(): void {
  const v = cadenceSel.value
  if (v === 'none') {
    localClock = null
    return
  }
  const [min, inc] = v.split('+').map(Number)
  localClock = { black: min * 60_000, white: min * 60_000, inc: inc ?? 0, last: Date.now(), flagged: false }
}
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
  const logged = auth !== null
  authFormEl.hidden = logged
  authInfoEl.hidden = !logged
  if (logged && auth) {
    authPseudoEl.textContent = auth.name
    authEloEl.textContent = String(auth.rating)
    authNameInput.value = auth.name
    authStatusEl.textContent = t('auth.logged')
    authStatusEl.className = 'ok'
  } else {
    authStatusEl.textContent =
      t('auth.hint')
    authStatusEl.className = ''
  }
  const navAuth = document.getElementById('nav-auth')!
  navAuth.innerHTML = logged
    ? `<span class="mini-auth">${auth!.name} · <b>${auth!.rating}</b></span>`
    : `<span class="mini-auth guest">${t('auth.guest')}</span>`
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
    const who = color === online.color ? t('you.suffix') : online.oppName || t('opp.suffix')
    return `${colorName(color)} (${who})`
  }
  return colorName(color)
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
      netStatus(t('net.ranked', { delta: (msg.delta > 0 ? '+' : '') + msg.delta, rating: msg.rating }))
      return
    case 'joined':
      if (!currentNet) return
      online = { net: currentNet, code: msg.code, color: msg.color, oppName: msg.oppName }
      humanSide = msg.color
      flipped = msg.color === 'black'
      setRules()
      localClock = null
      flagReason = null
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
      showGame()
      refresh()
      netStatus(
        online.oppName
          ? t('net.joined.opp', { code: msg.code, name: online.oppName })
          : t('net.joined.wait', { code: msg.code }),
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
      setQuickLabel(t('quick.cancel'))
      netStatus(t('net.searching', { n: msg.count ?? 1 }))
      break
    case 'queue-left':
      inQueue = false
      setQuickLabel(t('tile.quick'))
      netStatus(t('net.search.cancelled'))
      break
    case 'rematch-wait':
      netStatus(t('net.rematch.wait'))
      break
    case 'oppJoined':
      if (online) online.oppName = msg.name
      netStatus(t('net.opp.joined', { name: msg.name }))
      refresh()
      break
    case 'opponentLeft':
      netStatus('Adversaire déconnecté')
      if (!game.winner) {
        bannerTitle.textContent = t('game.interrupted')
        bannerSub.textContent = t('opp.left')
        bannerEl.hidden = false
      }
      break
    case 'error':
      netStatus(`⚠ ${msg.message}`)
      break
    case 'lobby':
      renderLobby(msg.rooms, msg.online)
      break
    default:
      break
  }
}

const CLOCK_LABEL: Record<string, string> = {
  none: 'sans horloge',
  '3+2': '3+2',
  '5+0': '5+0',
  test: 'test',
}

function renderLobby(rooms: LobbyRoom[], onlineCount: number): void {
  onlineCountEl.textContent = t('net.online.count', { n: onlineCount })
  lobbyBody.innerHTML = ''
  const open = rooms.filter((r) => r.status !== 'over')
  if (open.length === 0) {
    lobbyBody.innerHTML =
      '<tr><td colspan="6" class="empty">Aucun salon ouvert — crée le premier !</td></tr>'
    return
  }
  for (const r of open) {
    const tr = document.createElement('tr')
    const statusBadge =
      r.status === 'waiting'
        ? '<span class="badge wait">Ouvert</span>'
        : '<span class="badge play">En cours</span>'
    tr.innerHTML = `
      <td><code>${r.id}</code></td>
      <td>${r.host}</td>
      <td>${r.guest ?? '—'}</td>
      <td>${CLOCK_LABEL[r.clockKey] ?? r.clockKey}</td>
      <td>${r.rated ? '★' : ''}</td>
      <td>${statusBadge}</td>
      <td>${
        r.status === 'waiting'
          ? `<button class="mini join-btn" data-code="${r.id}">Rejoindre</button>`
          : ''
      }</td>
    `
    const btn = tr.querySelector<HTMLButtonElement>('button.join-btn')
    if (btn) {
      btn.addEventListener('click', () => {
        openNet()
        currentNet!.send({ type: 'join', code: r.id, name: profile.pseudo })
        netStatus(`Connexion au salon ${r.id}…`)
      })
    }
    lobbyBody.appendChild(tr)
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



function refresh(): void {
  places = game.placeSquares()
  const pos = game.position
  const w = game.winner

  sideLabel.hidden = levelLabel.hidden = mode !== 'ai'
  delayedLabel.hidden = mode === 'online'
  cadenceLabel.hidden = mode === 'online'
  swapBtn.hidden = !(game.swapAvailable() && (mode === 'hotseat' || pos.turn === humanSide))
  undoBtn.disabled = !game.canUndo() || aiThinking || mode === 'online'
  updateBanners()

  if (w) {
    const reasonText = flagReason ?? reasonLabel(game.winnerReason)
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
      `<span class="winner">${t('win.text', { name: colorName(w) })}</span><span class="reason"> — ${reasonText}</span>`
    bannerTitle.textContent = t('win.text', { name: colorName(w) })
    bannerSub.textContent = `${reasonText}${eloNote} ${t('banner.newgame')}`
    bannerEl.hidden = false
  } else if (aiThinking) {
    statusEl.innerHTML = `${t('ai.thinking')}<span class="dots"></span>`
    bannerEl.hidden = true
  } else {
    const pending = delayedCb.checked && mode !== 'online' && hasBreakthrough(pos, other(pos.turn))
    statusEl.textContent =
      mode === 'online' && online
        ? t('you.turn', { color: displayName(online.color), turn: colorName(pos.turn) })
        : pending
          ? t('turn.pending', { name: colorName(pos.turn) })
          : t('turn', { name: colorName(pos.turn) })
    bannerEl.hidden = true
  }

  resignBtn.hidden = !(mode === 'online' && online && !w)
  rematchBtn.hidden = !(mode === 'online' && online && !!w)

  reservesEl.innerHTML = pipRow('black') + pipRow('white')
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function renderClocks(): void {
  if (gameWrap.hidden) return
  if (mode === 'online') {
    if (!clockSnap) {
      clkTop.hidden = true
      clkBottom.hidden = true
      return
    }
    const now = Date.now()
    const live = (color: Color): number => {
      const base = color === 'black' ? clockSnap!.black : clockSnap!.white
      const running = clockSnap!.running && clockSnap!.turn === color
      return Math.max(0, base - (running ? now - clockSnap!.ts : 0))
    }
    setClockEl(clkTop, colorAtTop(), live(colorAtTop()))
    setClockEl(clkBottom, colorAtBottom(), live(colorAtBottom()))
    return
  }
  if (!localClock) {
    clkTop.hidden = true
    clkBottom.hidden = true
    return
  }
  const now = Date.now()
  const dt = now - localClock.last
  localClock.last = now
  if (!game.winner && !localClock.flagged) {
    const t = game.position.turn
    localClock[t] = Math.max(0, localClock[t] - dt)
    if (localClock[t] === 0) {
      localClock.flagged = true
      flagReason = 'au temps'
      game.winner = other(t)
      game.winnerReason = null
      refresh()
    }
  }
  setClockEl(clkTop, colorAtTop(), localClock[colorAtTop()])
  setClockEl(clkBottom, colorAtBottom(), localClock[colorAtBottom()])
}

function colorAtTop(): Color {
  return flipped ? 'white' : 'black'
}

function colorAtBottom(): Color {
  return flipped ? 'black' : 'white'
}

function setClockEl(el: HTMLElement, color: Color, ms: number): void {
  el.hidden = false
  el.textContent = fmtClock(ms)
  const active = !game.winner && !localClock?.flagged && (mode === 'online' ? clockSnap?.turn === color && clockSnap.running : game.position.turn === color)
  el.classList.toggle('active', !!active)
  el.classList.toggle('low', ms < 20000)
}

setInterval(renderClocks, 250)

const AVATAR_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8"/></svg>'
avatarTop.innerHTML = AVATAR_SVG
avatarBottom.innerHTML = AVATAR_SVG

function updateBanners(): void {
  avatarTop.dataset.color = colorAtTop()
  avatarBottom.dataset.color = colorAtBottom()
  // la jauge se lit du côté du joueur : sa couleur occupe le bas
  evalbarEl.classList.toggle('flip', colorAtBottom() === 'black')
  const me = auth?.name ?? profile.pseudo
  if (mode === 'ai') {
    pbnameTop.textContent = t('ai.name', {
      level: level.charAt(0).toUpperCase() + level.slice(1),
    })
    pbnameBottom.textContent = me
  } else if (mode === 'online' && online) {
    pbnameTop.textContent = online.oppName ?? 'Adversaire'
    pbnameBottom.textContent = me
  } else {
    pbnameTop.textContent = colorName(colorAtTop())
    pbnameBottom.textContent = colorName(colorAtBottom())
  }
}

function pipRow(color: Color): string {  const reserve = game.position.reserves[color]
  const captured = START_RESERVE - reserve - stonesOnBoard(color)
  const filled = Array.from({ length: reserve }, () => `<span class="pip ${color}"></span>`).join('')
  const ghosts = Array.from({ length: captured }, () => '<span class="pip ghost"></span>').join('')
  const cap = captured > 0 ? `<span class="cap">−${captured}</span>` : ''
  return (
    `<div class="side-row"><span class="tag ${color}">${colorName(color)}</span>` +
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
  w.postMessage({ type: 'analyse', gen: analysisGen, pos: clonePos(), rules: currentRules() })
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
  if (localClock) {
    localClock[other(game.position.turn)] += localClock.inc
    localClock.last = Date.now()
  }
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
  return [c * CELL + CELL / 2, vy(r) * CELL + CELL / 2]
}

/** Orientation : false = Blanc en bas (vue par défaut), true = Noir en bas (le joueur humain voit sa rangée en bas). */
let flipped = false
function vy(r: number): number {
  return flipped ? SIZE - 1 - r : r
}

function drawCoords(T: BoardPalette): void {
  ctx.fillStyle = T.coord
  ctx.font = `${Math.max(10, CELL * 0.17)}px Marcellus, serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let r = 0; r < SIZE; r++) {
    ctx.fillText(String(r + 1), 4, vy(r) * CELL + 3)
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  for (let c = 0; c < SIZE; c++) {
    ctx.fillText('abcdefghi'[c], (c + 1) * CELL - 4, LOGICAL - 3)
  }
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
  const T = BOARD[currentTheme()]
  if (color === 'black') {
    grad.addColorStop(0, T.blackG0)
    grad.addColorStop(1, T.blackG1)
  } else {
    grad.addColorStop(0, T.whiteG0)
    grad.addColorStop(1, T.whiteG1)
  }
  return grad
}

function drawStoneAt(x: number, y: number, color: Color, scale = 1): void {
  const radius = CELL * 0.38 * scale
  const T = BOARD[currentTheme()]
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = stoneGradient(x, y, radius, color)
  ctx.fill()
  ctx.strokeStyle = color === 'black' ? T.blackRim : T.whiteRim
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
  const T = BOARD[currentTheme()]
  requestAnimationFrame(render)
  ctx.clearRect(0, 0, LOGICAL, LOGICAL)
  ctx.fillStyle = T.bg
  ctx.fillRect(0, 0, LOGICAL, LOGICAL)

  const yB = vy(0) * CELL
  const yW = vy(SIZE - 1) * CELL
  ctx.fillStyle = T.campTopFill
  ctx.fillRect(0, yB, LOGICAL, CELL)
  ctx.fillStyle = T.campBottomFill
  ctx.fillRect(0, yW, LOGICAL, CELL)
  ctx.fillStyle = T.filetTop
  ctx.fillRect(0, flipped ? yB : yB + CELL - 1.5, LOGICAL, 1.5)
  ctx.fillStyle = T.filetBottom
  ctx.fillRect(0, flipped ? yW + CELL - 1.5 : yW, LOGICAL, 1.5)

  ctx.strokeStyle = T.line
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

  drawCoords(T)

  let k = 1
  if (anim) {
    const t = Math.min(1, (now - anim.start) / ANIM_MS)
    k = easeOut(t)
    if (t >= 1) anim = null
  }

  if (!game.winner && !anim) {
    ctx.fillStyle = T.placeDot
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
    ctx.strokeStyle = T.lastRing
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(tx, ty, CELL * 0.46, 0, Math.PI * 2)
    ctx.stroke()
    if (lastMove.from) {
      const [fx, fy] = center(lastMove.from[0], lastMove.from[1])
      ctx.strokeStyle = T.lastRingSoft
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
          T.selRing,
          CELL * 0.12,
        )
      }
    } else if (b && b.action.kind === 'place') {
      const [px, py] = center(b.action.row, b.action.col)
      ctx.strokeStyle = T.selRing
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(px, py, CELL * 0.3, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  if (selected !== null && !anim) {
    const [sx, sy] = center(Math.floor(selected / SIZE), selected % SIZE)
    ctx.strokeStyle = T.selRing
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(sx, sy, CELL * 0.42, 0, Math.PI * 2)
    ctx.stroke()
    for (const d of dests.values()) {
      const [dx, dy] = center(d.row, d.col)
      ctx.beginPath()
      ctx.arc(dx, dy, CELL * 0.16, 0, Math.PI * 2)
      ctx.fillStyle = d.capture ? T.dotCapture : T.dotMove
      ctx.fill()
    }
  }
}

function hitCell(e: PointerEvent): { r: number; c: number } | null {
  const rect = canvas.getBoundingClientRect()
  const x = ((e.clientX - rect.left) * LOGICAL) / rect.width
  const y = ((e.clientY - rect.top) * LOGICAL) / rect.height
  const c = Math.floor(x / CELL)
  const rRaw = Math.floor(y / CELL)
  if (rRaw < 0 || rRaw >= SIZE || c < 0 || c >= SIZE) return null
  return { r: flipped ? SIZE - 1 - rRaw : rRaw, c }
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
  if (localClock?.flagged) {
    // reprise après un drapeau : minimum 15 s pour éviter la boucle flag/undo
    if (localClock.black === 0) localClock.black = 15_000
    if (localClock.white === 0) localClock.white = 15_000
    localClock.flagged = false
  }
  flagReason = null
  movesLog.length = Math.min(movesLog.length, game.position.moveCount)
  resetView()
  afterMove()
})

newBtn.addEventListener('click', () => {
  if (mode === 'online') {
    netStatus(t('net.use.resign'))
    return
  }
  applyRuleVariant()
  initLocalClock()
  flagReason = null
  game = new Game()
  gameId++
  recorded = false
  movesLog = []
  resetView()
  afterMove()
})

/* ==== Écrans lobby / partie ==== */

/** Applique la variante de règles choisie (local uniquement). */
function applyRuleVariant(): void {
  const delayed = delayedCb.checked
  setRules(delayed ? { breakthroughDelay: true } : undefined)
  hintEl.textContent = t(delayed ? 'hint.delayed' : 'hint.std')
}

function showLobby(): void {
  lobbyEl.hidden = false
  gameWrap.hidden = true
}

function showGame(): void {
  lobbyEl.hidden = true
  gameWrap.hidden = false
  window.scrollTo({ top: 0 })
}

function startAiGame(): void {
  mode = 'ai'
  applyRuleVariant()
  initLocalClock()
  flagReason = null
  game = new Game()
  humanSide = sideSelEl.value as Color
  flipped = humanSide === 'black'
  level = levelSelEl.value as Level
  gameId++
  recorded = false
  movesLog = []
  resetView()
  clockSnap = null
  showGame()
  refresh()
  renderClocks()
}

function startLocalGame(): void {
  mode = 'hotseat'
  applyRuleVariant()
  initLocalClock()
  flagReason = null
  game = new Game()
  flipped = true
  gameId++
  recorded = false
  movesLog = []
  resetView()
  clockSnap = null
  showGame()
  refresh()
}

tileAi.addEventListener('click', startAiGame)
tileLocal.addEventListener('click', startLocalGame)

backLobbyBtn.addEventListener('click', () => {
  if (mode === 'online' && online) {
    online.net.send({ type: 'leave-room' })
    online = null
  }
  mode = 'ai'
  showLobby()
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
    authStatusEl.textContent = '⚠ ' + t('auth.required')
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
    netStatus(t('net.search.cancelled'))
    return
  }
  net.send({ type: 'quick', name: auth?.name ?? profile.pseudo })
  netStatus('Recherche d’un adversaire…')
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

levelSelEl.addEventListener('change', () => {
  level = levelSelEl.value as Level
})

sideSelEl.addEventListener('change', () => {
  humanSide = sideSelEl.value as Color
  if (mode === 'ai') flipped = humanSide === 'black'
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
  setTimeout(() => (pseudoSave.textContent = t('profile.save')), 1200)
})

resetStats.addEventListener('click', () => {
  if (!confirm(t('confirm.reset'))) return
  store.removeItem('impetus.profile.v1')
  store.removeItem('impetus.history.v1')
  profile = emptyProfile()
  historyRecords = []
  pseudoInput.value = profile.pseudo
  renderRatings(ratingsList, profile)
  renderHistoryTab()
})

const themeName = initTheme()
initI18n()
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement
const langToggle = document.getElementById('lang-toggle') as HTMLButtonElement

function renderLangToggle(): void {
  langToggle.textContent = (getLang() === 'fr' ? 'en' : 'fr').toUpperCase()
  langToggle.title = t('lang.toggle')
}

renderLangToggle()
langToggle.addEventListener('click', () => {
  const next: Lang = getLang() === 'fr' ? 'en' : 'fr'
  setLang(next)
})

onLangChange(() => {
  renderLangToggle()
  renderAuthZone()
  updateBanners()
  refresh()
  applyRuleVariant()
  setQuickLabel(inQueue ? t('quick.cancel') : t('tile.quick'))
  renderHistoryTab()
  renderRatings(ratingsList, profile)
  updateAnalysisPanel()
})

const ICON_SUN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>'
const ICON_MOON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'

function renderThemeIcon(t: string): void {
  themeToggle.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON
}

renderThemeIcon(themeName)
themeToggle.addEventListener('click', () => {
  const t = toggleTheme()
  renderThemeIcon(t)
})

refresh()
showView('play')
showLobby()
renderAuthZone()
requestAnimationFrame(render)

function fmtCp(cp: number): string {
  const v = cp / 100
  return (v > 0 ? '+' : '') + v.toFixed(1)
}

const WIN_SCORE = 1_000_000
const MATE_THRESHOLD = WIN_SCORE - 64

function fmtScore(cp: number): string {
  return Math.abs(cp) >= MATE_THRESHOLD ? t('analysis.mate') : fmtCp(cp)
}

/** Le mat n'est affiché qu'après deux profondeurs consécutives, puis persiste (3 profondeurs sans mat le retirent). */
let prevMateSide: '' | 'black' | 'white' = ''
let mateStable = 0
let noMateStable = 0
let mateLatch: '' | 'black' | 'white' = ''

function updateAnalysisPanel(): void {
  if (!liveOn) {
    evalLineEl.textContent = t('analysis.off')
    linesEl.innerHTML = ''
    infoEl.textContent = ''
    barWhite.style.height = '50%'
    prevMateSide = ''
    mateStable = 0
    noMateStable = 0
    mateLatch = ''
    return
  }
  const a = analysis
  if (!a) {
    evalLineEl.textContent = '…'
    linesEl.innerHTML = ''
    infoEl.textContent = ''
    prevMateSide = ''
    mateStable = 0
    noMateStable = 0
    mateLatch = ''
    return
  }
  const cp = a.scoreBlackCp
  const mateSide: '' | 'black' | 'white' =
    Math.abs(cp) >= MATE_THRESHOLD ? (cp > 0 ? 'black' : 'white') : ''
  if (mateSide) {
    mateStable++
    noMateStable = 0
  } else {
    noMateStable++
    if (noMateStable >= 3) {
      mateStable = 0
      mateLatch = ''
    }
  }
  if (mateSide && mateSide === prevMateSide && mateStable >= 2) mateLatch = mateSide
  prevMateSide = mateSide

  if (mateLatch) {
    const plies = WIN_SCORE - Math.abs(cp)
    const moves = Math.max(1, Math.ceil(plies / 2))
    evalLineEl.textContent = t('analysis.forced', {
      n: moves,
      side: t(mateLatch === 'black' ? 'name.black' : 'name.white'),
    })
    barWhite.style.height = mateLatch === 'black' ? '0%' : '100%'
  } else {
    evalLineEl.textContent = t('analysis.eval', { cp: fmtCp(cp) })
    barWhite.style.height = `${(50 - 50 * Math.tanh(cp / 400)).toFixed(1)}%`
  }
  linesEl.innerHTML = a.lines
    .slice(0, 3)
    .map((l) => {
      const relBlack = a.turn === 'black' ? l.score : -l.score
      return `<div class="line"><span>${l.notation}</span><span class="ls">${fmtScore(relBlack)}</span></div>`
    })
    .join('')
  const nps = Math.round(a.nodes / Math.max(1, a.ms))
  infoEl.textContent = `profondeur ${a.depth} · ${nps} k nœuds/s · ${(a.nodes / 1000).toFixed(0)}k nœuds`
}



