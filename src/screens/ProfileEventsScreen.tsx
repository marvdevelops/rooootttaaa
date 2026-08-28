import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CalendarIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { GroupRun } from '../types/route';
import { fetchPastEvents, fetchUpcomingEvents } from '../utils/groupRunsApi';

type Tab = 'upcoming' | 'past';

interface Props {
  userId: string;
  onClose: () => void;
  onOpenGroupRun: (groupRunId: string) => void;
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export default function ProfileEventsScreen({ userId, onClose, onOpenGroupRun }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [upcoming, setUpcoming] = useState<GroupRun[]>([]);
  const [past, setPast] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, p] = await Promise.all([fetchUpcomingEvents(userId), fetchPastEvents(userId)]);
      setUpcoming(u);
      setPast(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runs = tab === 'upcoming' ? upcoming : past;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Your Events</Text>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabButton, tab === 'upcoming' && styles.tabButtonActive]} onPress={() => setTab('upcoming')}>
          <Text style={[styles.tabButtonText, tab === 'upcoming' && styles.tabButtonTextActive]}>UPCOMING</Text>
        </Pressable>
        <Pressable style={[styles.tabButton, tab === 'past' && styles.tabButtonActive]} onPress={() => setTab('past')}>
          <Text style={[styles.tabButtonText, tab === 'past' && styles.tabButtonTextActive]}>PAST</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      )}

      {!loading && runs.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{tab === 'upcoming' ? 'No upcoming events' : 'No past events yet'}</Text>
          <Text style={styles.emptyBody}>
            {tab === 'upcoming'
              ? 'Runs you host or join will show up here.'
              : 'Runs you hosted or joined move here once they wrap up.'}
          </Text>
        </View>
      )}

      {!loading && (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpenGroupRun(item.id)}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.whenBadge}>
                  <CalendarIcon size={12} />
                  <Text style={styles.whenText}>{formatWhen(item.scheduledAt)}</Text>
                </View>
                <View style={[styles.roleBadge, item.myRole === 'host' && styles.roleBadgeHost]}>
                  <Text style={[styles.roleBadgeText, item.myRole === 'host' && styles.roleBadgeTextHost]}>
                    {item.myRole === 'host' ? 'HOST' : 'JOINING'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardRoute} numberOfLines={1}>
                {item.routeName}
                {item.myRole === 'participant' && item.hostUsername !== 'unknown' ? ` · hosted by ${item.hostUsername}` : ''}
              </Text>
              <Text style={styles.cardMeta}>{item.rsvpCount} {tab === 'past' ? 'went' : 'going'}</Text>
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
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  tabButton: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  tabButtonActive: {
    backgroundColor: colors.coral,
    ...elevation('primaryBtn'),
  },
  tabButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.08,
    color: colors.ink,
  },
  tabButtonTextActive: {
    color: colors.white,
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
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.base,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 4,
    ...elevation('card'),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  whenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  whenText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.white,
  },
  roleBadge: {
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  roleBadgeHost: {
    backgroundColor: colors.sage,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
  },
  roleBadgeTextHost: {
    color: colors.white,
  },
  cardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  cardRoute: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  cardMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
    marginTop: 4,
  },
});
