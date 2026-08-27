import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/theme';
import { RaceFlagIcon } from './icons';

export default function RaceBadge() {
  return (
    <View style={styles.badge}>
      <RaceFlagIcon size={12} color={colors.white} />
      <Text style={styles.text}>RACE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.white,
  },
});
