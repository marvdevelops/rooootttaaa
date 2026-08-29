import React, { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackIcon, CalendarIcon, LockIcon, MapPinIcon, UsersIcon } from '../components/icons';
import { useAuth } from '../lib/AuthContext';
import AnnouncementsFeed from '../components/AnnouncementsFeed';
import { Announcement, createClubPost, deleteClubPost, listClubPosts, uploadClubPostImages } from '../utils/announcementsApi';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { GroupRun } from '../types/route';
import { RunClub } from '../types/club';
import {
  ClubFullError,
  ClubRouteSummary,
  getClub,
  joinClub,
  leaveClub,
  listClubMembers,
  listClubRoutes,
} from '../utils/clubsApi';
import { listClubEvents } from '../utils/groupRunsApi';
import { PaywallTrigger } from './PaywallScreen';

type Tab = 'updates' | 'events' | 'routes' | 'members';

interface Props {
  clubId: string;
  onClose: () => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onOpenClubAdmin: (clubId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRequirePaywall: (trigger: PaywallTrigger) => void;
  onRequireAuth: (action: () => void, context?: string) => void;
  onScheduleClubRun: (clubId: string) => void;
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export default function ClubProfileScreen({
  clubId,
  onClose,
  onOpenGroupRun,
  onOpenClubAdmin,
  onOpenProfile,
  onRequirePaywall,
  onRequireAuth,
  onScheduleClubRun,
}: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [club, setClub] = useState<RunClub | null>(null);
  // Events and members are membership-adjacent social data (who's going,
  // the roster) — kept behind a session like GroupRunDetailScreen's
  // who's-going/comments, unlike routes which are public content already
  // browsable everywhere else. Guests land on Routes instead.
  const [tab, setTab] = useState<Tab>('updates');
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [events, setEvents] = useState<GroupRun[]>([]);
  const [routes, setRoutes] = useState<ClubRouteSummary[]>([]);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listClubMembers>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const c = await getClub(clubId);
      setClub(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load this club.');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshPosts = useCallback(() => {
    setPostsLoading(true);
    listClubPosts(clubId)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [clubId]);

  useEffect(() => {
    if (!club) return;
    if (tab === 'updates') {
      refreshPosts();
      return;
    }
    if (club.myStatus === 'pending') return;
    if (tab === 'events') {
      listClubEvents(clubId).then(setEvents).catch(() => {});
    } else if (tab === 'routes') {
      listClubRoutes(clubId).then(setRoutes).catch(() => {});
    } else if (tab === 'members') {
      listClubMembers(clubId).then(setMembers).catch(() => {});
    }
  }, [tab, clubId, club, refreshPosts]);

  const isMember = !!club?.myRole;
  const isAdmin = club?.myRole === 'admin' || club?.myRole === 'owner';
  const isPending = club?.myStatus === 'pending';

  const handleJoin = useCallback(async () => {
    if (!club) return;
    setJoining(true);
    try {
      const status = await joinClub(club.id, club.isPrivate);
      await refresh();
      if (status === 'pending') {
        Alert.alert('Request sent', "You'll be notified once an admin approves your request.");
      }
    } catch (e) {
      if (e instanceof ClubFullError) {
        Alert.alert('Club full', e.message);
      } else {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to join this club.');
      }
    } finally {
      setJoining(false);
    }
  }, [club, refresh]);

  const handleLeave = useCallback(() => {
    if (!club) return;
    Alert.alert('Leave club', `Leave ${club.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveClub(club.id);
            await refresh();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to leave this club.');
          }
        },
      },
    ]);
  }, [club, refresh]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
            <BackIcon />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </View>
    );
  }

  if (error || !club) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
            <BackIcon />
          </Pressable>
        </View>
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error ?? 'Club not found.'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        {isAdmin && (
          <Pressable style={styles.manageButton} onPress={() => onOpenClubAdmin(club.id)}>
            <Text style={styles.manageButtonText}>MANAGE</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.clubHeader}>
          {club.avatarUrl ? (
            <Image source={{ uri: club.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <UsersIcon size={28} color={colors.stone} />
            </View>
          )}
          <View style={styles.clubHeaderTextWrap}>
            <View style={styles.clubNameRow}>
              <Text style={styles.clubName} numberOfLines={2}>
                {club.name}
              </Text>
              {club.isPrivate && <LockIcon size={14} color={colors.stone} />}
            </View>
            {club.city && (
              <View style={styles.memberCountRow}>
                <MapPinIcon size={12} color={colors.stone} />
                <Text style={styles.clubMeta}>{club.city}</Text>
              </View>
            )}
            {club.memberCount > 1 && (
              <View style={styles.memberCountRow}>
                <UsersIcon size={12} color={colors.stone} />
                <Text style={styles.clubMeta}>
                  {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {!!club.description && <Text style={styles.description}>{club.description}</Text>}

        {!isMember && !isPending && (
          <Pressable style={styles.joinButton} onPress={() => onRequireAuth(handleJoin, 'join_club')} disabled={joining}>
            {joining ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.joinButtonText}>{club.isPrivate ? 'Request to join' : 'Join club'}</Text>
            )}
          </Pressable>
        )}
        {isPending && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>Request sent — waiting for approval</Text>
          </View>
        )}
        {isMember && club.myRole === 'member' && (
          <Pressable style={styles.leaveButton} onPress={handleLeave}>
            <Text style={styles.leaveButtonText}>Leave club</Text>
          </Pressable>
        )}

        <View style={styles.tabRow}>
          {(session ? (['updates', 'events', 'routes', 'members'] as Tab[]) : (['updates', 'routes'] as Tab[])).map((t) => (
            <Pressable key={t} style={[styles.tabButton, tab === t && styles.tabButtonActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabButtonText, tab === t && styles.tabButtonTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'updates' ? (
          <View style={styles.tabContent}>
            <AnnouncementsFeed
              posts={posts}
              loading={postsLoading}
              canManage={isAdmin}
              context="club"
              allowImages
              onCreate={async (body, imageUris) => {
                const paths = await uploadClubPostImages(imageUris);
                await createClubPost(club.id, body, paths);
                refreshPosts();
              }}
              onDelete={async (id) => {
                await deleteClubPost(id);
                refreshPosts();
              }}
            />
          </View>
        ) : isPending ? (
          <Text style={styles.emptyBody}>You&apos;ll see events, routes, and members once your request is approved.</Text>
        ) : tab === 'events' ? (
          <View style={styles.tabContent}>
            {isAdmin && (
              <Pressable style={styles.scheduleButton} onPress={() => onScheduleClubRun(club.id)}>
                <Text style={styles.scheduleButtonText}>+ Schedule a club run</Text>
              </Pressable>
            )}
            {events.length === 0 ? (
              <Text style={styles.emptyBody}>
                {isAdmin ? 'No runs scheduled yet — schedule your first one above.' : 'No runs scheduled yet. Check back soon.'}
              </Text>
            ) : (
              events.map((run) => (
                <Pressable key={run.id} style={styles.eventCard} onPress={() => onOpenGroupRun(run.id)}>
                  <View style={styles.eventWhenBadge}>
                    <CalendarIcon size={12} color={colors.white} />
                    <Text style={styles.eventWhenText}>{formatWhen(run.scheduledAt)}</Text>
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {run.title}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {run.routeName} · {run.rsvpCount} going
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : tab === 'routes' ? (
          <View style={styles.tabContent}>
            {routes.length === 0 ? (
              <Text style={styles.emptyBody}>{isAdmin ? 'Add the routes your club runs regularly.' : 'No routes yet.'}</Text>
            ) : (
              routes.map((route) => (
                <View key={route.id} style={styles.routeCard}>
                  <Text style={styles.routeName} numberOfLines={1}>
                    {route.name}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {route.distanceKm.toFixed(1)} km · +{Math.round(route.elevationGainM)} m · by {route.ownerUsername}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>
            {members.map((m) => (
              <Pressable key={m.userId} style={styles.memberRow} onPress={() => onOpenProfile(m.userId)}>
                {m.avatarUrl ? (
                  <Image source={{ uri: m.avatarUrl }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                    <Text style={styles.memberAvatarInitial}>{m.username.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.memberUsername} numberOfLines={1}>
                  {m.username}
                </Text>
                {m.role !== 'member' && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{m.role === 'owner' ? 'OWNER' : 'ADMIN'}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingBottom: spacing.md,
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
  manageButton: {
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 20,
    backgroundColor: colors.coral,
    ...elevation('smallCta'),
  },
  manageButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
    letterSpacing: 0.08 * 13,
  },
  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: 10,
  },
  errorText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: 4,
  },
  clubHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: radii.lg,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sheetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubHeaderTextWrap: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
  },
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clubName: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  clubMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 20,
    marginTop: spacing.base,
  },
  joinButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: spacing.lg,
    ...elevation('primaryBtn'),
  },
  joinButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  leaveButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: spacing.lg,
    ...elevation('subtle'),
  },
  leaveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  pendingBanner: {
    marginTop: spacing.lg,
    backgroundColor: colors.amber,
    borderRadius: radii.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pendingBannerText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
    marginBottom: spacing.base,
  },
  tabButton: {
    flex: 1,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  tabButtonActive: {
    backgroundColor: colors.coral,
    ...elevation('smallCta'),
  },
  tabButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    color: colors.ink,
  },
  tabButtonTextActive: {
    color: colors.white,
  },
  tabContent: {
    gap: 10,
  },
  scheduleButton: {
    height: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  scheduleButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  emptyBody: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    lineHeight: 20,
    paddingVertical: 12,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.base,
    gap: 6,
    ...elevation('card'),
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
  },
  eventWhenText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
    textTransform: 'uppercase',
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  eventMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  routeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.base,
    gap: 4,
    ...elevation('card'),
  },
  routeName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberAvatarPlaceholder: {
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarInitial: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.white,
  },
  memberUsername: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  roleBadge: {
    backgroundColor: colors.teal,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
  },
});
