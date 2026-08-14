import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';

interface Props {
  showWordmark?: boolean;
  size?: number;
}

export default function Logo({ showWordmark = true, size = 36 }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <Svg width={size * 0.55} height={size * 0.33} viewBox="0 0 52 30">
          <Path
            d="M9,15 C16,3 22,27 26,15 S36,3 43,15"
            fill="none"
            stroke={colors.ink}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle cx={9} cy={15} r={6.5} fill={colors.rust} stroke={colors.ink} strokeWidth={3.6} />
          <Circle cx={43} cy={15} r={6.5} fill={colors.rust} stroke={colors.ink} strokeWidth={3.6} />
        </Svg>
      </View>
      {showWordmark && <Text style={styles.wordmark}>rootah</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    backgroundColor: colors.rust,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
});
