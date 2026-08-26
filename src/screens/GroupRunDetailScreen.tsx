import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CalendarIcon, CloseIcon, CompassIcon, EditIcon, ReplyIcon, SendIcon, ShareIcon, TrashIcon, UserIcon } from '../components/icons';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import RaceBadge from '../components/RaceBadge';
import ReportModal from '../components/ReportModal';
import RunThisRaceButton from '../components/RunThisRaceButton';
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
  RaceDetails,
  RaceRsvp,
  RouteCompletion,
  RouteReview,
} from '../types/route';
import { addGroupRunToCalendar } from '../utils/calendar';
import { getTodayCompletion, logRouteCompletion } from '../utils/completionsApi';
import { getMyReview } from '../utils/reviewsApi';
import { getMyRaceRsvp, getRaceDetails } from '../utils/racesApi';
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
  onOpenProfile: (userId: string) => void;
  onRunRace: (groupRun: GroupRun, rsvpId: string) => void;
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

export default function GroupRunDetailScreen({ groupRunId, onClose, onOpenRoute, onRequirePaywall, onOpenProfile, onRunRace }: Props) {
  const [groupRun, setGroupRun] = useState<GroupRun | null>(null);
  const [raceDetails, setRaceDetails] = useState<RaceDetails | null>(null);
  const [myRaceRsvp, setMyRaceRsvp] = useState<RaceRsvp | null>(null);
  const [route, setRoute] = useState<CloudRoute | null>(null);
  const [comments, setComments] = useState<GroupRunComment[]>([]);
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
        getRaceDetails(groupRunId).then(setRaceDetails).catch(() => {});
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
        notificationPrePermission.maybePrompt('Get notified when the host approves your request or posts updates.');
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
  }, [groupRun, onRequirePaywall, notificationPrePermission.maybePrompt, refresh]);

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
          raceDate: race?.raceDate ?? null,
          raceTimezone: raceDetails?.raceTimezone,
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
  const canViewComments = !!groupRun && (groupRun.isRsvpedByMe || groupRun.isHostedByMe);
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
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {groupRun?.title ?? 'Group Run'}
        </Text>
        <View style={styles.headerActions}>
          {groupRun?.isHostedByMe && !isArchived && (
            <Pressable style={styles.backButton} onPress={() => setShowEditModal(true)}>
              <EditIcon size={16} />
            </Pressable>
          )}
          {groupRun?.isHostedByMe && (
            <Pressable style={styles.backButton} onPress={handleDelete} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color={colors.stone} /> : <TrashIcon size={16} color={colors.stone} />}
            </Pressable>
          )}
          <Pressable style={styles.backButton} onPress={onClose}>
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

            {groupRun.category === 'race' && <RaceBadge />}
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

            {groupRun.category === 'race' && groupRun.myRsvpStatus === 'approved' && raceDetails && (
              <View style={styles.raceRunWrap}>
                {myRaceRsvp?.finishedAt ? (
                  <View style={[styles.rsvpButton, styles.rsvpButtonActive]}>
                    <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>
                      ✓ FINISHED{myRaceRsvp.finishTimeSeconds ? ` · ${Math.round(myRaceRsvp.finishTimeSeconds / 60)} MIN` : ''}
                    </Text>
                  </View>
                ) : (
                  <RunThisRaceButton
                    raceDetails={raceDetails}
                    onPress={() => myRaceRsvp && onRunRace(groupRun, myRaceRsvp.id)}
                  />
                )}
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
                    onPress={handleToggleRsvp}
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

            {approvedParticipants.length > 0 && (
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
            <Text style={styles.commentsTitle}>
              {comments.length === 0 ? 'Comments' : `Comments (${countComments(comments)})`}
            </Text>

            {!canViewComments ? (
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
          }}
          onClose={() => setShowEditModal(false)}
          onSchedule={handleSaveEdit}
          onRequirePaywall={onRequirePaywall}
        />
      )}
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
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 4,
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
