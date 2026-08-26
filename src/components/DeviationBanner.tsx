import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';

interface Props {
  onPress: () => void;
}

export default function DeviationBanner({ onPress }: Props) {
  return (
    <Pressable style={styles.banner} onPress={onPress}>
      <Text style={styles.text}>You&apos;re off route · tap to see map</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...elevation('card'),
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
});
