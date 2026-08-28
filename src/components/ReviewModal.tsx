import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { RouteReview } from '../types/route';
import { upsertReview } from '../utils/reviewsApi';
import { CloseIcon } from './icons';
import { StarRatingInput } from './StarRating';

interface Props {
  visible: boolean;
  routeId: string;
  groupRunId?: string;
  existing: RouteReview | null;
  source: 'solo' | 'group_run';
  onClose: () => void;
  onSaved: (review: RouteReview) => void;
}

/**
 * Secondary review entry point — for editing a rating after the fact, or
 * writing one for someone who logged a completion earlier. The primary path
 * is the completion follow-up sheet; this exists so it's not the only way in.
 */
export default function ReviewModal({ visible, routeId, groupRunId, existing, source, onClose, onSaved }: Props) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (rating === 0) return;
    setSaving(true);
    try {
      const review = await upsertReview({ routeId, groupRunId, rating, body, source });
      onSaved(review);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Rate this route</Text>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <CloseIcon size={16} />
            </Pressable>
          </View>

          <StarRatingInput value={rating} onChange={setRating} size={34} />

          <TextInput
            placeholder="Share your experience (optional)"
            placeholderTextColor={colors.mist}
            value={body}
            onChangeText={setBody}
            maxLength={200}
            multiline
            style={styles.bodyInput}
          />
          <Text style={styles.charCount}>{body.length}/200</Text>

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={rating === 0 || saving}>
            {saving ? (
              <ActivityIndicator color={colors.sheetBg} />
            ) : (
              <Text style={styles.saveButtonText}>{existing ? 'UPDATE REVIEW' : 'POST REVIEW'}</Text>
            )}
          </Pressable>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 40,
    gap: 14,
    ...elevation('sheet'),
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
  bodyInput: {
    minHeight: 80,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
    ...elevation('subtle'),
  },
  charCount: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
    textAlign: 'right',
    marginTop: -8,
  },
  saveButton: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.surface,
  },
});
