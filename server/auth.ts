import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { updateRating } from '../src/core/elo'

const DATA_DIR = join(process.cwd(), 'data')
const USERS_FILE = join(DATA_DIR, 'users.json')
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json')

export interface User {
  name: string
  hash: string
  salt: string
  rating: number
  wins: number
  losses: number
  draws: number
  curve: number[]
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

let users: Record<string, User> = {}
let sessions: Record<string, string> = {}

try {
  mkdirSync(DATA_DIR, { recursive: true })
} catch {
  /* déjà présent */
}

function flushUsers(): void {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}
function flushSessions(): void {
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
}
users = readJson(USERS_FILE, {} as Record<string, User>)
sessions = readJson(SESSIONS_FILE, {} as Record<string, string>)

const NAME_RE = /^[A-Za-z0-9_-]{3,16}$/

function hashOf(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString('hex')
}

function verify(user: User, password: string): boolean {
  const candidate = Buffer.from(hashOf(password, user.salt), 'hex')
  const reference = Buffer.from(user.hash, 'hex')
  return candidate.length === reference.length && timingSafeEqual(candidate, reference)
}

export interface PublicUser {
  name: string
  rating: number
  wins: number
  losses: number
  draws: number
}

function pub(u: User): PublicUser {
  const { name, rating, wins, losses, draws } = u
  return { name, rating, wins, losses, draws }
}

export type AuthResult =
  | { ok: true; token: string; user: PublicUser }
  | { ok: false; error: string }

export function register(name: unknown, password: unknown): AuthResult {
  const clean = String(name ?? '').trim()
  const pass = String(password ?? '')
  if (!NAME_RE.test(clean)) {
    return { ok: false, error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, _ ou -)' }
  }
  if (pass.length < 4) return { ok: false, error: 'Mot de passe : 4 caractères minimum' }
  if (users[clean.toLowerCase()]) return { ok: false, error: 'Pseudo déjà pris' }
  const salt = randomBytes(8).toString('hex')
  const user: User = {
    name: clean,
    salt,
    hash: hashOf(pass, salt),
    rating: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    curve: [],
  }
  users[clean.toLowerCase()] = user
  flushUsers()
  return { ok: true, ...openSession(clean.toLowerCase()) }
}

export function login(name: unknown, password: unknown): AuthResult {
  const key = String(name ?? '').trim().toLowerCase()
  const user = users[key]
  if (!user || !verify(user, String(password ?? ''))) {
    return { ok: false, error: 'Pseudo ou mot de passe incorrect' }
  }
  return { ok: true, ...openSession(key) }
}

function openSession(key: string): { token: string; user: PublicUser } {
  const token = randomBytes(18).toString('hex')
  sessions[token] = key
  flushSessions()
  return { token, user: pub(users[key]) }
}

/** Retrouve un utilisateur depuis un jeton ; null si jeton inconnu/expiré. */
export function userByToken(token: unknown): User | null {
  if (typeof token !== 'string') return null
  const key = sessions[token]
  if (!key) return null
  return users[key] ?? null
}

export function publicByName(name: string | undefined | null): PublicUser | null {
  if (!name) return null
  const u = users[name.toLowerCase()]
  return u ? pub(u) : null
}

/** Applique et persiste un résultat classé entre deux comptes. */
export function applyRanked(
  winnerAccount: string,
  loserAccount: string,
): [{ delta: number; user: PublicUser }, { delta: number; user: PublicUser }] {
  const w = users[winnerAccount.toLowerCase()]
  const l = users[loserAccount.toLowerCase()]
  const rw = updateRating(w.rating, l.rating, 1, 24)
  const rl = updateRating(l.rating, w.rating, 0, 24)
  w.rating = rw.rating
  l.rating = rl.rating
  w.wins++
  l.losses++
  w.curve = [...w.curve, w.rating].slice(-60)
  l.curve = [...l.curve, l.rating].slice(-60)
  flushUsers()
  return [
    { delta: rw.delta, user: pub(w) },
    { delta: rl.delta, user: pub(l) },
  ]
}
