import { describe, expect, it } from 'vitest'
import {
  MemoryStorage,
  applyResult,
  emptyProfile,
  loadHistory,
  loadProfile,
  saveHistory,
  saveProfile,
} from './store'

describe('profil', () => {
  it('tourne au rond-trip localStorage', () => {
    const s = new MemoryStorage()
    const p = emptyProfile()
    p.pseudo = 'Martin'
    saveProfile(s, p)
    const loaded = loadProfile(s)
    expect(loaded.pseudo).toBe('Martin')
    expect(loaded.levels.normal.rating).toBe(1200)
  })

  it('répare un profil corrompu', () => {
    const s = new MemoryStorage()
    s.setItem('impetus.profile.v1', '{oops')
    expect(loadProfile(s).pseudo).toBe('Joueur')
  })

  it('applyResult met à jour Elo, compteurs et courbe', () => {
    const p = emptyProfile()
    const d1 = applyResult(p, 'difficile', 'win')
    expect(d1).toBeGreaterThan(10)
    expect(p.levels.difficile.wins).toBe(1)
    expect(p.curve.difficile).toHaveLength(1)
    const afterWin = p.levels.difficile.rating
    const d2 = applyResult(p, 'difficile', 'loss')
    expect(d2).toBeLessThan(-10)
    expect(p.levels.difficile.rating).toBe(afterWin + d2)
    expect(p.levels.difficile.losses).toBe(1)
    expect(p.curve.difficile).toHaveLength(2)
    expect(applyResult(p, 'hotseat', 'win')).toBe(0)
  })
})

describe('historique', () => {
  it('sauvegarde et recharge les parties', () => {
    const s = new MemoryStorage()
    const rec = {
      id: 1,
      ts: Date.now(),
      level: 'normal' as const,
      color: 'black' as const,
      result: 'win' as const,
      reason: 'percée',
      plies: 24,
      moves: [],
    }
    saveHistory(s, [rec])
    expect(loadHistory(s)[0].reason).toBe('percée')
  })
})
