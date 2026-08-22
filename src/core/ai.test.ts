import { describe, expect, it } from 'vitest'
import {
  Action,
  Color,
  SIZE,
  initialState,
  legalActions,
  slideDestination,
} from './rules'
import { chooseAction, isImmediateWin } from './ai'

function board(rows: Record<number, string> = {}): (Color | null)[] {
  const line = '.'.repeat(SIZE)
  return Array.from({ length: SIZE }, (_, r) =>
    [...(rows[r] ?? line)].map((ch) => (ch === '.' ? null : ch === 'b' ? 'black' : 'white')),
  ).flat()
}

function asSlide(action: Action | null): Extract<Action, { kind: 'slide' }> {
  expect(action?.kind).toBe('slide')
  return action as Extract<Action, { kind: 'slide' }>
}

describe('chooseAction', () => {
  it('saisit la percée immédiate, quel que soit le niveau', () => {
    const pos = {
      ...initialState(),
      cells: board({ 0: 'w........', 6: '....b....' }),
      turn: 'black' as const,
      moveCount: 10,
    }
    const allowed = legalActions(pos)
    for (const level of ['facile', 'normal', 'difficile'] as const) {
      const action = chooseAction(pos, level, allowed)
      expect(action).not.toBeNull()
      expect(isImmediateWin(pos, action!)).toBe(true)
    }
  })

  it('évite les glisses qui se font capturer', () => {
    const pos = {
      ...initialState(),
      cells: board({ 1: '.w.......', 4: '....b....' }),
      reserves: { black: 5, white: 5 },
      turn: 'black' as const,
      moveCount: 12,
    }
    const action = chooseAction(pos, 'difficile', legalActions(pos))
    expect(action).not.toBeNull()
    if (action!.kind === 'slide') {
      expect(['up', 'left']).not.toContain(action!.dir)
    }
  })

  it('choisit la capture disponible', () => {
    const pos = {
      ...initialState(),
      cells: board({ 1: '....w....', 4: '....b....' }),
      turn: 'black' as const,
      moveCount: 9,
    }
    for (const level of ['normal', 'difficile'] as const) {
      const slide = asSlide(chooseAction(pos, level, legalActions(pos)))
      const dest = slideDestination(pos.cells, slide.row, slide.col, slide.dir, 'black')
      expect(dest?.capture).toBe(true)
    }
  })

  it('retourne null sans coup disponible', () => {
    expect(chooseAction(initialState(), 'normal', [])).toBeNull()
  })

  it('facile reste dans les coups légaux', () => {
    const pos = initialState()
    const allowed = legalActions(pos)
    expect(allowed).toContain(chooseAction(pos, 'facile', allowed))
  })
})
