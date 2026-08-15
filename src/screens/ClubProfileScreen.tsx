import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CalendarIcon, LockIcon, UserIcon, UsersIcon } from '../components/icons';
import { brutalShadow, colors, fonts } from '../theme/theme';
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

type Tab = 'events' | 'routes' | 'members';

interface Props {
  clubId: string;
  onClose: () => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onOpenClubAdmin: (clubId: string) => void;
  onOpenProfile: (userId: string) => void;
  onRequirePaywall: (trigger: PaywallTrigger) => void;
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
  onScheduleClubRun,
}: Props) {
  const [club, setClub] = useState<RunClub | null>(null);
  const [tab, setTab] = useState<Tab>('events');
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

  useEffect(() => {
    if (!club || club.myStatus === 'pending') return;
    if (tab === 'events') {
      listClubEvents(clubId).then(setEvents).catch(() => {});
    } else if (tab === 'routes') {
      listClubRoutes(clubId).then(setRoutes).catch(() => {});
    } else if (tab === 'members') {
      listClubMembers(clubId).then(setMembers).catch(() => {});
    }
  }, [tab, clubId, club]);

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose}>
            <BackIcon />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.rust} />
        </View>
      </View>
    );
  }

  if (error || !club) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose}>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
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
              <UsersIcon size={28} color={colors.muted} />
            </View>
          )}
          <View style={styles.clubHeaderTextWrap}>
            <View style={styles.clubNameRow}>
              <Text style={styles.clubName} numberOfLines={2}>
                {club.name}
              </Text>
              {club.isPrivate && <LockIcon size={14} color={colors.muted} />}
            </View>
            {club.city && <Text style={styles.clubMeta}>📍 {club.city}</Text>}
            {club.memberCount > 1 && (
              <Text style={styles.clubMeta}>
                👥 {club.memberCount} member{club.memberCount === 1 ? '' : 's'}
              </Text>
            )}
          </View>
        </View>

        {!!club.description && <Text style={styles.description}>{club.description}</Text>}

        {!isMember && !isPending && (
          <Pressable style={styles.joinButton} onPress={handleJoin} disabled={joining}>
            {joining ? (
              <ActivityIndicator color={colors.sand} />
            ) : (
              <Text style={styles.joinButtonText}>{club.isPrivate ? 'REQUEST TO JOIN' : 'JOIN CLUB'}</Text>
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
            <Text style={styles.leaveButtonText}>LEAVE CLUB</Text>
          </Pressable>
        )}

        <View style={styles.tabRow}>
          {(['events', 'routes', 'members'] as Tab[]).map((t) => (
            <Pressable key={t} style={[styles.tabButton, tab === t && styles.tabButtonActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabButtonText, tab === t && styles.tabButtonTextActive]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {isPending ? (
          <Text style={styles.emptyBody}>You&apos;ll see events, routes, and members once your request is approved.</Text>
        ) : tab === 'events' ? (
          <View style={styles.tabContent}>
            {isAdmin && (
              <Pressable style={styles.scheduleButton} onPress={() => onScheduleClubRun(club.id)}>
                <Text style={styles.scheduleButtonText}>+ SCHEDULE A CLUB RUN</Text>
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
                    <CalendarIcon size={12} color={colors.ink} />
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
                  <View style={[styles.memberAvatar, styles.avatarPlaceholder]}>
                    <UserIcon size={16} color={colors.muted} />
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
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  manageButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  manageButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
  errorBanner: {
    marginHorizontal: 16,
    backgroundColor: colors.rustDark,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 4,
  },
  clubHeader: {
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sand,
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
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  clubMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  description: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    marginTop: 14,
  },
  joinButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...brutalShadow(4),
  },
  joinButtonText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.sand,
  },
  leaveButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  leaveButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  pendingBanner: {
    marginTop: 16,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pendingBannerText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 2.5,
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
    fontSize: 11,
    color: colors.ink,
  },
  tabButtonTextActive: {
    color: colors.sand,
  },
  tabContent: {
    gap: 10,
  },
  scheduleButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.ink,
    backgroundColor: colors.aqua,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  emptyBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    paddingVertical: 12,
  },
  eventCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    ...brutalShadow(3),
  },
  eventWhenBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  eventWhenText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  eventTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  eventMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  routeCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    ...brutalShadow(3),
  },
  routeName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberUsername: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  roleBadge: {
    backgroundColor: colors.aqua,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
  },
});
