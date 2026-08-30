import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { ActivityType } from '../types/route';

const OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail run' },
  { value: 'walk', label: 'Walk' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
];

interface Props {
  /** Currently selected activities (at least one should stay selected). */
  value: ActivityType[];
  onChange: (next: ActivityType[]) => void;
}

/** Multi-select activity chips — used when creating/editing a club. Keeps at
 * least one selected (tapping the last remaining one is a no-op). */
export default function ActivityPicker({ value, onChange }: Props) {
  const toggle = (activity: ActivityType) => {
    if (value.includes(activity)) {
      if (value.length === 1) return;
      onChange(value.filter((a) => a !== activity));
    } else {
      onChange([...value, activity]);
    }
  };

  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const on = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => toggle(opt.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  chipOn: {
    backgroundColor: colors.coral,
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  chipTextOn: {
    color: colors.white,
  },
});
