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
import { ActivityType, PathPoint } from '../types/route';
import { generateRouteName } from '../utils/routeName';
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
  onSave: (name: string, description: string, activityType: ActivityType) => void;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
  { value: 'other', label: 'Other' },
];

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [showDescription, setShowDescription] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  const peakElevationM = useMemo(() => {
    const elevations = elevationPath.map((p) => p.elevation).filter((e): e is number => typeof e === 'number');
    return elevations.length > 0 ? Math.max(...elevations) : null;
  }, [elevationPath]);

  useEffect(() => {
    if (visible) {
      const startingActivityType = initialActivityType ?? defaultActivityType ?? 'run';
      setName(initialName ?? generateRouteName(suggestedCity ?? null, startingActivityType));
      setDescription(initialDescription ?? '');
      setActivityType(startingActivityType);
      setShowDescription(!!initialDescription);
      // Text pre-selected so typing replaces the auto-generated name immediately.
      setTimeout(() => nameInputRef.current?.setNativeProps({ selection: { start: 0, end: 999 } }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
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
              onPress={() => onSave(name.trim(), description.trim(), activityType)}
              disabled={!name.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.saveButtonText}>{isEditing ? 'UPDATE ROUTE' : 'SAVE ROUTE'}</Text>
              )}
            </Pressable>
          </ScrollView>
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
    gap: 8,
  },
  activityPill: {
    flex: 1,
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
});
