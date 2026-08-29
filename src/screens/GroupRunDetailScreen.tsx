import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CalendarIcon, CloseIcon, CompassIcon, EditIcon, ExpandIcon, ReplyIcon, SendIcon, ShareIcon, TrashIcon, UserIcon } from '../components/icons';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import RaceBadge from '../components/RaceBadge';
import AnnouncementsFeed from '../components/AnnouncementsFeed';
import { Announcement, createEventPost, deleteEventPost, listEventPosts } from '../utils/announcementsApi';
import ReportModal from '../components/ReportModal';
import RunThisRaceButton from '../components/RunThisRaceButton';
import PosterViewerModal from '../components/PosterViewerModal';
import ScheduleGroupRunModal, { RaceInput, RecurrenceInput } from '../components/ScheduleGroupRunModal';
import { useNotificationPrePermission } from '../hooks/useNotificationPrePermission';
import { useAuth } from '../lib/AuthContext';
import { useUserTier } from '../hooks/useUserTier';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import {
  CloudRoute,
  GroupRun,
  GroupRunComment,
  GroupRunParticipant,
  PathPoint,
  RaceCategorySummary,
  RaceDetails,
  RaceRsvp,
  RouteCompletion,
  RouteReview,
} from '../types/route';
import { addGroupRunToCalendar } from '../utils/calendar';
import { getTodayCompletion, logRouteCompletion } from '../utils/completionsApi';
import { getMyReview } from '../utils/reviewsApi';
import { ensureLiveShareToken, getMyRaceRsvp, getRaceCategories, getRaceDetails } from '../utils/racesApi';
import {
  isSubscribedToSeries as checkIsSubscribedToSeries,
  subscribeToSeries,
  unsubscribeFromSeries,
} from '../utils/recurringSeriesApi';
import ReviewModal from '../components/ReviewModal';
import { navigateToStart } from '../utils/externalNav';
import { deleteGroupRunComment, listGroupRunComments, postGroupRunComment } from '../utils/groupRunCommentsApi';
import {
  cancelGroupRun,
  createGroupRun,
  FreeJoinLimitError,
  getGroupRun,
  listGroupRunParticipants,
  respondToJoinRequest,
  setGroupRunRsvp,
  updateGroupRun,
} from '../utils/groupRunsApi';
import { createReport, ReportReason } from '../utils/reportsApi';
import { getRoute } from '../utils/routesApi';
import { buildStaticMapUrl } from '../utils/staticMap';

const MAX_DEPTH = 2;
// Matches OFFICIAL_ACCOUNT_ID in App.tsx and scripts/createRace.ts — kept
// duplicated rather than threaded through props for this one gate.
const OFFICIAL_ACCOUNT_ID = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f';

interface Props {
  groupRunId: string;
  onClose: () => void;
  onOpenRoute: (routeId: string) => void;
  onRequirePaywall: () => void;
  /** Gates RSVP/join/comment/race-run actions behind having a session — guests can browse this screen read-only, but transacting prompts a sign-in. */
  onRequireAuth: (action: () => void, context?: string) => void;
  onOpenProfile: (userId: string) => void;
  onRunRace: (groupRun: GroupRun, rsvpId: string) => void;
  onReopenShareCard: (groupRun: GroupRun, rsvp: RaceRsvp) => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onAddDistanceCategory: (groupRun: GroupRun, raceDetails: RaceDetails) => void;
}

