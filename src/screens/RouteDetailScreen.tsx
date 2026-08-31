import { Camera } from '@rnmapbox/maps';
import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { BackIcon, CalendarIcon, CheckIcon, ChevronUpIcon, EditIcon, ExportIcon, FlybyIcon, HeartIcon, LockIcon, NoteFlagIcon, RecordIcon, RunnerIcon, ShareIcon, TrashIcon, TrophyIcon } from '../components/icons';
import EditRouteInfoModal from '../components/EditRouteInfoModal';
import ElevationProfileChart from '../components/ElevationProfileChart';
import TrailInfoSection from '../components/TrailInfoSection';
import RoutePhotoGallery from '../components/RoutePhotoGallery';
import LocalLegendCallout from '../components/LocalLegendCallout';
import { useFlybyAccess } from '../hooks/useFlybyAccess';
import { listRecentlyGrantedBadges, UserBadge } from '../utils/badgesApi';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import ReportModal from '../components/ReportModal';
import RouteMap, { MapStyleMode } from '../components/RouteMap';
import ScheduleGroupRunModal, { RecurrenceInput } from '../components/ScheduleGroupRunModal';
import { createSeries } from '../utils/recurringSeriesApi';
import { useNotificationPrePermission } from '../hooks/useNotificationPrePermission';
import { useUserTier } from '../hooks/useUserTier';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { ActivityType, CloudRoute, GroupRun, PathPoint } from '../types/route';
import { blockUser } from '../utils/blocksApi';
import CompletionFollowUpSheet from '../components/CompletionFollowUpSheet';
import { StarRating } from '../components/StarRating';
import {
  CompletionParticipant,
  formatDuration,
  getPersonalBest,
  getTodayCompletion,
  listRouteCompletions,
  logRouteCompletion,
} from '../utils/completionsApi';
import { canReviewRoute, getMyReview, listRouteReviews } from '../utils/reviewsApi';
import { RouteCompletion, RouteReview } from '../types/route';
import ReviewModal from '../components/ReviewModal';
import { kilometerMarkers } from '../utils/distance';
import { findUTurns } from '../utils/uturns';
import { buildGpx } from '../utils/gpx';
import {
  countMyActiveGroupRuns,
  createGroupRun,
  FreeJoinLimitError,
  listGroupRunsForRoute,
  setGroupRunRsvp,
} from '../utils/groupRunsApi';
import { createReport, ReportReason } from '../utils/reportsApi';
import { deleteRoute, setRouteLiked, setRouteSaved, updateRouteMeta } from '../utils/routesApi';
import { colorSegmentsByGrade } from '../utils/routeColor';
import { PaywallTrigger } from './PaywallScreen';
import { ROUTE_LIMITS } from '../constants/routeLimits';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  route: CloudRoute;
  onClose: () => void;
  onOpenOnMap: (route: CloudRoute) => void;
  onDeleted: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onRequirePaywall: (trigger: PaywallTrigger) => void;
  /** Gates a transacting action (like, save, record) behind having a session — guests can browse this screen, but tapping these prompts a sign-in instead of firing a doomed anonymous write. */
  onRequireAuth: (action: () => void, context?: string) => void;
  onOpenPhotoUpload: (routeId: string, completionId?: string) => void;
  onOpenPhotoViewer: (routeId: string, photoId: string) => void;
  photoRefreshSignal?: number;
  onOpenFlyby: (route: CloudRoute) => void;
  onRecordRoute: (route: CloudRoute) => void;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail Run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

// Past-tense verb for the "I ___ this" completion log — Rootah routes aren't
// just for running.
const ACTIVITY_PAST_VERB: Record<ActivityType, string> = {
  run: 'ran',
  trail_run: 'ran',
  hike: 'hiked',
  bike: 'rode',
  walk: 'walked',
  other: 'did',
};

