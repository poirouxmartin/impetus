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
    line: 'rgba(38, 34, 26, 0.50)',
    campTopFill: 'rgba(138, 49, 32, 0.20)',
    campBottomFill: 'rgba(120, 140, 110, 0.16)',
    filetTop: 'rgba(212, 175, 110, 0.60)',
    filetBottom: 'rgba(212, 175, 110, 0.60)',
    placeDot: 'rgba(240, 230, 210, 0.38)',
    lastRing: 'rgba(212, 175, 110, 0.55)',
    lastRingSoft: 'rgba(212, 175, 110, 0.25)',
    selRing: '#D4AF6E',
    dotMove: 'rgba(212, 175, 110, 0.85)',
    dotCapture: 'rgba(176, 82, 47, 0.90)',
    blackG0: '#57503f',
    blackG1: '#141109',
    blackRim: 'rgba(212, 175, 110, 0.45)',
    whiteG0: '#fffdf4',
    whiteG1: '#cfc6ae',
    whiteRim: 'rgba(50, 42, 28, 0.55)',
  },
  light: {
    bg: '#BDAE92',
    line: 'rgba(80, 66, 44, 0.42)',
    campTopFill: 'rgba(138, 49, 32, 0.13)',
    campBottomFill: 'rgba(74, 107, 84, 0.14)',
    filetTop: 'rgba(138, 49, 32, 0.60)',
    filetBottom: 'rgba(74, 107, 84, 0.60)',
    placeDot: 'rgba(60, 48, 30, 0.45)',
    lastRing: 'rgba(138, 49, 32, 0.55)',
    lastRingSoft: 'rgba(138, 49, 32, 0.22)',
    selRing: '#8A3120',
    dotMove: 'rgba(74, 107, 84, 0.85)',
    dotCapture: 'rgba(138, 49, 32, 0.85)',
    blackG0: '#433c31',
    blackG1: '#0f0c09',
    blackRim: 'rgba(255, 255, 255, 0.30)',
    whiteG0: '#ffffff',
    whiteG1: '#d8cfbc',
    whiteRim: 'rgba(70, 58, 40, 0.55)',
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
  let t: ThemeName | null = null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') t = saved
  } catch {
    /* stockage indisponible */
  }
  if (!t) {
    t = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  apply(t)
  return t
}

export function toggleTheme(): ThemeName {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  apply(next)
  return next
}
