import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, PlusIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ActivityType, CloudRoute } from '../types/route';
import { listMyRoutes } from '../utils/routesApi';

interface Props {
  onClose: () => void;
  onSelectRoute: (route: CloudRoute) => void;
  onCreateNewRoute: () => void;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail Run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

export default function CreateEventScreen({ onClose, onSelectRoute, onCreateNewRoute }: Props) {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutes(await listMyRoutes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your routes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Create Event</Text>
      </View>
      <Text style={styles.subtitle}>Pick a route for this run, or build a new one.</Text>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          ListHeaderComponent={
            <Pressable style={styles.newRouteCard} onPress={onCreateNewRoute}>
              <View style={styles.newRouteIcon}>
                <PlusIcon size={20} color={colors.white} />
              </View>
              <View style={styles.newRouteTextWrap}>
                <Text style={styles.newRouteTitle}>Create a new route</Text>
                <Text style={styles.newRouteBody}>Build it on the map, then finish setting up your event.</Text>
              </View>
            </Pressable>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No routes yet</Text>
                <Text style={styles.emptyBody}>Create a new route above to get your first event started.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onSelectRoute(item)}>
              <View style={styles.cardHeader}>
                <View style={styles.activityBadge}>
                  <Text style={styles.activityBadgeText}>{ACTIVITY_LABELS[item.activityType]}</Text>
                </View>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <View style={styles.cardStatsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statChipText}>{item.distanceKm.toFixed(2)} km</Text>
                </View>
                <View style={[styles.statChip, styles.statChipAqua]}>
                  <Text style={styles.statChipText}>+{Math.round(item.elevationGainM)} m</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
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
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
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
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  newRouteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.coral,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: 14,
    ...elevation('primaryBtn'),
  },
  newRouteIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRouteTextWrap: {
    flex: 1,
    gap: 2,
  },
  newRouteTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.3,
    color: colors.white,
  },
  newRouteBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
    lineHeight: 16,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: 'center',
    gap: 8,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 8,
    ...elevation('card'),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.4,
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
    letterSpacing: 0.08 * 9,
    textTransform: 'uppercase',
    color: colors.white,
  },
  cardStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statChipAqua: {
    backgroundColor: colors.teal,
  },
  statChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
});
