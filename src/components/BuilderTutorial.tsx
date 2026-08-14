import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';

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
    backgroundColor: colors.sand,
    borderWidth: 4,
    borderColor: colors.ink,
    gap: 8,
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 46,
  },
  cardContainer: {
    position: 'absolute',
    bottom: 108,
    left: 16,
    right: 16,
    borderRadius: 18,
    padding: 16,
    ...brutalShadow(4),
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
    backgroundColor: colors.mutedLight,
  },
  dotActive: {
    backgroundColor: colors.rust,
  },
  skipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  finishButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...brutalShadow(3),
  },
  finishButtonText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.sand,
  },
});
