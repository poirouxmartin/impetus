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

interface Room {
  id: string
  game: Game
  seats: [Seat, Seat]
  result?: { winner: Color; reason: string }
}

const rooms = new Map<string, Room>()

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
  return {
    type: 'state',
    cells: room.game.position.cells,
    reserves: room.game.position.reserves,
    turn: room.game.position.turn,
    moveCount: room.game.position.moveCount,
    winner: room.result?.winner ?? room.game.winner,
    winnerReason: room.result?.reason ?? room.game.winnerReason,
  }
}

function broadcast(room: Room, msg: unknown): void {
  for (const s of room.seats) send(s.ws, msg)
}

function opponentOf(room: Room, i: number): Seat {
  return room.seats[1 - i]
}

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws) => {
  let room: Room | null = null
  let seatIdx = -1

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
      room = { id: genCode(), game: new Game(), seats: [{ ws, name }, { ws: null, name: '' }] }
      rooms.set(room.id, room)
      seatIdx = 0
      send(ws, {
        type: 'joined',
        code: room.id,
        color: COLORS[0],
        state: publicState(room),
        oppName: '',
      })
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
      room = target
      seatIdx = free
      const name = String(msg.name ?? 'Joueur').slice(0, 24)
      target.seats[free] = { ws, name }
      send(ws, {
        type: 'joined',
        code: room.id,
        color: COLORS[free],
        state: publicState(room),
        oppName: target.seats[1 - free].name,
      })
      send(target.seats[1 - free].ws, { type: 'oppJoined', name })
      broadcast(room, { type: 'start' })
      return
    }

    if (!room || seatIdx < 0) {
      send(ws, { type: 'error', message: 'Tu n’es dans aucun salon' })
      return
    }
    const me = seatIndex(room, ws)
    if (me < 0) {
      send(ws, { type: 'error', message: 'Siège perdu' })
      return
    }
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
      const action = msg.action as Action
      if (!room.game.play(action)) {
        send(ws, { type: 'error', message: 'Coup illégal', state: publicState(room) })
        return
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
  })

  ws.on('close', () => {
    if (!room || seatIdx < 0) return
    const other = opponentOf(room, seatIdx)
    send(other.ws, { type: 'opponentLeft' })
    if (!other.ws) rooms.delete(room.id)
    else if (room.seats[seatIdx]) room.seats[seatIdx].ws = null
  })
})

httpServer.listen(PORT, () => {
  console.log(`Impetus serveur : http://localhost:${PORT}  (WS même port)`)
})
