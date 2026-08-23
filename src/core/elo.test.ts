import { describe, expect, it } from 'vitest'
import { expectedScore, updateRating } from './elo'

describe('expectedScore', () => {
  it('50/50 entre égaux', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5)
  })

  it('favorise le plus fort', () => {
    expect(expectedScore(1600, 1200)).toBeGreaterThan(0.85)
    expect(expectedScore(1200, 1600)).toBeLessThan(0.15)
  })
})

describe('updateRating', () => {
  it('victoire attendue rapporte presque rien', () => {
    const { rating, delta } = updateRating(1800, 1000, 1)
    expect(delta).toBeGreaterThanOrEqual(0)
    expect(delta).toBeLessThanOrEqual(2)
    expect(rating).toBe(1800 + delta)
  })

  it('victoire improbable rapporte beaucoup', () => {
    expect(updateRating(1000, 1800, 1).delta).toBeGreaterThanOrEqual(28)
  })

  it('l upset subi coûte le maximum, la défaite attendue presque rien', () => {
    expect(updateRating(1800, 1000, 0).delta).toBeLessThanOrEqual(-28)
    expect(Math.abs(updateRating(1000, 1800, 0).delta)).toBeLessThanOrEqual(2)
  })

  it('nul contre plus fort fait progresser', () => {
    expect(updateRating(1200, 1500, 0.5).delta).toBeGreaterThan(0)
  })

  it('plancher à 100', () => {
    expect(updateRating(101, 2400, 0).rating).toBeGreaterThanOrEqual(100)
  })
})
