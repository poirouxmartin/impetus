import type { Action, Color } from '../core/rules'
import { updateRating } from '../core/elo'

export type RankedLevel = 'facile' | 'normal' | 'difficile'
export type LevelKey = RankedLevel | 'hotseat' | 'online'

export const LEVEL_RATING: Record<RankedLevel, number> = {
  facile: 700,
  normal: 1200,
  difficile: 1650,
}

export interface LevelStat {
  rating: number
  wins: number
  losses: number
  draws: number
}

export interface Profile {
  pseudo: string
  created: number
  levels: Record<RankedLevel, LevelStat>
  curve: Partial<Record<RankedLevel, number[]>>
}

export interface GameRecord {
  id: number
  ts: number
  level: LevelKey
  color: Color
  result: 'win' | 'loss' | 'draw'
  reason: string
  plies: number
  moves: Action[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

const PROFILE_KEY = 'impetus.profile.v1'
const HISTORY_KEY = 'impetus.history.v1'
const HISTORY_CAP = 200

export function emptyProfile(): Profile {
  const stat = (): LevelStat => ({ rating: 0, wins: 0, losses: 0, draws: 0 })
  return {
    pseudo: 'Joueur',
    created: Date.now(),
    levels: {
      facile: { ...stat(), rating: LEVEL_RATING.facile },
      normal: { ...stat(), rating: LEVEL_RATING.normal },
      difficile: { ...stat(), rating: LEVEL_RATING.difficile },
    },
    curve: {},
  }
}

function isRankedLevel(k: string): k is RankedLevel {
  return k === 'facile' || k === 'normal' || k === 'difficile'
}

export function loadProfile(s: StorageLike): Profile {
  const base = emptyProfile()
  try {
    const raw = s.getItem(PROFILE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Profile>
    const savedLevels = (parsed.levels ?? {}) as Partial<Profile['levels']>
    for (const key of ['facile', 'normal', 'difficile'] as RankedLevel[]) {
      const saved = savedLevels[key]
      base.levels[key] = {
        rating:
          typeof saved?.rating === 'number' && saved.rating > 0 ? saved.rating : LEVEL_RATING[key],
        wins: saved?.wins ?? 0,
        losses: saved?.losses ?? 0,
        draws: saved?.draws ?? 0,
      }
    }
    return {
      pseudo: typeof parsed.pseudo === 'string' && parsed.pseudo ? parsed.pseudo : base.pseudo,
      created: typeof parsed.created === 'number' ? parsed.created : Date.now(),
      levels: base.levels,
      curve: parsed.curve ?? {},
    }
  } catch {
    return base
  }
}

export function saveProfile(s: StorageLike, p: Profile): void {
  s.setItem(PROFILE_KEY, JSON.stringify(p))
}

export function loadHistory(s: StorageLike): GameRecord[] {
  try {
    const raw = s.getItem(HISTORY_KEY)
    const parsed = raw ? (JSON.parse(raw) as GameRecord[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(s: StorageLike, records: GameRecord[]): void {
  s.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, HISTORY_CAP)))
}

/**
 * Applique un résultat classé au profil (mutation) et retourne la variation Elo.
 * Les parties hot-seat ne sont jamais classées.
 */
export function applyResult(
  p: Profile,
  level: LevelKey,
  result: 'win' | 'loss' | 'draw',
): number {
  if (!isRankedLevel(level)) return 0
  const stat = p.levels[level]
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0
  const { rating, delta } = updateRating(stat.rating, LEVEL_RATING[level], actual)
  stat.rating = rating
  if (result === 'win') stat.wins++
  else if (result === 'loss') stat.losses++
  else stat.draws++
  const curve = p.curve[level] ?? []
  curve.push(rating)
  p.curve[level] = curve.slice(-60)
  return delta
}
