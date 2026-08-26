import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { RaceDetails } from '../types/route';
import { isRaceDayUnlocked } from '../utils/racesApi';

interface Props {
  raceDetails: RaceDetails;
  onPress: () => void;
}

/**
 * Gated on race_date in the race's own timezone, not the device's — checked
 * on mount and re-checked every minute so a runner who has the run detail
 * screen open right at midnight sees the button appear without backing out
 * and back in.
 */
export default function RunThisRaceButton({ raceDetails, onPress }: Props) {
  const [unlocked, setUnlocked] = useState(() => isRaceDayUnlocked(raceDetails));

  useEffect(() => {
    setUnlocked(isRaceDayUnlocked(raceDetails));
    const interval = setInterval(() => setUnlocked(isRaceDayUnlocked(raceDetails)), 60_000);
    return () => clearInterval(interval);
  }, [raceDetails]);

  if (!unlocked) {
    return (
      <Pressable style={[styles.button, styles.buttonLocked]} disabled>
        <Text style={styles.textLocked}>Race unlocks on {raceDetails.raceDate}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.text}>RUN THIS RACE</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...elevation('primaryBtn'),
  },
  buttonLocked: {
    backgroundColor: colors.surface,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
    letterSpacing: 0.4,
  },
  textLocked: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
});
