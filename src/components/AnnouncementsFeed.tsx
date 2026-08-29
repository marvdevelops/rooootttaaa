import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraIcon, CloseIcon, TrashIcon } from './icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { Announcement } from '../utils/announcementsApi';
import { pickPostImages } from '../utils/photosApi';

interface Props {
  posts: Announcement[];
  loading: boolean;
  /** Owner/admin (club) or host (event) — shows the composer and delete controls. */
  canManage: boolean;
  /** Word for the empty state / composer, e.g. "club" or "event". */
  context: string;
  /** When true, the composer lets the author attach up to 3 images. */
  allowImages?: boolean;
  onCreate: (body: string, imageUris: string[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const MAX_IMAGES = 3;

function timeAgo(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AnnouncementsFeed({ posts, loading, canManage, context, allowImages = false, onCreate, onDelete }: Props) {
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [fullScreenUri, setFullScreenUri] = useState<string | null>(null);

  const addImages = async () => {
    try {
      const picked = await pickPostImages(MAX_IMAGES - images.length);
      if (picked.length) setImages((cur) => [...cur, ...picked].slice(0, MAX_IMAGES));
    } catch (e) {
      Alert.alert('Could not add images', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if ((!body && images.length === 0) || posting) return;
    setPosting(true);
    try {
      await onCreate(body, images);
      setDraft('');
      setImages([]);
    } catch (e) {
      Alert.alert('Could not post', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setPosting(false);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete update', 'Remove this update?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(id).catch(() => {}) },
    ]);
  };

  const canSubmit = (draft.trim().length > 0 || images.length > 0) && !posting;

  return (
    <View style={styles.wrap}>
      {canManage && (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Post an update to your ${context}…`}
            placeholderTextColor={colors.mist}
            multiline
            maxLength={2000}
          />

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
              {images.map((uri) => (
                <View key={uri} style={styles.previewWrap}>
                  <Image source={{ uri }} style={styles.preview} contentFit="cover" />
                  <Pressable
                    style={styles.previewRemove}
                    onPress={() => setImages((cur) => cur.filter((u) => u !== uri))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove image"
                  >
                    <CloseIcon size={12} color={colors.white} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.composerActions}>
            {allowImages && images.length < MAX_IMAGES && (
              <Pressable
                style={styles.addImageButton}
                onPress={addImages}
                accessibilityRole="button"
                accessibilityLabel="Add images"
              >
                <CameraIcon size={16} color={colors.stone} />
                <Text style={styles.addImageText}>Add photos</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Post update"
            >
              {posting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.postButtonText}>Post</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.coral} style={{ marginVertical: spacing.lg }} />
      ) : posts.length === 0 ? (
        <Text style={styles.empty}>
          {canManage ? `No updates yet — post the first one.` : `No updates from this ${context} yet.`}
        </Text>
      ) : (
        posts.map((p) => (
          <View key={p.id} style={styles.post}>
            <View style={styles.postHeader}>
              <Text style={styles.postMeta}>
                {p.authorUsername ? `@${p.authorUsername}` : 'Update'} · {timeAgo(p.createdAt)}
              </Text>
              {canManage && (
                <Pressable onPress={() => confirmDelete(p.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete update">
                  <TrashIcon size={14} color={colors.stone} />
                </Pressable>
              )}
            </View>
            {p.body.length > 0 && <Text style={styles.postBody}>{p.body}</Text>}
            {p.imageUrls.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
                {p.imageUrls.map((uri) => (
                  <Pressable key={uri} onPress={() => setFullScreenUri(uri)} accessibilityRole="imagebutton" accessibilityLabel="View photo full screen">
                    <Image source={{ uri }} style={styles.postImage} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ))
      )}

      <Modal visible={fullScreenUri !== null} transparent animationType="fade" onRequestClose={() => setFullScreenUri(null)}>
        <Pressable style={styles.fullScreenBackdrop} onPress={() => setFullScreenUri(null)}>
          {fullScreenUri && <Image source={{ uri: fullScreenUri }} style={styles.fullScreenImage} contentFit="contain" />}
          <Pressable style={styles.fullScreenClose} onPress={() => setFullScreenUri(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <CloseIcon size={18} color={colors.white} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  composer: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevation('subtle'),
  },
  input: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    minHeight: 44,
    maxHeight: 140,
  },
  previewRow: {
    gap: 8,
    paddingRight: 8,
  },
  previewWrap: {
    position: 'relative',
  },
  preview: {
    width: 84,
    height: 84,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
  },
  previewRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 8,
  },
  addImageText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.stone,
  },
  postButton: {
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    height: 38,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  empty: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    paddingVertical: spacing.sm,
  },
  post: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
    ...elevation('subtle'),
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postMeta: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.stone,
  },
  postBody: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  postImage: {
    width: 200,
    height: 200,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
