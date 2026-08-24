import type { Action, Color } from '../core/rules'

export interface NetPoint {
  cells: (Color | null)[]
  reserves: { black: number; white: number }
  turn: Color
  moveCount: number
  winner?: string | null
  winnerReason?: string | null
  clock?: { black: number; white: number; ts: number } | null
}

export interface ClockSnap {
  black: number
  white: number
  ts: number
}

export interface ServerProfile {
  name: string
  rating: number
  wins: number
  losses: number
  draws: number
}

export type ServerMsg =
  | {
      type: 'joined'
      code: string
      color: Color
      state: NetPoint
      oppName: string
      myRating?: number | null
      oppRating?: number | null
    }
  | { type: 'oppJoined'; name: string }
  | { type: 'start' }
  | { type: 'move'; action: Action; clock?: ClockSnap | null }
  | { type: 'ack'; action: Action; clock?: ClockSnap | null }
  | { type: 'state'; turn?: Color; clock?: ClockSnap | null }
  | { type: 'gameover'; winner: Color; reason: string }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string }
  | { type: 'queued'; count?: number }
  | { type: 'queue-left' }
  | { type: 'rematch-wait' }
  | { type: 'auth-ok'; token: string; profile: ServerProfile }
  | { type: 'auth-error'; message: string }
  | { type: 'ranked'; delta: number; rating: number; oppRating: number }

export interface NetClient {
  send(msg: unknown): void
  close(): void
}

/**
 * Wrapper WebSocket minimal : met en file les envois avant l'ouverture,
 * et transmet les messages serveur parsés au gestionnaire fourni.
 */
export function connectNet(
  url: string,
  onMessage: (msg: ServerMsg) => void,
  onOpen: () => void,
  onClose: () => void,
): NetClient {
  const ws = new WebSocket(url)
  const queue: unknown[] = []
  let ready = false

  ws.addEventListener('open', () => {
    ready = true
    onOpen()
    for (const m of queue) ws.send(JSON.stringify(m))
    queue.length = 0
  })
  ws.addEventListener('close', onClose)
  ws.addEventListener('message', (e) => {
    try {
      onMessage(JSON.parse(String(e.data)) as ServerMsg)
    } catch {
      /* message illisible : ignoré */
    }
  })

  return {
    send(msg: unknown): void {
      if (ready && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
      else queue.push(msg)
    },
    close(): void {
      ws.close()
    },
  }
}
