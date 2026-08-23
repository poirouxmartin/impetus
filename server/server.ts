import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { Action, Color, Game } from '../src/core/rules'

const PORT = Number(process.env.PORT) || 8787
const DIST = join(process.cwd(), 'dist')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

const httpServer = createServer((req, res) => {
  let path = (req.url ?? '/').split('?')[0]
  if (path === '/') path = '/index.html'
  const file = join(DIST, path)
  if (!path.startsWith('/assets') && path !== '/index.html' && !existsSync(file)) {
    res.writeHead(200, { 'content-type': MIME['.html'] })
    res.end(readFileSync(join(DIST, 'index.html')))
    return
  }
  if (!existsSync(file)) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})

interface Seat {
  ws: WebSocket | null
  name: string
}

interface ClockCfg {
  base: number
  inc: number
}

const FAST = !!process.env.FAST_CLOCK

const CLOCKS: Record<string, ClockCfg> = {
  none: { base: 0, inc: 0 },
  '3+2': { base: 180_000, inc: 2000 },
  '5+0': { base: 300_000, inc: 0 },
}

function clockFromKey(key: unknown): ClockCfg | null {
  const k = String(key ?? 'none')
  return CLOCKS[k] ?? null
}

interface RoomClock {
  cfg: ClockCfg
  rem: [number, number]
  turnStart: number
}

interface Room {
  id: string
  game: Game
  seats: [Seat, Seat]
  result?: { winner: Color; reason: string }
  clock?: RoomClock
  wantRematch: [boolean, boolean]
}

const rooms = new Map<string, Room>()
const quickQueue: { ws: WebSocket; name: string }[] = []

const COLORS: Color[] = ['black', 'white']

function genCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  } while (rooms.has(code))
  return code
}

function seatIndex(room: Room, ws: WebSocket): number {
  return room.seats.findIndex((s) => s.ws === ws)
}

