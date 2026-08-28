import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';

interface Props {
  size?: 'sm' | 'md';
}

/** Small coral "PRO" pill shown next to a username for accounts on the paid tier. */
export default function ProBadge({ size = 'sm' }: Props) {
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, isSmall ? styles.badgeSm : styles.badgeMd]}>
      <Text style={[styles.text, isSmall ? styles.textSm : styles.textMd]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.coral,
    borderRadius: radii.xs,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fonts.bold,
    color: colors.white,
    letterSpacing: 0.4,
  },
  textSm: {
    fontSize: 9,
  },
  textMd: {
    fontSize: 10,
  },
});
