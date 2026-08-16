import { Camera } from '@rnmapbox/maps';
import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BackIcon, CalendarIcon, ChevronUpIcon, CompassIcon, ExportIcon, HeartIcon, LockIcon, ShareIcon, TrashIcon } from '../components/icons';
import ElevationProfileChart from '../components/ElevationProfileChart';
import TrailInfoSection from '../components/TrailInfoSection';
import RoutePhotoGallery from '../components/RoutePhotoGallery';
import LocalLegendCallout from '../components/LocalLegendCallout';
import { listRecentlyGrantedBadges, UserBadge } from '../utils/badgesApi';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import ReportModal from '../components/ReportModal';
import RouteMap, { MapStyleMode } from '../components/RouteMap';
import ScheduleGroupRunModal, { RecurrenceInput } from '../components/ScheduleGroupRunModal';
import { createSeries } from '../utils/recurringSeriesApi';
import { useNotificationPrePermission } from '../hooks/useNotificationPrePermission';
import { useUserTier } from '../hooks/useUserTier';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
import { navigateToStart } from '../utils/externalNav';
import { buildGpx } from '../utils/gpx';
import {
  countMyActiveGroupRuns,
  createGroupRun,
  FreeJoinLimitError,
  listGroupRunsForRoute,
  setGroupRunRsvp,
} from '../utils/groupRunsApi';
import { createReport, ReportReason } from '../utils/reportsApi';
import { deleteRoute, setRouteLiked, setRouteSaved } from '../utils/routesApi';
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
  onOpenPhotoUpload: (routeId: string, completionId?: string) => void;
  onOpenPhotoViewer: (routeId: string, photoId: string) => void;
  photoRefreshSignal?: number;
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail Run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

