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

  /** @deprecated aliases kept during the design-system migration — prefer the tokens above */
  rust: '#E84B2A',
  rustDark: '#C43A1D',
  aqua: '#4BABB8',
  sand: '#F2EDE5',
  green: '#4BAB7A',
  red: '#E13A3A',
  muted: '#8C8078',
  mutedLight: '#B0A898',
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',

  /** @deprecated aliases kept during the design-system migration */
  display: 'PlusJakartaSans_800ExtraBold',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodyBold: 'PlusJakartaSans_700Bold',
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

export {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/** Soft elevation shadow — the design system uses shadows only, never borders, to express elevation. */
export function elevation(level: 'subtle' | 'card' | 'sheet' | 'fab' | 'primaryBtn' | 'smallCta' = 'card') {
  switch (level) {
    case 'subtle':
      return {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      } as const;
    case 'sheet':
      return {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.11,
        shadowRadius: 32,
        elevation: 12,
      } as const;
    case 'fab':
      return {
        shadowColor: colors.coral,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 8,
      } as const;
    case 'primaryBtn':
      return {
        shadowColor: colors.coral,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
      } as const;
    case 'smallCta':
      return {
        shadowColor: colors.coral,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 4,
      } as const;
    case 'card':
    default:
      return {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 16,
        elevation: 4,
      } as const;
  }
}

/**
 * @deprecated Legacy neo-brutalist hard shadow + border, kept only so unmigrated
 * screens keep compiling during the design-system rollout. New/updated code
 * should use `elevation()` (shadow-only, no border) instead.
 */
export function brutalShadow(offset = 5) {
  return {
    borderWidth: 3,
    borderColor: colors.ink,
    boxShadow: `${offset}px ${offset}px 0px ${colors.ink}`,
  } as const;
}
