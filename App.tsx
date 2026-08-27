import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
// Side-effect import — registers the background location task at module
// load time, before any navigation renders. Must happen at the app root,
// not lazily inside the recording screen, or a background re-launch after
// the OS kills the app mid-run would have no task definition to resume into.
import './src/tasks/locationTask';
import ActivityFeedScreen from './src/screens/ActivityFeedScreen';
import AuthScreen from './src/screens/AuthScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import ClubAdminScreen from './src/screens/ClubAdminScreen';
import ClubProfileScreen from './src/screens/ClubProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RecordingScreen from './src/screens/RecordingScreen';
import RecordingSummaryScreen from './src/screens/RecordingSummaryScreen';
import RaceShareCardScreen from './src/screens/RaceShareCardScreen';
import ActivityShareCardScreen from './src/screens/ActivityShareCardScreen';
import ClubsListScreen from './src/screens/ClubsListScreen';
import CreateClubScreen from './src/screens/CreateClubScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import DiscoverMapScreen from './src/screens/DiscoverMapScreen';
import GroupRunDetailScreen from './src/screens/GroupRunDetailScreen';
import GroupRunsScreen from './src/screens/GroupRunsScreen';
import ImportGpxScreen from './src/screens/ImportGpxScreen';
import MapScreen from './src/screens/MapScreen';
import MyMapsScreen from './src/screens/MyMapsScreen';
import PaywallScreen, { PaywallTrigger } from './src/screens/PaywallScreen';
import PhotoUploadScreen from './src/screens/PhotoUploadScreen';
import PhotoViewerScreen from './src/screens/PhotoViewerScreen';
import FlybyScreen from './src/screens/FlybyScreen';
import ProfileEventsScreen from './src/screens/ProfileEventsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import RouteDetailScreen from './src/screens/RouteDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TopRoutesScreen from './src/screens/TopRoutesScreen';
import UsernameSetupScreen from './src/screens/UsernameSetupScreen';
import NotificationPermissionModal from './src/components/NotificationPermissionModal';
import ScheduleGroupRunModal from './src/components/ScheduleGroupRunModal';
import { useNotificationPrePermission } from './src/hooks/useNotificationPrePermission';
import { useUserTier } from './src/hooks/useUserTier';
import { colors, fonts } from './src/theme/theme';
import { ActivityType, CloudRoute, GroupRun, RaceDetails, RaceRsvp } from './src/types/route';
import { RecordingSession } from './src/types/recording';
import { countMyActiveGroupRuns, createGroupRun } from './src/utils/groupRunsApi';
import { countUnreadNotifications } from './src/utils/notificationsApi';
import { useRecording } from './src/hooks/useRecording';
import { useRecordingStore } from './src/stores/recordingStore';
import { getRoute } from './src/utils/routesApi';
import { getRaceDetails } from './src/utils/racesApi';
import { getRecordedRunStats } from './src/utils/recordingUpload';
import { RaceInput, RacePrefill, RecurrenceInput } from './src/components/ScheduleGroupRunModal';
import { createSeries, getFirstUpcomingOccurrence } from './src/utils/recurringSeriesApi';

SplashScreen.preventAutoHideAsync().catch(() => {});

// The only account allowed to create races (docs/race-mode-plan.md) — matches
// OFFICIAL_ACCOUNT_ID in scripts/createRace.ts and the group_runs/race_details RLS policies.
const OFFICIAL_ACCOUNT_ID = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f';

type Overlay =
  | 'builder'
  | 'myMaps'
  | 'detail'
  | 'profile'
  | 'settings'
  | 'publicProfile'
  | 'activity'
  | 'groupRuns'
  | 'groupRunDetail'
  | 'blockedUsers'
  | 'importGpx'
  | 'events'
  | 'createEvent'
  | 'clubs'
  | 'topRoutes'
  | 'photoUpload'
  | 'photoView'
  | 'flyby'
  | 'clubProfile'
  | 'clubAdmin'
  | 'createClub'
  | 'notifications'
  | 'recording'
  | 'recordingSummary'
  | 'raceShareCard'
  | 'activityShareCard'
  | null;

interface AuthedAppProps {
  pendingRouteId: string | null;
  onConsumePendingRoute: () => void;
  pendingGroupRunId: string | null;
  onConsumePendingGroupRun: () => void;
  pendingProfileId: string | null;
  onConsumePendingProfile: () => void;
}

