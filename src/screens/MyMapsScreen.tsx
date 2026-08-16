import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, HeartIcon, TrashIcon } from '../components/icons';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { ActivityType, CloudRoute } from '../types/route';
import { deleteRoute, listMyRoutes, listSavedRoutes } from '../utils/routesApi';

interface Props {
  onClose: () => void;
  onSelectRoute: (route: CloudRoute) => void;
  onOpenDetail: (route: CloudRoute) => void;
}

type Tab = 'created' | 'saved';

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail Run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

export default function MyMapsScreen({ onClose, onSelectRoute, onOpenDetail }: Props) {
  const [tab, setTab] = useState<Tab>('created');
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutes(tab === 'created' ? await listMyRoutes() : await listSavedRoutes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your maps.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    (route: CloudRoute) => {
      Alert.alert('Delete route', `Remove "${route.name}"? This can't be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRoute(route.id);
            refresh();
          },
        },
      ]);
    },
    [refresh],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>My Maps</Text>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, tab === 'created' && styles.tabButtonActive]}
          onPress={() => setTab('created')}
        >
          <Text style={[styles.tabButtonText, tab === 'created' && styles.tabButtonTextActive]}>Created</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === 'saved' && styles.tabButtonActive]}
          onPress={() => setTab('saved')}
        >
          <Text style={[styles.tabButtonText, tab === 'saved' && styles.tabButtonTextActive]}>Saved</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && routes.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{tab === 'created' ? 'No maps yet' : 'No saved routes yet'}</Text>
          <Text style={styles.emptyBody}>
            {tab === 'created'
              ? 'Build a route on the map, then tap Save to keep it here.'
              : 'Save routes from Discover to find them here.'}
          </Text>
        </View>
      )}

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpenDetail(item)}>
            <View style={styles.cardHeader}>
              <View style={styles.activityBadge}>
                <Text style={styles.activityBadgeText}>{ACTIVITY_LABELS[item.activityType]}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              {tab === 'created' && (
                <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
                  <TrashIcon size={16} />
                </Pressable>
              )}
            </View>
            {tab === 'saved' && <Text style={styles.cardOwner}>by {item.ownerUsername}</Text>}
            {!!item.description && (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.cardStatsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>{item.distanceKm.toFixed(2)} km</Text>
              </View>
              <View style={[styles.statChip, styles.statChipAqua]}>
                <Text style={styles.statChipText}>+{Math.round(item.elevationGainM)} m</Text>
              </View>
              <View style={styles.socialRow}>
                <HeartIcon size={13} filled={item.likesCount > 0} />
                <Text style={styles.socialCount}>{item.likesCount}</Text>
                <BookmarkGlyph count={item.savesCount} />
              </View>
            </View>
            <Pressable style={styles.loadButton} onPress={() => onSelectRoute(item)}>
              <Text style={styles.loadButtonText}>OPEN ON MAP</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

function BookmarkGlyph({ count }: { count: number }) {
  return (
    <View style={styles.savesInline}>
      <Text style={styles.socialCount}>· {count} saved</Text>
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
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.rust,
  },
  tabButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  tabButtonTextActive: {
    color: colors.sand,
  },
  cardOwner: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...brutalShadow(4),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  activityBadge: {
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  activityBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDescription: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statChip: {
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statChipAqua: {
    backgroundColor: colors.aqua,
  },
  statChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  socialRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
  },
  savesInline: {
    flexDirection: 'row',
  },
  loadButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  loadButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
});
