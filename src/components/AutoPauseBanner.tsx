import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';

interface Props {
  onResume: () => void;
}

export default function AutoPauseBanner({ onResume }: Props) {
  return (
    <Pressable style={styles.banner} onPress={onResume}>
      <Text style={styles.text}>Auto-paused · Moving again? Keep going.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...elevation('card'),
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.surface,
  },
});
