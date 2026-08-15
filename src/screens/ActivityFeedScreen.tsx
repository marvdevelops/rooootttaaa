import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CheckIcon, ClockIcon } from '../components/icons';
import { useAuth } from '../lib/AuthContext';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { RouteCompletionActivityItem } from '../types/route';
import { formatDuration, listCompletionActivity } from '../utils/completionsApi';

interface Props {
  onClose: () => void;
  onOpenDetail: (routeId: string) => void;
}

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

export default function ActivityFeedScreen({ onClose, onOpenDetail }: Props) {
  const { session } = useAuth();
  const [items, setItems] = useState<RouteCompletionActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listCompletionActivity(session.user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    refresh();
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
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpenDetail(item.routeId)}>
            <View style={styles.iconBadge}>
              <CheckIcon size={16} color={colors.ink} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardText} numberOfLines={2}>
                You ran <Text style={styles.cardTextBold}>{item.routeName}</Text>
              </Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMeta}>{item.routeDistanceKm.toFixed(1)} km</Text>
                {item.durationSeconds != null && (
                  <>
                    <ClockIcon size={11} color={colors.mutedLight} />
                    <Text style={styles.cardMeta}>{formatDuration(item.durationSeconds)}</Text>
                  </>
                )}
              </View>
              <Text style={styles.cardTime}>{timeAgo(item.completedAt)}</Text>
            </View>
          </Pressable>
        )}
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.rustDark,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  emptyState: {
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.rust,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    ...brutalShadow(3),
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.aqua,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  cardTextBold: {
    fontFamily: fonts.bodyBold,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  cardMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginRight: 4,
  },
  cardTime: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
    marginTop: 2,
  },
});
