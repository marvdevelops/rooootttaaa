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
import { CalendarIcon, CloseIcon, CompassIcon, ReplyIcon, SendIcon, ShareIcon, TrashIcon, UserIcon } from '../components/icons';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import ReportModal from '../components/ReportModal';
import { useNotificationPrePermission } from '../hooks/useNotificationPrePermission';
import { brutalShadow, colors, fonts } from '../theme/theme';
import {
  CloudRoute,
  GroupRun,
  GroupRunComment,
  GroupRunParticipant,
  PathPoint,
  RouteCompletion,
  RouteReview,
} from '../types/route';
import { addGroupRunToCalendar } from '../utils/calendar';
import { getTodayCompletion, logRouteCompletion } from '../utils/completionsApi';
import { getMyReview } from '../utils/reviewsApi';
import ReviewModal from '../components/ReviewModal';
import { navigateToStart } from '../utils/externalNav';
import { deleteGroupRunComment, listGroupRunComments, postGroupRunComment } from '../utils/groupRunCommentsApi';
import {
  FreeJoinLimitError,
  getGroupRun,
  listGroupRunParticipants,
  respondToJoinRequest,
  setGroupRunRsvp,
} from '../utils/groupRunsApi';
import { createReport, ReportReason } from '../utils/reportsApi';
import { getRoute } from '../utils/routesApi';
import { buildStaticMapUrl } from '../utils/staticMap';

const MAX_DEPTH = 2;

interface Props {
  groupRunId: string;
  onClose: () => void;
  onOpenRoute: (routeId: string) => void;
  onRequirePaywall: () => void;
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

export default function GroupRunDetailScreen({ groupRunId, onClose, onOpenRoute, onRequirePaywall }: Props) {
  const [groupRun, setGroupRun] = useState<GroupRun | null>(null);
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
  const notificationPrePermission = useNotificationPrePermission();

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
              <TrashIcon size={12} color={colors.rustDark} />
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
        <Pressable style={styles.backButton} onPress={onClose}>
          <CloseIcon size={16} />
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.rust} />
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
                  <ActivityIndicator color={colors.sand} size="small" />
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

            <View style={styles.whenBadge}>
              <CalendarIcon size={13} />
              <Text style={styles.whenText}>{formatWhen(groupRun.scheduledAt)}</Text>
            </View>
            <Text style={styles.eventTitle}>{groupRun.title}</Text>
            <Pressable onPress={() => onOpenRoute(groupRun.routeId)}>
              <Text style={styles.eventRoute}>
                {groupRun.routeName}
                {groupRun.hostUsername !== 'unknown' ? ` · hosted by ${groupRun.hostUsername}` : ''}
              </Text>
            </Pressable>
            {!!groupRun.description && <Text style={styles.eventDescription}>{groupRun.description}</Text>}

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
                        <UserIcon size={16} color={colors.muted} />
                      )}
                    </View>
                    <Text style={styles.requestUsername} numberOfLines={1}>
                      {p.username}
                    </Text>
                    {respondingUserId === p.userId ? (
                      <ActivityIndicator size="small" color={colors.ink} />
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
                          <UserIcon size={13} color={colors.muted} />
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

            {/* "Add to Calendar" is hidden until a native build ships with
                expo-calendar linked — re-add the button once that's live. */}
            <View style={styles.secondaryActionsRow}>
              <Pressable style={styles.secondaryActionButton} onPress={handleNavigateToStart}>
                <CompassIcon size={15} color={colors.ink} />
                <Text style={styles.secondaryActionText}>NAVIGATE</Text>
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
                  placeholderTextColor={colors.mutedLight}
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
                  {posting ? <ActivityIndicator size="small" color={colors.sand} /> : <SendIcon size={16} />}
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 16,
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
    backgroundColor: colors.rustDark,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
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
    backgroundColor: colors.green,
    borderRadius: 10,
    padding: 10,
  },
  activeBannerText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.white,
    textAlign: 'center',
  },
  archivedBanner: {
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 10,
  },
  archivedBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  postEventCard: {
    gap: 8,
    marginBottom: 4,
  },
  postEventButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(3),
  },
  postEventButtonDone: {
    backgroundColor: colors.sand,
  },
  postEventButtonText: {
    fontFamily: fonts.display,
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
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.rust,
    textDecorationLine: 'underline',
  },
  eventCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    ...brutalShadow(4),
  },
  routePreviewWrap: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: 'hidden',
    marginBottom: 10,
  },
  routePreviewImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.sand,
  },
  routePreviewStatsRow: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
  },
  routePreviewChip: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  routePreviewChipAqua: {
    backgroundColor: colors.aqua,
  },
  routePreviewChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  whenBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  whenText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  eventTitle: {
    fontFamily: fonts.display,
    fontSize: 19,
    color: colors.ink,
  },
  eventRoute: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  eventDescription: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    marginTop: 4,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  rsvpCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.mutedLight,
  },
  rsvpButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: colors.sand,
  },
  rsvpButtonActive: {
    backgroundColor: colors.green,
  },
  rsvpButtonFull: {
    backgroundColor: colors.sand,
    opacity: 0.6,
  },
  rsvpButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
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
    fontFamily: fonts.bodyBold,
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
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 6,
  },
  requestActionButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  requestDeclineButton: {
    backgroundColor: colors.white,
  },
  requestApproveButton: {
    backgroundColor: colors.green,
  },
  requestActionText: {
    fontFamily: fonts.bodyBold,
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
    fontFamily: fonts.bodyBold,
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
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: colors.cream,
    maxWidth: 140,
  },
  whosGoingAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  whosGoingUsername: {
    fontFamily: fonts.bodyMedium,
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
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 9,
    backgroundColor: colors.sand,
  },
  secondaryActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  commentsSection: {
    gap: 12,
  },
  commentsTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  emptyCommentsText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  commentWrap: {
    gap: 8,
  },
  commentWrapReply: {
    marginLeft: 18,
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.sand,
  },
  commentCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    ...brutalShadow(2),
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
    backgroundColor: colors.aqua,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  commentAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 7,
    backgroundColor: colors.sand,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.ink,
  },
  commentUsername: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  commentTime: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
    marginLeft: 'auto',
  },
  commentBody: {
    fontFamily: fonts.bodyMedium,
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
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.muted,
  },
  deleteCommentButton: {
    marginLeft: 'auto',
  },
  reportCommentText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
    textDecorationLine: 'underline',
  },
  composerWrap: {
    borderTopWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  replyingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  replyingCancel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.rustDark,
  },
  composerPrompt: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  composerPromptText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.mutedLight,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(3),
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  rsvpGate: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  rsvpGateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
});
