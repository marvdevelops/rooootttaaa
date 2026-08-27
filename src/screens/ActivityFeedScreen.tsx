import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CheckIcon, ClockIcon, RecordIcon } from '../components/icons';
import SwipeToDeleteRow from '../components/SwipeToDeleteRow';
import { useAuth } from '../lib/AuthContext';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { RouteCompletionActivityItem } from '../types/route';
import { formatDuration, listCompletionActivity } from '../utils/completionsApi';
import { deleteRecordedRun, listMyRecordedRuns, RecordedRunFeedItem } from '../utils/recordingUpload';

interface Props {
  onClose: () => void;
  onOpenDetail: (routeId: string) => void;
  onOpenRecordedRun: (runId: string) => void;
}

type FeedItem =
  | { kind: 'completion'; id: string; sortAt: number; completion: RouteCompletionActivityItem }
  | { kind: 'recording'; id: string; sortAt: number; recording: RecordedRunFeedItem };

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'run',
  trail_run: 'trail run',
  hike: 'hike',
  bike: 'ride',
  walk: 'walk',
  other: 'activity',
};

function timeAgo(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function ActivityFeedScreen({ onClose, onOpenDetail, onOpenRecordedRun }: Props) {
  const { session } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [completions, recordings] = await Promise.all([
        listCompletionActivity(session.user.id),
        listMyRecordedRuns(session.user.id),
      ]);
      const merged: FeedItem[] = [
        ...completions.map((c): FeedItem => ({ kind: 'completion', id: c.id, sortAt: c.completedAt, completion: c })),
        ...recordings.map((r): FeedItem => ({ kind: 'recording', id: r.id, sortAt: r.finishedAt, recording: r })),
      ];
      merged.sort((a, b) => b.sortAt - a.sortAt);
      setItems(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDeleteRecording = useCallback((item: RecordedRunFeedItem) => {
    Alert.alert('Delete this run?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((i) => !(i.kind === 'recording' && i.id === item.id)));
          try {
            await deleteRecordedRun(item.id);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete run.');
            refresh(); // put it back if the delete failed server-side
          }
        },
      },
    ]);
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Activity</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && items.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>Routes you've run will show up here.</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.emptyLink}>Explore routes</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        renderItem={({ item }) =>
          item.kind === 'completion' ? (
            <Pressable style={styles.card} onPress={() => onOpenDetail(item.completion.routeId)}>
              <View style={styles.iconBadge}>
                <CheckIcon size={16} color={colors.white} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardText} numberOfLines={2}>
                  You ran <Text style={styles.cardTextBold}>{item.completion.routeName}</Text>
                </Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardMeta}>{item.completion.routeDistanceKm.toFixed(1)} km</Text>
                  {item.completion.durationSeconds != null && (
                    <>
                      <ClockIcon size={11} color={colors.mist} />
                      <Text style={styles.cardMeta}>{formatDuration(item.completion.durationSeconds)}</Text>
                    </>
                  )}
                </View>
                <Text style={styles.cardTime}>{timeAgo(item.completion.completedAt)}</Text>
              </View>
            </Pressable>
          ) : (
            <SwipeToDeleteRow onDelete={() => handleDeleteRecording(item.recording)}>
              <Pressable style={styles.card} onPress={() => onOpenRecordedRun(item.recording.id)}>
                <View style={[styles.iconBadge, styles.iconBadgeCoral]}>
                  {item.recording.raceTitle ? <Text style={styles.raceFinishFlag}>🏁</Text> : <RecordIcon size={14} color={colors.white} />}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardText} numberOfLines={2}>
                    {item.recording.raceTitle ? (
                      <>
                        You finished <Text style={styles.cardTextBold}>{item.recording.raceTitle}</Text>
                      </>
                    ) : (
                      <>
                        You recorded a <Text style={styles.cardTextBold}>{ACTIVITY_LABEL[item.recording.activityType] ?? 'activity'}</Text>
                      </>
                    )}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardMeta}>{(item.recording.distanceMeters / 1000).toFixed(1)} km</Text>
                    <ClockIcon size={11} color={colors.mist} />
                    <Text style={styles.cardMeta}>{formatDuration(item.recording.movingTimeSeconds)}</Text>
                  </View>
                  <Text style={styles.cardTime}>{timeAgo(item.recording.finishedAt)}</Text>
                </View>
              </Pressable>
            </SwipeToDeleteRow>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: spacing.md,
  },
  errorText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  emptyState: {
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyLink: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.coral,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.base,
    ...elevation('card'),
  },
  iconBadgeCoral: {
    backgroundColor: colors.coral,
  },
  raceFinishFlag: {
    fontSize: 15,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.icon,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  cardTextBold: {
    fontFamily: fonts.bold,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  cardMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
    marginRight: 4,
  },
  cardTime: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
    marginTop: 2,
  },
});
