import { describe, expect, it } from 'vitest'
import {
  Action,
  Color,
  Game,
  IllegalMoveError,
  SIZE,
  START_RESERVE,
  applyAction,
  idx,
  initialState,
  legalActions,
  outcome,
  other,
  positionHash,
  setRules,
  slideDestination,
  winnerAfter,
} from './rules'

/** Plateau depuis des lignes partielles : '.' vide, 'b' noir, 'w' blanc. */
function board(rows: Record<number, string> = {}): (Color | null)[] {
  const line = '.'.repeat(SIZE)
  return Array.from({ length: SIZE }, (_, r) =>
    [...(rows[r] ?? line)].map((ch) => (ch === '.' ? null : ch === 'b' ? 'black' : 'white')),
  ).flat()
}

describe('slideDestination', () => {
  it('s arrete au bout de la portée sur colonne vide', () => {
    expect(slideDestination(board(), 4, 4, 'up', 'black')).toEqual({ row: 1, col: 4, capture: false })
  })

  it('s arrete avant une pierre alliée', () => {
    const cells = board({ 2: '....b....', 4: '....b....' })
    expect(slideDestination(cells, 4, 4, 'up', 'black')).toEqual({ row: 3, col: 4, capture: false })
  })

  it('ne peut pas avancer si pierre alliée adjacente', () => {
    const cells = board({ 3: '....b....', 4: '....b....' })
    expect(slideDestination(cells, 4, 4, 'up', 'black')).toBeNull()
  })

  it('capture une pierre adverse à distance', () => {
    const cells = board({ 1: '....w....', 4: '....b....' })
    expect(slideDestination(cells, 4, 4, 'up', 'black')).toEqual({ row: 1, col: 4, capture: true })
  })

  it('capture une pierre adverse adjacente', () => {
    const cells = board({ 3: '....w....', 4: '....b....' })
    expect(slideDestination(cells, 4, 4, 'up', 'black')).toEqual({ row: 3, col: 4, capture: true })
  })

  it('ne capture pas au-delà de la portée : simple arrêt', () => {
    const cells = board({ 0: '....w....', 4: '....b....' })
    expect(slideDestination(cells, 4, 4, 'up', 'black')).toEqual({ row: 1, col: 4, capture: false })
  })
})

describe('actions légales', () => {
  it('pose uniquement sur sa rangée de départ', () => {
    const places = legalActions(initialState()).filter(
      (a): a is Extract<Action, { kind: 'place' }> => a.kind === 'place',
    )
    expect(places).toHaveLength(SIZE)
    expect(places.every((a) => a.row === 0)).toBe(true)
  })

  it('refuse la pose si réserve vide', () => {
    const pos = { ...initialState(), reserves: { black: 0, white: 10 } }
    expect(legalActions(pos).some((a) => a.kind === 'place')).toBe(false)
  })

  it('le swap n est disponible qu après le premier coup', () => {
    expect(legalActions(initialState()).some((a) => a.kind === 'swap')).toBe(false)
    const afterOne = applyAction(initialState(), { kind: 'place', row: 0, col: 4 })
    expect(afterOne.turn).toBe('white')
    expect(legalActions(afterOne).some((a) => a.kind === 'swap')).toBe(true)
  })
})

describe('applyAction', () => {
  it('place une pierre et décrémente la réserve', () => {
    const pos = applyAction(initialState(), { kind: 'place', row: 0, col: 3 })
    expect(pos.cells[3]).toBe('black')
    expect(pos.reserves.black).toBe(9)
    expect(pos.turn).toBe('white')
  })

  it('capture en retirant la pierre adverse', () => {
    const pos = {
      ...initialState(),
      cells: board({ 1: '....w....', 4: '....b....' }),
      turn: 'black' as const,
      moveCount: 5,
    }
    const next = applyAction(pos, { kind: 'slide', row: 4, col: 4, dir: 'up' })
    expect(next.cells[SIZE + 4]).toBe('black')
    expect(next.cells[4 * SIZE + 4]).toBeNull()
  })

  it('le swap miroir : la pierre noire devient blanche en position symétrique', () => {
    let pos = applyAction(initialState(), { kind: 'place', row: 0, col: 4 })
    pos = applyAction(pos, { kind: 'swap' })
    expect(pos.swapped).toBe(true)
    expect(pos.turn).toBe('black')
    expect(pos.cells[4]).toBeNull()
    const mirror = idx(SIZE - 1, SIZE - 1 - 4)
    expect(pos.cells[mirror]).toBe('white')
    expect(pos.reserves.black).toBe(START_RESERVE)
    expect(pos.reserves.white).toBe(START_RESERVE - 1)
    expect(legalActions(pos).some((a) => a.kind === 'swap')).toBe(false)
  })

  it('lance IllegalMoveError sur coup illégal', () => {
    expect(() => applyAction(initialState(), { kind: 'place', row: 5, col: 0 })).toThrow(
      IllegalMoveError,
    )
  })
})

