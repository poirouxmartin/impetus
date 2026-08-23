import type { Action, Color } from '../core/rules'

export interface NetPoint {
  cells: (Color | null)[]
  reserves: { black: number; white: number }
  turn: Color
  moveCount: number
  winner?: string | null
  winnerReason?: string | null
}

export type ServerMsg =
  | { type: 'joined'; code: string; color: Color; state: NetPoint; oppName: string }
  | { type: 'oppJoined'; name: string }
  | { type: 'start' }
  | { type: 'move'; action: Action }
  | { type: 'ack'; action: Action }
  | { type: 'state' }
  | { type: 'gameover'; winner: Color; reason: string }
  | { type: 'opponentLeft' }
  | { type: 'error'; message: string }

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
