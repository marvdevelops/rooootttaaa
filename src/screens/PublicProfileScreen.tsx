import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CalendarIcon } from '../components/icons';
import ReportModal from '../components/ReportModal';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { ActivityType, CloudRoute, GroupRun } from '../types/route';
import BadgeStrip from '../components/BadgeStrip';
import { blockUser } from '../utils/blocksApi';
import { PublicProfile, getProfile } from '../utils/profilesApi';
import { createReport, ReportReason } from '../utils/reportsApi';
import { fetchUpcomingEvents } from '../utils/groupRunsApi';
import { listRoutesByOwner } from '../utils/routesApi';

interface Props {
  userId: string;
  onClose: () => void;
  onOpenDetail: (route: CloudRoute) => void;
  onOpenGroupRun: (groupRunId: string) => void;
}

function formatEventWhen(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail Run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

export default function PublicProfileScreen({ userId, onClose, onOpenDetail, onOpenGroupRun }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [events, setEvents] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, details: string) => {
      setIsReporting(true);
      try {
        await createReport('profile', userId, reason, details);
        setShowReportModal(false);
        Alert.alert('Report submitted', "Thanks — we'll take a look.");
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit report.');
      } finally {
        setIsReporting(false);
      }
    },
    [userId],
  );

  const handleBlock = useCallback(() => {
    Alert.alert(
      `Block ${profile?.username ?? 'this user'}?`,
      "You won't see their routes or comments anymore, and they won't see yours.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(userId);
              onClose();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to block user.');
            }
          },
        },
      ],
    );
  }, [userId, profile?.username, onClose]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, routesData, eventsData] = await Promise.all([
        getProfile(userId),
        listRoutesByOwner(userId),
        fetchUpcomingEvents(userId).catch(() => []), // non-critical — the rest of the profile still works without it
      ]);
      setProfile(profileData);
      setRoutes(routesData);
      setEvents(eventsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {profile?.username ?? 'Profile'}
        </Text>
      </View>

      {loading && !profile && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.rust} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {profile && (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          ListHeaderComponent={
            <View style={styles.profileCard}>
              {profile.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>{profile.username.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.username}>{profile.username}</Text>
              {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
              <BadgeStrip userId={userId} />
              <Text style={styles.routeCount}>
                {routes.length} public {routes.length === 1 ? 'route' : 'routes'}
              </Text>
              <View style={styles.moderationRow}>
                <Pressable onPress={() => setShowReportModal(true)}>
                  <Text style={styles.moderationLink}>Report</Text>
                </Pressable>
                <Pressable onPress={handleBlock}>
                  <Text style={styles.moderationLink}>Block</Text>
                </Pressable>
              </View>

              {events.length > 0 && (
                <View style={styles.eventsSection}>
                  <Text style={styles.eventsSectionTitle}>Upcoming events</Text>
                  {events.map((event) => (
                    <Pressable key={event.id} style={styles.eventCard} onPress={() => onOpenGroupRun(event.id)}>
                      <View style={styles.eventWhenBadge}>
                        <CalendarIcon size={12} />
                        <Text style={styles.eventWhenText}>{formatEventWhen(event.scheduledAt)}</Text>
                      </View>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {event.routeName} · {event.myRole === 'host' ? 'Hosting' : 'Joining'} · {event.rsvpCount} going
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No public routes yet.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpenDetail(item)}>
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

      <ReportModal
        visible={showReportModal}
        isSubmitting={isReporting}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSubmitReport}
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
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    marginHorizontal: 8,
  },
  loadingState: {
    paddingTop: 60,
    alignItems: 'center',
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    gap: 6,
    ...brutalShadow(4),
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.ink,
    marginBottom: 6,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  username: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  bio: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  routeCount: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.mutedLight,
    marginTop: 4,
  },
  moderationRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  moderationLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.mutedLight,
    textDecorationLine: 'underline',
  },
  eventsSection: {
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  eventsSectionTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 2,
  },
  eventCard: {
    width: '100%',
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  eventWhenBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 7,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginBottom: 2,
  },
  eventWhenText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  eventTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
  },
  eventMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  emptyState: {
    paddingTop: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
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
