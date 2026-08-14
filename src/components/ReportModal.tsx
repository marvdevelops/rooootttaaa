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
import { brutalShadow, colors, fonts } from '../theme/theme';
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
              <Pressable style={styles.closeButton} onPress={onClose}>
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
                placeholderTextColor={colors.mutedLight}
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
              {isSubmitting ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.submitButtonText}>SUBMIT REPORT</Text>}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  reasonList: {
    gap: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reasonOptionActive: {
    backgroundColor: colors.rust,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
  },
  radioActive: {
    backgroundColor: colors.sand,
  },
  reasonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  reasonTextActive: {
    color: colors.sand,
    fontFamily: fonts.bodyBold,
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
  submitButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
});
