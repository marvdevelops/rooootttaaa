import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';

interface Props {
  showWordmark?: boolean;
  size?: number;
  /** Render the mark alone, without its rounded background container (e.g. for use on a dark/red surface). */
  bare?: boolean;
}

export default function Logo({ showWordmark = true, size = 36, bare = false }: Props) {
  const mark = (
    <Svg width={size * (bare ? 1 : 0.62)} height={size * (bare ? 1 : 0.62) * (140 / 120)} viewBox="-8 -4 116 136">
      <Path
        d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
        stroke={colors.white}
        strokeWidth={10}
        fill="none"
        strokeLinecap="square"
      />
      <Circle cx={26} cy={24} r={22} fill={colors.white} />
      <Circle cx={74} cy={104} r={19} fill={colors.white} />
      <Circle cx={74} cy={104} r={5} fill={colors.coral} />
    </Svg>
  );

  return (
    <View style={styles.row}>
      {bare ? (
        mark
      ) : (
        <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>{mark}</View>
      )}
      {showWordmark && <Text style={styles.wordmark}>rootah</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  mark: {
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.coral,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  wordmark: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: -0.5,
  },
});
