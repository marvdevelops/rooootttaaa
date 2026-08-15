import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
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
import { brutalShadow, colors, fonts } from '../theme/theme';
import { RecurrenceFrequency } from '../types/recurringSeries';
import { CloseIcon, LockIcon } from './icons';
import { UserTier } from '../hooks/useUserTier';

export interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  endDate: Date | null;
}

interface Props {
  visible: boolean;
  isSaving: boolean;
  tier: UserTier;
  onClose: () => void;
  onSchedule: (
    title: string,
    description: string,
    scheduledAt: Date,
    maxParticipants: number | null,
    recurrence: RecurrenceInput | null,
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

export default function ScheduleGroupRunModal({ visible, isSaving, tier, onClose, onSchedule, onRequirePaywall }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(defaultTime());
  const [maxParticipants, setMaxParticipants] = useState<number | null>(10);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [endDate, setEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setScheduledAt(defaultTime());
      setMaxParticipants(10);
      setRecurrenceEnabled(false);
      setFrequency('weekly');
      setEndDate(null);
    }
  }, [visible]);

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
              <Text style={styles.title}>Schedule group run</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <CloseIcon size={16} />
              </Pressable>
            </View>

            <View>
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Saturday sunrise run"
                placeholderTextColor={colors.mutedLight}
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
                placeholderTextColor={colors.mutedLight}
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
                  {tier === 'free' && <LockIcon size={11} color={maxParticipants === null ? colors.sand : colors.muted} />}
                  <Text style={[styles.participantChipText, maxParticipants === null && styles.participantChipTextActive]}>
                    OPEN
                  </Text>
                </Pressable>
              </View>
            </View>

            <View>
              <Pressable style={styles.recurrenceRow} onPress={() => handleToggleRecurrence(!recurrenceEnabled)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recurrenceLabel}>Repeat this run</Text>
                  {tier === 'free' && <Text style={styles.recurrenceSub}>Upgrade to Pro for recurring runs</Text>}
                </View>
                {tier === 'free' ? (
                  <LockIcon size={16} color={colors.muted} />
                ) : (
                  <Switch
                    value={recurrenceEnabled}
                    onValueChange={handleToggleRecurrence}
                    trackColor={{ true: colors.rust, false: colors.sand }}
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

            <Pressable
              style={[styles.scheduleButton, !title.trim() && styles.scheduleButtonDisabled]}
              onPress={() =>
                onSchedule(
                  title.trim(),
                  description.trim(),
                  scheduledAt,
                  maxParticipants,
                  recurrenceEnabled ? { frequency, endDate } : null,
                )
              }
              disabled={!title.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.scheduleButtonText}>SCHEDULE RUN</Text>
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
    fontSize: 20,
    color: colors.ink,
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
    minHeight: 70,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pickerBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: 'center',
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
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openChip: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
  },
  participantChipActive: {
    backgroundColor: colors.rust,
  },
  participantChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  participantChipTextActive: {
    color: colors.sand,
  },
  recurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 14,
  },
  recurrenceLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  recurrenceSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  recurrenceDetails: {
    marginTop: 10,
    gap: 10,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyChipActive: {
    backgroundColor: colors.rust,
  },
  frequencyChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  frequencyChipTextActive: {
    color: colors.sand,
  },
  recurrencePreview: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  scheduleButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  scheduleButtonDisabled: {
    opacity: 0.5,
  },
  scheduleButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
});
