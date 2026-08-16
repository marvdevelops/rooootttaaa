import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, PlusIcon } from '../components/icons';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
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
          <ActivityIndicator color={colors.rust} />
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
                <PlusIcon size={20} color={colors.sand} />
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
    paddingTop: 60,
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
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
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
    backgroundColor: colors.rust,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...brutalShadow(4),
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
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.sand,
  },
  newRouteBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.sand,
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
  cardStatsRow: {
    flexDirection: 'row',
    gap: 8,
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
});
