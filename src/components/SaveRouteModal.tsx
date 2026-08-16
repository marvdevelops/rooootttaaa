import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { ActivityType, PathPoint, TrailDifficulty, TrailSurface } from '../types/route';
import { generateRouteName } from '../utils/routeName';
import { TrailInfoInput } from '../utils/trailInfoApi';
import ElevationProfileChart from './ElevationProfileChart';
import { CloseIcon } from './icons';

interface Props {
  visible: boolean;
  distanceKm: number;
  elevationGainM: number;
  elevationPath: PathPoint[];
  isSaving: boolean;
  isEditing?: boolean;
  initialName?: string;
  initialDescription?: string;
  initialActivityType?: ActivityType;
  /** Reverse-geocoded city for the route's start point, if resolved yet — folded into the auto-generated name. */
  suggestedCity?: string | null;
  /** Last activity type the user picked, remembered across saves so it doesn't reset to Run every time. */
  defaultActivityType?: ActivityType;
  onClose: () => void;
  /** trailInfo is null when the activity isn't trail_run/hike, or the user skipped the trail step. */
  onSave: (name: string, description: string, activityType: ActivityType, trailInfo: TrailInfoInput | null) => void;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail Run' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
  { value: 'other', label: 'Other' },
];

const SURFACE_OPTIONS: { value: TrailSurface; label: string }[] = [
  { value: 'gravel', label: 'Gravel' },
  { value: 'dirt', label: 'Dirt' },
  { value: 'rock', label: 'Rock' },
  { value: 'mixed', label: 'Mixed' },
];

const DIFFICULTY_OPTIONS: { value: TrailDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
];

const EMPTY_TRAIL_INFO: TrailInfoInput = {
  surface: null,
  technicalDifficulty: null,
  hasWaterCrossing: false,
  hasStream: false,
  isShaded: false,
  isDogFriendly: false,
  requiresPermit: false,
  conditionNote: null,
};

function isTrailActivity(activityType: ActivityType): boolean {
  return activityType === 'trail_run' || activityType === 'hike';
}