describe('victoires', () => {
  it('percée : pierre sur la rangée adverse (variante immédiate)', () => {
    try {
      setRules({ breakthroughDelay: false })
      const before = {
        ...initialState(),
        cells: board({ 0: '....w....', 7: '....b....' }),
        reserves: { black: 5, white: 5 },
        moveCount: 8,
        turn: 'black' as const,
      }
      const after = applyAction(before, { kind: 'slide', row: 7, col: 4, dir: 'down' })
      expect(winnerAfter(after, 'black')).toBe('black')
    } finally {
      setRules()
    }
  })

  it('percée différée : arrivée = menace, riposte incapable de capturer = victoire', () => {
    // Noir arrive en e9 ; Blanc en a9 est hors de portée : la menace est incapturable.
    const before = {
      ...initialState(),
      cells: board({ 6: '....b....', 8: 'w........' }),
      reserves: { black: 5, white: 5 },
      moveCount: 8,
      turn: 'black' as const,
    }
    const after = applyAction(before, { kind: 'slide', row: 6, col: 4, dir: 'down' })
    expect(winnerAfter(after, 'black')).toBeNull()
    expect(winnerAfter(after, 'white')).toBe('black')
    expect(outcome(after, 'white', new Map())).toEqual({ winner: 'black', reason: 'percée' })
  })

  it('anéantissement : plus de pierres adverses ni de réserve', () => {
    const after = {
      ...initialState(),
      cells: board({ 2: '....b....' }),
      reserves: { black: 3, white: 0 },
      turn: 'white' as const,
      moveCount: 12,
    }
    expect(winnerAfter(after, 'black')).toBe('black')
  })

  it('immobilisation : aucun coup non répétitif disponible', () => {
    // Blanc vient de bouger (Noir gagnant potentiel). Blanc n'a plus de réserve ;
    // ses deux seuls coups (haut et gauche depuis le coin) ont déjà été vus 2 fois.
    const pos = {
      ...initialState(),
      cells: board({ 4: '....b....', 8: '........w' }),
      reserves: { black: 0, white: 0 },
      turn: 'white' as const,
      moveCount: 30,
    }
    const reps = new Map<string, number>()
    reps.set(positionHash(applyAction(pos, { kind: 'slide', row: 8, col: 8, dir: 'up' })), 2)
    reps.set(positionHash(applyAction(pos, { kind: 'slide', row: 8, col: 8, dir: 'left' })), 2)
    expect(outcome(pos, 'black', reps)).toEqual({ winner: 'black', reason: 'immobilisation' })
    // Sans historique, les coups existent : pas de fin.
    expect(outcome(pos, 'black', new Map())).toBeNull()
  })
})