function send(ws: WebSocket | null, msg: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function publicState(room: Room) {
  const now = Date.now()
  let clock: Record<string, number | null> | null = null
  if (room.clock) {
    const turnIdx = COLORS.indexOf(room.game.position.turn)
    const live = room.clock.rem.map((v, i) =>
      i === turnIdx && !room.result && !room.game.winner ? v - (now - room.clock!.turnStart) : v,
    )
    clock = { black: Math.max(0, live[0]), white: Math.max(0, live[1]), ts: now }
  }
  return {
    type: 'state',
    cells: room.game.position.cells,
    reserves: room.game.position.reserves,
    turn: room.game.position.turn,
    moveCount: room.game.position.moveCount,
    winner: room.result?.winner ?? room.game.winner,
    winnerReason: room.result?.reason ?? room.game.winnerReason,
    clock,
  }
}

function broadcast(room: Room, msg: unknown): void {
  for (const s of room.seats) send(s.ws, msg)
}

function opponentOf(room: Room, i: number): Seat {
  return room.seats[1 - i]
}

const wss = new WebSocketServer({ server: httpServer })

function locate(ws: WebSocket): { room: Room; me: number } | null {
  for (const room of rooms.values()) {
    const me = room.seats.findIndex((s) => s.ws === ws)
    if (me >= 0) return { room, me }
  }
  return null
}

wss.on('connection', (ws) => {

  ws.on('message', (data) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(String(data))
    } catch {
      return
    }
    const type = msg.type as string

    if (type === 'create') {
      const name = String(msg.name ?? 'Joueur').slice(0, 24)
      const cfg = clockFromKey(msg.clock)
      const r: Room = {
        id: genCode(),
        game: new Game(),
        seats: [
          { ws, name },
          { ws: null, name: '' },
        ],
        wantRematch: [false, false],
      }
      if (cfg) r.clock = { cfg, rem: [cfg.base, cfg.base], turnStart: Date.now() }
      rooms.set(r.id, r)
      send(ws, {
        type: 'joined',
        code: r.id,
        color: COLORS[0],
        state: publicState(r),
        oppName: '',
      })
      return
    }

    if (type === 'quick') {
      const name = String(msg.name ?? 'Joueur').slice(0, 24)
      const idxInQueue = quickQueue.findIndex((q) => q.ws === ws)
      if (idxInQueue >= 0) {
        quickQueue.splice(idxInQueue, 1)
        send(ws, { type: 'queue-left' })
        return
      }
      quickQueue.push({ ws, name })
      send(ws, { type: 'queued', count: quickQueue.length })
      while (quickQueue.length >= 2) {
        const A = quickQueue.shift()!
        const B = quickQueue.shift()!
        const cfg = FAST ? { base: 600, inc: 0 } : CLOCKS['5+0']
        const r: Room = {
          id: genCode(),
          game: new Game(),
          seats: [
            { ws: A.ws, name: A.name },
            { ws: B.ws, name: B.name },
          ],
          wantRematch: [false, false],
          clock: { cfg, rem: [cfg.base, cfg.base], turnStart: Date.now() },
        }
        rooms.set(r.id, r)
        const colors: Color[] = Math.random() < 0.5 ? ['black', 'white'] : ['white', 'black']
        ;[A, B].forEach((q, i) => {
          send(q.ws, {
            type: 'joined',
            code: r.id,
            color: colors[i],
            state: publicState(r),
            oppName: (i === 0 ? B : A).name,
          })
        })
        broadcast(r, { type: 'start' })
      }
      return
    }

    if (type === 'cancel-quick') {
      const idxInQueue = quickQueue.findIndex((q) => q.ws === ws)
      if (idxInQueue >= 0) quickQueue.splice(idxInQueue, 1)
      send(ws, { type: 'queue-left' })
      return
    }

    if (type === 'join') {
      const code = String(msg.code ?? '').toUpperCase()
      const target = rooms.get(code)
      if (!target) {
        send(ws, { type: 'error', message: 'Salon introuvable' })
        return
      }
      const free = target.seats.findIndex((s) => s.ws === null)
      if (free < 0) {
        send(ws, { type: 'error', message: 'Salon complet' })
        return
      }


      const name = String(msg.name ?? 'Joueur').slice(0, 24)
      target.seats[free] = { ws, name }
      send(ws, {
        type: 'joined',
        code: target.id,
        color: COLORS[free],
        state: publicState(target),
        oppName: target.seats[1 - free].name,
      })
      send(target.seats[1 - free].ws, { type: 'oppJoined', name })
      broadcast(target, { type: 'start' })
      return
    }

    const loc = locate(ws)
    if (!loc) {
      send(ws, { type: 'error', message: 'Tu n’es dans aucun salon' })
      return
    }
    const room = loc.room
    const me = loc.me
    const myColor = COLORS[me]

    if (type === 'move') {
      if (room.game.winner || room.result) {
        send(ws, { type: 'error', message: 'La partie est finie' })
        return
      }
      if (room.game.position.turn !== myColor) {
        send(ws, { type: 'error', message: 'Ce n’est pas ton tour' })
        return
      }
      const meIdx = COLORS.indexOf(myColor)
      const now = Date.now()
      if (room.clock && !FAST) {
        room.clock.rem[meIdx] -= now - room.clock.turnStart
        room.clock.turnStart = now
        if (room.clock.rem[meIdx] <= 0) {
          room.clock.rem[meIdx] = 0
          room.result = { winner: COLORS[1 - meIdx], reason: 'temps' }
          broadcast(room, { type: 'gameover', winner: room.result.winner, reason: 'temps' })
          broadcast(room, publicState(room))
          return
        }
      }
      const action = msg.action as Action
      if (!room.game.play(action)) {
        send(ws, { type: 'error', message: 'Coup illégal', state: publicState(room) })
        return
      }
      if (room.clock) {
        room.clock.rem[meIdx] += room.clock.cfg.inc
        room.clock.turnStart = now
      }
      send(opponentOf(room, me).ws, { type: 'move', action })
      send(ws, { type: 'ack', action })
      broadcast(room, publicState(room))
      if (room.game.winner) {
        broadcast(room, {
          type: 'gameover',
          winner: room.game.winner,
          reason: room.game.winnerReason,
        })
      }
      return
    }

    if (type === 'resign') {
      if (room.game.winner || room.result) return
      const winner = COLORS[1 - me]
      room.result = { winner, reason: 'abandon' }
      broadcast(room, { type: 'gameover', winner, reason: 'abandon' })
      broadcast(room, publicState(room))
      return
    }

    if (type === 'rematch') {
      console.log('[rematch] me=', me, 'result=', !!room.result, 'winner=', room.game.winner)
      if (!room.result && !room.game.winner) return
      room.wantRematch[me] = true
      console.log('[rematch] flags=', room.wantRematch)
      if (room.wantRematch[0] && room.wantRematch[1]) {
        room.game = new Game()
        room.result = undefined
        room.wantRematch = [false, false]
        if (room.clock) {
          room.clock.rem = [room.clock.cfg.base, room.clock.cfg.base]
          room.clock.turnStart = Date.now()
        }
        const r = room
        room.seats.forEach((s, i) => {
          send(s.ws, {
            type: 'joined',
            code: r.id,
            color: COLORS[1 - i],
            state: publicState(r),
            oppName: r.seats[1 - i].name,
          })
        })
        broadcast(room, { type: 'start' })
        console.log('[rematch] envoyé')
      } else {
        send(ws, { type: 'rematch-wait' })
      }
      return
    }
  })

  ws.on('close', () => {
    const qIdx = quickQueue.findIndex((q) => q.ws === ws)
    if (qIdx >= 0) quickQueue.splice(qIdx, 1)
    const loc = locate(ws)
    if (!loc) return
    const { room, me } = loc
    room.seats[me].ws = null
    const otherSeat = room.seats[1 - me]
    send(otherSeat.ws, { type: 'opponentLeft' })
    if (!otherSeat.ws) rooms.delete(room.id)
  })
})

setInterval(() => {
  const now = Date.now()
  for (const room of rooms.values()) {
    if (!room.clock || room.result || room.game.winner) continue
    if (room.seats.some((s) => !s.ws)) continue
    const turnIdx = COLORS.indexOf(room.game.position.turn)
    if (now - room.clock.turnStart > room.clock.rem[turnIdx]) {
      room.clock.rem[turnIdx] = 0
      room.result = { winner: COLORS[1 - turnIdx], reason: 'temps' }
      broadcast(room, { type: 'gameover', winner: room.result.winner, reason: 'temps' })
      broadcast(room, publicState(room))
    }
  }
}, 400)

httpServer.listen(PORT, () => {
  console.log(`Impetus serveur : http://localhost:${PORT}  (WS même port)${FAST ? ' — HORLOGE RAPIDE (test)' : ''}`)
})
