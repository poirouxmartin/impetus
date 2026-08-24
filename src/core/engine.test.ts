import { describe, expect, it } from 'vitest'
import { Action, Color, SIZE, applyAction, initialState, legalActions, setRules } from './rules'
import { analyse, engineActions, Analyzer, notation } from './engine'

const WIN = 1_000_000

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

describe('moteur d analyse', () => {
  it('génère exactement les coups légaux du moteur de règles', () => {
    let pos = initialState()
    for (let step = 0; step < 120; step++) {
      const moves = legalActions(pos)
      expect(serialize(engineActions(pos))).toBe(serialize(moves))
      if (moves.length === 0) break
      pos = applyAction(pos, moves[Math.floor(Math.random() * moves.length)])
    }
  })

  it('trouve la percée immédiate et la note en conséquence', () => {
    const pos = {
      ...initialState(),
      cells: (() => {
        const c: (Color | null)[] = Array(SIZE * SIZE).fill(null)
        c[7 * SIZE + 4] = 'black'
        c[0] = 'white'
        return c
      })(),
      reserves: { black: 5, white: 5 },
      turn: 'black' as const,
      moveCount: 10,
    }
    const a = analyse(pos, 400)
    expect(a).not.toBeNull()
    expect(a!.best!.action.kind).toBe('slide')
    expect(a!.best!.score).toBeGreaterThan(WIN - 100)
  })

  it('percée différée : arrivée incapturable = mat forcé vu par le moteur', () => {
    try {
      setRules({ breakthroughDelay: true })
      // Noir en e7, Blanc en a9 (hors de portée de e9) : l'arrivée en e9 décide
      const arrival = {
        ...initialState(),
        cells: (() => {
          const c: (Color | null)[] = Array(SIZE * SIZE).fill(null)
          c[6 * SIZE + 4] = 'black'
          c[8 * SIZE] = 'white'
          return c
        })(),
        reserves: { black: 5, white: 5 },
        turn: 'black' as const,
        moveCount: 10,
      }
      const a1 = analyse(arrival, 400)
      expect(a1).not.toBeNull()
      expect(a1!.best!.action.kind).toBe('slide')
      expect(a1!.best!.score).toBeGreaterThan(WIN - 100)
      // Blanc au trait après l'arrivée : aucune riposte n'évacue la menace → perdu
      const survived = applyAction(arrival, a1!.best!.action)
      expect(survived.turn).toBe('white')
      const a2 = analyse(survived, 400)
      expect(a2).not.toBeNull()
      expect(a2!.best!.score).toBeLessThan(-(WIN - 100))
    } finally {
      setRules()
    }
  })

  it('la notation est lisible', () => {
    expect(notation({ kind: 'place', row: 8, col: 3 })).toBe('poser d9')
    expect(
      notation({ kind: 'slide', row: 7, col: 4, dir: 'down' }),
    ).toBe('e8→e9')
  })

  it('produit des statistiques plausibles', () => {
    const a = analyse(initialState(), 300)
    expect(a).not.toBeNull()
    expect(a!.nodes).toBeGreaterThan(500)
    expect(a!.depth).toBeGreaterThanOrEqual(1)
    expect(Math.abs(a!.scoreBlackCp)).toBeLessThan(WIN / 2)
  })

  it('les paliers de l Analyzer progressent', () => {
    const az = new Analyzer(initialState())
    const a1 = az.step()
    const a2 = az.step()
    expect(a1).not.toBeNull()
    expect(a2).not.toBeNull()
    expect(a2!.depth).toBe((a1?.depth ?? 0) + 1)
  })
})
