import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { RecurrenceFrequency } from '../types/recurringSeries';
import { CloseIcon, LockIcon } from './icons';
import { UserTier } from '../hooks/useUserTier';

export interface RaceInput {
  raceDate: Date;
  organizerName: string;
  organizerLogoUrl: string;
  eventBannerUrl: string;
  eventLogoUrl: string;
  /** Set only when this race is joining an existing multi-distance event (prefillRace was passed) — the shared event name to carry over. */
  eventTitle?: string;
}

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  endDate: Date | null;
}

export interface EditingGroupRun {
  title: string;
  description: string;
  scheduledAt: Date;
  maxParticipants: number | null;
  /** Set when the event being edited is a race — shows the race-day picker and branding fields without the "make this a race" toggle (category isn't editable after creation). */
  raceDate: Date | null;
  organizerName?: string;
  organizerLogoUrl?: string;
  eventBannerUrl?: string;
  eventLogoUrl?: string;
}

export interface RacePrefill {
  /** The event's shared display name ("Milo Marathon 2026") — shown read-only; the title field below becomes this new category's own distance label instead. */
  eventTitle: string;
  raceDate: Date;
  organizerName: string;
  organizerLogoUrl: string;
  eventBannerUrl: string;
  eventLogoUrl: string;
}

interface Props {
  visible: boolean;
  isSaving: boolean;
  tier: UserTier;
  /** Only the official Rootah account can create races — see docs/race-mode-plan.md. */
  isOfficialAccount?: boolean;
  /** Present to edit an existing event instead of creating a new one — prefills fields, hides recurrence (out of scope for an edit), and relabels the sheet/button. */
  editing?: EditingGroupRun | null;
  /** Present when creating a NEW distance category for an existing multi-distance event — seeds the race toggle on and its branding/date fields (read-only there, since every category shares one event's identity) while leaving title/route to be picked fresh. Ignored when `editing` is set. */
  prefillRace?: RacePrefill | null;
  onClose: () => void;
  onSchedule: (
    title: string,
    description: string,
    scheduledAt: Date,
    maxParticipants: number | null,
    recurrence: RecurrenceInput | null,
    race: RaceInput | null,
  ) => void;
  onRequirePaywall: () => void;
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'weekly', label: 'WEEKLY' },
  { value: 'biweekly', label: 'EVERY 2 WEEKS' },
  { value: 'monthly', label: 'MONTHLY' },
];

function recurrencePreview(frequency: RecurrenceFrequency, date: Date): string {
  const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (frequency === 'weekly') return `Every ${dayName} at ${time}`;
  if (frequency === 'biweekly') return `Every other ${dayName} at ${time}`;
  return `Monthly on day ${date.getDate()} at ${time}`;
}

const PARTICIPANT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function defaultTime(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  return d;
}

