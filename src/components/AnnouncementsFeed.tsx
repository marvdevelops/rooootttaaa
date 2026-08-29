import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TrashIcon } from './icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { Announcement } from '../utils/announcementsApi';

interface Props {
  posts: Announcement[];
  loading: boolean;
  /** Owner/admin (club) or host (event) — shows the composer and delete controls. */
  canManage: boolean;
  /** Word for the empty state / composer, e.g. "club" or "event". */
  context: string;
  onCreate: (body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function timeAgo(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AnnouncementsFeed({ posts, loading, canManage, context, onCreate, onDelete }: Props) {
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await onCreate(body);
      setDraft('');
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
          <Pressable
            style={[styles.postButton, (!draft.trim() || posting) && styles.postButtonDisabled]}
            onPress={submit}
            disabled={!draft.trim() || posting}
            accessibilityRole="button"
            accessibilityLabel="Post update"
          >
            {posting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.postButtonText}>Post</Text>}
          </Pressable>
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
            <Text style={styles.postBody}>{p.body}</Text>
          </View>
        ))
      )}
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
  postButton: {
    alignSelf: 'flex-end',
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
});
