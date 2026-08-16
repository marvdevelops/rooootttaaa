import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon } from '../components/icons';
import TopRouteCard from '../components/TopRouteCard';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { ActivityType, CloudRoute } from '../types/route';
import { fetchTopRoutesRanked } from '../utils/topRoutesApi';

interface Props {
  city: string | null;
  onClose: () => void;
  onOpenDetail: (route: CloudRoute) => void;
}

const ACTIVITY_FILTERS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'run', label: 'Run' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
];

export default function TopRoutesScreen({ city, onClose, onOpenDetail }: Props) {
  const [activityType, setActivityType] = useState<ActivityType | 'all'>('all');
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoutes(await fetchTopRoutesRanked(city, activityType));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load top routes.');
    } finally {
      setLoading(false);
    }
  }, [city, activityType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Top Routes</Text>
          <Text style={styles.subtitle}>Ranked by runs, ratings, and saves{city ? ` · ${city}` : ''}</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {ACTIVITY_FILTERS.map((f) => {
          const active = activityType === f.value;
          return (
            <Pressable
              key={f.value}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActivityType(f.value)}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.rust} style={{ marginTop: 40 }} />
      ) : routes.length === 0 && !error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No top routes yet</Text>
          <Text style={styles.emptyBody}>Routes need a few runs and reviews before they show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <TopRouteCard route={item} onPress={() => onOpenDetail(item)} />
            </View>
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
    paddingBottom: 12,
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
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterPill: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  filterPillActive: {
    backgroundColor: colors.rust,
  },
  filterPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  filterPillTextActive: {
    color: colors.sand,
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
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 8,
    ...brutalShadow(3),
  },
  rank: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.muted,
    width: 28,
    textAlign: 'center',
  },
});