export default function ScheduleGroupRunModal({
  visible,
  isSaving,
  tier,
  isOfficialAccount,
  editing,
  prefillRace,
  onClose,
  onSchedule,
  onRequirePaywall,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(defaultTime());
  const [maxParticipants, setMaxParticipants] = useState<number | null>(10);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isRace, setIsRace] = useState(false);
  const [raceDate, setRaceDate] = useState<Date>(defaultTime());
  const [organizerName, setOrganizerName] = useState('');
  const [organizerLogoUrl, setOrganizerLogoUrl] = useState('');
  const [eventBannerUrl, setEventBannerUrl] = useState('');
  const [eventLogoUrl, setEventLogoUrl] = useState('');

  // Only reset fields on the closed->open transition — `editing` is a fresh
  // object literal from the caller on every render (GroupRunDetailScreen
  // builds it inline), so depending on it directly would wipe out whatever
  // the user is mid-typing every time the parent re-renders for an
  // unrelated reason (comments/participants polling, etc.) while this modal
  // is still open — which is exactly what made edits appear to silently
  // revert instead of saving.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setTitle(editing?.title ?? '');
      setDescription(editing?.description ?? '');
      setScheduledAt(editing?.scheduledAt ?? defaultTime());
      setMaxParticipants(editing ? editing.maxParticipants : 10);
      setRecurrenceEnabled(false);
      setFrequency('weekly');
      setEndDate(null);
      setIsRace(!!editing?.raceDate || !!prefillRace);
      setOrganizerName(editing?.organizerName ?? prefillRace?.organizerName ?? '');
      setOrganizerLogoUrl(editing?.organizerLogoUrl ?? prefillRace?.organizerLogoUrl ?? '');
      setEventBannerUrl(editing?.eventBannerUrl ?? prefillRace?.eventBannerUrl ?? '');
      setEventLogoUrl(editing?.eventLogoUrl ?? prefillRace?.eventLogoUrl ?? '');
      setRaceDate(editing?.raceDate ?? prefillRace?.raceDate ?? defaultTime());
    }
    wasVisible.current = visible;
  }, [visible, editing, prefillRace]);

  const handleToggleRecurrence = (v: boolean) => {
    if (v && tier === 'free') {
      onRequirePaywall();
      return;
    }
    setRecurrenceEnabled(v);
  };

  const handleSelectOpen = () => {
    if (tier === 'free') {
      onRequirePaywall();
      return;
    }
    setMaxParticipants(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{editing ? 'Edit event' : prefillRace ? 'Add a distance' : 'Schedule group run'}</Text>
              <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <CloseIcon size={16} />
              </Pressable>
            </View>

            {prefillRace && (
              <View style={styles.eventNameBanner}>
                <Text style={styles.eventNameBannerLabel}>PART OF</Text>
                <Text style={styles.eventNameBannerText}>{prefillRace.eventTitle}</Text>
              </View>
            )}

            <View>
              <Text style={styles.label}>{prefillRace ? 'DISTANCE LABEL' : 'TITLE'}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={prefillRace ? 'e.g. 10K' : 'Saturday sunrise run'}
                placeholderTextColor={colors.mist}
                style={styles.input}
                maxLength={60}
              />
            </View>

            <View>
              <Text style={styles.label}>DETAILS</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Meet point, pace, what to bring..."
                placeholderTextColor={colors.mist}
                style={[styles.input, styles.textArea]}
                multiline
                maxLength={280}
              />
            </View>

            <View>
              <Text style={styles.label}>WHEN</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerBox}>
                  <DateTimePicker
                    value={scheduledAt}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_, date) => date && setScheduledAt(date)}
                    style={styles.picker}
                  />
                </View>
                <View style={styles.pickerBox}>
                  <DateTimePicker
                    value={scheduledAt}
                    mode="time"
                    onChange={(_, date) => date && setScheduledAt(date)}
                    style={styles.picker}
                  />
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.label}>MAX PARTICIPANTS</Text>
              <View style={styles.participantsRow}>
                {PARTICIPANT_OPTIONS.map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.participantChip, maxParticipants === n && styles.participantChipActive]}
                    onPress={() => setMaxParticipants(n)}
                  >
                    <Text style={[styles.participantChipText, maxParticipants === n && styles.participantChipTextActive]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.participantChip, styles.openChip, maxParticipants === null && styles.participantChipActive]}
                  onPress={handleSelectOpen}
                >
                  {tier === 'free' && <LockIcon size={11} color={maxParticipants === null ? colors.white : colors.stone} />}
                  <Text style={[styles.participantChipText, maxParticipants === null && styles.participantChipTextActive]}>
                    OPEN
                  </Text>
                </Pressable>
              </View>
            </View>

            {!editing && (
              <View>
                <Pressable style={styles.recurrenceRow} onPress={() => handleToggleRecurrence(!recurrenceEnabled)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recurrenceLabel}>Repeat this run</Text>
                    {tier === 'free' && <Text style={styles.recurrenceSub}>Upgrade to Pro for recurring runs</Text>}
                  </View>
                  {tier === 'free' ? (
                    <LockIcon size={16} color={colors.stone} />
                  ) : (
                    <Switch
                      value={recurrenceEnabled}
                      onValueChange={handleToggleRecurrence}
                      trackColor={{ true: colors.coral, false: '#E0DAD2' }}
                      thumbColor={colors.white}
                    />
                  )}
                </Pressable>

                {recurrenceEnabled && (
                  <View style={styles.recurrenceDetails}>
                    <View style={styles.frequencyRow}>
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.value}
                          style={[styles.frequencyChip, frequency === opt.value && styles.frequencyChipActive]}
                          onPress={() => setFrequency(opt.value)}
                        >
                          <Text
                            style={[
                              styles.frequencyChipText,
                              frequency === opt.value && styles.frequencyChipTextActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.recurrencePreview}>{recurrencePreview(frequency, scheduledAt)}</Text>
                  </View>
                )}
              </View>
            )}

            {isOfficialAccount && (!editing || editing.raceDate) && (
              <View>
                {!editing && !prefillRace && (
                  <Pressable style={styles.recurrenceRow} onPress={() => setIsRace((v) => !v)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recurrenceLabel}>Make this a race</Text>
                      <Text style={styles.recurrenceSub}>Adds a RACE badge and a day-of "Run This Race" button.</Text>
                    </View>
                    <Switch
                      value={isRace}
                      onValueChange={setIsRace}
                      trackColor={{ true: colors.coral, false: '#E0DAD2' }}
                      thumbColor={colors.white}
                    />
                  </Pressable>
                )}

                {prefillRace && (
                  <View style={styles.recurrenceRow}>
                    <Text style={styles.recurrenceLabel}>New distance category</Text>
                  </View>
                )}

                {isRace && (
                  <View
                    style={[styles.recurrenceDetails, prefillRace && styles.recurrenceDetailsDisabled]}
                    pointerEvents={prefillRace ? 'none' : 'auto'}
                  >
                    {prefillRace && (
                      <Text style={styles.recurrenceSub}>
                        Branding and race day below are shared with this event's other distances — edit them from any category later if they need to change.
                      </Text>
                    )}
                    <Text style={styles.label}>RACE DAY (UNLOCKS "RUN THIS RACE")</Text>
                    <View style={styles.pickerBox}>
                      <DateTimePicker
                        value={raceDate}
                        mode="date"
                        minimumDate={new Date()}
                        onChange={(_, date) => date && setRaceDate(date)}
                        style={styles.picker}
                      />
                    </View>

                    <Text style={styles.label}>ORGANIZER NAME</Text>
                    <TextInput
                      value={organizerName}
                      onChangeText={setOrganizerName}
                      placeholder="e.g. Milo Philippines"
                      placeholderTextColor={colors.mist}
                      style={styles.input}
                      maxLength={60}
                    />

                    <Text style={styles.label}>ORGANIZER LOGO URL</Text>
                    <TextInput
                      value={organizerLogoUrl}
                      onChangeText={setOrganizerLogoUrl}
                      placeholder="https://…"
                      placeholderTextColor={colors.mist}
                      style={styles.input}
                      autoCapitalize="none"
                      keyboardType="url"
                    />

                    <Text style={styles.label}>EVENT LOGO URL</Text>
                    <TextInput
                      value={eventLogoUrl}
                      onChangeText={setEventLogoUrl}
                      placeholder="https://…"
                      placeholderTextColor={colors.mist}
                      style={styles.input}
                      autoCapitalize="none"
                      keyboardType="url"
                    />

                    <Text style={styles.label}>EVENT BANNER URL</Text>
                    <TextInput
                      value={eventBannerUrl}
                      onChangeText={setEventBannerUrl}
                      placeholder="https://… (wide image, shown at the top of the event page)"
                      placeholderTextColor={colors.mist}
                      style={styles.input}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                )}
              </View>
            )}

            <Pressable
              style={[styles.scheduleButton, !title.trim() && styles.scheduleButtonDisabled]}
              onPress={() =>
                onSchedule(
                  title.trim(),
                  description.trim(),
                  scheduledAt,
                  maxParticipants,
                  recurrenceEnabled ? { frequency, endDate } : null,
                  isOfficialAccount && isRace
                    ? {
                        raceDate,
                        organizerName: organizerName.trim(),
                        organizerLogoUrl: organizerLogoUrl.trim(),
                        eventBannerUrl: eventBannerUrl.trim(),
                        eventLogoUrl: eventLogoUrl.trim(),
                        eventTitle: prefillRace?.eventTitle,
                      }
                    : null,
                )
              }
              disabled={!title.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.scheduleButtonText}>
                  {editing ? 'SAVE CHANGES' : isOfficialAccount && isRace ? 'CREATE RACE' : 'SCHEDULE RUN'}
                </Text>
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
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '85%',
    ...elevation('sheet'),
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
    fontFamily: fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.08 * 10,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    ...elevation('subtle'),
  },
  eventNameBanner: {
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    padding: 12,
  },
  eventNameBannerLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.stone,
  },
  eventNameBannerText: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 2,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  picker: {
    alignSelf: 'stretch',
  },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantChip: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  openChip: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  participantChipActive: {
    backgroundColor: colors.coral,
  },
  participantChipText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  participantChipTextActive: {
    color: colors.white,
  },
  recurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 14,
    ...elevation('subtle'),
  },
  recurrenceLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  recurrenceSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
    marginTop: 2,
  },
  recurrenceDetails: {
    marginTop: 10,
    gap: 10,
  },
  recurrenceDetailsDisabled: {
    opacity: 0.5,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyChip: {
    flex: 1,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  frequencyChipActive: {
    backgroundColor: colors.coral,
  },
  frequencyChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
  },
  frequencyChipTextActive: {
    color: colors.white,
  },
  recurrencePreview: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  scheduleButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    ...elevation('primaryBtn'),
  },
  scheduleButtonDisabled: {
    opacity: 0.5,
  },
  scheduleButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
});