interface ReplyTarget {
  id: string;
  depth: number;
  username: string;
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

function formatCommentTime(ms: number): string {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function GroupRunDetailScreen({ groupRunId, onClose, onOpenRoute, onRequirePaywall, onRequireAuth, onOpenProfile, onRunRace, onReopenShareCard, onOpenGroupRun, onAddDistanceCategory }: Props) {
  const insets = useSafeAreaInsets();
  const [groupRun, setGroupRun] = useState<GroupRun | null>(null);
  const [raceDetails, setRaceDetails] = useState<RaceDetails | null>(null);
  const [raceCategories, setRaceCategories] = useState<RaceCategorySummary[]>([]);
  const [myRaceRsvp, setMyRaceRsvp] = useState<RaceRsvp | null>(null);
  const [myLiveLink, setMyLiveLink] = useState<string | null>(null);
  const [viewingPoster, setViewingPoster] = useState<string | null>(null);
  const [route, setRoute] = useState<CloudRoute | null>(null);
  const [comments, setComments] = useState<GroupRunComment[]>([]);
  const [eventPosts, setEventPosts] = useState<Announcement[]>([]);
  const [eventPostsLoading, setEventPostsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [participants, setParticipants] = useState<GroupRunParticipant[]>([]);
  const [respondingUserId, setRespondingUserId] = useState<string | null>(null);
  const [todayCompletion, setTodayCompletion] = useState<RouteCompletion | null>(null);
  const [loggingCompletion, setLoggingCompletion] = useState(false);
  const [myReview, setMyReview] = useState<RouteReview | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubscribedToSeries, setIsSubscribedToSeriesState] = useState(false);
  const [subscribingToSeries, setSubscribingToSeries] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharingLiveLink, setSharingLiveLink] = useState(false);
  const notificationPrePermission = useNotificationPrePermission();
  const { session } = useAuth();
  const tier = useUserTier();

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const run = await getGroupRun(groupRunId);
      setGroupRun(run);
      // Comments are only fetched for participants — RLS would block a
      // non-participant's read anyway, but there's no reason to make the
      // call (or briefly show a stale/empty list) for someone who can't see them.
      if (run.isRsvpedByMe || run.isHostedByMe) {
        setComments(await listGroupRunComments(groupRunId));
      } else {
        setComments([]);
      }
      listGroupRunParticipants(groupRunId)
        .then(setParticipants)
        .catch(() => {});
      setEventPostsLoading(true);
      listEventPosts(groupRunId)
        .then(setEventPosts)
        .catch(() => {})
        .finally(() => setEventPostsLoading(false));
      // Non-critical — the event page still works if the route preview fails to load.
      getRoute(run.routeId)
        .then(setRoute)
        .catch(() => {});
      if (run.status === 'archived' && (run.isRsvpedByMe || run.isHostedByMe)) {
        getTodayCompletion(run.routeId)
          .then(setTodayCompletion)
          .catch(() => {});
        getMyReview(run.routeId)
          .then(setMyReview)
          .catch(() => {});
      }
      if (run.category === 'race') {
        getRaceDetails(groupRunId)
          .then((details) => {
            setRaceDetails(details);
            if (details?.eventGroupId) {
              getRaceCategories(details.eventGroupId)
                .then(setRaceCategories)
                .catch(() => {});
            }
          })
          .catch(() => {});
        if (run.isRsvpedByMe) getMyRaceRsvp(groupRunId).then(setMyRaceRsvp).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load this group run.');
    } finally {
      setLoading(false);
    }
  }, [groupRunId]);

  const handleLogRun = useCallback(async () => {
    if (!groupRun || todayCompletion) return;
    setLoggingCompletion(true);
    try {
      const completion = await logRouteCompletion(groupRun.routeId, {
        groupRunId: groupRun.id,
        source: 'group_run',
      });
      setTodayCompletion(completion);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log your run. Try again.');
    } finally {
      setLoggingCompletion(false);
    }
  }, [groupRun, todayCompletion]);

  const routeFullPath = useMemo<PathPoint[]>(() => {
    if (!route || route.waypoints.length === 0) return [];
    const points: PathPoint[] = [route.waypoints[0]];
    for (const segment of route.segments) {
      points.push(...segment.path.slice(1));
    }
    return points;
  }, [route]);

  const routeMapUrl = useMemo(
    () => (route ? buildStaticMapUrl(routeFullPath, route.waypoints) : null),
    [route, routeFullPath],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!groupRun?.seriesId) return;
    checkIsSubscribedToSeries(groupRun.seriesId)
      .then(setIsSubscribedToSeriesState)
      .catch(() => {});
  }, [groupRun?.seriesId]);

  // Displayed on the event page for anyone who's joined a race — issues the
  // token silently (no share-sheet prompt here, that's promptShareLiveLink's
  // job right at join time) so the link is visible to copy/share again later.
  useEffect(() => {
    if (!myRaceRsvp || myRaceRsvp.finishedAt) {
      setMyLiveLink(null);
      return;
    }
    ensureLiveShareToken(myRaceRsvp.id)
      .then((token) => setMyLiveLink(`https://app.rootah.com/live/${token}`))
      .catch(() => {});
  }, [myRaceRsvp]);

  const handleToggleSeriesSubscription = useCallback(async () => {
    if (!groupRun?.seriesId) return;
    setSubscribingToSeries(true);
    try {
      if (isSubscribedToSeries) {
        await unsubscribeFromSeries(groupRun.seriesId);
        setIsSubscribedToSeriesState(false);
      } else {
        await subscribeToSeries(groupRun.seriesId);
        setIsSubscribedToSeriesState(true);
      }
      await refresh();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update your subscription.');
    } finally {
      setSubscribingToSeries(false);
    }
  }, [groupRun?.seriesId, isSubscribedToSeries, refresh]);

  // Sharing the live-tracking link only happens right after tapping "I'M
  // JOINING THIS RACE" — not as a persistent button elsewhere on the page —
  // so this is invoked once, from handleToggleRsvp, not wired to its own UI.
  const promptShareLiveLink = useCallback(async (rsvpId: string, raceTitle: string) => {
    setSharingLiveLink(true);
    try {
      const token = await ensureLiveShareToken(rsvpId);
      const url = `https://app.rootah.com/live/${token}`;
      Alert.alert("You're in!", 'Share your live tracking link so friends and family can follow along on race day?', [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Share',
          onPress: () => {
            Share.share({ message: `Follow me live on Rootah at "${raceTitle}": ${url}`, url }).catch(() => {});
          },
        },
      ]);
    } catch {
      // non-fatal — the runner already joined successfully; they just won't get the share prompt this time.
    } finally {
      setSharingLiveLink(false);
    }
  }, []);

  const handleToggleRsvp = useCallback(async () => {
    if (!groupRun || groupRun.isHostedByMe) return;
    const requesting = !groupRun.myRsvpStatus;
    const prevStatus = groupRun.myRsvpStatus;
    setGroupRun((prev) =>
      prev
        ? {
            ...prev,
            myRsvpStatus: requesting ? 'pending' : null,
            isRsvpedByMe: false,
            rsvpCount: prev.rsvpCount - (prevStatus === 'approved' ? 1 : 0),
          }
        : prev,
    );
    try {
      await setGroupRunRsvp(groupRun.id, requesting);
      if (requesting) {
        notificationPrePermission.maybePrompt(
          groupRun.category === 'race'
            ? 'Get notified about race updates and reminders.'
            : 'Get notified when the host approves your request or posts updates.',
        );
        // Races auto-approve on join (no host review) — this is the moment
        // "I'M JOINING THIS RACE" was tapped, so offer the live-tracking
        // link right here rather than making the runner hunt for it later.
        if (groupRun.category === 'race') {
          getMyRaceRsvp(groupRun.id)
            .then((rsvp) => {
              if (rsvp?.status === 'approved') promptShareLiveLink(rsvp.id, groupRun.title);
            })
            .catch(() => {});
        }
      }
      refresh();
    } catch (e) {
      setGroupRun((prev) =>
        prev
          ? {
              ...prev,
              myRsvpStatus: prevStatus,
              isRsvpedByMe: prevStatus === 'approved',
              rsvpCount: prev.rsvpCount + (prevStatus === 'approved' ? 1 : 0),
            }
          : prev,
      );
      if (e instanceof FreeJoinLimitError) {
        onRequirePaywall();
      } else {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update RSVP.');
      }
    }
  }, [groupRun, onRequirePaywall, notificationPrePermission.maybePrompt, refresh, promptShareLiveLink]);

  const handleRespondToRequest = useCallback(
    async (userId: string, approve: boolean) => {
      if (!groupRun) return;
      setRespondingUserId(userId);
      try {
        await respondToJoinRequest(groupRun.id, userId, approve);
        await refresh();
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update this request.');
      } finally {
        setRespondingUserId(null);
      }
    },
    [groupRun, refresh],
  );

  const handleNavigateToStart = useCallback(() => {
    if (!groupRun) return;
    if (groupRun.startLat == null || groupRun.startLng == null) {
      Alert.alert('Unavailable', "This event's start location isn't available yet.");
      return;
    }
    navigateToStart(groupRun.startLat, groupRun.startLng, groupRun.title || 'the start');
  }, [groupRun]);

  const handleSaveEdit = useCallback(
    async (
      title: string,
      description: string,
      scheduledAt: Date,
      maxParticipants: number | null,
      _recurrence: RecurrenceInput | null,
      race: RaceInput | null,
    ) => {
      if (!groupRun) return;
      setSavingEdit(true);
      try {
        await updateGroupRun(groupRun.id, {
          title,
          description,
          scheduledAt,
          maxParticipants,
          race: race
            ? {
                raceDate: race.raceDate,
                raceTimezone: raceDetails?.raceTimezone,
                organizerName: race.organizerName || null,
                organizerLogoUrl: race.organizerLogoUrl || null,
                eventBannerUrl: race.eventBannerUrl || null,
                eventLogoUrl: race.eventLogoUrl || null,
              }
            : null,
        });
        await refresh();
        setShowEditModal(false);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save changes.');
      } finally {
        setSavingEdit(false);
      }
    },
    [groupRun, raceDetails, refresh],
  );

  const handleDelete = useCallback(() => {
    if (!groupRun) return;
    Alert.alert('Delete this event?', 'This cannot be undone — participants will no longer see it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await cancelGroupRun(groupRun.id);
            onClose();
          } catch (e) {
            setDeleting(false);
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete event.');
          }
        },
      },
    ]);
  }, [groupRun, onClose]);

  const handleAddToCalendar = useCallback(() => {
    if (!groupRun) return;
    addGroupRunToCalendar({
      title: groupRun.title,
      notes: groupRun.description,
      startDate: new Date(groupRun.scheduledAt),
    });
  }, [groupRun]);

  const handleShare = useCallback(async () => {
    if (!groupRun) return;
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    const url = webBaseUrl ? `${webBaseUrl}/runs/${groupRun.id}` : undefined;
    const when = formatWhen(groupRun.scheduledAt);
    const lines = [
      `Join us for a group run! 🏃`,
      '',
      `📅 ${when}`,
      groupRun.city ? `📍 ${groupRun.city} — ${groupRun.routeName} (${groupRun.routeDistanceKm.toFixed(1)}km)` : `${groupRun.routeName} (${groupRun.routeDistanceKm.toFixed(1)}km)`,
      `👥 ${groupRun.rsvpCount} people joining`,
    ];
    if (url) {
      lines.push('', 'RSVP and see the route here:', url);
    }
    try {
      await Share.share({ message: lines.join('\n'), url, title: groupRun.title });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to share this run.');
    }
  }, [groupRun]);

  const isArchived = groupRun?.status === 'archived';
  const isFull =
    !!groupRun && !groupRun.myRsvpStatus && groupRun.maxParticipants !== null && groupRun.rsvpCount >= groupRun.maxParticipants;
  const canViewComments = !!session && !!groupRun && (groupRun.isRsvpedByMe || groupRun.isHostedByMe);
  const canComment = canViewComments && !isArchived;
  const pendingRequests = useMemo(() => participants.filter((p) => p.status === 'pending'), [participants]);
  const approvedParticipants = useMemo(
    () => participants.filter((p) => p.status === 'approved' && p.userId !== groupRun?.hostId),
    [participants, groupRun?.hostId],
  );

  const handlePost = useCallback(async () => {
    const body = draft.trim();
    if (!body || !groupRun) return;
    setPosting(true);
    try {
      await postGroupRunComment(groupRun.id, body, replyTarget ? { id: replyTarget.id, depth: replyTarget.depth } : undefined);
      setDraft('');
      setReplyTarget(null);
      setComposerOpen(false);
      await refresh();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  }, [draft, groupRun, replyTarget, refresh]);

  const handleDeleteComment = useCallback(
    (comment: GroupRunComment) => {
      Alert.alert('Delete comment', 'Remove this comment and any replies to it?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroupRunComment(comment.id);
              await refresh();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete comment.');
            }
          },
        },
      ]);
    },
    [refresh],
  );

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, details: string) => {
      if (!reportingCommentId) return;
      setIsReporting(true);
      try {
        await createReport('comment', reportingCommentId, reason, details);
        setReportingCommentId(null);
        Alert.alert('Report submitted', "Thanks — we'll take a look.");
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit report.');
      } finally {
        setIsReporting(false);
      }
    },
    [reportingCommentId],
  );

  const renderComment = (comment: GroupRunComment) => (
    <View key={comment.id} style={[styles.commentWrap, comment.depth > 0 && styles.commentWrapReply]}>
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          {comment.authorAvatarUrl ? (
            <View style={styles.commentAvatarImg} />
          ) : (
            <View style={styles.commentAvatarPlaceholder}>
              <Text style={styles.commentAvatarText}>{comment.authorUsername.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.commentUsername}>{comment.authorUsername}</Text>
          <Text style={styles.commentTime}>{formatCommentTime(comment.createdAt)}</Text>
        </View>

        <Text style={styles.commentBody}>{comment.body}</Text>

        <View style={styles.commentFooter}>
          {comment.depth < MAX_DEPTH && canComment && (
            <Pressable
              style={styles.replyButton}
              onPress={() => {
                setReplyTarget({ id: comment.id, depth: comment.depth, username: comment.authorUsername });
                setComposerOpen(true);
              }}
            >
              <ReplyIcon size={12} />
              <Text style={styles.replyButtonText}>Reply</Text>
            </Pressable>
          )}
          {comment.isOwnedByMe ? (
            <Pressable style={styles.deleteCommentButton} onPress={() => handleDeleteComment(comment)}>
              <TrashIcon size={12} color={colors.danger} />
            </Pressable>
          ) : (
            <Pressable style={styles.deleteCommentButton} onPress={() => setReportingCommentId(comment.id)}>
              <Text style={styles.reportCommentText}>Report</Text>
            </Pressable>
          )}
        </View>
      </View>

      {comment.replies.map(renderComment)}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {groupRun?.title ?? 'Group Run'}
        </Text>
        <View style={styles.headerActions}>
          {groupRun?.isHostedByMe && !isArchived && (
            <Pressable style={styles.backButton} onPress={() => setShowEditModal(true)} accessibilityRole="button" accessibilityLabel="Back">
              <EditIcon size={16} />
            </Pressable>
          )}
          {groupRun?.isHostedByMe && (
            <Pressable style={styles.backButton} onPress={handleDelete} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color={colors.stone} /> : <TrashIcon size={16} color={colors.stone} />}
            </Pressable>
          )}
          <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
            <CloseIcon size={16} />
          </Pressable>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && groupRun && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {groupRun.status === 'active' && (
            <View style={styles.activeBanner}>
              <Text style={styles.activeBannerText}>This run is happening today</Text>
            </View>
          )}
          {isArchived && (
            <View style={styles.archivedBanner}>
              <Text style={styles.archivedBannerText}>This run has already taken place</Text>
            </View>
          )}

          {isArchived && (groupRun.isRsvpedByMe || groupRun.isHostedByMe) && (
            <View style={styles.postEventCard}>
              <Pressable
                style={[styles.postEventButton, todayCompletion && styles.postEventButtonDone]}
                onPress={handleLogRun}
                disabled={loggingCompletion}
              >
                {loggingCompletion ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={[styles.postEventButtonText, todayCompletion && styles.postEventButtonTextDone]}>
                    {todayCompletion ? '✓ Logged' : 'I ran it ✓'}
                  </Text>
                )}
              </Pressable>
              <Pressable style={styles.postEventReviewLink} onPress={() => setShowReviewModal(true)}>
                <Text style={styles.postEventReviewLinkText}>
                  {myReview ? 'Edit your review of this route' : 'How was the route? Leave a review'}
                </Text>
              </Pressable>
            </View>
          )}

          {groupRun.category === 'race' ? (
            <>
              {/* Hero — the banner IS the hero image when the organizer supplied one; the route map thumbnail only appears as a fallback so the two never compete for the same visual weight. */}
              {raceDetails?.eventBannerUrl ? (
                <Pressable onPress={() => setViewingPoster(raceDetails.eventBannerUrl)}>
                  <Image source={{ uri: raceDetails.eventBannerUrl }} style={styles.eventBanner} resizeMode="cover" />
                  <View style={styles.expandBadge}>
                    <ExpandIcon size={14} color={colors.white} />
                  </View>
                </Pressable>
              ) : (
                routeMapUrl && (
                  <Pressable onPress={() => onOpenRoute(groupRun.routeId)}>
                    <Image source={{ uri: routeMapUrl }} style={styles.eventBanner} resizeMode="cover" />
                  </Pressable>
                )
              )}

              {/* Identity — badge, title, and organizer grouped tightly since they answer one question ("what race is this, who's behind it"); the date/distance facts sit in their own scannable row below rather than interleaved as separate badges. */}
              <View style={styles.eventCard}>
                <RaceBadge />
                <Text style={styles.eventTitle}>{raceDetails?.eventTitle ?? groupRun.title}</Text>
                {raceDetails?.eventTitle && raceDetails.eventTitle !== groupRun.title && (
                  <Text style={styles.categorySubtitle}>{groupRun.title}</Text>
                )}

                {(raceDetails?.organizerName || raceDetails?.eventLogoUrl) && (
                  <View style={styles.organizerRow}>
                    {(raceDetails.eventLogoUrl || raceDetails.organizerLogoUrl) && (
                      <Image
                        source={{ uri: raceDetails.eventLogoUrl ?? raceDetails.organizerLogoUrl! }}
                        style={styles.organizerLogo}
                        resizeMode="contain"
                      />
                    )}
                    {raceDetails.organizerName && (
                      <View>
                        <Text style={styles.organizerLabel}>ORGANIZED BY</Text>
                        <Text style={styles.organizerName}>{raceDetails.organizerName}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.raceFactsRow}>
                  <View style={styles.raceFactChip}>
                    <CalendarIcon size={12} />
                    <Text style={styles.raceFactChipText}>{formatWhen(groupRun.scheduledAt)}</Text>
                  </View>
                  <Pressable style={styles.raceFactChip} onPress={() => onOpenRoute(groupRun.routeId)}>
                    <Text style={styles.raceFactChipText}>{groupRun.routeDistanceKm.toFixed(1)} km</Text>
                  </Pressable>
                  {route && (
                    <View style={[styles.raceFactChip, styles.raceFactChipAqua]}>
                      <Text style={styles.raceFactChipText}>+{Math.round(route.elevationGainM)} m</Text>
                    </View>
                  )}
                </View>

                {raceCategories.length > 1 && (
                  <View style={styles.categoriesSection}>
                    <Text style={styles.categoriesLabel}>DISTANCE</Text>
                    <View style={styles.categoriesRow}>
                      {raceCategories.map((cat) => {
                        const isCurrent = cat.groupRunId === groupRun.id;
                        return (
                          <Pressable
                            key={cat.groupRunId}
                            style={[styles.categoryChip, isCurrent && styles.categoryChipActive]}
                            onPress={() => !isCurrent && onOpenGroupRun(cat.groupRunId)}
                            disabled={isCurrent}
                          >
                            <Text style={[styles.categoryChipText, isCurrent && styles.categoryChipTextActive]}>
                              {cat.routeDistanceKm.toFixed(1)} km
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {groupRun.isHostedByMe && raceDetails && (
                  <Pressable style={styles.addCategoryButton} onPress={() => onAddDistanceCategory(groupRun, raceDetails)}>
                    <Text style={styles.addCategoryButtonText}>+ Add another distance</Text>
                  </Pressable>
                )}
              </View>

              {/* Action — the single most important thing on this screen (join, run, or view your finish) gets its own visually distinct card instead of being buried in the footer below the description. */}
              <View style={styles.raceActionCard}>
                {groupRun.myRsvpStatus === 'approved' && raceDetails ? (
                  <>
                    {myRaceRsvp?.finishedAt ? (
                      <Pressable
                        style={[styles.rsvpButton, styles.rsvpButtonActive]}
                        onPress={() => myRaceRsvp.recordedRunId && onReopenShareCard(groupRun, myRaceRsvp)}
                        disabled={!myRaceRsvp.recordedRunId}
                      >
                        <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>
                          ✓ FINISHED{myRaceRsvp.finishTimeSeconds ? ` · ${Math.round(myRaceRsvp.finishTimeSeconds / 60)} MIN` : ''} · VIEW SHARE CARD
                        </Text>
                      </Pressable>
                    ) : (
                      <RunThisRaceButton raceDetails={raceDetails} onPress={() => myRaceRsvp && onRunRace(groupRun, myRaceRsvp.id)} />
                    )}
                    {myLiveLink && (
                      <Pressable
                        style={styles.liveLinkCard}
                        onPress={() => Share.share({ message: `Follow me live on Rootah at "${groupRun.title}": ${myLiveLink}`, url: myLiveLink }).catch(() => {})}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.liveLinkLabel}>YOUR LIVE TRACKING LINK</Text>
                          <Text style={styles.liveLinkUrl} numberOfLines={1}>{myLiveLink}</Text>
                        </View>
                        <ShareIcon size={16} color={colors.ink} />
                      </Pressable>
                    )}
                  </>
                ) : groupRun.isHostedByMe ? (
                  <View style={[styles.rsvpButton, styles.rsvpButtonActive]}>
                    <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>HOSTING</Text>
                  </View>
                ) : (
                  !isArchived &&
                  (isFull ? (
                    <View style={[styles.rsvpButton, styles.rsvpButtonFull]}>
                      <Text style={styles.rsvpButtonText}>FULL</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.rsvpButton, groupRun.myRsvpStatus === 'pending' && styles.rsvpButtonPending]}
                      onPress={() => onRequireAuth(handleToggleRsvp, 'rsvp')}
                    >
                      <Text style={styles.rsvpButtonText}>
                        {groupRun.myRsvpStatus === 'pending' ? 'REQUESTED' : "I'M JOINING THIS RACE"}
                      </Text>
                    </Pressable>
                  ))
                )}
                <Text style={styles.rsvpCount}>
                  {groupRun.rsvpCount}{groupRun.maxParticipants ? `/${groupRun.maxParticipants}` : ''} {isArchived ? 'went' : 'going'}
                </Text>
              </View>

              {!!groupRun.description && (
                <View style={styles.eventCard}>
                  <Text style={styles.eventDescription}>{groupRun.description}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.eventCard}>
              {routeMapUrl && (
                <Pressable style={styles.routePreviewWrap} onPress={() => onOpenRoute(groupRun.routeId)}>
                  <Image source={{ uri: routeMapUrl }} style={styles.routePreviewImage} />
                  <View style={styles.routePreviewStatsRow}>
                    <View style={styles.routePreviewChip}>
                      <Text style={styles.routePreviewChipText}>{groupRun.routeDistanceKm.toFixed(1)} km</Text>
                    </View>
                    {route && (
                      <View style={[styles.routePreviewChip, styles.routePreviewChipAqua]}>
                        <Text style={styles.routePreviewChipText}>+{Math.round(route.elevationGainM)} m</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              )}

              <View style={styles.whenBadge}>
                <CalendarIcon size={13} />
                <Text style={styles.whenText}>{formatWhen(groupRun.scheduledAt)}</Text>
              </View>
              <Text style={styles.eventTitle}>{groupRun.title}</Text>
              <View style={styles.eventRouteRow}>
                <Pressable onPress={() => onOpenRoute(groupRun.routeId)}>
                  <Text style={styles.eventRoute}>{groupRun.routeName}</Text>
                </Pressable>
                {groupRun.hostUsername !== 'unknown' && (
                  <>
                    <Text style={styles.eventRoute}> · hosted by </Text>
                    <Pressable onPress={() => onOpenProfile(groupRun.hostId)}>
                      <Text style={[styles.eventRoute, styles.eventHostLink]}>{groupRun.hostUsername}</Text>
                    </Pressable>
                  </>
                )}
              </View>
              {!!groupRun.description && <Text style={styles.eventDescription}>{groupRun.description}</Text>}

              {groupRun.seriesId && !groupRun.isHostedByMe && !isArchived && (
                <View style={styles.seriesRow}>
                  <View style={styles.seriesBadge}>
                    <Text style={styles.seriesBadgeText}>🔁 RECURRING</Text>
                  </View>
                  {isSubscribedToSeries ? (
                    <Pressable onPress={handleToggleSeriesSubscription} disabled={subscribingToSeries}>
                      <Text style={styles.seriesLink}>
                        {subscribingToSeries ? 'Updating…' : "✓ Subscribed — leave series"}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={handleToggleSeriesSubscription} disabled={subscribingToSeries}>
                      <Text style={styles.seriesLink}>
                        {subscribingToSeries ? 'Joining…' : 'Join every week →'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
              {groupRun.seriesId && groupRun.isHostedByMe && (
                <View style={styles.seriesBadge}>
                  <Text style={styles.seriesBadgeText}>🔁 RECURRING</Text>
                </View>
              )}

              <View style={styles.eventFooter}>
                <Text style={styles.rsvpCount}>
                  {groupRun.rsvpCount}{groupRun.maxParticipants ? `/${groupRun.maxParticipants}` : ''} {isArchived ? 'went' : 'going'}
                </Text>
                {groupRun.isHostedByMe ? (
                  <View style={[styles.rsvpButton, styles.rsvpButtonActive]}>
                    <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>HOSTING</Text>
                  </View>
                ) : (
                  !isArchived &&
                  (isFull ? (
                    <View style={[styles.rsvpButton, styles.rsvpButtonFull]}>
                      <Text style={styles.rsvpButtonText}>FULL</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[
                        styles.rsvpButton,
                        groupRun.myRsvpStatus === 'approved' && styles.rsvpButtonActive,
                        groupRun.myRsvpStatus === 'pending' && styles.rsvpButtonPending,
                      ]}
                      onPress={() => onRequireAuth(handleToggleRsvp, 'rsvp')}
                    >
                      <Text
                        style={[
                          styles.rsvpButtonText,
                          groupRun.myRsvpStatus === 'approved' && styles.rsvpButtonTextActive,
                        ]}
                      >
                        {groupRun.myRsvpStatus === 'approved'
                          ? "I'M IN"
                          : groupRun.myRsvpStatus === 'pending'
                            ? 'REQUESTED'
                            : 'REQUEST TO JOIN'}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          )}

          <View style={styles.eventCard}>
            {groupRun.isHostedByMe && pendingRequests.length > 0 && (
              <View style={styles.requestsSection}>
                <Text style={styles.requestsTitle}>
                  Join requests ({pendingRequests.length})
                </Text>
                {pendingRequests.map((p) => (
                  <View key={p.userId} style={styles.requestRow}>
                    <View style={styles.requestAvatar}>
                      {p.avatarUrl ? (
                        <Image source={{ uri: p.avatarUrl }} style={styles.requestAvatarImage} />
                      ) : (
                        <UserIcon size={16} color={colors.stone} />
                      )}
                    </View>
                    <Text style={styles.requestUsername} numberOfLines={1}>
                      {p.username}
                    </Text>
                    {respondingUserId === p.userId ? (
                      <ActivityIndicator size="small" color={colors.coral} />
                    ) : (
                      <View style={styles.requestActions}>
                        <Pressable
                          style={[styles.requestActionButton, styles.requestDeclineButton]}
                          onPress={() => handleRespondToRequest(p.userId, false)}
                        >
                          <Text style={styles.requestActionText}>DECLINE</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.requestActionButton, styles.requestApproveButton]}
                          onPress={() => handleRespondToRequest(p.userId, true)}
                        >
                          <Text style={[styles.requestActionText, styles.requestApproveText]}>APPROVE</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {!!session && approvedParticipants.length > 0 && (
              <View style={styles.whosGoingSection}>
                <Text style={styles.whosGoingTitle}>Who&apos;s going</Text>
                <View style={styles.whosGoingList}>
                  {approvedParticipants.map((p) => (
                    <View key={p.userId} style={styles.whosGoingChip}>
                      <View style={styles.whosGoingAvatar}>
                        {p.avatarUrl ? (
                          <Image source={{ uri: p.avatarUrl }} style={styles.requestAvatarImage} />
                        ) : (
                          <UserIcon size={13} color={colors.stone} />
                        )}
                      </View>
                      <Text style={styles.whosGoingUsername} numberOfLines={1}>
                        {p.username}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.secondaryActionsRow}>
              <Pressable style={styles.secondaryActionButton} onPress={handleNavigateToStart}>
                <CompassIcon size={15} color={colors.ink} />
                <Text style={styles.secondaryActionText}>NAVIGATE</Text>
              </Pressable>
              <Pressable style={styles.secondaryActionButton} onPress={handleAddToCalendar}>
                <CalendarIcon size={15} color={colors.ink} />
                <Text style={styles.secondaryActionText}>CALENDAR</Text>
              </Pressable>
              <Pressable style={styles.secondaryActionButton} onPress={handleShare}>
                <ShareIcon size={15} color={colors.ink} />
                <Text style={styles.secondaryActionText}>SHARE</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>Updates</Text>
            <AnnouncementsFeed
              posts={eventPosts}
              loading={eventPostsLoading}
              canManage={!!groupRun?.isHostedByMe}
              context={groupRun?.category === 'race' ? 'race' : 'event'}
              onCreate={async (body) => {
                await createEventPost(groupRunId, body);
                setEventPosts(await listEventPosts(groupRunId));
              }}
              onDelete={async (id) => {
                await deleteEventPost(id);
                setEventPosts(await listEventPosts(groupRunId));
              }}
            />
          </View>

          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>
              {comments.length === 0 ? 'Comments' : `Comments (${countComments(comments)})`}
            </Text>

            {!session ? (
              <Text style={styles.emptyCommentsText}>Sign in and RSVP to this run to see the comments.</Text>
            ) : !canViewComments ? (
              <Text style={styles.emptyCommentsText}>RSVP to this run to see the comments.</Text>
            ) : comments.length === 0 ? (
              <Text style={styles.emptyCommentsText}>No comments yet — be the first to say something.</Text>
            ) : (
              comments.map(renderComment)
            )}
          </View>
        </ScrollView>
      )}

      {!loading && groupRun && (
        <View style={styles.composerWrap}>
          {replyTarget && (
            <View style={styles.replyingBanner}>
              <Text style={styles.replyingText}>Replying to {replyTarget.username}</Text>
              <Pressable
                onPress={() => {
                  setReplyTarget(null);
                  if (!draft.trim()) setComposerOpen(false);
                }}
              >
                <Text style={styles.replyingCancel}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {canComment ? (
            composerOpen ? (
              <View style={styles.composerRow}>
                <TextInput
                  style={styles.composerInput}
                  placeholder={replyTarget ? 'Write a reply…' : 'Write a comment…'}
                  placeholderTextColor={colors.mist}
                  value={draft}
                  onChangeText={setDraft}
                  autoFocus
                  multiline
                />
                <Pressable
                  style={[styles.sendButton, (!draft.trim() || posting) && styles.sendButtonDisabled]}
                  onPress={handlePost}
                  disabled={!draft.trim() || posting}
                >
                  {posting ? <ActivityIndicator size="small" color={colors.white} /> : <SendIcon size={16} />}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.composerPrompt} onPress={() => setComposerOpen(true)}>
                <Text style={styles.composerPromptText}>Add a comment…</Text>
              </Pressable>
            )
          ) : isArchived ? (
            <View style={styles.rsvpGate}>
              <Text style={styles.rsvpGateText}>Comments are closed — this run has ended.</Text>
            </View>
          ) : (
            <View style={styles.rsvpGate}>
              <Text style={styles.rsvpGateText}>RSVP to this run to join the conversation.</Text>
            </View>
          )}
        </View>
      )}

      <ReportModal
        visible={!!reportingCommentId}
        isSubmitting={isReporting}
        onClose={() => setReportingCommentId(null)}
        onSubmit={handleSubmitReport}
      />

      <NotificationPermissionModal
        visible={notificationPrePermission.visible}
        message={notificationPrePermission.message}
        onAllow={notificationPrePermission.handleAllow}
        onDismiss={notificationPrePermission.handleDismiss}
      />

      {groupRun && (
        <ReviewModal
          visible={showReviewModal}
          routeId={groupRun.routeId}
          groupRunId={groupRun.id}
          existing={myReview}
          source="group_run"
          onClose={() => setShowReviewModal(false)}
          onSaved={(review) => {
            setMyReview(review);
            setShowReviewModal(false);
          }}
        />
      )}

      {groupRun && (
        <ScheduleGroupRunModal
          visible={showEditModal}
          isSaving={savingEdit}
          tier={tier}
          isOfficialAccount={session?.user.id === OFFICIAL_ACCOUNT_ID}
          editing={{
            title: groupRun.title,
            description: groupRun.description,
            scheduledAt: new Date(groupRun.scheduledAt),
            maxParticipants: groupRun.maxParticipants,
            raceDate: raceDetails ? new Date(`${raceDetails.raceDate}T00:00:00`) : null,
            organizerName: raceDetails?.organizerName ?? '',
            organizerLogoUrl: raceDetails?.organizerLogoUrl ?? '',
            eventBannerUrl: raceDetails?.eventBannerUrl ?? '',
            eventLogoUrl: raceDetails?.eventLogoUrl ?? '',
          }}
          onClose={() => setShowEditModal(false)}
          onSchedule={handleSaveEdit}
          onRequirePaywall={onRequirePaywall}
        />
      )}

      <PosterViewerModal imageUrl={viewingPoster} onClose={() => setViewingPoster(null)} />
    </KeyboardAvoidingView>
  );
}

function countComments(comments: GroupRunComment[]): number {
  return comments.reduce((sum, c) => sum + 1 + countComments(c.replies), 0);
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
    marginHorizontal: 8,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 20,
  },
  activeBanner: {
    backgroundColor: colors.sage,
    borderRadius: radii.sm,
    padding: 10,
  },
  activeBannerText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
    textAlign: 'center',
  },
  archivedBanner: {
    backgroundColor: colors.sheetBg,
    borderRadius: radii.sm,
    padding: 10,
  },
  archivedBannerText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textAlign: 'center',
  },
  postEventCard: {
    gap: 8,
    marginBottom: 4,
  },
  postEventButton: {
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    ...elevation('primaryBtn'),
  },
  postEventButtonDone: {
    backgroundColor: colors.sheetBg,
  },
  postEventButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  postEventButtonTextDone: {
    color: colors.ink,
  },
  postEventReviewLink: {
    alignItems: 'center',
  },
  postEventReviewLinkText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.coral,
    textDecorationLine: 'underline',
  },
  eventBanner: {
    width: '100%',
    height: 160,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  expandBadge: {
    position: 'absolute',
    bottom: spacing.sm + 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  organizerLogo: {
    width: 32,
    height: 32,
    borderRadius: radii.xs,
  },
  organizerLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.stone,
  },
  organizerName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 4,
    ...elevation('card'),
  },
  raceFactsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  raceFactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.cream,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  raceFactChipAqua: {
    backgroundColor: colors.teal,
  },
  raceFactChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  categoriesSection: {
    marginTop: 12,
  },
  categoriesLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.stone,
    marginBottom: 6,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.coral,
  },
  categoryChipActive: {
    backgroundColor: colors.coral,
  },
  categoryChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.coral,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  addCategoryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  addCategoryButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.coral,
    textDecorationLine: 'underline',
  },
  raceActionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.coral,
    ...elevation('card'),
  },
  routePreviewWrap: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginBottom: 10,
  },
  routePreviewImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.sheetBg,
  },
  routePreviewStatsRow: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
  },
  routePreviewChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    ...elevation('subtle'),
  },
  routePreviewChipAqua: {
    backgroundColor: colors.teal,
  },
  routePreviewChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  whenBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  whenText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.08 * 9,
    textTransform: 'uppercase',
    color: colors.white,
  },
  eventTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 19,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  categorySubtitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.coral,
    marginTop: 2,
  },
  eventRouteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  eventRoute: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textDecorationLine: 'underline',
  },
  eventHostLink: {
    color: colors.coral,
    fontFamily: fonts.bold,
  },
  eventDescription: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    marginTop: 4,
  },
  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  seriesBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.teal,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  raceRunWrap: {
    marginTop: 14,
    gap: 8,
  },
  liveLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  liveLinkLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.stone,
  },
  liveLinkUrl: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.ink,
    marginTop: 2,
  },
  seriesBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.white,
  },
  seriesLink: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.coral,
    textDecorationLine: 'underline',
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
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
  rsvpButtonFull: {
    backgroundColor: colors.mist,
    opacity: 0.7,
  },
  rsvpButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  rsvpButtonTextActive: {
    color: colors.white,
  },
  rsvpButtonPending: {
    backgroundColor: colors.amber,
  },
  requestsSection: {
    marginTop: 14,
    gap: 8,
  },
  requestsTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  requestAvatarImage: {
    width: '100%',
    height: '100%',
  },
  requestUsername: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 6,
  },
  requestActionButton: {
    borderRadius: radii.xs,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...elevation('subtle'),
  },
  requestDeclineButton: {
    backgroundColor: colors.surface,
  },
  requestApproveButton: {
    backgroundColor: colors.sage,
  },
  requestActionText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
  },
  requestApproveText: {
    color: colors.white,
  },
  whosGoingSection: {
    marginTop: 14,
    gap: 8,
  },
  whosGoingTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  whosGoingList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  whosGoingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.sheetBg,
    maxWidth: 140,
  },
  whosGoingAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  whosGoingUsername: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.sm,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  secondaryActionText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.08 * 10,
    color: colors.ink,
  },
  commentsSection: {
    gap: 12,
  },
  commentsTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  emptyCommentsText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  commentWrap: {
    gap: 8,
  },
  commentWrapReply: {
    marginLeft: 18,
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0,0,0,0.06)',
  },
  commentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 12,
    gap: 6,
    ...elevation('subtle'),
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAvatarImg: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: colors.teal,
  },
  commentAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
  },
  commentUsername: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  commentTime: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
    marginLeft: 'auto',
  },
  commentBody: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.stone,
  },
  deleteCommentButton: {
    marginLeft: 'auto',
  },
  reportCommentText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
    textDecorationLine: 'underline',
  },
  composerWrap: {
    backgroundColor: colors.sheetBg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    ...elevation('sheet'),
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  replyingText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  replyingCancel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.danger,
  },
  composerPrompt: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...elevation('subtle'),
  },
  composerPromptText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.mist,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    maxHeight: 100,
    ...elevation('subtle'),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  rsvpGate: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 12,
    alignItems: 'center',
    ...elevation('subtle'),
  },
  rsvpGateText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
});
