import { describe, expect, it } from 'vitest'
import {
  Action,
  SIZE,
  applyAction,
  initialState,
  legalActions,
  positionHash,
} from './rules'
import {
  Variant,
  hashV,
  initialStateV,
  legalActionsV,
  solve,
} from './solver'

function serialize(actions: Action[]): string {
  return JSON.stringify(
    actions
      .map((a) =>
        a.kind === 'slide'
          ? `s${a.row},${a.col},${a.dir}`
          : a.kind === 'place'
            ? `p${a.row},${a.col}`
            : 'swap',
      )
      .sort(),
  )
}

function toSolverPos(enginePos: ReturnType<typeof initialState>, v: Variant) {
  const s = initialStateV(v)
  s.cells = [...enginePos.cells]
  s.reserves = { ...enginePos.reserves }
  s.turn = enginePos.turn
  s.moveCount = enginePos.moveCount
  return s
}

describe('solveur (règles paramétrées)', () => {
  it('concorde avec le moteur sur des marches aléatoires standard', () => {
    const v: Variant = { size: SIZE, reserve: 10 }
    for (let walk = 0; walk < 40; walk++) {
      let pos = initialState()
      for (let step = 0; step < 150; step++) {
        const engineMoves = legalActions(pos)
        expect(serialize(legalActionsV(v, pos))).toBe(serialize(engineMoves))
        expect(hashV(v, toSolverPos(pos, v))).toBe(positionHash(pos))
        if (engineMoves.length === 0) break
        pos = applyAction(pos, engineMoves[Math.floor(Math.random() * engineMoves.length)])
      }
    }
  })

  it('résout une variante minuscule de façon exacte', () => {
    const r = solve({ size: 3, reserve: 1 }, initialStateV({ size: 3, reserve: 1 }))
    expect(r.status).toBe('exact')
    expect(typeof r.blackWinsWithPerfectPlay).toBe('boolean')
    expect(r.nodes).toBeGreaterThan(0)
  })
})
