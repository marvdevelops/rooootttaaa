import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';

export const TUTORIAL_STEP_COUNT = 4;

export type TutorialStep = 1 | 2 | 3 | 4;

interface StepContent {
  title: string;
  body: string;
}

const STEPS: Record<TutorialStep, StepContent> = {
  1: {
    title: "Let's build your first route",
    body: 'Tap anywhere on the map to drop your starting point.',
  },
  2: {
    title: 'Nice start!',
    body: 'Tap again to add your next stop — Rootah routes along real streets automatically, no straight lines.',
  },
  3: {
    title: 'Watch it update live',
    body: 'Distance and elevation up top update as you go. Drag any point on the line to reshape the route.',
  },
  4: {
    title: "You're ready",
    body: 'When you’re happy with it, tap the save icon below to name and store your route.',
  },
};

interface Props {
  step: TutorialStep;
  variant: 'sheet' | 'card';
  onSkip: () => void;
  onFinish: () => void;
}

export default function BuilderTutorial({ step, variant, onSkip, onFinish }: Props) {
  const { title, body } = STEPS[step];

  return (
    <View style={[styles.container, variant === 'sheet' ? styles.sheetContainer : styles.cardContainer]}>
      <View style={styles.headerRow}>
        <View style={styles.dots}>
          {Array.from({ length: TUTORIAL_STEP_COUNT }, (_, i) => i + 1).map((n) => (
            <View key={n} style={[styles.dot, n === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {step === TUTORIAL_STEP_COUNT && (
        <Pressable style={styles.finishButton} onPress={onFinish}>
          <Text style={styles.finishButtonText}>GOT IT</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.sheetBg,
    gap: 8,
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 46,
    ...elevation('sheet'),
  },
  cardContainer: {
    position: 'absolute',
    bottom: 108,
    left: 16,
    right: 16,
    borderRadius: radii.lg,
    padding: 16,
    ...elevation('card'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mist,
  },
  dotActive: {
    backgroundColor: colors.coral,
  },
  skipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.stone,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.stone,
    lineHeight: 20,
  },
  finishButton: {
    height: 48,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...elevation('primaryBtn'),
  },
  finishButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.surface,
    textAlign: 'center',
  },
});
