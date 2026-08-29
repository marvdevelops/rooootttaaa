import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { CheckIcon, CloseIcon, RunnerIcon, ShareIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ActivityType, CloudRoute, LatLng } from '../types/route';
import { haversineDistance } from '../utils/distance';
import { findNearbyRoutes } from '../utils/routesApi';
import { endLiveSession, liveTrackingUrl, startLiveSession, updateLiveSessionMeta } from '../utils/liveTrackingApi';
import { useAuth } from '../lib/AuthContext';

/** A live session opened before the run starts, handed to the recording flow so it broadcasts from the first GPS fix. */
export interface PreStartLiveSession {
  id: string;
  shareToken: string;
}

interface Props {
  initialActivityType?: ActivityType;
  onCancel: () => void;
  onStartFree: (activityType: ActivityType, liveSession: PreStartLiveSession | null) => void;
  onStartWithRoute: (activityType: ActivityType, route: CloudRoute, liveSession: PreStartLiveSession | null) => void;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail run' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Ride' },
  { value: 'walk', label: 'Walk' },
];

// A route is only offered as "follow this" if its start point is this close to
// where you're standing — i.e. you're actually at the trailhead, not just in
// the same part of town. Loose enough to survive normal GPS jitter and a
// start pin that was dropped a few metres off.
const NEAR_ROUTE_METERS = 60;

// Which route activity types are worth following for a given activity. Anything
// on foot is interchangeable here — a walk route is fine to run, a trail route
// is fine to hike — so they all surface together. Rides only match ride routes.
const ON_FOOT: ActivityType[] = ['run', 'trail_run', 'hike', 'walk', 'other'];
function followableRouteTypes(activity: ActivityType): ActivityType[] {
  return activity === 'bike' ? ['bike'] : ON_FOOT;
}

