export type ThemeName = 'dark' | 'light'

const STORAGE_KEY = 'impetus.theme.v1'

export interface BoardPalette {
  bg: string
  line: string
  coord: string
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
    // Ardoise bleutée — nuit froide, filets or
    bg: '#4b515c',
    line: 'rgba(12, 15, 20, 0.50)',
    coord: 'rgba(225, 230, 240, 0.55)',
    campTopFill: 'rgba(160, 60, 40, 0.18)',
    campBottomFill: 'rgba(96, 130, 160, 0.16)',
    filetTop: 'rgba(212, 175, 110, 0.55)',
    filetBottom: 'rgba(212, 175, 110, 0.55)',
    placeDot: 'rgba(230, 235, 245, 0.45)',
    lastRing: 'rgba(212, 175, 110, 0.65)',
    lastRingSoft: 'rgba(212, 175, 110, 0.30)',
    selRing: '#D4AF6E',
    dotMove: 'rgba(212, 175, 110, 0.90)',
    dotCapture: 'rgba(215, 100, 60, 0.95)',
    blackG0: '#3a3f4a',
    blackG1: '#101318',
    blackRim: 'rgba(200, 210, 225, 0.45)',
    whiteG0: '#f8fafc',
    whiteG1: '#c3cbd8',
    whiteRim: 'rgba(20, 26, 36, 0.65)',
  },
  light: {
    // Ivoire & sépia — jour chaud, encre sépia
    bg: '#D9CDB2',
    line: 'rgba(92, 74, 48, 0.40)',
    coord: 'rgba(92, 74, 48, 0.60)',
    campTopFill: 'rgba(150, 62, 38, 0.10)',
    campBottomFill: 'rgba(96, 118, 78, 0.12)',
    filetTop: 'rgba(150, 62, 38, 0.55)',
    filetBottom: 'rgba(96, 118, 78, 0.55)',
    placeDot: 'rgba(92, 74, 48, 0.45)',
    lastRing: 'rgba(150, 62, 38, 0.55)',
    lastRingSoft: 'rgba(150, 62, 38, 0.25)',
    selRing: '#8A3120',
    dotMove: 'rgba(70, 104, 78, 0.90)',
    dotCapture: 'rgba(150, 62, 38, 0.90)',
    blackG0: '#4a4238',
    blackG1: '#171310',
    blackRim: 'rgba(255, 252, 244, 0.40)',
    whiteG0: '#fffdf6',
    whiteG1: '#ded2ba',
    whiteRim: 'rgba(92, 74, 48, 0.70)',
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