export default function RouteDetailScreen({
  route,
  onClose,
  onOpenOnMap,
  onDeleted,
  onOpenProfile,
  onOpenGroupRun,
  onRequirePaywall,
  onOpenPhotoUpload,
  onOpenPhotoViewer,
  photoRefreshSignal,
}: Props) {
  const tier = useUserTier();
  const notificationPrePermission = useNotificationPrePermission();
  const [likesCount, setLikesCount] = useState(route.likesCount);
  const [savesCount, setSavesCount] = useState(route.savesCount);
  const [isLiked, setIsLiked] = useState(route.isLikedByMe);
  const [isSaved, setIsSaved] = useState(route.isSavedByMe);
  const [busy, setBusy] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>('standard');
  const [is3D, setIs3D] = useState(false);
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
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log your run. Try again.');
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

  useEffect(() => {
    // Frame the whole route on open instead of just the start point — the
    // bottom ~40% of the map is covered by the stats/chart overlay, so
    // weight padding toward the bottom to keep the route out from under it.
    if (hasFitBounds.current || fullPath.length < 2) return;
    const lats = fullPath.map((p) => p.latitude);
    const lngs = fullPath.map((p) => p.longitude);
    hasFitBounds.current = true;
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      [40, 50, 260, 50],
      0,
    );
  }, [fullPath]);

  const chartPath = route.elevationProfile.length >= 2 ? route.elevationProfile : fullPath;
  const colorSegments = useMemo(() => colorSegmentsByGrade(chartPath), [chartPath]);
  const kmMarkers = useMemo(() => kilometerMarkers(fullPath), [fullPath]);
  const peakElevationM = useMemo(() => {
    const elevations = chartPath.map((p) => p.elevation).filter((e): e is number => typeof e === 'number');
    return elevations.length > 0 ? Math.max(...elevations) : null;
  }, [chartPath]);
  const center = route.waypoints[0] ?? { latitude: 0, longitude: 0 };

  const notedWaypoints = useMemo(
    () =>
      route.waypoints
        .map((wp, index) => ({ wp, index }))
        .filter(({ wp }) => !!wp.note?.trim())
        .map(({ wp, index }) => ({
          note: wp.note!.trim(),
          label: index === 0 ? 'S' : index === route.waypoints.length - 1 ? 'E' : String(index + 1),
        })),
    [route.waypoints],
  );

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
    Alert.alert('Delete route', `Remove "${route.name}"? This can't be undone.`, [
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
  }, [route.id, route.name, onDeleted]);

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
        message: url ? `Check out my route "${route.name}" on Rootah: ${url}` : `Check out my route "${route.name}" on Rootah`,
        url,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to share route.');
    }
  }, [route.id, route.name]);

  const handleExportGpx = useCallback(async () => {
    setExporting(true);
    try {
      const gpx = buildGpx(fullPath, route.name);
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
  }, [fullPath, route.id, route.name]);

  const handlePressSchedule = useCallback(async () => {
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
  }, [tier, onRequirePaywall]);

  const handleCustomize = useCallback(() => {
    if (tier === 'paid') {
      onOpenOnMap(route);
    } else {
      onRequirePaywall('route_customize');
    }
  }, [tier, route, onOpenOnMap, onRequirePaywall]);

  const handleNavigateToStart = useCallback(() => {
    const start = route.waypoints[0];
    if (!start) return;
    navigateToStart(start.latitude, start.longitude, route.name || 'start');
  }, [route]);

  const handleSchedule = useCallback(
    async (
      title: string,
      description: string,
      scheduledAt: Date,
      maxParticipants: number | null,
      recurrence: RecurrenceInput | null,
    ) => {
      setIsScheduling(true);
      try {
        if (recurrence) {
          await createSeries({
            routeId: route.id,
            title,
            description,
            firstOccurrenceAt: scheduledAt,
            frequency: recurrence.frequency,
            endDate: recurrence.endDate,
          });
        } else {
          await createGroupRun({ routeId: route.id, title, description, scheduledAt, maxParticipants });
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
    [route.id, refreshGroupRuns, notificationPrePermission.maybePrompt],
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
          showNoteMarkers
        />

        <Pressable style={styles.backButton} onPress={() => (sheetExpanded ? setExpanded(false) : onClose())}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <BackIcon />
        </Pressable>

        {!sheetExpanded && (
          <View style={styles.topRightActions}>
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
            <Pressable style={[styles.iconChip, styles.iconChipSolid]} onPress={handleExportGpx} disabled={exporting}>
              {exporting ? <ActivityIndicator size="small" color={colors.sand} /> : <ExportIcon size={18} color={colors.sand} />}
            </Pressable>
            <Pressable style={styles.iconChip} onPress={handleShare}>
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <ShareIcon size={16} />
            </Pressable>
            {route.isOwnedByMe && (
              <Pressable style={styles.iconChip} onPress={handleDelete} disabled={busy}>
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                {busy ? <ActivityIndicator size="small" color={colors.rustDark} /> : <TrashIcon size={16} color={colors.rustDark} />}
              </Pressable>
            )}
          </View>
        )}

        {!sheetExpanded && (
          <View style={styles.glassOverlayWrap}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(226,218,194,0)', 'rgba(226,218,194,0.35)', 'rgba(226,218,194,0.55)']}
              locations={[0, 0.3, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glassOverlayContent}>
              <View style={styles.glassStatsRow}>
                <View style={styles.glassChip}>
                  <Text style={styles.glassStatLabel}>DISTANCE</Text>
                  <Text style={styles.glassStatValueCompact}>{route.distanceKm.toFixed(2)} km</Text>
                </View>
                <View style={[styles.glassChip, styles.glassChipAqua]}>
                  <Text style={styles.glassStatLabel}>GAIN</Text>
                  <Text style={styles.glassStatValueCompact}>+{Math.round(route.elevationGainM)} m</Text>
                </View>
                {peakElevationM !== null && (
                  <View style={[styles.glassChip, styles.glassChipAmber]}>
                    <Text style={styles.glassStatLabel}>PEAK</Text>
                    <Text style={styles.glassStatValueCompact}>{Math.round(peakElevationM)} m</Text>
                  </View>
                )}
              </View>

              {chartPath.length >= 2 && (
                <View style={styles.glassChartCard}>
                  <ElevationProfileChart path={chartPath} compact transparent />
                </View>
              )}

              <Pressable style={styles.detailsPill} onPress={() => setExpanded(true)}>
                <ChevronUpIcon size={13} />
                <Text style={styles.detailsPillText}>DETAILS</Text>
              </Pressable>
            </View>
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
              {route.name}
            </Text>
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

          {!!route.description && <Text style={styles.description}>{route.description}</Text>}

          {notedWaypoints.length > 0 && (
            <View style={styles.notesSection}>
              {notedWaypoints.map((n, i) => (
                <View key={i} style={styles.noteRow}>
                  <View style={styles.noteBadge}>
                    <Text style={styles.noteBadgeText}>{n.label}</Text>
                  </View>
                  <Text style={styles.noteText}>{n.note}</Text>
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
              <Text style={styles.statLabel}>GAIN</Text>
              <Text style={styles.statValue}>+{Math.round(route.elevationGainM)} m</Text>
            </View>
            {peakElevationM !== null && (
              <View style={[styles.statCardSheet, styles.statCardSheetAmber]}>
                <Text style={styles.statLabel}>PEAK</Text>
                <Text style={styles.statValue}>{Math.round(peakElevationM)} m</Text>
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
            onOpenUpload={() => onOpenPhotoUpload(route.id)}
            onOpenPhoto={(photoId) => onOpenPhotoViewer(route.id, photoId)}
            onSeeAll={() => onOpenPhotoViewer(route.id, '')}
          />

          <Pressable
            style={[styles.runThisButton, todayCompletion && styles.runThisButtonLogged]}
            onPress={handleLogRun}
            disabled={loggingCompletion}
          >
            {loggingCompletion ? (
              <ActivityIndicator color={colors.sand} />
            ) : (
              <Text style={[styles.runThisButtonText, todayCompletion && styles.runThisButtonTextLogged]}>
                {todayCompletion ? '✓ Ran today' : '✓ I ran this'}
              </Text>
            )}
          </Pressable>

          {personalBestSeconds != null && (
            <View style={styles.pbRow}>
              <Text style={styles.pbRowText}>🏆 Your best: {formatDuration(personalBestSeconds)}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable style={[styles.actionButton, isLiked && styles.actionButtonLiked]} onPress={handleToggleLike}>
              <HeartIcon size={16} color={isLiked ? colors.sand : colors.ink} filled={isLiked} />
              <Text style={[styles.actionButtonText, isLiked && styles.actionButtonTextLiked]} numberOfLines={1}>
                {likesCount}
              </Text>
            </Pressable>

            {!route.isOwnedByMe && (
              <Pressable
                style={[styles.actionButton, isSaved && styles.actionButtonSaved]}
                onPress={handleToggleSave}
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

            <Pressable style={styles.actionButton} onPress={handleNavigateToStart}>
              <CompassIcon size={16} color={colors.ink} />
              <Text style={styles.actionButtonText} numberOfLines={1}>
                NAVIGATE
              </Text>
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
              {tier === 'free' && <LockIcon size={16} color={colors.sand} />}
              <Text style={styles.openButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                CUSTOMIZE THIS ROUTE
              </Text>
            </Pressable>
          )}

          {completionCount > 0 && (
            <View style={styles.completionsSection}>
              <Pressable onPress={toggleCompletionsExpanded}>
                <Text style={styles.completionsSummary}>
                  🏃 Ran by {completionCount} {completionCount === 1 ? 'person' : 'people'}
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
                        onPress={() => handleToggleRsvp(run)}
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
              <TrashIcon size={14} color={colors.rustDark} />
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
    top: 56,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(226,218,194,0.72)',
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadowNoBorder(3),
  },
  topRightActions: {
    position: 'absolute',
    top: 56,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(226,218,194,0.72)',
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadowNoBorder(3),
  },
  iconChipSolid: {
    backgroundColor: colors.rust,
  },
  toggleText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink,
  },
  toggleTextActive: {
    color: colors.rust,
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
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 2,
    borderColor: 'rgba(34,42,42,0.85)',
    borderRadius: 12,
    padding: 10,
    gap: 1,
  },
  glassChipAqua: {
    backgroundColor: 'rgba(79,187,188,0.4)',
  },
  glassChipAmber: {
    backgroundColor: 'rgba(243,145,32,0.4)',
  },
  glassStatLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.ink,
  },
  glassStatValueCompact: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  glassChartCard: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 2,
    borderColor: 'rgba(34,42,42,0.85)',
    borderRadius: 12,
    padding: 10,
  },
  detailsPill: {
    alignSelf: 'center',
    width: 120,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(226,218,194,0.6)',
    borderWidth: 3,
    borderColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...brutalShadowNoBorder(3),
  },
  detailsPillText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.ink,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  name: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
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
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.mutedLight,
    textDecorationLine: 'underline',
  },
  bylineAvatar: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  bylineAvatarPlaceholder: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bylineAvatarText: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.ink,
  },
  byline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  description: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
    marginTop: 2,
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
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noteBadgeText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
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
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 10,
    gap: 1,
  },
  statCardSheetAqua: {
    backgroundColor: colors.aqua,
  },
  statCardSheetAmber: {
    backgroundColor: colors.amber,
  },
  runThisButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...brutalShadow(4),
  },
  runThisButtonLogged: {
    backgroundColor: colors.sand,
  },
  runThisButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.white,
  },
  runThisButtonTextLogged: {
    color: colors.ink,
  },
  pbRow: {
    alignSelf: 'flex-start',
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  pbRowText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
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
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingVertical: 10,
    ...brutalShadowNoBorder(3),
  },
  actionButtonLiked: {
    backgroundColor: colors.rust,
  },
  actionButtonSaved: {
    backgroundColor: colors.aqua,
  },
  actionButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  actionButtonTextLiked: {
    color: colors.sand,
  },
  openButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    ...brutalShadow(4),
  },
  openButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
  divider: {
    height: 1,
    backgroundColor: '#c9bfa2',
    marginVertical: 2,
  },
  completionsSection: {
    gap: 8,
    marginTop: 4,
  },
  completionsSummary: {
    fontFamily: fonts.bodyBold,
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
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionAvatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  completionUsername: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  completionDuration: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
  },
  reviewsSection: {
    gap: 10,
    marginTop: 4,
  },
  reviewsTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingSummaryValue: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
  },
  ratingSummaryCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.mutedLight,
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
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  reviewSourceLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
  },
  reviewBody: {
    fontFamily: fonts.bodyMedium,
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
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.rust,
    textDecorationLine: 'underline',
  },
  groupRunsSection: {
    gap: 10,
  },
  groupRunsTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  noRunsText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  groupRunCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    ...brutalShadow(3),
  },
  groupRunWhenBadge: {
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
    marginBottom: 2,
  },
  groupRunWhenText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  groupRunTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  groupRunDescription: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  groupRunFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  groupRunGoing: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.mutedLight,
  },
  rsvpButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.sand,
  },
  rsvpButtonActive: {
    backgroundColor: colors.green,
  },
  rsvpButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  rsvpButtonTextActive: {
    color: colors.white,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  deleteButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.rustDark,
  },
});

/** Same hard-offset shadow as brutalShadow(), without re-declaring the border (already set explicitly alongside it here). */
function brutalShadowNoBorder(offset: number) {
  return { boxShadow: `${offset}px ${offset}px 0px ${colors.ink}` } as const;
}
