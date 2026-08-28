import React, { useEffect, useState } from 'react';
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
import { colors, elevation, fonts, radii } from '../theme/theme';
import { ReportReason } from '../utils/reportsApi';
import { CloseIcon, FlagIcon } from './icons';

interface Props {
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => void;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
];

export default function ReportModal({ visible, isSubmitting, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(null);
      setDetails('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <View style={styles.titleRow}>
                <FlagIcon size={16} color={colors.ink} />
                <Text style={styles.title}>Report</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <CloseIcon size={16} />
              </Pressable>
            </View>

            <View>
              <Text style={styles.label}>REASON</Text>
              <View style={styles.reasonList}>
                {REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    style={[styles.reasonOption, reason === r.value && styles.reasonOptionActive]}
                    onPress={() => setReason(r.value)}
                  >
                    <View style={[styles.radio, reason === r.value && styles.radioActive]} />
                    <Text style={[styles.reasonText, reason === r.value && styles.reasonTextActive]}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.label}>DETAILS (OPTIONAL)</Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Anything else we should know?"
                placeholderTextColor={colors.mist}
                style={[styles.input, styles.textArea]}
                multiline
                maxLength={500}
              />
            </View>

            <Pressable
              style={[styles.submitButton, !reason && styles.submitButtonDisabled]}
              onPress={() => reason && onSubmit(reason, details.trim())}
              disabled={!reason || isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitButtonText}>SUBMIT REPORT</Text>}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: 6,
  },
  reasonList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...elevation('subtle'),
  },
  reasonOptionActive: {
    backgroundColor: colors.coral,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.mist,
    backgroundColor: colors.surface,
  },
  radioActive: {
    borderColor: colors.white,
    backgroundColor: colors.cream,
  },
  reasonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  reasonTextActive: {
    color: colors.white,
    fontFamily: fonts.bold,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    ...elevation('subtle'),
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...elevation('primaryBtn'),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    lineHeight: 20,
  },
});