function AuthedApp({
  pendingRouteId,
  onConsumePendingRoute,
  pendingGroupRunId,
  onConsumePendingGroupRun,
  pendingProfileId,
  onConsumePendingProfile,
}: AuthedAppProps) {
  const { session } = useAuth();
  const tier = useUserTier();
  const notificationPrePermission = useNotificationPrePermission();
  const [overlay, setOverlay] = useState<Overlay>(null);
  // Real back-stack (rather than a single fixed "return to" slot per screen)
  // so chains like detail -> groupRunDetail -> detail -> ... unwind correctly
  // instead of ping-ponging between the last two screens forever.
  const [navStack, setNavStack] = useState<Overlay[]>([]);
  // Stacked on top of whatever `overlay` is currently showing, rather than
  // replacing it — so a paywall triggered mid-builder (e.g. save-route cap)
  // doesn't unmount MapScreen and lose the in-progress route.
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | undefined>(undefined);
  const [selectedRoute, setSelectedRoute] = useState<CloudRoute | null>(null);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [selectedGroupRunId, setSelectedGroupRunId] = useState<string | null>(null);
  const [routeToLoad, setRouteToLoad] = useState<CloudRoute | null>(null);
  const [resolvingRoute, setResolvingRoute] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [discoverRefreshSignal, setDiscoverRefreshSignal] = useState(0);
  // Set once a route is picked (or freshly created) for the in-progress
  // "Create event" flow — a non-null value drives the top-level schedule
  // modal regardless of which overlay is currently showing underneath it.
  const [eventRouteId, setEventRouteId] = useState<string | null>(null);
  // Set when the "Create event" flow was launched from a club's Events tab —
  // tags the resulting group run to that club.
  const [eventClubId, setEventClubId] = useState<string | null>(null);
  // Set only when "add distance category" was tapped from an existing
  // race's event page — routes the resulting createGroupRun call to join
  // that event (race.eventGroupId) instead of starting a new one, and
  // seeds the schedule modal's branding fields from the event it's joining.
  const [addCategoryContext, setAddCategoryContext] = useState<{ eventGroupId: string; prefillRace: RacePrefill } | null>(null);
  const [isSchedulingEvent, setIsSchedulingEvent] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [topRoutesCity, setTopRoutesCity] = useState<string | null>(null);
  const [photoUploadTarget, setPhotoUploadTarget] = useState<{ routeId: string; completionId?: string } | null>(null);
  const [photoViewTarget, setPhotoViewTarget] = useState<{ routeId: string; photoId: string } | null>(null);
  const [photoRefreshSignal, setPhotoRefreshSignal] = useState(0);
  // True while the builder is open specifically because the user chose
  // "Create a new route" from the Create Event flow — on save, this reroutes
  // the normal "route created" handling into "now finish the event details"
  // instead of opening the route's detail page.
  const [creatingEventForNewRoute, setCreatingEventForNewRoute] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [recordingActivityType, setRecordingActivityType] = useState<ActivityType>('run');
  const [finishedRecordingSession, setFinishedRecordingSession] = useState<RecordingSession | null>(null);
  const [resumedRecording, setResumedRecording] = useState(false);
  const [recordingRoute, setRecordingRoute] = useState<CloudRoute | null>(null);
  const [recordingRaceRsvpId, setRecordingRaceRsvpId] = useState<string | null>(null);
  const [recordingRaceContext, setRecordingRaceContext] = useState<{ raceDetails: RaceDetails; raceTitle: string } | null>(null);
  const [raceFinishStats, setRaceFinishStats] = useState<{ distanceMeters: number; finishTimeSeconds: number; paceSecondsPerKm: number | null } | null>(null);
  const [activityFinishStats, setActivityFinishStats] = useState<{ activityType: ActivityType; distanceMeters: number; movingTimeSeconds: number; paceSecondsPerKm: number | null } | null>(null);
  // True only when the share card was reopened later from the race event
  // page (not right after finishing) — changes onDone to go back to that
  // page instead of closing out to the map with a "Run saved" toast.
  const [shareCardReopened, setShareCardReopened] = useState(false);
  const { checkForActiveSession, resumeActiveSession, finishRecording, discardSession } = useRecording();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Crash recovery — the app died mid-recording (force-quit, OS kill) and
  // relaunched into a fresh session with no active overlay. Never silently
  // discard the in-progress run; ask the user what to do with it.
  useEffect(() => {
    const activeSession = checkForActiveSession();
    if (!activeSession) return;

    Alert.alert(
      'Unfinished run found',
      `You have an unfinished run from ${new Date(activeSession.startedAt).toLocaleString()}. Resume or finish it?`,
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => discardSession(activeSession.id),
        },
        {
          text: 'Finish now',
          onPress: async () => {
            await finishRecording(activeSession.id);
            setFinishedRecordingSession(activeSession);
            setOverlay('recordingSummary');
          },
        },
        {
          text: 'Resume',
          onPress: async () => {
            setRecordingActivityType(activeSession.activityType);
            await resumeActiveSession(activeSession);
            setResumedRecording(true);
            setOverlay('recording');
          },
        },
      ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A recording in progress owns the screen — returning to Rootah (from the
  // background, another app, or the lock screen) always lands back on the
  // recording screen, and the Android hardware back button is blocked while
  // it's showing. The only way out is Finish or the in-screen Discard
  // confirm, both of which actually stop the recording first.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (useRecordingStore.getState().isRecording && overlay !== 'recording') {
        setOverlay('recording');
      }
    });
    return () => subscription.remove();
  }, [overlay]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => overlay === 'recording');
    return () => subscription.remove();
  }, [overlay]);

  useEffect(() => {
    const refreshUnread = () => countUnreadNotifications().then(setUnreadNotificationCount).catch(() => {});
    refreshUnread();
    const poll = setInterval(refreshUnread, 30_000);
    return () => clearInterval(poll);
    // Also refetch whenever the notifications screen closes, so the badge
    // clears immediately after a "mark all read" instead of waiting for the
    // next poll tick.
  }, [overlay]);

  const navigateTo = useCallback(
    (next: Overlay) => {
      setNavStack((prev) => [...prev, overlay]);
      setOverlay(next);
    },
    [overlay],
  );

  const navigateBack = useCallback((fallback: Overlay = null) => {
    setNavStack((prev) => {
      if (prev.length === 0) {
        setOverlay(fallback);
        return prev;
      }
      const copy = [...prev];
      const top = copy.pop()!;
      setOverlay(top);
      return copy;
    });
  }, []);

  const openDetail = useCallback(
    (route: CloudRoute) => {
      setSelectedRoute(route);
      navigateTo('detail');
    },
    [navigateTo],
  );

  const openDetailById = useCallback(
    async (routeId: string) => {
      setResolvingRoute(true);
      try {
        const route = await getRoute(routeId);
        openDetail(route);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load route.');
      } finally {
        setResolvingRoute(false);
      }
    },
    [openDetail],
  );

  const openOnMap = useCallback((route: CloudRoute) => {
    setRouteToLoad(route);
    setOverlay('builder');
  }, []);

  const openProfile = useCallback(
    (userId: string) => {
      if (userId === session?.user.id) {
        setOverlay('profile');
      } else {
        setViewedUserId(userId);
        setOverlay('publicProfile');
      }
    },
    [session],
  );

  const openGroupRunDetail = useCallback(
    (groupRunId: string) => {
      setSelectedGroupRunId(groupRunId);
      navigateTo('groupRunDetail');
    },
    [navigateTo],
  );

  const openClubProfile = useCallback(
    (clubId: string) => {
      setSelectedClubId(clubId);
      navigateTo('clubProfile');
    },
    [navigateTo],
  );

  const openPaywall = useCallback((trigger: PaywallTrigger) => {
    setPaywallTrigger(trigger);
  }, []);

  const handleTapCreateEvent = useCallback(async () => {
    if (tier === 'free') {
      try {
        const activeCount = await countMyActiveGroupRuns();
        if (activeCount >= 1) {
          openPaywall('group_run_limit');
          return;
        }
      } catch {
        // Don't block on a network hiccup — this is a soft UX gate only,
        // the server-side check on RSVP/creation is the real enforcement.
      }
    }
    setOverlay('createEvent');
  }, [tier, openPaywall]);

  const handleSelectEventRoute = useCallback((route: CloudRoute) => {
    setEventRouteId(route.id);
    setOverlay(null);
  }, []);

  const handleAddDistanceCategory = useCallback((groupRun: GroupRun, raceDetails: RaceDetails) => {
    setAddCategoryContext({
      eventGroupId: raceDetails.eventGroupId ?? groupRun.id,
      prefillRace: {
        eventTitle: raceDetails.eventTitle ?? groupRun.title,
        raceDate: new Date(`${raceDetails.raceDate}T00:00:00`),
        organizerName: raceDetails.organizerName ?? '',
        organizerLogoUrl: raceDetails.organizerLogoUrl ?? '',
        eventBannerUrl: raceDetails.eventBannerUrl ?? '',
        eventLogoUrl: raceDetails.eventLogoUrl ?? '',
      },
    });
    setEventClubId(null);
    setOverlay('createEvent');
  }, []);

  const handleTapScheduleClubRun = useCallback((clubId: string) => {
    setEventClubId(clubId);
    setOverlay('createEvent');
  }, []);

  const handleRecordRoute = useCallback(
    (route: CloudRoute) => {
      setResumedRecording(false);
      setRecordingRoute(route);
      setRecordingRaceRsvpId(null);
      setRecordingRaceContext(null);
      setRecordingActivityType(route.activityType);
      navigateTo('recording');
    },
    [navigateTo],
  );

  const handleRunRace = useCallback(
    async (groupRun: GroupRun, rsvpId: string) => {
      setResolvingRoute(true);
      try {
        const [route, raceDetails] = await Promise.all([getRoute(groupRun.routeId), getRaceDetails(groupRun.id)]);
        setResumedRecording(false);
        setRecordingRoute(route);
        setRecordingRaceRsvpId(rsvpId);
        setRecordingRaceContext(raceDetails ? { raceDetails, raceTitle: raceDetails.eventTitle ?? groupRun.title } : null);
        setRecordingActivityType(route.activityType);
        navigateTo('recording');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : "Couldn't load this race's route.");
      } finally {
        setResolvingRoute(false);
      }
    },
    [navigateTo],
  );

  const handleReopenShareCard = useCallback(
    async (groupRun: GroupRun, rsvp: RaceRsvp) => {
      if (!rsvp.recordedRunId) return;
      setResolvingRoute(true);
      try {
        const [raceDetails, stats] = await Promise.all([getRaceDetails(groupRun.id), getRecordedRunStats(rsvp.recordedRunId)]);
        if (!raceDetails) throw new Error("Couldn't load this race's branding.");
        setRecordingRaceRsvpId(rsvp.id);
        setRecordingRaceContext({ raceDetails, raceTitle: raceDetails.eventTitle ?? groupRun.title });
        setRaceFinishStats({
          distanceMeters: stats.distanceMeters,
          finishTimeSeconds: rsvp.finishTimeSeconds ?? stats.movingTimeSeconds,
          paceSecondsPerKm: stats.avgPaceSecondsPerKm,
        });
        setShareCardReopened(true);
        navigateTo('raceShareCard');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : "Couldn't load your finish card.");
      } finally {
        setResolvingRoute(false);
      }
    },
    [navigateTo],
  );

  const handleStartRecording = useCallback(() => {
    setResumedRecording(false);
    setRecordingRoute(null);
    setRecordingRaceRsvpId(null);
    setRecordingRaceContext(null);
    Alert.alert('Record activity', 'What are you doing?', [
      { text: 'Run', onPress: () => { setRecordingActivityType('run'); navigateTo('recording'); } },
      { text: 'Trail run', onPress: () => { setRecordingActivityType('trail_run'); navigateTo('recording'); } },
      { text: 'Hike', onPress: () => { setRecordingActivityType('hike'); navigateTo('recording'); } },
      { text: 'Ride', onPress: () => { setRecordingActivityType('bike'); navigateTo('recording'); } },
      { text: 'Walk', onPress: () => { setRecordingActivityType('walk'); navigateTo('recording'); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [navigateTo]);

  const handleCreateNewRouteForEvent = useCallback(() => {
    setCreatingEventForNewRoute(true);
    setRouteToLoad(null);
    setOverlay('builder');
  }, []);

  const handleScheduleEvent = useCallback(
    async (
      title: string,
      description: string,
      scheduledAt: Date,
      maxParticipants: number | null,
      recurrence: RecurrenceInput | null,
      race: RaceInput | null,
    ) => {
      if (!eventRouteId) return;
      setIsSchedulingEvent(true);
      try {
        if (recurrence) {
          const series = await createSeries({
            routeId: eventRouteId,
            clubId: eventClubId,
            title,
            description,
            firstOccurrenceAt: scheduledAt,
            frequency: recurrence.frequency,
            endDate: recurrence.endDate,
          });
          setEventRouteId(null);
          setEventClubId(null);
          setToast('Recurring event created.');
          const firstRun = await getFirstUpcomingOccurrence(series.id);
          if (firstRun) openGroupRunDetail(firstRun.id);
        } else {
          const created = await createGroupRun({
            routeId: eventRouteId,
            title,
            description,
            scheduledAt,
            maxParticipants,
            clubId: eventClubId,
            race: race
              ? {
                  raceDate: race.raceDate,
                  organizerName: race.organizerName || null,
                  organizerLogoUrl: race.organizerLogoUrl || null,
                  eventBannerUrl: race.eventBannerUrl || null,
                  eventLogoUrl: race.eventLogoUrl || null,
                  eventGroupId: addCategoryContext?.eventGroupId ?? null,
                  eventTitle: race.eventTitle ?? null,
                }
              : null,
          });
          setEventRouteId(null);
          setEventClubId(null);
          setAddCategoryContext(null);
          setToast(addCategoryContext ? 'Distance category added.' : 'Event created.');
          openGroupRunDetail(created.id);
        }
        notificationPrePermission.maybePrompt('Get notified when people join your event or post updates.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create event.');
      } finally {
        setIsSchedulingEvent(false);
      }
    },
    [eventRouteId, eventClubId, addCategoryContext, openGroupRunDetail, notificationPrePermission.maybePrompt],
  );

  // Deep link from the shared web preview page (rootah://routes/{id}),
  // captured by Root even before the user is signed in — see there.
  useEffect(() => {
    if (!pendingRouteId) return;
    openDetailById(pendingRouteId);
    onConsumePendingRoute();
  }, [pendingRouteId, onConsumePendingRoute, openDetailById]);

  // Deep link from tapping a push notification (RSVP/like on a group run) —
  // same capture-above-the-auth-gate pattern as pendingRouteId, see Root().
  useEffect(() => {
    if (!pendingGroupRunId) return;
    openGroupRunDetail(pendingGroupRunId);
    onConsumePendingGroupRun();
  }, [pendingGroupRunId, onConsumePendingGroupRun, openGroupRunDetail]);

  // Deep link from the shared web profile page (rootah://profile/{id}).
  useEffect(() => {
    if (!pendingProfileId) return;
    openProfile(pendingProfileId);
    onConsumePendingProfile();
  }, [pendingProfileId, onConsumePendingProfile, openProfile]);

  return (
    <View style={styles.container}>
      <DiscoverMapScreen
        onOpenDetail={(route) => openDetail(route)}
        onOpenProfile={() => setOverlay('profile')}
        onOpenGroupRuns={() => setOverlay('groupRuns')}
        onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
        onOpenClubs={() => setOverlay('clubs')}
        onOpenNotifications={() => navigateTo('notifications')}
        unreadNotificationCount={unreadNotificationCount}
        onStartRecording={handleStartRecording}
        onCreateRoute={() => setOverlay('builder')}
        onImportGpx={() => (tier === 'paid' ? setOverlay('importGpx') : openPaywall('gpx_import'))}
        onCreateEvent={handleTapCreateEvent}
        refreshSignal={discoverRefreshSignal}
      />

      {resolvingRoute && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.rust} size="large" />
        </View>
      )}

      {overlay === 'builder' && (
        <View style={StyleSheet.absoluteFill}>
          <MapScreen
            routeToLoad={routeToLoad}
            onRouteConsumed={() => setRouteToLoad(null)}
            onClose={() => setOverlay(null)}
            onRouteCreated={(route) => {
              if (creatingEventForNewRoute) {
                setCreatingEventForNewRoute(false);
                setEventRouteId(route.id);
                setOverlay(null);
                setDiscoverRefreshSignal((n) => n + 1);
                return;
              }
              openDetail(route);
              setToast('Route added to your maps.');
              setDiscoverRefreshSignal((n) => n + 1);
            }}
            onRouteUpdated={(route) => {
              openDetail(route);
              setToast('Route updated.');
              setDiscoverRefreshSignal((n) => n + 1);
            }}
            onRequirePaywall={() => openPaywall('route_limit')}
          />
        </View>
      )}

      {toast && (
        <View style={styles.toastBanner} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {overlay === 'myMaps' && (
        <View style={StyleSheet.absoluteFill}>
          <MyMapsScreen
            onClose={() => setOverlay(null)}
            onSelectRoute={openOnMap}
            onOpenDetail={(route) => openDetail(route)}
          />
        </View>
      )}

      {overlay === 'importGpx' && (
        <View style={StyleSheet.absoluteFill}>
          <ImportGpxScreen
            onClose={() => setOverlay(null)}
            onImported={(route) => {
              openDetail(route);
              setToast('Route imported.');
              setDiscoverRefreshSignal((n) => n + 1);
            }}
          />
        </View>
      )}

      {overlay === 'activity' && (
        <View style={StyleSheet.absoluteFill}>
          <ActivityFeedScreen
            onClose={() => setOverlay('profile')}
            onOpenDetail={(routeId) => openDetailById(routeId)}
          />
        </View>
      )}

      {overlay === 'groupRuns' && (
        <View style={StyleSheet.absoluteFill}>
          <GroupRunsScreen
            onClose={() => setOverlay(null)}
            onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
            onRequirePaywall={() => openPaywall('group_run_join_limit')}
          />
        </View>
      )}

      {overlay === 'topRoutes' && (
        <View style={StyleSheet.absoluteFill}>
          <TopRoutesScreen city={topRoutesCity} onClose={() => navigateBack()} onOpenDetail={(route) => openDetail(route)} />
        </View>
      )}

      {overlay === 'clubs' && (
        <View style={StyleSheet.absoluteFill}>
          <ClubsListScreen
            userCity={null}
            onClose={() => setOverlay(null)}
            onOpenClub={(clubId) => openClubProfile(clubId)}
            onCreateClub={() => navigateTo('createClub')}
          />
        </View>
      )}

      {overlay === 'createClub' && (
        <View style={StyleSheet.absoluteFill}>
          <CreateClubScreen
            onClose={() => navigateBack()}
            onCreated={(club) => {
              setToast('Club created.');
              openClubProfile(club.id);
            }}
          />
        </View>
      )}

      {overlay === 'clubProfile' && selectedClubId && (
        <View style={StyleSheet.absoluteFill}>
          <ClubProfileScreen
            clubId={selectedClubId}
            onClose={() => navigateBack()}
            onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
            onOpenClubAdmin={(clubId) => {
              setSelectedClubId(clubId);
              navigateTo('clubAdmin');
            }}
            onOpenProfile={openProfile}
            onRequirePaywall={openPaywall}
            onScheduleClubRun={handleTapScheduleClubRun}
          />
        </View>
      )}

      {overlay === 'notifications' && (
        <View style={StyleSheet.absoluteFill}>
          <NotificationsScreen
            onClose={() => navigateBack()}
            onOpenRoute={(routeId) => openDetailById(routeId)}
            onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
            onOpenClub={(clubId) => openClubProfile(clubId)}
          />
        </View>
      )}

      {overlay === 'recording' && (
        <View style={StyleSheet.absoluteFill}>
          <RecordingScreen
            activityType={recordingActivityType}
            routeId={recordingRoute?.id}
            plannedSegments={recordingRoute?.segments}
            alreadyStarted={resumedRecording}
            raceRsvpId={recordingRaceRsvpId ?? undefined}
            onFinish={(session) => {
              setFinishedRecordingSession(session);
              setOverlay('recordingSummary');
            }}
            onDiscard={() => navigateBack()}
          />
        </View>
      )}

      {overlay === 'recordingSummary' && finishedRecordingSession && (
        <View style={StyleSheet.absoluteFill}>
          <RecordingSummaryScreen
            sessionId={finishedRecordingSession.id}
            activityType={finishedRecordingSession.activityType}
            routeId={finishedRecordingSession.routeId}
            startedAt={finishedRecordingSession.startedAt}
            raceRsvpId={recordingRaceRsvpId ?? undefined}
            onRaceFinished={
              recordingRaceContext
                ? (distanceMeters, finishTimeSeconds, paceSecondsPerKm) => {
                    setRaceFinishStats({ distanceMeters, finishTimeSeconds, paceSecondsPerKm });
                    setFinishedRecordingSession(null);
                    setDiscoverRefreshSignal((n) => n + 1);
                    setOverlay('raceShareCard');
                  }
                : undefined
            }
            onActivityFinished={(distanceMeters, movingTimeSeconds, paceSecondsPerKm) => {
              setActivityFinishStats({ activityType: finishedRecordingSession.activityType, distanceMeters, movingTimeSeconds, paceSecondsPerKm });
              setFinishedRecordingSession(null);
              setDiscoverRefreshSignal((n) => n + 1);
              setOverlay('activityShareCard');
            }}
            onDone={() => {
              setFinishedRecordingSession(null);
              setRecordingRaceRsvpId(null);
              setRecordingRaceContext(null);
              setToast('Run saved.');
              setDiscoverRefreshSignal((n) => n + 1);
              setOverlay(null);
              setNavStack([]);
            }}
          />
        </View>
      )}

      {overlay === 'activityShareCard' && activityFinishStats && (
        <View style={StyleSheet.absoluteFill}>
          <ActivityShareCardScreen
            activityType={activityFinishStats.activityType}
            distanceMeters={activityFinishStats.distanceMeters}
            movingTimeSeconds={activityFinishStats.movingTimeSeconds}
            paceSecondsPerKm={activityFinishStats.paceSecondsPerKm}
            onDone={() => {
              setActivityFinishStats(null);
              setToast('Run saved.');
              setOverlay(null);
              setNavStack([]);
            }}
          />
        </View>
      )}

      {overlay === 'raceShareCard' && recordingRaceRsvpId && recordingRaceContext && raceFinishStats && (
        <View style={StyleSheet.absoluteFill}>
          <RaceShareCardScreen
            rsvpId={recordingRaceRsvpId}
            raceDetails={recordingRaceContext.raceDetails}
            raceTitle={recordingRaceContext.raceTitle}
            distanceMeters={raceFinishStats.distanceMeters}
            finishTimeSeconds={raceFinishStats.finishTimeSeconds}
            paceSecondsPerKm={raceFinishStats.paceSecondsPerKm}
            onDone={() => {
              setRecordingRaceRsvpId(null);
              setRecordingRaceContext(null);
              setRaceFinishStats(null);
              if (shareCardReopened) {
                setShareCardReopened(false);
                navigateBack();
              } else {
                setToast('Run saved.');
                setOverlay(null);
                setNavStack([]);
              }
            }}
          />
        </View>
      )}

      {overlay === 'clubAdmin' && selectedClubId && (
        <View style={StyleSheet.absoluteFill}>
          <ClubAdminScreen
            clubId={selectedClubId}
            onClose={() => navigateBack()}
            onDeleted={() => {
              setToast('Club deleted.');
              setSelectedClubId(null);
              setOverlay('clubs');
              setNavStack([]);
            }}
          />
        </View>
      )}

      {overlay === 'detail' && selectedRoute && (
        <View style={StyleSheet.absoluteFill}>
          <RouteDetailScreen
            route={selectedRoute}
            onClose={() => navigateBack()}
            onOpenOnMap={openOnMap}
            onDeleted={() => {
              navigateBack();
              setDiscoverRefreshSignal((n) => n + 1);
            }}
            onOpenProfile={openProfile}
            onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
            onRequirePaywall={openPaywall}
            onOpenPhotoUpload={(routeId, completionId) => {
              setPhotoUploadTarget({ routeId, completionId });
              navigateTo('photoUpload');
            }}
            onOpenPhotoViewer={(routeId, photoId) => {
              setPhotoViewTarget({ routeId, photoId });
              navigateTo('photoView');
            }}
            photoRefreshSignal={photoRefreshSignal}
            onOpenFlyby={(r) => {
              setSelectedRoute(r);
              navigateTo('flyby');
            }}
            onRecordRoute={handleRecordRoute}
          />
        </View>
      )}

      {overlay === 'flyby' && selectedRoute && (
        <View style={StyleSheet.absoluteFill}>
          <FlybyScreen route={selectedRoute} onClose={() => navigateBack()} />
        </View>
      )}

      {overlay === 'photoUpload' && photoUploadTarget && (
        <View style={StyleSheet.absoluteFill}>
          <PhotoUploadScreen
            routeId={photoUploadTarget.routeId}
            completionId={photoUploadTarget.completionId}
            onClose={() => navigateBack()}
            onUploaded={() => {
              setPhotoRefreshSignal((n) => n + 1);
              navigateBack();
              setToast('Photo added.');
            }}
          />
        </View>
      )}

      {overlay === 'photoView' && photoViewTarget && (
        <View style={StyleSheet.absoluteFill}>
          <PhotoViewerScreen
            routeId={photoViewTarget.routeId}
            initialPhotoId={photoViewTarget.photoId}
            onClose={() => navigateBack()}
            onDeleted={() => setPhotoRefreshSignal((n) => n + 1)}
          />
        </View>
      )}

      {overlay === 'groupRunDetail' && selectedGroupRunId && (
        <View style={StyleSheet.absoluteFill}>
          <GroupRunDetailScreen
            groupRunId={selectedGroupRunId}
            onClose={() => navigateBack()}
            onOpenRoute={(routeId) => openDetailById(routeId)}
            onRequirePaywall={() => openPaywall('group_run_join_limit')}
            onOpenProfile={openProfile}
            onRunRace={handleRunRace}
            onReopenShareCard={handleReopenShareCard}
            onOpenGroupRun={openGroupRunDetail}
            onAddDistanceCategory={handleAddDistanceCategory}
          />
        </View>
      )}

      {overlay === 'profile' && (
        <View style={StyleSheet.absoluteFill}>
          <ProfileScreen
            onClose={() => setOverlay(null)}
            onOpenActivity={() => setOverlay('activity')}
            onOpenMyMaps={() => setOverlay('myMaps')}
            onOpenEvents={() => setOverlay('events')}
            onOpenSettings={() => setOverlay('settings')}
            onOpenClub={(clubId) => openClubProfile(clubId)}
            onOpenCreateClub={() => navigateTo('createClub')}
          />
        </View>
      )}

      {overlay === 'settings' && (
        <View style={StyleSheet.absoluteFill}>
          <SettingsScreen onClose={() => setOverlay('profile')} onOpenBlockedUsers={() => setOverlay('blockedUsers')} />
        </View>
      )}

      {overlay === 'blockedUsers' && (
        <View style={StyleSheet.absoluteFill}>
          <BlockedUsersScreen onClose={() => setOverlay('settings')} />
        </View>
      )}

      {overlay === 'events' && session && (
        <View style={StyleSheet.absoluteFill}>
          <ProfileEventsScreen
            userId={session.user.id}
            onClose={() => setOverlay('profile')}
            onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
          />
        </View>
      )}

      {overlay === 'publicProfile' && viewedUserId && (
        <View style={StyleSheet.absoluteFill}>
          <PublicProfileScreen
            userId={viewedUserId}
            onClose={() => setOverlay(null)}
            onOpenDetail={(route) => openDetail(route)}
            onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
          />
        </View>
      )}

      {overlay === 'createEvent' && (
        <View style={StyleSheet.absoluteFill}>
          <CreateEventScreen
            onClose={() => {
              setEventClubId(null);
              setAddCategoryContext(null);
              setOverlay(null);
            }}
            onSelectRoute={handleSelectEventRoute}
            onCreateNewRoute={handleCreateNewRouteForEvent}
          />
        </View>
      )}

      <ScheduleGroupRunModal
        visible={!!eventRouteId}
        isSaving={isSchedulingEvent}
        tier={tier}
        isOfficialAccount={session?.user.id === OFFICIAL_ACCOUNT_ID}
        prefillRace={addCategoryContext?.prefillRace ?? null}
        onClose={() => {
          setEventRouteId(null);
          setAddCategoryContext(null);
        }}
        onSchedule={handleScheduleEvent}
        onRequirePaywall={() => openPaywall('group_run_limit')}
      />

      {paywallTrigger && (
        <View style={StyleSheet.absoluteFill}>
          <PaywallScreen
            trigger={paywallTrigger}
            onClose={() => setPaywallTrigger(undefined)}
            onSuccess={() => {
              setToast('Welcome to Rootah Pro.');
              setPaywallTrigger(undefined);
            }}
          />
        </View>
      )}

      <NotificationPermissionModal
        visible={notificationPrePermission.visible}
        message={notificationPrePermission.message}
        onAllow={notificationPrePermission.handleAllow}
        onDismiss={notificationPrePermission.handleDismiss}
      />
    </View>
  );
}

function Root() {
  const { session, loading, needsUsernameSetup } = useAuth();
  const [pendingRouteId, setPendingRouteId] = useState<string | null>(null);
  const [pendingGroupRunId, setPendingGroupRunId] = useState<string | null>(null);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [passwordResetDone, setPasswordResetDone] = useState(false);

  // Captured here (above the auth gate) so a link tapped while signed out
  // isn't lost — it's held until the user signs in and AuthedApp mounts.
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const runMatch = url.match(/runs\/([^/?#]+)/);
      if (runMatch) {
        setPendingGroupRunId(runMatch[1]);
        return;
      }
      const routeMatch = url.match(/routes\/([^/?#]+)/);
      if (routeMatch) {
        setPendingRouteId(routeMatch[1]);
        return;
      }
      const profileMatch = url.match(/profile\/([^/?#]+)/);
      if (profileMatch) setPendingProfileId(profileMatch[1]);
      // Sent by rootah.com/reset-password after a successful password
      // reset — the user resets on the web, then taps through back here.
      if (/login\?.*reset=success/.test(url)) setPasswordResetDone(true);
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Notification tap deep linking — covers cold start (app was closed),
  // background (tapped from the tray), and foreground (listener fires
  // immediately). Same capture-above-the-auth-gate approach as the URL
  // handler above.
  useEffect(() => {
    const handleNotificationData = (data: Record<string, unknown> | undefined) => {
      if (!data) return;
      if (data.type === 'route_liked' && typeof data.route_id === 'string') {
        setPendingRouteId(data.route_id);
      } else if (
        (data.type === 'group_run_rsvp' ||
          data.type === 'group_run_join_request' ||
          data.type === 'group_run_rsvp_decision' ||
          data.type === 'group_run_comment' ||
          data.type === 'comment_reply' ||
          data.type === 'club_new_run') &&
        typeof data.run_id === 'string'
      ) {
        setPendingGroupRunId(data.run_id);
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      handleNotificationData(response?.notification.request.content.data);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data);
    });
    return () => subscription.remove();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.rust} size="large" />
      </View>
    );
  }

  if (session && needsUsernameSetup) {
    return <UsernameSetupScreen />;
  }

  return session ? (
    <AuthedApp
      pendingRouteId={pendingRouteId}
      onConsumePendingRoute={() => setPendingRouteId(null)}
      pendingGroupRunId={pendingGroupRunId}
      onConsumePendingGroupRun={() => setPendingGroupRunId(null)}
      pendingProfileId={pendingProfileId}
      onConsumePendingProfile={() => setPendingProfileId(null)}
    />
  ) : (
    <AuthScreen passwordResetDone={passwordResetDone} onConsumePasswordResetDone={() => setPasswordResetDone(false)} />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const onLayout = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <AuthProvider>
        <Root />
      </AuthProvider>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(239,233,220,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  toastBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  toastText: {
    color: colors.sand,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
});
