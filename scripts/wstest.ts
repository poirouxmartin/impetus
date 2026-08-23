import { WebSocket } from 'ws'

const URL = 'ws://localhost:8787'
let failures = 0

function expect(cond: boolean, label: string): void {
  if (!cond) {
    failures++
    console.log(`KO  ${label}`)
  } else {
    console.log(`ok  ${label}`)
  }
}

function once<T>(ws: WebSocket, filter: (m: any) => boolean, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    const handler = (raw: unknown): void => {
      const m = JSON.parse(String(raw))
      if (filter(m)) {
        clearTimeout(timer)
        ws.off('message', handler)
        resolve(m as T)
      }
    }
    ws.on('message', handler)
  })
}

const a = new WebSocket(URL)
await new Promise((r) => a.on('open', r))
a.send(JSON.stringify({ type: 'create', name: 'Alice' }))
const joinedA = await once<any>(a, (m) => m.type === 'joined')
expect(joinedA.color === 'black', 'Alice recoit Noir')
expect(/^[A-Z0-9]{4}$/.test(joinedA.code), `code salon (${joinedA.code})`)

const b = new WebSocket(URL)
await new Promise((r) => b.on('open', r))
b.send(JSON.stringify({ type: 'join', code: joinedA.code, name: 'Bob' }))
const joinedB = await once<any>(b, (m) => m.type === 'joined')
expect(joinedB.color === 'white', 'Bob recoit Blanc')
await once<any>(a, (m) => m.type === 'oppJoined')

a.send(JSON.stringify({ type: 'move', action: { kind: 'place', row: 0, col: 4 } }))
const mvB = await once<any>(b, (m) => m.type === 'move')
expect(mvB.action.kind === 'place', 'coup relaye a Bob')

b.send(JSON.stringify({ type: 'move', action: { kind: 'place', row: 8, col: 4 } }))
const mvA = await once<any>(a, (m) => m.type === 'move')
expect(mvA.action.kind === 'place', 'reponse de Bob relayee a Alice')

b.send(JSON.stringify({ type: 'move', action: { kind: 'place', row: 8, col: 5 } }))
const errB = await once<any>(b, (m) => m.type === 'error')
expect(String(errB.message).includes('tour'), 'hors-tour refuse')

a.close()
b.close()
console.log(failures === 0 ? '\nTOUT PASSE' : `\n${failures} echec(s)`)
process.exit(failures === 0 ? 0 : 1)
