import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { RouteCompletion } from '../types/route';
import { UserBadge } from '../utils/badgesApi';
import { updateCompletion } from '../utils/completionsApi';
import { upsertReview } from '../utils/reviewsApi';
import { CameraIcon, CloseIcon } from './icons';
import { StarRatingInput } from './StarRating';

interface Props {
  visible: boolean;
  completion: RouteCompletion | null;
  routeName: string;
  /** Set when a completion beats the user's previous personal best, for the celebration line. */
  newPersonalBestSeconds: number | null;
  /** Set when this completion just earned a badge — replaces the generic "Nice work!" header. */
  newBadge: UserBadge | null;
  onClose: () => void;
  onSaved: () => void;
  /** Doesn't block saving the completion — tapped, this closes the sheet and hands off to the photo upload screen. */
  onAddPhoto: (completionId: string) => void;
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
  newBadge,
  onClose,
  onSaved,
  onAddPhoto,
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
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {newBadge ? (
                <>
                  <Text style={styles.title}>
                    {newBadge.badge.icon} You earned {newBadge.badge.name}!
                  </Text>
                  <Text style={styles.subtitle}>{newBadge.badge.description}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.title}>Nice work!</Text>
                  <Text style={styles.subtitle}>Logged your run on {routeName}</Text>
                </>
              )}
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close">
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
              placeholderTextColor={colors.mist}
              value={mins}
              onChangeText={setMins}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.timeInput}
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              placeholder="SS"
              placeholderTextColor={colors.mist}
              value={secs}
              onChangeText={setSecs}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.timeInput}
            />
          </View>

          <TextInput
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.mist}
            value={note}
            onChangeText={setNote}
            maxLength={150}
            multiline
            style={styles.noteInput}
          />

          <Pressable
            style={styles.addPhotoButton}
            onPress={() => completion && onAddPhoto(completion.id)}
          >
            <CameraIcon size={16} color={colors.ink} />
            <Text style={styles.addPhotoText}>Add a photo from this run</Text>
          </Pressable>

          <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.sheetBg} /> : <Text style={styles.saveButtonText}>DONE</Text>}
          </Pressable>
          <Pressable onPress={handleClose}>
            <Text style={styles.skipText}>Skip</Text>
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
    gap: 12,
    ...elevation('sheet'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    marginTop: 2,
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
  pbBanner: {
    backgroundColor: colors.amber,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  pbText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.surface,
  },
  label: {
    fontFamily: fonts.bold,
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
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
    ...elevation('subtle'),
  },
  timeColon: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.ink,
  },
  noteInput: {
    minHeight: 56,
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
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  addPhotoText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  saveButton: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...elevation('primaryBtn'),
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.surface,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