export default function SaveRouteModal({
  visible,
  distanceKm,
  elevationGainM,
  elevationPath,
  isSaving,
  isEditing = false,
  initialName,
  initialDescription,
  initialActivityType,
  suggestedCity,
  defaultActivityType,
  onClose,
  onSave,
}: Props) {
  const [step, setStep] = useState<'basics' | 'trail'>('basics');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [showDescription, setShowDescription] = useState(false);
  const [trailInfo, setTrailInfo] = useState<TrailInfoInput>(EMPTY_TRAIL_INFO);
  const nameInputRef = useRef<TextInput>(null);

  const peakElevationM = useMemo(() => {
    const elevations = elevationPath.map((p) => p.elevation).filter((e): e is number => typeof e === 'number');
    return elevations.length > 0 ? Math.max(...elevations) : null;
  }, [elevationPath]);

  useEffect(() => {
    if (visible) {
      const startingActivityType = initialActivityType ?? defaultActivityType ?? 'run';
      setStep('basics');
      setName(initialName ?? generateRouteName(suggestedCity ?? null, startingActivityType));
      setDescription(initialDescription ?? '');
      setActivityType(startingActivityType);
      setShowDescription(!!initialDescription);
      setTrailInfo(EMPTY_TRAIL_INFO);
      // Text pre-selected so typing replaces the auto-generated name immediately.
      setTimeout(() => nameInputRef.current?.setNativeProps({ selection: { start: 0, end: 999 } }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleContinue = () => {
    if (isTrailActivity(activityType)) {
      setStep('trail');
    } else {
      onSave(name.trim(), description.trim(), activityType, null);
    }
  };

  const handleTrailSave = () => {
    onSave(name.trim(), description.trim(), activityType, trailInfo);
  };

  const handleTrailSkip = () => {
    onSave(name.trim(), description.trim(), activityType, null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          {step === 'basics' ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerRow}>
                <Text style={styles.title}>{isEditing ? 'Update route' : 'Save route'}</Text>
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <CloseIcon size={16} />
                </Pressable>
              </View>

              <Text style={styles.subtitle}>
                {distanceKm.toFixed(2)} km · +{Math.round(elevationGainM)} m gain
                {peakElevationM !== null ? ` · ${Math.round(peakElevationM)} m peak` : ''}
              </Text>

              {elevationPath.length >= 2 && <ElevationProfileChart path={elevationPath} compact />}

              <View>
                <Text style={styles.label}>ACTIVITY</Text>
                <View style={styles.activityRow}>
                  {ACTIVITY_OPTIONS.map((option) => {
                    const active = activityType === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.activityPill, active && styles.activityPillActive]}
                        onPress={() => setActivityType(option.value)}
                      >
                        <Text style={[styles.activityPillText, active && styles.activityPillTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={styles.label}>NAME</Text>
                <TextInput
                  ref={nameInputRef}
                  value={name}
                  onChangeText={setName}
                  placeholder="Sunday long run"
                  placeholderTextColor={colors.mutedLight}
                  style={styles.input}
                  maxLength={60}
                />
              </View>

              {showDescription ? (
                <View>
                  <Text style={styles.label}>DESCRIPTION</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional notes — surface, effort, weather..."
                    placeholderTextColor={colors.mutedLight}
                    style={[styles.input, styles.textArea]}
                    multiline
                    maxLength={280}
                    autoFocus
                  />
                </View>
              ) : (
                <Pressable onPress={() => setShowDescription(true)} hitSlop={8}>
                  <Text style={styles.addDetailsLink}>+ Add details</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
                onPress={handleContinue}
                disabled={!name.trim() || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isTrailActivity(activityType) ? 'NEXT: TRAIL DETAILS' : isEditing ? 'UPDATE ROUTE' : 'SAVE ROUTE'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.title}>Trail details</Text>
                  <Text style={styles.subtitle}>Optional — helps others know what to expect</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <CloseIcon size={16} />
                </Pressable>
              </View>

              <View>
                <Text style={styles.label}>SURFACE</Text>
                <View style={styles.chipRow}>
                  {SURFACE_OPTIONS.map((option) => {
                    const active = trailInfo.surface === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setTrailInfo((f) => ({ ...f, surface: active ? null : option.value }))}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={styles.label}>TECHNICAL DIFFICULTY</Text>
                <View style={styles.chipRow}>
                  {DIFFICULTY_OPTIONS.map((option) => {
                    const active = trailInfo.technicalDifficulty === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() =>
                          setTrailInfo((f) => ({ ...f, technicalDifficulty: active ? null : option.value }))
                        }
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={styles.label}>TRAIL FEATURES</Text>
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, trailInfo.hasWaterCrossing && styles.chipActive]}
                    onPress={() => setTrailInfo((f) => ({ ...f, hasWaterCrossing: !f.hasWaterCrossing }))}
                  >
                    <Text style={[styles.chipText, trailInfo.hasWaterCrossing && styles.chipTextActive]}>
                      💧 Water crossing
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.chip, trailInfo.hasStream && styles.chipActive]}
                    onPress={() => setTrailInfo((f) => ({ ...f, hasStream: !f.hasStream }))}
                  >
                    <Text style={[styles.chipText, trailInfo.hasStream && styles.chipTextActive]}>🏞 Stream nearby</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.chip, trailInfo.isShaded && styles.chipActive]}
                    onPress={() => setTrailInfo((f) => ({ ...f, isShaded: !f.isShaded }))}
                  >
                    <Text style={[styles.chipText, trailInfo.isShaded && styles.chipTextActive]}>🌲 Shaded</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.chip, trailInfo.isDogFriendly && styles.chipActive]}
                    onPress={() => setTrailInfo((f) => ({ ...f, isDogFriendly: !f.isDogFriendly }))}
                  >
                    <Text style={[styles.chipText, trailInfo.isDogFriendly && styles.chipTextActive]}>🐕 Dog friendly</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.chip, trailInfo.requiresPermit && styles.chipActive]}
                    onPress={() => setTrailInfo((f) => ({ ...f, requiresPermit: !f.requiresPermit }))}
                  >
                    <Text style={[styles.chipText, trailInfo.requiresPermit && styles.chipTextActive]}>
                      📋 Permit required
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View>
                <Text style={styles.label}>CURRENT CONDITIONS (OPTIONAL)</Text>
                <TextInput
                  value={trailInfo.conditionNote ?? ''}
                  onChangeText={(v) => setTrailInfo((f) => ({ ...f, conditionNote: v }))}
                  placeholder="e.g. Muddy after rain, stream is knee-deep in August"
                  placeholderTextColor={colors.mutedLight}
                  style={[styles.input, styles.textArea]}
                  multiline
                  maxLength={200}
                />
              </View>

              <Pressable style={styles.saveButton} onPress={handleTrailSave} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.saveButtonText}>{isEditing ? 'UPDATE ROUTE' : 'SAVE ROUTE'}</Text>
                )}
              </Pressable>
              <Pressable onPress={handleTrailSkip} disabled={isSaving} hitSlop={8}>
                <Text style={styles.skipLink}>Skip for now</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  scrollContent: {
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 46,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    marginTop: -8,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 6,
  },
  activityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityPill: {
    flexBasis: '31%',
    flexGrow: 1,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityPillActive: {
    backgroundColor: colors.rust,
  },
  activityPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  activityPillTextActive: {
    color: colors.sand,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 20,
    backgroundColor: colors.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.aqua,
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addDetailsLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
  },
  saveButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
  skipLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
