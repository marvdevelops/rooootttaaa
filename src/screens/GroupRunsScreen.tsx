import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CalendarIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { GroupRun } from '../types/route';
import { FreeJoinLimitError, listUpcomingGroupRuns, setGroupRunRsvp } from '../utils/groupRunsApi';

interface Props {
  onClose: () => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onRequirePaywall: () => void;
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function GroupRunsScreen({ onClose, onOpenGroupRun, onRequirePaywall }: Props) {
  const [runs, setRuns] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await listUpcomingGroupRuns());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load group runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggleRsvp = useCallback(
    async (run: GroupRun) => {
      if (run.isHostedByMe) return;
      const requesting = !run.myRsvpStatus;
      const prevStatus = run.myRsvpStatus;
      setRuns((prev) =>
        prev.map((r) =>
          r.id === run.id
            ? {
                ...r,
                myRsvpStatus: requesting ? 'pending' : null,
                isRsvpedByMe: false,
                rsvpCount: r.rsvpCount - (prevStatus === 'approved' ? 1 : 0),
              }
            : r,
        ),
      );
      try {
        await setGroupRunRsvp(run.id, requesting);
      } catch (e) {
        setRuns((prev) =>
          prev.map((r) =>
            r.id === run.id
              ? {
                  ...r,
                  myRsvpStatus: prevStatus,
                  isRsvpedByMe: prevStatus === 'approved',
                  rsvpCount: r.rsvpCount + (prevStatus === 'approved' ? 1 : 0),
                }
              : r,
          ),
        );
        if (e instanceof FreeJoinLimitError) {
          onRequirePaywall();
        } else {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update RSVP.');
        }
      }
    },
    [onRequirePaywall],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Group Runs</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && runs.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No upcoming group runs</Text>
          <Text style={styles.emptyBody}>
            Open a route and tap &quot;Schedule group run&quot; to plan one.
          </Text>
        </View>
      )}

      <FlatList
        data={runs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onOpenGroupRun(item.id)}>
            <View style={styles.cardHeader}>
              <View style={styles.whenBadge}>
                <CalendarIcon size={13} />
                <Text style={styles.whenText}>{formatWhen(item.scheduledAt)}</Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardRoute} numberOfLines={1}>
              {item.routeName}
              {item.hostUsername !== 'unknown' ? ` · hosted by ${item.hostUsername}` : ''}
            </Text>
            {!!item.description && (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.rsvpCount}>{item.rsvpCount} going</Text>
              {item.isHostedByMe ? (
                <View style={[styles.rsvpButton, styles.rsvpButtonActive]}>
                  <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>HOSTING</Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.rsvpButton, item.isRsvpedByMe && styles.rsvpButtonActive]}
                  onPress={() => handleToggleRsvp(item)}
                >
                  <Text style={[styles.rsvpButtonText, item.isRsvpedByMe && styles.rsvpButtonTextActive]}>
                    {item.myRsvpStatus === 'approved'
                      ? "I'M IN"
                      : item.myRsvpStatus === 'pending'
                        ? 'REQUESTED'
                        : item.category === 'race'
                          ? "I'M JOINING THIS RACE"
                          : 'RSVP'}
                  </Text>
                </Pressable>
              )}
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
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: 10,
  },
  errorText: {
    color: colors.surface,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  emptyState: {
    paddingHorizontal: 32,
    paddingTop: 48,
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 4,
    ...elevation('card'),
  },
  cardHeader: {
    flexDirection: 'row',
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
    letterSpacing: 0.08 * 9,
    textTransform: 'uppercase',
    color: colors.white,
  },
  cardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  cardRoute: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  cardDescription: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rsvpCount: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.stone,
  },
  rsvpButton: {
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 20,
    backgroundColor: colors.coral,
    ...elevation('smallCta'),
  },
  rsvpButtonActive: {
    backgroundColor: colors.sage,
  },
  rsvpButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  rsvpButtonTextActive: {
    color: colors.white,
  },
});
