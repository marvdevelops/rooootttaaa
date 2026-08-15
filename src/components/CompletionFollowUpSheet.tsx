import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { RouteCompletion } from '../types/route';
import { updateCompletion } from '../utils/completionsApi';
import { upsertReview } from '../utils/reviewsApi';
import { CloseIcon } from './icons';
import { StarRatingInput } from './StarRating';

interface Props {
  visible: boolean;
  completion: RouteCompletion | null;
  routeName: string;
  /** Set when a completion beats the user's previous personal best, for the celebration line. */
  newPersonalBestSeconds: number | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Appears right after a completion is already saved — everything in here is
 * optional and dismissible with no data loss. Doubles as the primary review
 * capture path (rating rides along with logging, per T4-route-reviews.md)
 * rather than a separate "write a review" flow being the main route in.
 */
export default function CompletionFollowUpSheet({
  visible,
  completion,
  routeName,
  newPersonalBestSeconds,
  onClose,
  onSaved,
}: Props) {
  const [rating, setRating] = useState(0);
  const [mins, setMins] = useState('');
  const [secs, setSecs] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setRating(0);
    setMins('');
    setSecs('');
    setNote('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!completion) return;
    setSaving(true);
    try {
      const duration = mins || secs ? parseInt(mins || '0', 10) * 60 + parseInt(secs || '0', 10) : null;
      const tasks: Promise<unknown>[] = [];

      if (duration != null || note.trim()) {
        tasks.push(updateCompletion(completion.id, { durationSeconds: duration, notes: note.trim() || null }));
      }
      if (rating > 0) {
        tasks.push(
          upsertReview({
            routeId: completion.routeId,
            rating,
            body: note.trim() || null,
            completionId: completion.id,
            source: 'solo',
          }),
        );
      }

      await Promise.all(tasks);
      reset();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Nice work!</Text>
              <Text style={styles.subtitle}>Logged your run on {routeName}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <CloseIcon size={16} />
            </Pressable>
          </View>

          {newPersonalBestSeconds != null && (
            <View style={styles.pbBanner}>
              <Text style={styles.pbText}>🏆 New personal best!</Text>
            </View>
          )}

          <Text style={styles.label}>How was it?</Text>
          <StarRatingInput value={rating} onChange={setRating} size={34} />

          <Text style={styles.label}>Your time (optional)</Text>
          <View style={styles.timeRow}>
            <TextInput
              placeholder="MM"
              placeholderTextColor={colors.mutedLight}
              value={mins}
              onChangeText={setMins}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.timeInput}
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              placeholder="SS"
              placeholderTextColor={colors.mutedLight}
              value={secs}
              onChangeText={setSecs}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.timeInput}
            />
          </View>

          <TextInput
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.mutedLight}
            value={note}
            onChangeText={setNote}
            maxLength={150}
            multiline
            style={styles.noteInput}
          />

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.saveButtonText}>DONE</Text>}
          </Pressable>
          <Pressable onPress={handleClose}>
            <Text style={styles.skipText}>Skip</Text>
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
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
  pbBanner: {
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  pbText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    width: 64,
    height: 48,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
  },
  timeColon: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  noteInput: {
    minHeight: 56,
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
  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...brutalShadow(4),
  },
  saveButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.sand,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
