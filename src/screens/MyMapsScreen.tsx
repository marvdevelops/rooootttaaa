import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, HeartIcon, PlusIcon, TrashIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ActivityType, CloudRoute } from '../types/route';
import { deleteRoute, listMyRoutes, listSavedRoutes } from '../utils/routesApi';

interface Props {
  onClose: () => void;
  onSelectRoute: (route: CloudRoute) => void;
  onOpenDetail: (route: CloudRoute) => void;
  onCreateRoute: () => void;
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

export default function MyMapsScreen({ onClose, onSelectRoute, onOpenDetail, onCreateRoute }: Props) {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
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

      {loading && routes.length === 0 && !error && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.coral} size="large" />
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
          {tab === 'created' ? (
            <Pressable
              style={styles.emptyCta}
              onPress={onCreateRoute}
              accessibilityRole="button"
              accessibilityLabel="Build a route"
            >
              <PlusIcon size={16} color={colors.white} />
              <Text style={styles.emptyCtaText}>Build a route</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.emptyCta}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Explore Discover"
            >
              <Text style={styles.emptyCtaText}>Explore Discover</Text>
            </Pressable>
          )}
        </View>
      )}

      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading && routes.length > 0}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => onOpenDetail(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.distanceKm.toFixed(1)} km`}
          >
            <View style={styles.cardHeader}>
              <View style={styles.activityBadge}>
                <Text style={styles.activityBadgeText}>{ACTIVITY_LABELS[item.activityType]}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              {tab === 'created' && (
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <TrashIcon size={16} color={colors.ink} />
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
              <View style={[styles.statChip, styles.statChipTeal]}>
                <Text style={[styles.statChipText, styles.statChipTextLight]}>
                  +{Math.round(item.elevationGainM)} m
                </Text>
              </View>
              <View style={styles.socialRow}>
                <HeartIcon size={13} color={colors.coral} filled={item.likesCount > 0} />
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
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...elevation('subtle'),
  },
  tabButtonActive: {
    backgroundColor: colors.coral,
    ...elevation('primaryBtn'),
  },
  tabButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  tabButtonTextActive: {
    color: colors.white,
  },
  cardOwner: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
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
  loadingState: {
    paddingTop: 64,
    alignItems: 'center',
  },
  emptyState: {
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    ...elevation('primaryBtn'),
  },
  emptyCtaText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.base,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
    ...elevation('card'),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  activityBadge: {
    backgroundColor: colors.amber,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  activityBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.white,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: radii.icon,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDescription: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    lineHeight: 18,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  statChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statChipTeal: {
    backgroundColor: colors.teal,
  },
  statChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  statChipTextLight: {
    color: colors.white,
  },
  socialRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialCount: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
  },
  savesInline: {
    flexDirection: 'row',
  },
  loadButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 20,
    ...elevation('smallCta'),
  },
  loadButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
});
