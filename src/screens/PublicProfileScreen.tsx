import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackIcon, CalendarIcon, ShareIcon } from '../components/icons';
import ProBadge from '../components/ProBadge';
import ReportModal from '../components/ReportModal';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
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

  const handleShare = useCallback(async () => {
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    const url = webBaseUrl ? `${webBaseUrl}/profile/${userId}` : undefined;
    try {
      await Share.share({
        message: url ? `Check out ${profile?.username ?? 'this runner'}'s profile on Rootah: ${url}` : `Check out ${profile?.username ?? 'this runner'}'s profile on Rootah`,
        url,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to share profile.');
    }
  }, [userId, profile?.username]);

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
        <Pressable style={styles.backButton} onPress={handleShare}>
          <ShareIcon />
        </Pressable>
      </View>

      {loading && !profile && (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.coral} size="large" />
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
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{profile.username}</Text>
                {profile.tier === 'paid' && <ProBadge />}
              </View>
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
                <View style={[styles.statChip, styles.statChipTeal]}>
                  <Text style={[styles.statChipText, styles.statChipTextLight]}>
                    +{Math.round(item.elevationGainM)} m
                  </Text>
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
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.ink,
    marginHorizontal: spacing.sm,
  },
  loadingState: {
    paddingTop: 60,
    alignItems: 'center',
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.base,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...elevation('card'),
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.white,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  username: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  bio: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    textAlign: 'center',
    lineHeight: 20,
  },
  routeCount: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.mist,
    marginTop: 4,
  },
  moderationRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  moderationLink: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
    textDecorationLine: 'underline',
  },
  eventsSection: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  eventsSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.08,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: 2,
  },
  eventCard: {
    width: '100%',
    backgroundColor: colors.sheetBg,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: 3,
    ...elevation('subtle'),
  },
  eventWhenBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amber,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  eventWhenText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.white,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  eventMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  emptyState: {
    paddingTop: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
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
  cardStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
});