describe('anti-répétition (Game)', () => {
  function shuffleGame(): Game {
    const g = new Game()
    g.play({ kind: 'place', row: 0, col: 0 })
    g.play({ kind: 'place', row: SIZE - 1, col: 1 })
    return g
  }

  /** Fait la navette avec le premier coup de glisse disponible ; vrai dès blocage. */
  function shuttleUntilBlocked(g: Game): boolean {
    for (let i = 0; i < 60; i++) {
      const slides = g.legalMoves().filter((a) => a.kind === 'slide')
      if (slides.length === 0) return true
      if (!g.play(slides[0])) return true
    }
    return false
  }

  it('bloque la navette infinie : le cycle finit par être interdit', () => {
    expect(shuttleUntilBlocked(shuffleGame())).toBe(true)
  })

  it('interdit la 3e occurrence d une position', () => {
    const g = new Game()
    g.play({ kind: 'place', row: 0, col: 0 })
    g.play({ kind: 'place', row: SIZE - 1, col: SIZE - 1 })
    const bDown = () => g.play({ kind: 'slide', row: 0, col: 0, dir: 'down' })
    const wUp = () => g.play({ kind: 'slide', row: SIZE - 1, col: SIZE - 1, dir: 'up' })
    const bBackUp = () => g.play({ kind: 'slide', row: 3, col: 0, dir: 'up' })
    const wBackDown = () => g.play({ kind: 'slide', row: 5, col: SIZE - 1, dir: 'down' })
    // Premier cycle complet : retour à la position initiale (2e occurrence, autorisé).
    expect(bDown()).toBe(true)
    expect(wUp()).toBe(true)
    expect(bBackUp()).toBe(true)
    expect(wBackDown()).toBe(true)
    // Second cycle : les états intermédiaires deviennent des 2es occurrences…
    expect(bDown()).toBe(true)
    expect(wUp()).toBe(true)
    expect(bBackUp()).toBe(true)
    // …mais refermer le cycle créerait une 3e occurrence : interdit.
    expect(wBackDown()).toBe(false)
    // Un autre coup reste jouable.
    expect(g.legalMoves()).not.toHaveLength(0)
  })

  it('undo restaure la position et les occurrences', () => {
    const g = new Game()
    const h0 = positionHash(g.position)
    g.play({ kind: 'place', row: 0, col: 4 })
    g.undo()
    expect(positionHash(g.position)).toBe(h0)
    expect(g.canUndo()).toBe(false)
    expect(g.play({ kind: 'place', row: 0, col: 4 })).toBe(true)
  })

  it('plus aucun coup jouable après victoire', () => {
    const g = new Game()
    g.winner = 'black'
    expect(g.play({ kind: 'place', row: 0, col: 0 })).toBe(false)
    expect(g.legalMoves()).toHaveLength(0)
  })
})

describe('divers', () => {
  it('other est involutif', () => {
    expect(other(other('black'))).toBe('black')
  })

  it('une partie neuve n a pas de gagnant', () => {
    expect(new Game().winner).toBeNull()
  })

  it('percée différée : la pierre doit survivre à une riposte', () => {
    try {
      setRules({ breakthroughDelay: true })
      // Noir vient d'arriver sur la rangée blanche : pas de victoire immédiate
      const arrival = { ...initialState(), cells: board({ 8: '....b....' }) }
      expect(winnerAfter(arrival, 'black')).toBeNull()
      // Blanc passe son tour de la capturer : la percée de Noir est confirmée
      expect(winnerAfter(arrival, 'white')).toBe('black')
      expect(outcome(arrival, 'white', new Map())).toEqual({ winner: 'black', reason: 'percée' })
      // Blanc capture : plus aucune percée
      const cleared = { ...initialState(), cells: board({ 8: '....w....' }) }
      expect(winnerAfter(cleared, 'white')).toBeNull()
    } finally {
      setRules()
    }
  })

  it('percée paramétrable : BREAKTHROUGH pierres requises sur la rangée adverse', () => {
    try {
      setRules({ breakthrough: 2, breakthroughDelay: false })
      const one = { ...initialState(), cells: board({ 8: '....b....' }) }
      expect(winnerAfter(one, 'black')).toBeNull()
      const two = { ...initialState(), cells: board({ 8: '.b..b....' }) }
      expect(winnerAfter(two, 'black')).toBe('black')
      expect(outcome(two, 'black', new Map())).toEqual({ winner: 'black', reason: 'percée' })
    } finally {
      setRules()
    }
  })

  it('setRules applique une variante puis restaure le standard', () => {
    try {
      setRules({ size: 7, reserve: 6, range: 2, occurrences: 1 })
      expect(SIZE).toBe(7)
      expect(START_RESERVE).toBe(6)
      const g = new Game()
      expect(g.position.cells).toHaveLength(49)
      expect(g.position.reserves.black).toBe(6)
      expect(g.play({ kind: 'place', row: 0, col: 3 })).toBe(true)
      expect(g.play({ kind: 'place', row: 6, col: 3 })).toBe(true)
      expect(g.play({ kind: 'slide', row: 0, col: 3, dir: 'down' })).toBe(true)
    } finally {
      setRules()
    }
    expect(SIZE).toBe(9)
    expect(START_RESERVE).toBe(10)
    expect(new Game().position.cells).toHaveLength(81)
  })
})
