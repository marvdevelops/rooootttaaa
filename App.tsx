import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/lib/AuthContext';
import ActivityFeedScreen from './src/screens/ActivityFeedScreen';
import AuthScreen from './src/screens/AuthScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import ClubAdminScreen from './src/screens/ClubAdminScreen';
import ClubProfileScreen from './src/screens/ClubProfileScreen';
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
import { CloudRoute } from './src/types/route';
import { countMyActiveGroupRuns, createGroupRun } from './src/utils/groupRunsApi';
import { getRoute } from './src/utils/routesApi';
import { RecurrenceInput } from './src/components/ScheduleGroupRunModal';
import { createSeries, getFirstUpcomingOccurrence } from './src/utils/recurringSeriesApi';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
  | 'clubProfile'
  | 'clubAdmin'
  | 'createClub'
  | null;

interface AuthedAppProps {
  pendingRouteId: string | null;
  onConsumePendingRoute: () => void;
  pendingGroupRunId: string | null;
  onConsumePendingGroupRun: () => void;
}

function AuthedApp({ pendingRouteId, onConsumePendingRoute, pendingGroupRunId, onConsumePendingGroupRun }: AuthedAppProps) {
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

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

  const handleTapScheduleClubRun = useCallback((clubId: string) => {
    setEventClubId(clubId);
    setOverlay('createEvent');
  }, []);

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
          });
          setEventRouteId(null);
          setEventClubId(null);
          setToast('Event created.');
          openGroupRunDetail(created.id);
        }
        notificationPrePermission.maybePrompt('Get notified when people join your event or post updates.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create event.');
      } finally {
        setIsSchedulingEvent(false);
      }
    },
    [eventRouteId, eventClubId, openGroupRunDetail, notificationPrePermission.maybePrompt],
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

  return (
    <View style={styles.container}>
      <DiscoverMapScreen
        onOpenDetail={(route) => openDetail(route)}
        onOpenProfile={() => setOverlay('profile')}
        onOpenGroupRuns={() => setOverlay('groupRuns')}
        onOpenGroupRun={(groupRunId) => openGroupRunDetail(groupRunId)}
        onOpenClubs={() => setOverlay('clubs')}
        onCreateRoute={() => setOverlay('builder')}
        onImportGpx={() => (tier === 'paid' ? setOverlay('importGpx') : openPaywall('gpx_import'))}
        onCreateEvent={handleTapCreateEvent}
        onOpenTopRoutes={(city) => {
          setTopRoutesCity(city);
          navigateTo('topRoutes');
        }}
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
          />
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
        onClose={() => setEventRouteId(null)}
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
      if (routeMatch) setPendingRouteId(routeMatch[1]);
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
    />
  ) : (
    <AuthScreen passwordResetDone={passwordResetDone} onConsumePasswordResetDone={() => setPasswordResetDone(false)} />
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ArchivoBlack_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
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
