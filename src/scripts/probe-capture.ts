import { initialState, applyAction, legalActions, slideDestination } from '../core/rules'
import { evaluate, chooseAction } from '../core/ai'

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

const capture = { kind: 'slide' as const, row: 4, col: 4, dir: 'up' as const }
const place = { kind: 'place' as const, row: 0, col: 2 }

const afterCapture = applyAction(pos, capture)
const afterPlace = applyAction(pos, place)
console.log('eval après capture :', evaluate(afterCapture, 'black'))
console.log('eval après place   :', evaluate(afterPlace, 'black'))

const dest = slideDestination(pos.cells, 4, 4, 'up', 'black')
console.log('dest capture:', dest)

for (const level of ['normal', 'difficile'] as const) {
  const choice = chooseAction(pos, level, legalActions(pos))
  console.log(`choix ${level} :`, JSON.stringify(choice))
}
