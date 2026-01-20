import { tokens, type ThemeTokens } from './tokens'
import { lightTokens } from './lightTokens'

type ThemeMode = 'dark' | 'light'

const themeMap: Record<ThemeMode, ThemeTokens> = {
  dark: tokens,
  light: lightTokens,
}

const THEME_STORAGE_KEY = 'mw-theme-mode'

const applyTokens = (themeTokens: ThemeTokens) => {
  const root = document.documentElement
  Object.entries({
    '--color-background': themeTokens.colors.background,
    '--color-surface': themeTokens.colors.surface,
    '--color-surface-2': themeTokens.colors.surface2,
    '--color-border': themeTokens.colors.border,
    '--color-text-primary': themeTokens.colors.textPrimary,
    '--color-text-secondary': themeTokens.colors.textSecondary,
    '--color-accent': themeTokens.colors.accent,
    '--color-accent-hover': themeTokens.colors.accentHover,
    '--color-accent-ring': themeTokens.colors.accentRing,
    '--color-success': themeTokens.colors.success,
    '--color-warning': themeTokens.colors.warning,
    '--color-danger': themeTokens.colors.danger,
    '--color-info': themeTokens.colors.info,
    '--color-overlay-hover': themeTokens.colors.overlayHover,
    '--color-overlay-active': themeTokens.colors.overlayActive,
    '--color-overlay-selected': themeTokens.colors.overlaySelected,
    '--font-family-sans': themeTokens.typography.fontFamily,
    '--font-size-base': themeTokens.typography.baseFontSize,
    '--radius-xl': themeTokens.radii.xl,
    '--radius-2xl': themeTokens.radii['2xl'],
    '--shadow-soft': themeTokens.shadows.soft,
    '--shadow-popover': themeTokens.shadows.popover,
  }).forEach(([key, value]) => root.style.setProperty(key, value))
}

export const applyTheme = (mode: ThemeMode = 'dark') => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
  applyTokens(themeMap[mode])
}

export const getThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
  if (stored && themeMap[stored]) return stored
  return 'light'
}

export const setThemeMode = (mode: ThemeMode) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  applyTheme(mode)
}

export const toggleThemeMode = (): ThemeMode => {
  const next: ThemeMode = getThemeMode() === 'dark' ? 'light' : 'dark'
  setThemeMode(next)
  return next
}

export const setAccentColor = (hex: string) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--color-accent', hex)
}

export type { ThemeMode }
