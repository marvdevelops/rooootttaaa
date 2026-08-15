import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Rate this route</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <CloseIcon size={16} />
            </Pressable>
          </View>

          <StarRatingInput value={rating} onChange={setRating} size={34} />

          <TextInput
            placeholder="Share your experience (optional)"
            placeholderTextColor={colors.mutedLight}
            value={body}
            onChangeText={setBody}
            maxLength={200}
            multiline
            style={styles.bodyInput}
          />
          <Text style={styles.charCount}>{body.length}/200</Text>

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={rating === 0 || saving}>
            {saving ? (
              <ActivityIndicator color={colors.sand} />
            ) : (
              <Text style={styles.saveButtonText}>{existing ? 'UPDATE REVIEW' : 'POST REVIEW'}</Text>
            )}
          </Pressable>
        </View>
      </View>
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
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 40,
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
  bodyInput: {
    minHeight: 80,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
    textAlign: 'right',
    marginTop: -8,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  saveButtonText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.sand,
  },
});