function formatAway(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export default function StartActivityScreen({
  initialActivityType = 'run',
  onCancel,
  onStartFree,
  onStartWithRoute,
}: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activityType, setActivityType] = useState<ActivityType>(initialActivityType);
  // null = "free run, no route"
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<CloudRoute[]>([]);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  // Non-null once the runner opts into sharing their location before starting.
  const [liveSession, setLiveSession] = useState<PreStartLiveSession | null>(null);
  const [busyLive, setBusyLive] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const routes = await findNearbyRoutes(here, followableRouteTypes(activityType), NEAR_ROUTE_METERS, 5);
        if (!cancelled) {
          setOrigin(here);
          setNearby(routes);
        }
      } catch {
        // Best-effort — an empty list just means "no route to follow", which is fine.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityType]);

  const selectedRoute = useMemo(
    () => nearby.find((r) => r.id === selectedRouteId) ?? null,
    [nearby, selectedRouteId],
  );

  const startLabel = selectedRoute ? `Follow ${selectedRoute.name}` : 'Start free run';
  const liveUrl = liveSession ? liveTrackingUrl(liveSession.shareToken, profile?.username) : null;

  // Keep an already-issued session's activity type / route in sync if the
  // runner changes their mind before starting — same token, so a link they've
  // already sent keeps working.
  useEffect(() => {
    if (!liveSession) return;
    updateLiveSessionMeta(liveSession.id, activityType, selectedRouteId).catch(() => {});
  }, [liveSession, activityType, selectedRouteId]);

  // If they back out without starting, don't leave an orphaned live session.
  useEffect(() => {
    return () => {
      if (liveSession && !startedRef.current) endLiveSession(liveSession.id).catch(() => {});
    };
  }, [liveSession]);

  const handleToggleLive = () => {
    if (busyLive) return;
    if (liveSession) {
      const id = liveSession.id;
      setLiveSession(null);
      endLiveSession(id).catch(() => {});
      return;
    }
    Alert.alert(
      'Share your live location?',
      'Anyone with the link can see where you are, your pace, and your distance until you stop sharing or it expires in 12 hours. Share it now so people can follow from the start.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Get link',
          onPress: async () => {
            setBusyLive(true);
            try {
              const s = await startLiveSession(activityType, selectedRouteId);
              setLiveSession({ id: s.id, shareToken: s.shareToken });
            } catch (e) {
              Alert.alert('Could not start sharing', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setBusyLive(false);
            }
          },
        },
      ],
    );
  };

  const handleSendLink = () => {
    if (!liveUrl) return;
    Share.share({ message: `Follow me live on Rootah: ${liveUrl}`, url: liveUrl }).catch(() => {});
  };

  const handleStart = () => {
    startedRef.current = true;
    if (selectedRoute) onStartWithRoute(activityType, selectedRoute, liveSession);
    else onStartFree(activityType, liveSession);
  };

  const awayLabel = (route: CloudRoute): string | null => {
    const start = route.waypoints[0];
    if (!origin || !start) return null;
    return formatAway(
      haversineDistance(origin, { latitude: start.latitude, longitude: start.longitude }) / 1000,
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <CloseIcon size={16} />
        </Pressable>
        <Text style={styles.title}>Start an activity</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pillRow}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const active = opt.value === activityType;
            return (
              <Pressable
                key={opt.value}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setActivityType(opt.value)}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>
          Follow a route <Text style={styles.sectionLabelHint}>starting here (optional)</Text>
        </Text>

        <Pressable
          style={[styles.routeCard, selectedRouteId === null && styles.routeCardSelected]}
          onPress={() => setSelectedRouteId(null)}
          accessibilityRole="button"
          accessibilityLabel="Free run, no route"
          accessibilityState={{ selected: selectedRouteId === null }}
        >
          <View style={styles.freeIcon}>
            <RunnerIcon size={18} color={colors.coral} />
          </View>
          <View style={styles.routeCardBody}>
            <Text style={styles.routeName}>Free run &mdash; no route</Text>
            <Text style={styles.routeMeta}>Just track distance, pace, and your map</Text>
          </View>
          <Radio selected={selectedRouteId === null} />
        </Pressable>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.coral} />
            <Text style={styles.loadingText}>Looking for routes near you&hellip;</Text>
          </View>
        ) : nearby.length === 0 ? (
          <Text style={styles.emptyText}>No route starts right where you are. Head to a trailhead, or go free.</Text>
        ) : (
          nearby.map((route) => {
            const selected = route.id === selectedRouteId;
            const away = awayLabel(route);
            return (
              <Pressable
                key={route.id}
                style={[styles.routeCard, selected && styles.routeCardSelected]}
                onPress={() => setSelectedRouteId(route.id)}
                accessibilityRole="button"
                accessibilityLabel={`${route.name}, ${route.distanceKm.toFixed(1)} kilometres${away ? `, ${away}` : ''}`}
                accessibilityState={{ selected }}
              >
                <View style={styles.distanceChip}>
                  <Text style={styles.distanceChipValue}>{route.distanceKm.toFixed(1)}</Text>
                  <Text style={styles.distanceChipUnit}>km</Text>
                </View>
                <View style={styles.routeCardBody}>
                  <Text style={styles.routeName} numberOfLines={1}>
                    {route.name}
                  </Text>
                  <Text style={styles.routeMeta} numberOfLines={1}>
                    +{Math.round(route.elevationGainM)} m
                    {away ? ` · ${away}` : ''}
                    {route.ownerUsername !== 'unknown' ? ` · by @${route.ownerUsername}` : ''}
                  </Text>
                </View>
                <Radio selected={selected} />
              </Pressable>
            );
          })
        )}

        <Text style={styles.sectionLabel}>Live location</Text>
        <Pressable
          style={[styles.liveRow, liveSession && styles.liveRowActive]}
          onPress={handleToggleLive}
          accessibilityRole="switch"
          accessibilityLabel="Share my live location"
          accessibilityState={{ checked: !!liveSession }}
        >
          <View style={styles.routeCardBody}>
            <Text style={styles.routeName}>Share my live location</Text>
            <Text style={styles.routeMeta}>
              {liveSession ? 'On — anyone with the link can follow you' : 'Off — get a link to send before you start'}
            </Text>
          </View>
          {busyLive ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <View style={[styles.switchTrack, liveSession && styles.switchTrackOn]}>
              <View style={[styles.switchKnob, liveSession && styles.switchKnobOn]} />
            </View>
          )}
        </Pressable>

        {liveSession && (
          <Pressable style={styles.sendLinkButton} onPress={handleSendLink} accessibilityRole="button" accessibilityLabel="Send live tracking link">
            <ShareIcon size={15} color={colors.white} />
            <Text style={styles.sendLinkText}>Send link</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.startButton}
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel={startLabel}
        >
          <Text style={styles.startButtonText} numberOfLines={1}>
            {startLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected && <CheckIcon size={12} color={colors.white} />}
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  pillActive: {
    backgroundColor: colors.coral,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  pillTextActive: {
    color: colors.white,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.stone,
    marginTop: spacing.sm,
  },
  sectionLabelHint: {
    textTransform: 'none',
    letterSpacing: 0,
    color: colors.mist,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    ...elevation('subtle'),
  },
  routeCardSelected: {
    borderColor: colors.coral,
  },
  routeCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  routeName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  routeMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  freeIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceChip: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceChipValue: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 15,
  },
  distanceChipUnit: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.stone,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.coral,
    backgroundColor: colors.coral,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    paddingVertical: spacing.sm,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    ...elevation('subtle'),
  },
  liveRowActive: {
    borderColor: colors.coral,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.mist,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: colors.coral,
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  sendLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    ...elevation('primaryBtn'),
  },
  sendLinkText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  startButton: {
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    ...elevation('primaryBtn'),
  },
  startButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
});