export default function RouteDetailScreen({
  route,
  onClose,
  onOpenOnMap,
  onDeleted,
  onOpenProfile,
  onOpenGroupRun,
  onRequirePaywall,
  onRequireAuth,
  onOpenPhotoUpload,
  onOpenPhotoViewer,
  photoRefreshSignal,
  onOpenFlyby,
  onRecordRoute,
}: Props) {
  const insets = useSafeAreaInsets();
  const tier = useUserTier();
  const flybyAccess = useFlybyAccess();
  const notificationPrePermission = useNotificationPrePermission();
  const [routeName, setRouteName] = useState(route.name);
  const [routeDescription, setRouteDescription] = useState(route.description);
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [likesCount, setLikesCount] = useState(route.likesCount);
  const [savesCount, setSavesCount] = useState(route.savesCount);
  const [isLiked, setIsLiked] = useState(route.isLikedByMe);
  const [isSaved, setIsSaved] = useState(route.isSavedByMe);
  const [busy, setBusy] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>('standard');
  const [is3D, setIs3D] = useState(false);
  // Measured so the SAT/3D toggles can float just above the glass details
  // panel instead of a hardcoded offset — the panel's height varies with
  // whether the elevation chart/peak stat is showing.
  const [glassPanelHeight, setGlassPanelHeight] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [groupRuns, setGroupRuns] = useState<GroupRun[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [checkingScheduleLimit, setCheckingScheduleLimit] = useState(false);

  const [completionCount, setCompletionCount] = useState(route.completionCount);
  const [todayCompletion, setTodayCompletion] = useState<RouteCompletion | null>(null);
  const [loggingCompletion, setLoggingCompletion] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [newPersonalBestSeconds, setNewPersonalBestSeconds] = useState<number | null>(null);
  const [newBadge, setNewBadge] = useState<UserBadge | null>(null);
  const [completionsExpanded, setCompletionsExpanded] = useState(false);
  const [routeCompletions, setRouteCompletions] = useState<CompletionParticipant[]>([]);
  const [personalBestSeconds, setPersonalBestSeconds] = useState<number | null>(null);

  const pastVerb = ACTIVITY_PAST_VERB[route.activityType];
  const completionLabel = todayCompletion
    ? `${pastVerb[0].toUpperCase()}${pastVerb.slice(1)} today`
    : `I ${pastVerb} this`;
  const [reviewCount, setReviewCount] = useState(route.reviewCount);
  const [ratingSum, setRatingSum] = useState(route.ratingSum);
  const [reviews, setReviews] = useState<RouteReview[]>([]);
  const [myReview, setMyReview] = useState<RouteReview | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null);
  const hasFitBounds = useRef(false);

  const refreshGroupRuns = useCallback(async () => {
    try {
      setGroupRuns(await listGroupRunsForRoute(route.id));
    } catch {
      // non-critical — the rest of the screen still works without group runs
    }
  }, [route.id]);

  useEffect(() => {
    refreshGroupRuns();
  }, [refreshGroupRuns]);

  useEffect(() => {
    getTodayCompletion(route.id)
      .then(setTodayCompletion)
      .catch(() => {});
    getPersonalBest(route.id)
      .then((pb) => setPersonalBestSeconds(pb?.durationSeconds ?? null))
      .catch(() => {});
    getMyReview(route.id)
      .then(setMyReview)
      .catch(() => {});
    canReviewRoute(route.id)
      .then(setCanReview)
      .catch(() => {});
    if (route.reviewCount > 0) {
      listRouteReviews(route.id)
        .then(setReviews)
        .catch(() => {});
    }
  }, [route.id]);

  const handleLogRun = useCallback(async () => {
    if (todayCompletion) {
      setShowFollowUp(true);
      return;
    }
    setLoggingCompletion(true);
    try {
      const completion = await logRouteCompletion(route.id);
      setTodayCompletion(completion);
      setCompletionCount((c) => c + 1);
      if (personalBestSeconds == null) {
        // No prior timed completion — nothing to beat yet, handled after they add a time.
      }
      listRecentlyGrantedBadges(completion.userId)
        .then((badges) => setNewBadge(badges[0] ?? null))
        .catch(() => {});
      setShowFollowUp(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log this. Try again.');
    } finally {
      setLoggingCompletion(false);
    }
  }, [route.id, todayCompletion, personalBestSeconds]);

  const handleFollowUpSaved = useCallback(async () => {
    setShowFollowUp(false);
    try {
      const [pb, review] = await Promise.all([getPersonalBest(route.id), getMyReview(route.id)]);
      if (pb && (personalBestSeconds == null || pb.durationSeconds < personalBestSeconds)) {
        setNewPersonalBestSeconds(pb.durationSeconds);
      }
      setPersonalBestSeconds(pb?.durationSeconds ?? null);
      if (review) {
        const hadReviewBefore = !!myReview;
        setMyReview(review);
        if (!hadReviewBefore) {
          setReviewCount((c) => c + 1);
          setRatingSum((s) => s + review.rating);
        } else {
          setRatingSum((s) => s - myReview!.rating + review.rating);
        }
        setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
      }
    } catch {
      // Follow-up data is best-effort — the completion itself already saved.
    }
  }, [route.id, personalBestSeconds, myReview]);

  const toggleCompletionsExpanded = useCallback(() => {
    const next = !completionsExpanded;
    setCompletionsExpanded(next);
    if (next && routeCompletions.length === 0) {
      listRouteCompletions(route.id)
        .then(setRouteCompletions)
        .catch(() => {});
    }
  }, [completionsExpanded, routeCompletions.length, route.id]);

  const handleReviewSaved = useCallback(
    (review: RouteReview) => {
      const hadReviewBefore = !!myReview;
      setMyReview(review);
      setShowReviewModal(false);
      if (!hadReviewBefore) {
        setReviewCount((c) => c + 1);
        setRatingSum((s) => s + review.rating);
      } else {
        setRatingSum((s) => s - myReview!.rating + review.rating);
      }
      setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
    },
    [myReview],
  );

  const fullPath = useMemo<PathPoint[]>(() => {
    if (route.waypoints.length === 0) return [];
    const points: PathPoint[] = [route.waypoints[0]];
    for (const segment of route.segments) {
      points.push(...segment.path.slice(1));
    }
    return points;
  }, [route.waypoints, route.segments]);

  const uTurnPoints = useMemo(() => findUTurns(route.segments).map((u) => u.coordinate), [route.segments]);

  useEffect(() => {
    // Frame the whole route on open instead of just the start point — the
    // bottom ~40% of the map is covered by the stats/chart overlay, so
    // weight padding toward the bottom to keep the route out from under it.
    if (hasFitBounds.current || fullPath.length < 2) return;
    const lats = fullPath.map((p) => p.latitude);
    const lngs = fullPath.map((p) => p.longitude);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];

    // The camera ref isn't guaranteed to be attached the instant fullPath is
    // ready (native map/camera mount lags a render or two behind) — calling
    // fitBounds while it's still null silently no-ops, leaving the map
    // framed on just the default center/zoom (looks like "only part of the
    // route is visible"). Retry on the next frame until the ref is live,
    // rather than marking done unconditionally.
    let cancelled = false;
    const tryFit = () => {
      if (cancelled) return;
      if (cameraRef.current) {
        hasFitBounds.current = true;
        cameraRef.current.fitBounds(ne, sw, [40, 50, 260, 50], 0);
      } else {
        requestAnimationFrame(tryFit);
      }
    };
    tryFit();
    return () => {
      cancelled = true;
    };
  }, [fullPath]);

  const chartPath = route.elevationProfile.length >= 2 ? route.elevationProfile : fullPath;
  const colorSegments = useMemo(() => colorSegmentsByGrade(chartPath), [chartPath]);
  const kmMarkers = useMemo(() => kilometerMarkers(fullPath), [fullPath]);
  const peakElevationM = useMemo(() => {
    const elevations = chartPath.map((p) => p.elevation).filter((e): e is number => typeof e === 'number');
    return elevations.length > 0 ? Math.max(...elevations) : null;
  }, [chartPath]);
  const center = route.waypoints[0] ?? { latitude: 0, longitude: 0 };

  const routeNotes = useMemo(() => route.notes.filter((n) => !!n.text.trim()), [route.notes]);

  const setExpanded = useCallback((next: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(280, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setSheetExpanded(next);
  }, []);

  const sheetDragY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy > 0) sheetDragY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const isTap = Math.abs(gesture.dy) < 6 && Math.abs(gesture.dx) < 6;
        if (isTap || gesture.dy > 70 || gesture.vy > 0.8) {
          Animated.timing(sheetDragY, {
            toValue: isTap ? 0 : Dimensions.get('window').height,
            duration: isTap ? 0 : 220,
            useNativeDriver: true,
          }).start(() => {
            sheetDragY.setValue(0);
            setExpanded(false);
          });
        } else {
          Animated.spring(sheetDragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetDragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
    }),
  ).current;

  const handleToggleLike = useCallback(async () => {
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      await setRouteLiked(route.id, next);
    } catch (e) {
      setIsLiked(!next);
      setLikesCount((c) => c + (next ? -1 : 1));
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update like.');
    }
  }, [isLiked, route.id]);

  const handleToggleSave = useCallback(async () => {
    const next = !isSaved;
    setIsSaved(next);
    setSavesCount((c) => c + (next ? 1 : -1));
    try {
      await setRouteSaved(route.id, next);
    } catch (e) {
      setIsSaved(!next);
      setSavesCount((c) => c + (next ? -1 : 1));
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update save.');
    }
  }, [isSaved, route.id]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete route', `Remove "${routeName}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteRoute(route.id);
            onDeleted();
          } catch (e) {
            setBusy(false);
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete route.');
          }
        },
      },
    ]);
  }, [route.id, routeName, onDeleted]);

  const handleSaveInfo = useCallback(
    async (name: string, description: string) => {
      setSavingInfo(true);
      try {
        await updateRouteMeta(route.id, name, description);
        setRouteName(name);
        setRouteDescription(description);
        setShowEditInfoModal(false);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update route info.');
      } finally {
        setSavingInfo(false);
      }
    },
    [route.id],
  );

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, details: string) => {
      setIsReporting(true);
      try {
        await createReport('route', route.id, reason, details);
        setShowReportModal(false);
        Alert.alert('Report submitted', "Thanks — we'll take a look.");
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit report.');
      } finally {
        setIsReporting(false);
      }
    },
    [route.id],
  );

  const handleBlockOwner = useCallback(() => {
    Alert.alert(
      `Block ${route.ownerUsername}?`,
      "You won't see their routes or comments anymore, and they won't see yours.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(route.ownerId);
              onDeleted();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to block user.');
            }
          },
        },
      ],
    );
  }, [route.ownerId, route.ownerUsername, onDeleted]);

  const handleShare = useCallback(async () => {
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    const url = webBaseUrl ? `${webBaseUrl}/routes/${route.id}` : undefined;
    try {
      await Share.share({
        message: url ? `Check out my route "${routeName}" on Rootah: ${url}` : `Check out my route "${routeName}" on Rootah`,
        url,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to share route.');
    }
  }, [route.id, routeName]);

  const handleExportGpx = useCallback(async () => {
    setExporting(true);
    try {
      const gpx = buildGpx(fullPath, routeName);
      const file = new File(Paths.cache, `rootah_${route.id}.gpx`);
      file.create({ overwrite: true });
      file.write(gpx);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx' });
      } else {
        Alert.alert('Sharing unavailable', `Route saved to ${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to export GPX.');
    } finally {
      setExporting(false);
    }
  }, [fullPath, route.id, routeName]);

  const handlePressSchedule = useCallback(() => {
    onRequireAuth(async () => {
      if (tier === 'free') {
        setCheckingScheduleLimit(true);
        try {
          const activeCount = await countMyActiveGroupRuns();
          if (activeCount >= ROUTE_LIMITS.maxActiveGroupRunsFree) {
            onRequirePaywall('group_run_limit');
            return;
          }
        } catch {
          // Don't block scheduling on a network hiccup — this is a soft UX gate only.
        } finally {
          setCheckingScheduleLimit(false);
        }
      }
      setShowScheduleModal(true);
    }, 'host_run');
  }, [tier, onRequirePaywall, onRequireAuth]);

  const handleCustomize = useCallback(() => {
    onRequireAuth(() => {
      if (tier === 'paid') {
        onOpenOnMap(route);
      } else {
        onRequirePaywall('route_customize');
      }
    }, 'generic');
  }, [tier, route, onOpenOnMap, onRequirePaywall, onRequireAuth]);

  const handleSchedule = useCallback(
    async (
      title: string,
      description: string,
      scheduledAt: Date,
      maxParticipants: number | null,
      recurrence: RecurrenceInput | null,
      _race: unknown,
      _visibility: unknown,
      activityType: ActivityType = route.activityType,
    ) => {
      setIsScheduling(true);
      try {
        if (recurrence) {
          await createSeries({
            routeId: route.id,
            activityType,
            title,
            description,
            firstOccurrenceAt: scheduledAt,
            frequency: recurrence.frequency,
            endDate: recurrence.endDate,
          });
        } else {
          await createGroupRun({ routeId: route.id, activityType, title, description, scheduledAt, maxParticipants });
        }
        setShowScheduleModal(false);
        refreshGroupRuns();
        notificationPrePermission.maybePrompt('Get notified when people join your event or post updates.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to schedule group run.');
      } finally {
        setIsScheduling(false);
      }
    },
    [route.id, route.activityType, refreshGroupRuns, notificationPrePermission.maybePrompt],
  );

  const handleToggleRsvp = useCallback(
    async (run: GroupRun) => {
      if (run.isHostedByMe) return;
      const requesting = !run.myRsvpStatus;
      const prevStatus = run.myRsvpStatus;
      // A request only decrements rsvpCount on cancel if it had actually been
      // approved — pending requests never counted toward it in the first place.
      setGroupRuns((prev) =>
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
        setGroupRuns((prev) =>
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
          onRequirePaywall('group_run_join_limit');
        } else {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update RSVP.');
        }
      }
    },
    [onRequirePaywall],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.mapWrap, sheetExpanded && styles.mapWrapExpanded]}>
        <RouteMap
          ref={cameraRef}
          initialCenter={center}
          waypoints={route.waypoints}
          colorSegments={colorSegments}
          kmMarkers={kmMarkers}
          mapStyleMode={mapStyleMode}
          is3D={is3D}
          waypointsDraggable={false}
          showWaypointMarkers={false}
          notes={route.notes}
          uTurnPoints={uTurnPoints}
        />

        <Pressable
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => (sheetExpanded ? setExpanded(false) : onClose())}
          accessibilityRole="button"
          accessibilityLabel={sheetExpanded ? 'Collapse details' : 'Back'}
        >
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <BackIcon />
        </Pressable>

        {!sheetExpanded && (
          <View style={[styles.topRightActions, { top: insets.top + 8 }]}>
            <Pressable
              style={styles.iconChip}
              onPress={() => onRequireAuth(handleExportGpx, 'generic')}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Export as GPX"
            >
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              {exporting ? <ActivityIndicator size="small" color={colors.ink} /> : <ExportIcon size={18} color={colors.ink} />}
            </Pressable>
            <Pressable style={styles.iconChip} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share route">
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <ShareIcon size={16} />
            </Pressable>
            {flybyAccess.allowed ? (
              <Pressable style={styles.iconChip} onPress={() => onOpenFlyby(route)} accessibilityRole="button" accessibilityLabel="Flyby preview">
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                <FlybyIcon size={17} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.iconChip}
                onPress={() => onRequirePaywall('flyby_video')}
                accessibilityRole="button"
                accessibilityLabel="Flyby preview (Rootah Pro)"
              >
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                <LockIcon size={14} color={colors.ink} />
              </Pressable>
            )}
            {route.isOwnedByMe && (
              <Pressable
                style={styles.iconChip}
                onPress={handleDelete}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Delete route"
              >
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                {busy ? <ActivityIndicator size="small" color={colors.danger} /> : <TrashIcon size={16} color={colors.danger} />}
              </Pressable>
            )}
          </View>
        )}

        {!sheetExpanded && (
          <View style={styles.glassOverlayWrap} onLayout={(e) => setGlassPanelHeight(e.nativeEvent.layout.height)}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(226,218,194,0)', 'rgba(226,218,194,0.35)', 'rgba(226,218,194,0.55)']}
              locations={[0, 0.3, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glassOverlayContent}>
              <View style={styles.glassHeaderRow}>
                <View style={styles.activityBadge}>
                  <Text style={styles.activityBadgeText}>{ACTIVITY_LABELS[route.activityType]}</Text>
                </View>
                <Text style={styles.glassName} numberOfLines={1}>
                  {routeName}
                </Text>
              </View>
              <Pressable
                style={styles.glassByline}
                onPress={() => onOpenProfile(route.ownerId)}
                accessibilityRole="link"
                accessibilityLabel={`View ${route.ownerUsername}'s profile`}
              >
                <Text style={styles.glassBylineText}>by {route.ownerUsername}</Text>
              </Pressable>

              <View style={styles.glassStatsRow}>
                <View style={[styles.glassChip, styles.glassChipInk]}>
                  <Text style={[styles.glassStatLabel, styles.glassStatLabelOnColor]}>DISTANCE</Text>
                  <Text style={[styles.glassStatValueCompact, styles.glassStatValueOnColor]}>{route.distanceKm.toFixed(2)} km</Text>
                </View>
                <View style={[styles.glassChip, styles.glassChipAqua]}>
                  <Text style={[styles.glassStatLabel, styles.glassStatLabelOnColor]}>GAIN</Text>
                  <Text style={[styles.glassStatValueCompact, styles.glassStatValueOnColor]}>+{Math.round(route.elevationGainM)} m</Text>
                </View>
                {peakElevationM !== null && (
                  <View style={[styles.glassChip, styles.glassChipAmber]}>
                    <Text style={[styles.glassStatLabel, styles.glassStatLabelOnColor]}>PEAK</Text>
                    <Text style={[styles.glassStatValueCompact, styles.glassStatValueOnColor]}>{Math.round(peakElevationM)} m</Text>
                  </View>
                )}
              </View>

              {chartPath.length >= 2 && (
                <View style={styles.glassChartCard}>
                  <ElevationProfileChart path={chartPath} compact transparent />
                </View>
              )}

              <View style={styles.glassActionRow}>
                <Pressable
                  style={styles.glassRunButton}
                  onPress={() => onRequireAuth(() => onRecordRoute(route), 'record')}
                  accessibilityRole="button"
                  accessibilityLabel="Record an activity on this route with GPS"
                >
                  <RecordIcon size={14} color={colors.white} />
                  <Text style={styles.glassRunButtonText}>Record an activity</Text>
                </Pressable>
                <Pressable
                  style={[styles.glassSaveButton, isSaved && styles.glassSaveButtonActive]}
                  onPress={() => onRequireAuth(handleToggleSave, 'save_route')}
                  accessibilityRole="button"
                  accessibilityLabel={isSaved ? 'Saved to your maps' : 'Save to your maps'}
                >
                  <Text style={[styles.glassSaveButtonText, isSaved && styles.glassSaveButtonTextActive]}>
                    {isSaved ? 'Saved' : 'Save'}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.detailsPill}
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Show full route details"
              >
                <ChevronUpIcon size={13} />
                <Text style={styles.detailsPillText}>DETAILS</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!sheetExpanded && (
          <View style={[styles.bottomRightActions, { bottom: glassPanelHeight + 12 }]}>
            <Pressable
              style={styles.iconChip}
              onPress={() => setMapStyleMode((prev) => (prev === 'satellite' ? 'standard' : 'satellite'))}
            >
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <Text style={[styles.toggleText, mapStyleMode === 'satellite' && styles.toggleTextActive]}>SAT</Text>
            </Pressable>
            <Pressable style={styles.iconChip} onPress={() => setIs3D((prev) => !prev)}>
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <Text style={[styles.toggleText, is3D && styles.toggleTextActive]}>3D</Text>
            </Pressable>
          </View>
        )}
      </View>

      {sheetExpanded && (
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetDragY }] }]}>
          <View style={styles.dragHandleRow} hitSlop={{ top: 12, bottom: 12, left: 40, right: 40 }} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
          <View style={styles.headerRow}>
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>{ACTIVITY_LABELS[route.activityType]}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {routeName}
            </Text>
            {route.isOwnedByMe && (
              <Pressable style={styles.editInfoButton} onPress={() => setShowEditInfoModal(true)}>
                <EditIcon size={15} color={colors.stone} />
              </Pressable>
            )}
          </View>

          <View style={styles.bylineWrap}>
            <Pressable style={styles.bylineRow} onPress={() => onOpenProfile(route.ownerId)}>
              {route.ownerAvatarUrl ? (
                <Image source={{ uri: route.ownerAvatarUrl }} style={styles.bylineAvatar} />
              ) : (
                <View style={[styles.bylineAvatar, styles.bylineAvatarPlaceholder]}>
                  <Text style={styles.bylineAvatarText}>{route.ownerUsername.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.byline}>by {route.ownerUsername}</Text>
            </Pressable>

            {!route.isOwnedByMe && (
              <View style={styles.moderationRow}>
                <Pressable onPress={() => setShowReportModal(true)}>
                  <Text style={styles.moderationLink}>Report</Text>
                </Pressable>
                <Pressable onPress={handleBlockOwner}>
                  <Text style={styles.moderationLink}>Block</Text>
                </Pressable>
              </View>
            )}
          </View>

          {!!routeDescription && <Text style={styles.description}>{routeDescription}</Text>}

          {routeNotes.length > 0 && (
            <View style={styles.notesSection}>
              {routeNotes.map((n) => (
                <View key={n.id} style={styles.noteRow}>
                  <View style={styles.noteBadge}>
                    <NoteFlagIcon size={12} color={colors.white} />
                  </View>
                  <Text style={styles.noteText}>{n.text}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.statsRowSheet}>
            <View style={styles.statCardSheet}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.statValue}>{route.distanceKm.toFixed(2)} km</Text>
            </View>
            <View style={[styles.statCardSheet, styles.statCardSheetAqua]}>
              <Text style={[styles.statLabel, styles.statLabelOnColor]}>GAIN</Text>
              <Text style={[styles.statValue, styles.statValueOnColor]}>+{Math.round(route.elevationGainM)} m</Text>
            </View>
            {peakElevationM !== null && (
              <View style={[styles.statCardSheet, styles.statCardSheetAmber]}>
                <Text style={[styles.statLabel, styles.statLabelOnColor]}>PEAK</Text>
                <Text style={[styles.statValue, styles.statValueOnColor]}>{Math.round(peakElevationM)} m</Text>
              </View>
            )}
          </View>

          <TrailInfoSection
            routeId={route.id}
            isTrail={route.isTrail}
            isOwnedByMe={route.isOwnedByMe}
            elevationPath={chartPath}
            onOpenPhoto={(photoId) => onOpenPhotoViewer(route.id, photoId)}
          />

          <RoutePhotoGallery
            key={`gallery-${photoRefreshSignal ?? 0}`}
            routeId={route.id}
            photoCount={route.photoCount}
            onOpenUpload={() => onRequireAuth(() => onOpenPhotoUpload(route.id), 'generic')}
            onOpenPhoto={(photoId) => onOpenPhotoViewer(route.id, photoId)}
            onSeeAll={() => onOpenPhotoViewer(route.id, '')}
          />

          <Pressable
            style={styles.recordRunButton}
            onPress={() => onRequireAuth(() => onRecordRoute(route), 'record')}
            accessibilityRole="button"
            accessibilityLabel="Record an activity on this route with GPS"
          >
            <RecordIcon size={16} color={colors.white} />
            <Text style={styles.recordRunButtonText}>Record an activity on this route</Text>
          </Pressable>

          <Pressable
            style={[styles.runThisButton, todayCompletion && styles.runThisButtonLogged]}
            onPress={handleLogRun}
            disabled={loggingCompletion}
            accessibilityRole="button"
            accessibilityLabel={todayCompletion ? `Logged — ${pastVerb} today` : `Log that you ${pastVerb} this route`}
          >
            {loggingCompletion ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <View style={styles.runThisButtonInner}>
                <CheckIcon size={15} color={todayCompletion ? colors.sage : colors.stone} />
                <Text style={[styles.runThisButtonText, todayCompletion && styles.runThisButtonTextLogged]}>
                  {completionLabel}
                </Text>
              </View>
            )}
          </Pressable>

          {personalBestSeconds != null && (
            <View style={styles.pbRow}>
              <TrophyIcon size={14} color={colors.surface} />
              <Text style={styles.pbRowText}>Your best: {formatDuration(personalBestSeconds)}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, isLiked && styles.actionButtonLiked]}
              onPress={() => onRequireAuth(handleToggleLike, 'like_route')}
            >
              <HeartIcon size={16} color={isLiked ? colors.sheetBg : colors.ink} filled={isLiked} />
              <Text style={[styles.actionButtonText, isLiked && styles.actionButtonTextLiked]} numberOfLines={1}>
                {likesCount}
              </Text>
            </Pressable>

            {!route.isOwnedByMe && (
              <Pressable
                style={[styles.actionButton, isSaved && styles.actionButtonSaved]}
                onPress={() => onRequireAuth(handleToggleSave, 'save_route')}
              >
                <Text
                  style={[styles.actionButtonText, isSaved && styles.actionButtonTextLiked]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {isSaved ? 'SAVED' : 'SAVE'} · {savesCount}
                </Text>
              </Pressable>
            )}

            {route.isOwnedByMe && (
              <View style={styles.actionButton}>
                <Text style={styles.actionButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {savesCount} SAVED
                </Text>
              </View>
            )}

            <Pressable style={styles.actionButton} onPress={handlePressSchedule} disabled={checkingScheduleLimit}>
              {checkingScheduleLimit ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <>
                  <CalendarIcon size={16} color={colors.ink} />
                  <Text style={styles.actionButtonText} numberOfLines={1}>
                    SCHEDULE
                  </Text>
                </>
              )}
            </Pressable>

          </View>

          {route.isOwnedByMe ? (
            <Pressable style={styles.openButton} onPress={() => onOpenOnMap(route)}>
              <Text style={styles.openButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                OPEN ON MAP
              </Text>
            </Pressable>
          ) : (
            <Pressable style={styles.openButton} onPress={handleCustomize}>
              {tier === 'free' && <LockIcon size={16} color={colors.sheetBg} />}
              <Text style={styles.openButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                CUSTOMIZE THIS ROUTE
              </Text>
            </Pressable>
          )}

          {completionCount > 0 && (
            <View style={styles.completionsSection}>
              <Pressable style={styles.completionsSummaryRow} onPress={toggleCompletionsExpanded}>
                <RunnerIcon size={15} color={colors.ink} />
                <Text style={styles.completionsSummary}>
                  Ran by {completionCount} {completionCount === 1 ? 'person' : 'people'}
                </Text>
              </Pressable>
              <LocalLegendCallout routeId={route.id} onOpenProfile={onOpenProfile} />
              {completionsExpanded &&
                routeCompletions.map((c) => (
                  <View key={c.id} style={styles.completionRow}>
                    {c.avatarUrl ? (
                      <Image source={{ uri: c.avatarUrl }} style={styles.completionAvatar} />
                    ) : (
                      <View style={[styles.completionAvatar, styles.completionAvatarPlaceholder]}>
                        <Text style={styles.completionAvatarText}>{c.username.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.completionUsername} numberOfLines={1}>
                      {c.username}
                    </Text>
                    {c.durationSeconds != null && (
                      <Text style={styles.completionDuration}>{formatDuration(c.durationSeconds)}</Text>
                    )}
                  </View>
                ))}
            </View>
          )}

          <View style={styles.reviewsSection}>
            {reviewCount >= 3 ? (
              <View style={styles.ratingSummaryRow}>
                <Text style={styles.ratingSummaryValue}>{(ratingSum / reviewCount).toFixed(1)}</Text>
                <StarRating value={ratingSum / reviewCount} size={15} />
                <Text style={styles.ratingSummaryCount}>({reviewCount})</Text>
              </View>
            ) : (
              canReview &&
              !myReview && <Text style={styles.reviewsTitle}>Be the first to review this route</Text>
            )}

            {reviews.length > 0 && (
              <View style={styles.reviewList}>
                {reviews.slice(0, 3).map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    {review.avatarUrl ? (
                      <Image source={{ uri: review.avatarUrl }} style={styles.completionAvatar} />
                    ) : (
                      <View style={[styles.completionAvatar, styles.completionAvatarPlaceholder]}>
                        <Text style={styles.completionAvatarText}>{review.username.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.reviewCardBody}>
                      <Text style={styles.reviewUsername}>{review.username}</Text>
                      <StarRating value={review.rating} size={11} />
                      {review.groupRunTitle && (
                        <Text style={styles.reviewSourceLabel}>Via group run: {review.groupRunTitle}</Text>
                      )}
                      {!!review.body && <Text style={styles.reviewBody}>{review.body}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {canReview && (
              <Pressable style={styles.writeReviewButton} onPress={() => setShowReviewModal(true)}>
                <Text style={styles.writeReviewText}>
                  {myReview ? 'Edit your review' : 'Write a review'}
                </Text>
                {myReview && <StarRating value={myReview.rating} size={12} />}
              </Pressable>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.groupRunsSection}>
            <Text style={styles.groupRunsTitle}>Group runs</Text>

            {groupRuns.length === 0 ? (
              <Text style={styles.noRunsText}>No upcoming group runs for this route yet.</Text>
            ) : (
              groupRuns.map((run) => (
                <Pressable key={run.id} style={styles.groupRunCard} onPress={() => onOpenGroupRun(run.id)}>
                  <View style={styles.groupRunWhenBadge}>
                    <CalendarIcon size={13} color={colors.ink} />
                    <Text style={styles.groupRunWhenText}>
                      {new Date(run.scheduledAt).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {new Date(run.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>

                  <Text style={styles.groupRunTitle} numberOfLines={1}>
                    {run.title}
                  </Text>
                  {!!run.description && (
                    <Text style={styles.groupRunDescription} numberOfLines={2}>
                      {run.description}
                    </Text>
                  )}

                  <View style={styles.groupRunFooter}>
                    <Text style={styles.groupRunGoing}>{run.rsvpCount} going</Text>
                    {run.isHostedByMe ? (
                      <View style={[styles.rsvpButton, styles.rsvpButtonActive]}>
                        <Text style={[styles.rsvpButtonText, styles.rsvpButtonTextActive]}>HOSTING</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.rsvpButton, run.isRsvpedByMe && styles.rsvpButtonActive]}
                        onPress={() => onRequireAuth(() => handleToggleRsvp(run), 'rsvp')}
                      >
                        <Text style={[styles.rsvpButtonText, run.isRsvpedByMe && styles.rsvpButtonTextActive]}>
                          {run.myRsvpStatus === 'approved'
                            ? "I'M IN"
                            : run.myRsvpStatus === 'pending'
                              ? 'REQUESTED'
                              : 'RSVP'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </View>

          {route.isOwnedByMe && (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={busy}>
              <TrashIcon size={14} color={colors.danger} />
              <Text style={styles.deleteButtonText}>Delete route</Text>
            </Pressable>
          )}
          </ScrollView>
        </Animated.View>
      )}

      <ScheduleGroupRunModal
        visible={showScheduleModal}
        isSaving={isScheduling}
        tier={tier}
        defaultActivityType={route.activityType}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleSchedule}
        onRequirePaywall={() => onRequirePaywall('group_run_limit')}
      />

      <ReportModal
        visible={showReportModal}
        isSubmitting={isReporting}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSubmitReport}
      />

      <EditRouteInfoModal
        visible={showEditInfoModal}
        initialName={routeName}
        initialDescription={routeDescription}
        isSaving={savingInfo}
        onClose={() => setShowEditInfoModal(false)}
        onSave={handleSaveInfo}
      />

      <NotificationPermissionModal
        visible={notificationPrePermission.visible}
        message={notificationPrePermission.message}
        onAllow={notificationPrePermission.handleAllow}
        onDismiss={notificationPrePermission.handleDismiss}
      />

      <CompletionFollowUpSheet
        visible={showFollowUp}
        completion={todayCompletion}
        routeName={route.name}
        newPersonalBestSeconds={newPersonalBestSeconds}
        newBadge={newBadge}
        onClose={() => {
          setShowFollowUp(false);
          setNewPersonalBestSeconds(null);
          setNewBadge(null);
        }}
        onSaved={handleFollowUpSaved}
        onAddPhoto={(completionId) => {
          setShowFollowUp(false);
          setNewPersonalBestSeconds(null);
          setNewBadge(null);
          onOpenPhotoUpload(route.id, completionId);
        }}
      />

      <ReviewModal
        visible={showReviewModal}
        routeId={route.id}
        existing={myReview}
        source="solo"
        onClose={() => setShowReviewModal(false)}
        onSaved={handleReviewSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  mapWrap: {
    flex: 1,
  },
  mapWrapExpanded: {
    flex: 0,
    height: 300,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: radii.icon,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  topRightActions: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  bottomRightActions: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radii.icon,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  iconChipSolid: {
    backgroundColor: colors.coral,
  },
  toggleText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: colors.ink,
  },
  toggleTextActive: {
    color: colors.coral,
  },
  glassOverlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  glassOverlayContent: {
    padding: 20,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 12,
  },
  glassStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  glassChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: radii.sm,
    padding: 10,
    gap: 1,
  },
  glassChipAqua: {
    backgroundColor: 'rgba(75,171,184,0.72)',
  },
  glassChipAmber: {
    backgroundColor: 'rgba(232,146,58,0.72)',
  },
  glassStatLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.ink,
  },
  glassStatLabelOnColor: {
    color: 'rgba(255,255,255,0.85)',
  },
  glassStatValueCompact: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  glassStatValueOnColor: {
    color: colors.white,
  },
  glassChartCard: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: radii.sm,
    padding: 10,
  },
  glassHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glassName: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  glassByline: {
    alignSelf: 'flex-start',
    marginTop: -6,
  },
  glassBylineText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  glassChipInk: {
    backgroundColor: 'rgba(26,22,20,0.82)',
  },
  glassActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  glassRunButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  glassRunButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
  glassSaveButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  glassSaveButtonActive: {
    backgroundColor: colors.ink,
  },
  glassSaveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  glassSaveButtonTextActive: {
    color: colors.white,
  },
  detailsPill: {
    alignSelf: 'center',
    width: 120,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...elevation('subtle'),
  },
  detailsPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.ink,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...elevation('sheet'),
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    padding: 20,
    paddingTop: 4,
    gap: 12,
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink,
    opacity: 0.35,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityBadge: {
    backgroundColor: colors.amber,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  activityBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.surface,
    textTransform: 'uppercase',
  },
  name: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.ink,
  },
  editInfoButton: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  bylineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -6,
  },
  bylineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moderationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  moderationLink: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
    textDecorationLine: 'underline',
  },
  bylineAvatar: {
    width: 18,
    height: 18,
    borderRadius: 6,
  },
  bylineAvatarPlaceholder: {
    backgroundColor: colors.sheetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bylineAvatarText: {
    fontFamily: fonts.extraBold,
    fontSize: 9,
    color: colors.ink,
  },
  byline: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  description: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.stone,
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: colors.ink,
    marginTop: 2,
  },
  statLabelOnColor: {
    color: 'rgba(255,255,255,0.85)',
  },
  statValueOnColor: {
    color: colors.white,
  },
  notesSection: {
    gap: 6,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteBadge: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noteBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: colors.surface,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  statsRowSheet: {
    flexDirection: 'row',
    gap: 10,
  },
  statCardSheet: {
    flex: 1,
    backgroundColor: colors.sheetBg,
    borderRadius: radii.sm,
    padding: 12,
    gap: 1,
    ...elevation('subtle'),
  },
  statCardSheetAqua: {
    backgroundColor: colors.teal,
  },
  statCardSheetAmber: {
    backgroundColor: colors.amber,
  },
  runThisButton: {
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...elevation('subtle'),
  },
  runThisButtonLogged: {
    backgroundColor: colors.sheetBg,
  },
  runThisButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  runThisButtonTextLogged: {
    color: colors.sage,
  },
  pbRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  runThisButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordRunButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    marginBottom: 10,
    ...elevation('primaryBtn'),
  },
  recordRunButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.white,
  },
  pbRowText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.surface,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    ...elevation('subtle'),
  },
  actionButtonLiked: {
    backgroundColor: colors.coral,
  },
  actionButtonSaved: {
    backgroundColor: colors.teal,
  },
  actionButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  actionButtonTextLiked: {
    color: colors.sheetBg,
  },
  openButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    ...elevation('primaryBtn'),
  },
  openButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.surface,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 2,
  },
  completionsSection: {
    gap: 8,
    marginTop: 4,
  },
  completionsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completionsSummary: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  completionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  completionAvatarPlaceholder: {
    backgroundColor: colors.sheetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  completionUsername: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
  completionDuration: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.stone,
  },
  reviewsSection: {
    gap: 10,
    marginTop: 4,
  },
  reviewsTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingSummaryValue: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: colors.ink,
  },
  ratingSummaryCount: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mist,
  },
  reviewList: {
    gap: 12,
  },
  reviewCard: {
    flexDirection: 'row',
    gap: 10,
  },
  reviewCardBody: {
    flex: 1,
    gap: 2,
  },
  reviewUsername: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  reviewSourceLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
  },
  reviewBody: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 18,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  writeReviewText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.coral,
    textDecorationLine: 'underline',
  },
  groupRunsSection: {
    gap: 10,
  },
  groupRunsTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  noRunsText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  groupRunCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    gap: 6,
    ...elevation('card'),
  },
  groupRunWhenBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  groupRunWhenText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.surface,
    textTransform: 'uppercase',
  },
  groupRunTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  groupRunDescription: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    lineHeight: 18,
  },
  groupRunFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  groupRunGoing: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
  },
  rsvpButton: {
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  rsvpButtonActive: {
    backgroundColor: colors.sage,
  },
  rsvpButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  rsvpButtonTextActive: {
    color: colors.surface,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  deleteButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.danger,
  },
});
