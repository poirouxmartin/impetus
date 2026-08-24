export type ThemeName = 'dark' | 'light'

const STORAGE_KEY = 'impetus.theme.v1'

export interface BoardPalette {
  bg: string
  line: string
  campTopFill: string
  campBottomFill: string
  filetTop: string
  filetBottom: string
  placeDot: string
  lastRing: string
  lastRingSoft: string
  selRing: string
  dotMove: string
  dotCapture: string
  blackG0: string
  blackG1: string
  blackRim: string
  whiteG0: string
  whiteG1: string
  whiteRim: string
}

export const BOARD: Record<ThemeName, BoardPalette> = {
  dark: {
    bg: '#6E6858',
    line: 'rgba(30, 27, 20, 0.55)',
    campTopFill: 'rgba(138, 49, 32, 0.12)',
    campBottomFill: 'rgba(110, 130, 100, 0.12)',
    filetTop: 'rgba(212, 175, 110, 0.55)',
    filetBottom: 'rgba(212, 175, 110, 0.55)',
    placeDot: 'rgba(240, 230, 210, 0.45)',
    lastRing: 'rgba(212, 175, 110, 0.60)',
    lastRingSoft: 'rgba(212, 175, 110, 0.28)',
    selRing: '#D4AF6E',
    dotMove: 'rgba(212, 175, 110, 0.90)',
    dotCapture: 'rgba(200, 90, 50, 0.95)',
    blackG0: '#57503f',
    blackG1: '#141109',
    blackRim: 'rgba(212, 175, 110, 0.50)',
    whiteG0: '#fffdf4',
    whiteG1: '#cfc6ae',
    whiteRim: 'rgba(40, 32, 20, 0.60)',
  },
  light: {
    bg: '#B5A789',
    line: 'rgba(70, 58, 40, 0.50)',
    campTopFill: 'rgba(138, 49, 32, 0.10)',
    campBottomFill: 'rgba(74, 107, 84, 0.12)',
    filetTop: 'rgba(138, 49, 32, 0.65)',
    filetBottom: 'rgba(74, 107, 84, 0.65)',
    placeDot: 'rgba(50, 40, 24, 0.50)',
    lastRing: 'rgba(138, 49, 32, 0.60)',
    lastRingSoft: 'rgba(138, 49, 32, 0.25)',
    selRing: '#8A3120',
    dotMove: 'rgba(58, 90, 66, 0.90)',
    dotCapture: 'rgba(138, 49, 32, 0.90)',
    blackG0: '#3f3930',
    blackG1: '#0f0c09',
    blackRim: 'rgba(255, 255, 255, 0.35)',
    whiteG0: '#ffffff',
    whiteG1: '#d8cfbc',
    whiteRim: 'rgba(60, 48, 30, 0.65)',
  },
}

export function currentTheme(): ThemeName {
  const t = document.documentElement.dataset.theme
  return t === 'light' ? 'light' : 'dark'
}

function apply(t: ThemeName): void {
  document.documentElement.dataset.theme = t
  localStorage.setItem(STORAGE_KEY, t)
}

export function initTheme(): ThemeName {
  let t: ThemeName = 'dark'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') t = saved
  } catch {
    /* stockage indisponible */
  }
  apply(t)
  return t
}

export function toggleTheme(): ThemeName {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  apply(next)
  return next
}
