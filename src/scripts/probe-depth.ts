import { initialState, legalActions, applyAction } from '../core/rules'
import { search } from '../core/ai'

function board(rows: Record<number, string>): ReturnType<typeof initialState>['cells'] {
  const line = '.'.repeat(9)
  return (Array.from({ length: 9 }, (_, r) =>
    [...(rows[r] ?? line)].map((ch) => (ch === '.' ? null : ch === 'b' ? 'black' : 'white')),
  ).flat()) as ReturnType<typeof initialState>['cells']
}

const pos = {
  ...initialState(),
  cells: board({ 1: '....w....', 4: '....b....' }),
  turn: 'black' as const,
  moveCount: 9,
}

for (const depth of [2, 3, 4]) {
  const t0 = Date.now()
  const scored = legalActions(pos).map((a) => ({
    a,
    v: -search(applyAction(pos, a), depth - 1, -Infinity, Infinity),
  }))
  scored.sort((x, y) => y.v - x.v)
  console.log(
    `profondeur ${depth} (${Date.now() - t0} ms) :`,
    scored.slice(0, 3).map((s) => `${s.a.kind}:${'row' in s.a ? s.a.row : ''},${'col' in s.a ? s.a.col : ''} → ${s.v}`),
  )
}

import { chooseAction as ca } from '../core/ai'
const allowed = legalActions(pos)
const dist: Record<string, number> = {}
for (let i = 0; i < 20; i++) {
  const choice = ca(pos, 'normal', allowed)
  const k = JSON.stringify(choice)
  dist[k] = (dist[k] ?? 0) + 1
}
console.log('chooseAction normal ×20 :', dist)
