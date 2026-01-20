import type { ThemeTokens } from './tokens'

export const lightTokens: ThemeTokens = {
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surface2: '#F1F5F9',
    border: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    accent: '#4F46E5',
    accentHover: '#6050F6',
    accentRing: 'rgba(79,70,229,0.35)',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',
    overlayHover: '#0F172A0D',
    overlayActive: '#0F172A1A',
    overlaySelected: '#0F172A14',
  },
  typography: {
    fontFamily: '"Inter", "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    baseFontSize: '15px',
  },
  radii: {
    xl: '1rem',
    '2xl': '1.25rem',
  },
  shadows: {
    soft: '0 1px 0 rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.12)',
    popover: '0 12px 30px rgba(15,23,42,0.15)',
  },
}
