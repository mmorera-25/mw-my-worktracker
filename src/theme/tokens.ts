export const tokens = {
  colors: {
    background: '#0E0E10',
    surface: '#18181B',
    surface2: '#1F1F23',
    border: '#2A2A2E',
    textPrimary: '#E5E5E7',
    textSecondary: '#9CA3AF',
    accent: '#6366F1',
    accentHover: '#7C7FF5',
    accentRing: 'rgba(99,102,241,0.35)',
    success: '#22C55E',
    warning: '#EAB308',
    danger: '#EF4444',
    info: '#38BDF8',
    overlayHover: '#FFFFFF0F',
    overlayActive: '#FFFFFF1A',
    overlaySelected: '#FFFFFF14',
  },
  typography: {
    fontFamily:
      '"Inter", "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    baseFontSize: '15px',
  },
  radii: {
    xl: '1rem',
    '2xl': '1.25rem',
  },
  shadows: {
    soft: '0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)',
    popover: '0 12px 30px rgba(0,0,0,0.5)',
  },
} as const

export type ThemeTokens = typeof tokens
