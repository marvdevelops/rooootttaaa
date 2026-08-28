import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

const STARS = [1, 2, 3, 4, 5];

interface DisplayProps {
  value: number;
  size?: number;
}

/** Read-only star row — rounds to the nearest whole star. */
export function StarRating({ value, size = 14 }: DisplayProps) {
  const rounded = Math.round(value);
  return (
    <View style={styles.row}>
      {STARS.map((s) => (
        <Text key={s} style={{ fontSize: size, color: s <= rounded ? colors.amber : colors.mist }}>
          ★
        </Text>
      ))}
    </View>
  );
}

interface InputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

/** Interactive star row — tap a star to set the rating. */
export function StarRatingInput({ value, onChange, size = 32 }: InputProps) {
  return (
    <View style={styles.row}>
      {STARS.map((s) => (
        <Pressable key={s} onPress={() => onChange(s)} hitSlop={6}>
          <Text style={{ fontSize: size, color: s <= value ? colors.amber : colors.mist }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 3,
  },
});
