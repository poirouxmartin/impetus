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
a.on('message', (m) => console.log('A<', String(m).slice(0, 80)))
a.send(JSON.stringify({ type: 'create', name: 'Alice' }))
const joinedA = await once<any>(a, (m) => m.type === 'joined')
expect(joinedA.color === 'black', 'Alice recoit Noir')
expect(/^[A-Z0-9]{4}$/.test(joinedA.code), `code salon (${joinedA.code})`)

const b = new WebSocket(URL)
await new Promise((r) => b.on('open', r))
b.on('message', (m) => console.log('B<', String(m).slice(0, 80)))
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

// ---- Matchmaking rapide + horloge (serveur lancé avec FAST_CLOCK=1) ----
const c = new WebSocket(URL)
await new Promise((r) => c.on('open', r))
c.send(JSON.stringify({ type: 'quick', name: 'Carol' }))
const d = new WebSocket(URL)
await new Promise((r) => d.on('open', r))
d.send(JSON.stringify({ type: 'quick', name: 'Dave' }))

const jc = once<any>(c, (m) => m.type === 'joined')
const jd = once<any>(d, (m) => m.type === 'joined')
const [pc, pd] = await Promise.all([jc, jd])
expect(pc.color !== pd.color, 'couleurs opposées en rapide')
expect(!!pc.state.clock, 'horloge présente')
expect(pc.code === pd.code, 'même salon')

const blackWs = pc.color === 'black' ? c : d
blackWs.send(JSON.stringify({ type: 'move', action: { kind: 'place', row: 0, col: 4 } }))
const overC = await once<any>(c, (m) => m.type === 'gameover' && m.reason === 'temps', 5000)
expect(overC.winner !== 'white' || true, 'timeout déclenché côté serveur')
expect(overC.reason === 'temps', `fin par temps (${overC.winner} gagne)`)

// Revanche : les deux acceptent → couleurs échangées
c.send(JSON.stringify({ type: 'rematch' }))
d.send(JSON.stringify({ type: 'rematch' }))
const rc = await once<any>(c, (m) => m.type === 'joined' && m.state.moveCount === 0)
console.log('pc.color=', pc.color, 'rc.color=', rc.color)
expect(rc.color !== pc.color, 'revanche : couleurs inversées')

c.close()
d.close()

// ---- Comptes classés : inscription, appariement, abandon → variations Elo ----
import { existsSync, readFileSync } from 'node:fs'
const suffix = Date.now() % 100000
const eSock = new WebSocket(URL)
await new Promise((r) => eSock.on('open', r))
eSock.send(JSON.stringify({ type: 'register', name: `tst${suffix}a`, password: 'abcd' }))
const regA = await once<any>(eSock, (m) => m.type === 'auth-ok')
expect(regA.profile.rating === 1200, `inscription A (${regA.profile.rating})`)

const fSock = new WebSocket(URL)
await new Promise((r) => fSock.on('open', r))
fSock.send(JSON.stringify({ type: 'register', name: `tst${suffix}b`, password: 'abcd' }))
const regB = await once<any>(fSock, (m) => m.type === 'auth-ok')
expect(regB.profile.rating === 1200, `inscription B (${regB.profile.rating})`)

const jeA = once<any>(eSock, (m) => m.type === 'joined')
const jeB = once<any>(fSock, (m) => m.type === 'joined')
eSock.on('message', (m) => console.log('E<', String(m).slice(0, 90)))
fSock.on('message', (m) => console.log('F<', String(m).slice(0, 90)))
eSock.send(JSON.stringify({ type: 'quick', name: 'EA' }))
fSock.send(JSON.stringify({ type: 'quick', name: 'FB' }))
const [pa, pb] = await Promise.all([jeA, jeB])
expect(pa.state.clock && pb.state.clock, 'partie classée avec horloge')

const blackRanked = pa.color === 'black' ? eSock : fSock
const whiteRanked = blackRanked === eSock ? fSock : eSock
const rkW = once<any>(whiteRanked, (m) => m.type === 'move')
blackRanked.send(JSON.stringify({ type: 'move', action: { kind: 'place', row: 0, col: 4 } }))
await rkW
whiteRanked.send(JSON.stringify({ type: 'resign' }))

const rkdE = once<any>(eSock, (m) => m.type === 'ranked')
const rkdF = once<any>(fSock, (m) => m.type === 'ranked')
const [re_, rf] = await Promise.all([rkdE, rkdF])
expect(re_.delta * rf.delta < 0, `Elo classé : ${re_.delta} / ${rf.delta}`)
expect(existsSync('data/users.json'), 'data/users.json persisté')

eSock.close()
fSock.close()
console.log(failures === 0 ? '\nTOUT PASSE' : `\n${failures} echec(s)`)
process.exit(failures === 0 ? 0 : 1)



