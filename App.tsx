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
import CreateEventScreen from './src/screens/CreateEventScreen';
import DiscoverMapScreen from './src/screens/DiscoverMapScreen';
import GroupRunDetailScreen from './src/screens/GroupRunDetailScreen';
import GroupRunsScreen from './src/screens/GroupRunsScreen';
import ImportGpxScreen from './src/screens/ImportGpxScreen';
import MapScreen from './src/screens/MapScreen';
import MyMapsScreen from './src/screens/MyMapsScreen';
import PaywallScreen, { PaywallTrigger } from './src/screens/PaywallScreen';
import ProfileEventsScreen from './src/screens/ProfileEventsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import RouteDetailScreen from './src/screens/RouteDetailScreen';
import UsernameSetupScreen from './src/screens/UsernameSetupScreen';
import NotificationPermissionModal from './src/components/NotificationPermissionModal';
import ScheduleGroupRunModal from './src/components/ScheduleGroupRunModal';
import { useNotificationPrePermission } from './src/hooks/useNotificationPrePermission';
import { useUserTier } from './src/hooks/useUserTier';
import { colors, fonts } from './src/theme/theme';
import { CloudRoute } from './src/types/route';
import { countMyActiveGroupRuns, createGroupRun } from './src/utils/groupRunsApi';
import { getRoute } from './src/utils/routesApi';

SplashScreen.preventAutoHideAsync().catch(() => {});

type Overlay =
  | 'builder'
  | 'myMaps'
  | 'detail'
  | 'profile'
  | 'publicProfile'
  | 'activity'
  | 'groupRuns'
  | 'groupRunDetail'
  | 'blockedUsers'
  | 'importGpx'
  | 'events'
  | 'createEvent'
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
  const [isSchedulingEvent, setIsSchedulingEvent] = useState(false);
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

  const handleCreateNewRouteForEvent = useCallback(() => {
    setCreatingEventForNewRoute(true);
    setRouteToLoad(null);
    setOverlay('builder');
  }, []);

  const handleScheduleEvent = useCallback(
    async (title: string, description: string, scheduledAt: Date, maxParticipants: number | null) => {
      if (!eventRouteId) return;
      setIsSchedulingEvent(true);
      try {
        const created = await createGroupRun({ routeId: eventRouteId, title, description, scheduledAt, maxParticipants });
        setEventRouteId(null);
        setToast('Event created.');
        openGroupRunDetail(created.id);
        notificationPrePermission.maybePrompt('Get notified when people join your event or post updates.');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create event.');
      } finally {
        setIsSchedulingEvent(false);
      }
    },
    [eventRouteId, openGroupRunDetail, notificationPrePermission.maybePrompt],
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
            onOpenDetail={(route) => openDetail(route)}
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
            onOpenBlockedUsers={() => setOverlay('blockedUsers')}
            onOpenEvents={() => setOverlay('events')}
          />
        </View>
      )}

      {overlay === 'blockedUsers' && (
        <View style={StyleSheet.absoluteFill}>
          <BlockedUsersScreen onClose={() => setOverlay('profile')} />
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
            onClose={() => setOverlay(null)}
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
          data.type === 'comment_reply') &&
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
