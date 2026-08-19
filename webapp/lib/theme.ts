// Mirrors src/theme/theme.ts on mobile — one design system, three runtimes
// (mobile RN, the rootah.com marketing site, and this app). CSS custom
// properties in app/globals.css carry the same values for stylesheet/
// className-based styling; these JS exports are for places that need the
// raw value (inline style props, canvas/SVG drawing, JS logic).

export const colors = {
  coral: '#E84B2A',
  cream: '#F2EDE5',
  surface: '#FFFFFF',
  sheetBg: '#F7F3ED',
  ink: '#1A1614',
  stone: '#8C8078',
  mist: '#B0A898',
  mapBg: '#E5E0D8',
  teal: '#4BABB8',
  amber: '#E8923A',
  sage: '#4BAB7A',
  danger: '#E13A3A',
  white: '#FFFFFF',
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 17,
  lg: 23,
  pill: 50,
  fab: 18,
  icon: 11,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
} as const;

/** Soft elevation shadow (CSS box-shadow string) — shadows only, never borders, matching mobile's elevation(). */
export function elevation(level: 'subtle' | 'card' | 'sheet' | 'fab' | 'primaryBtn' | 'smallCta' = 'card'): string {
  switch (level) {
    case 'subtle':
      return '0 2px 8px rgba(0,0,0,.06)';
    case 'sheet':
      return '0 -4px 32px rgba(0,0,0,.11)';
    case 'fab':
      return '0 6px 20px rgba(232,75,42,.45)';
    case 'primaryBtn':
      return '0 4px 12px rgba(232,75,42,.3)';
    case 'smallCta':
      return '0 3px 10px rgba(232,75,42,.3)';
    case 'card':
    default:
      return '0 4px 16px rgba(0,0,0,.07)';
  }
}
