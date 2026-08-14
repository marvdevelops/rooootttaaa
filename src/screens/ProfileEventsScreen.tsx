import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CalendarIcon } from '../components/icons';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
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
          <ActivityIndicator color={colors.rust} />
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
                  <Text style={styles.roleBadgeText}>{item.myRole === 'host' ? 'HOST' : 'JOINING'}</Text>
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
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.rust,
  },
  tabButtonText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.ink,
  },
  tabButtonTextActive: {
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
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
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
    gap: 4,
    ...brutalShadow(4),
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
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  whenText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  roleBadge: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: colors.sand,
  },
  roleBadgeHost: {
    backgroundColor: colors.aqua,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
  },
  cardRoute: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  cardMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 4,
  },
});
