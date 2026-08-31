import React, { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BackIcon, LockIcon, MapPinIcon, PlusIcon, SearchIcon, UsersIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { RunClub } from '../types/club';
import { ActivityType } from '../types/route';
import { listNearbyClubs } from '../utils/clubsApi';

interface Props {
  userCity: string | null;
  onClose: () => void;
  onOpenClub: (clubId: string) => void;
  onCreateClub: () => void;
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Activity',
};

const ACTIVITY_FILTERS: { value: ActivityType | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail run' },
  { value: 'walk', label: 'Walk' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
];

export default function ClubsListScreen({ userCity, onClose, onOpenClub, onCreateClub }: Props) {
  const insets = useSafeAreaInsets();
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activity, setActivity] = useState<ActivityType | null>(null);

  const filtering = search.trim().length > 0 || activity !== null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = search.trim();
      let results = await listNearbyClubs({
        city: userCity,
        activity,
        search: trimmed || null,
      });
      // City is only a soft "near you" default — if it hides everything (or the
      // user is filtering), widen to all cities so the filter still returns hits.
      if (results.length === 0 && (userCity || filtering)) {
        results = await listNearbyClubs({ city: null, activity, search: trimmed || null });
      }
      setClubs(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clubs.');
    } finally {
      setLoading(false);
    }
  }, [userCity, activity, search, filtering]);

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(refresh, 300);
    return () => clearTimeout(t);
  }, [refresh]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Clubs</Text>
      </View>
      <Text style={styles.subtitle}>Groups for runners, riders, walkers, and hikers near you.</Text>

      <View style={styles.searchBar}>
        <SearchIcon size={16} color={colors.stone} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search clubs by name or city"
          placeholderTextColor={colors.mist}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterRow}
        keyboardShouldPersistTaps="handled"
      >
        {ACTIVITY_FILTERS.map((f) => {
          const on = activity === f.value;
          return (
            <Pressable
              key={f.label}
              style={[styles.filterChip, on && styles.filterChipOn]}
              onPress={() => setActivity(f.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.filterChipText, on && styles.filterChipTextOn]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.listWrap}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={clubs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          ListHeaderComponent={
            filtering ? null : (
              <Pressable
                style={styles.createCard}
                onPress={onCreateClub}
                accessibilityRole="button"
                accessibilityLabel="Create a club"
              >
                <View style={styles.createIcon}>
                  <PlusIcon size={20} color={colors.white} />
                </View>
                <View style={styles.createTextWrap}>
                  <Text style={styles.createTitle}>Create a club</Text>
                  <Text style={styles.createBody}>Bring your whole crew onto Rootah — whatever you move for.</Text>
                </View>
              </Pressable>
            )
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{filtering ? 'No clubs match' : 'No clubs yet'}</Text>
                <Text style={styles.emptyBody}>
                  {filtering
                    ? 'Try a different activity or search term.'
                    : 'Be the first to start one in your area.'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => onOpenClub(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} club`}
            >
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <UsersIcon size={22} color={colors.stone} />
                </View>
              )}
              <View style={styles.cardTextWrap}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.isPrivate && <LockIcon size={12} color={colors.stone} />}
                </View>
                {item.city && (
                  <View style={styles.cardMetaRow}>
                    <MapPinIcon size={13} color={colors.stone} />
                    <Text style={styles.cardMeta}>{item.city}</Text>
                  </View>
                )}
                {item.memberCount > 1 && (
                  <View style={styles.cardMetaRow}>
                    <UsersIcon size={13} color={colors.stone} />
                    <Text style={styles.cardMeta}>{item.memberCount} members</Text>
                  </View>
                )}
                <View style={styles.tagRow}>
                  {item.activities.map((a) => (
                    <View key={a} style={styles.tag}>
                      <Text style={styles.tagText}>{ACTIVITY_LABEL[a]}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
      </View>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  filterBar: {
    flexGrow: 0,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  listWrap: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  filterChipOn: {
    backgroundColor: colors.coral,
  },
  filterChipText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.ink,
  },
  filterChipTextOn: {
    color: colors.white,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  tag: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radii.xs,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  tagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.stone,
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
    padding: 10,
  },
  errorText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.coral,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...elevation('card'),
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTextWrap: {
    flex: 1,
    gap: 2,
  },
  createTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.white,
  },
  createBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
    lineHeight: 16,
  },
  emptyState: {
    paddingHorizontal: spacing.lg,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.base,
    ...elevation('card'),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sheetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
});
