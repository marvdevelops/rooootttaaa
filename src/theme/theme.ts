export const colors = {
  cream: '#EFE9DC',
  mapBg: '#F2EEE2',
  ink: '#222A2A',
  rust: '#EC4624',
  rustDark: '#C43A1D',
  aqua: '#4FBBBC',
  sand: '#E2DAC2',
  amber: '#F39120',
  green: '#3FA34D',
  red: '#E13A3A',
  white: '#FFFFFF',
  muted: '#5b5548',
  mutedLight: '#8a7a6a',
} as const;

export const fonts = {
  display: 'ArchivoBlack_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodyBold: 'SpaceGrotesk_700Bold',
} as const;

export { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
export { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';

/** Hard-edged neo-brutalist drop shadow, offset with no blur, plus a matching ink border. */
export function brutalShadow(offset = 5) {
  return {
    borderWidth: 3,
    borderColor: colors.ink,
    boxShadow: `${offset}px ${offset}px 0px ${colors.ink}`,
  } as const;
}
