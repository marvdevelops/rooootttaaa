import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import RecordingMap from '../components/RecordingMap';
import { BackIcon, ExportIcon, TrashIcon } from '../components/icons';
import { deleteSession, getSessionPoints } from '../lib/recordingDb';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ActivityType } from '../types/route';
import { formatDuration } from '../utils/completionsApi';
import { buildGpx } from '../utils/gpx';
import { correctAndroidElevation, RecordedRunSummary, summarizeSession, uploadRecording } from '../utils/recordingUpload';
import { finishRaceRun } from '../utils/racesApi';

interface Props {
  sessionId: string;
  activityType: ActivityType;
  routeId: string | null;
  startedAt: number;
  /** Set when this recording was a race run — links the finish back to the race's RSVP row (finish time, recorded_run_id) once the upload succeeds. */
  raceRsvpId?: string;
  /** Called instead of onDone when a race run finishes saving — hands off to the share-card screen with the stats it needs. */
  onRaceFinished?: (distanceMeters: number, finishTimeSeconds: number, paceSecondsPerKm: number | null) => void;
  /** Called instead of onDone when a normal (non-race) activity finishes saving — hands off to the generic selfie share-card screen. */
  onActivityFinished?: (distanceMeters: number, movingTimeSeconds: number, paceSecondsPerKm: number | null) => void;
  onDone: () => void;
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Activity',
};

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RecordingSummaryScreen({ sessionId, activityType, routeId, startedAt, raceRsvpId, onRaceFinished, onActivityFinished, onDone }: Props) {
  const [summary, setSummary] = useState<RecordedRunSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refiningElevation, setRefiningElevation] = useState(false);

  useEffect(() => {
    const initial = summarizeSession(sessionId);
    setSummary(initial);

    // Android's GPS altitude is unreliable — re-fetch corrected elevation in
    // the background and merge it in once ready. No-ops on iOS.
    setRefiningElevation(true);
    correctAndroidElevation(sessionId)
      .then((corrected) => {
        if (corrected) setSummary((s) => (s ? { ...s, elevationGainMeters: corrected.elevationGainMeters, elevationLossMeters: corrected.elevationLossMeters } : s));
      })
      .finally(() => setRefiningElevation(false));
  }, [sessionId]);

  const handleSave = useCallback(async () => {
    if (!summary) return;
    setSaving(true);
    try {
      const { recordedRunId } = await uploadRecording(summary, activityType, routeId, startedAt);
      if (raceRsvpId) {
        // Non-fatal — the run itself is already saved; a failed race link
        // just means the finish screen/share card won't have this run's
        // stats attached, not worth blocking the save over.
        await finishRaceRun(raceRsvpId, summary.movingTimeSeconds, recordedRunId).catch(() => {});
      }
      deleteSession(sessionId); // raw points only needed until a successful upload
      if (raceRsvpId && onRaceFinished) {
        onRaceFinished(summary.distanceMeters, summary.movingTimeSeconds, summary.avgPaceSecondsPerKm);
      } else if (onActivityFinished) {
        onActivityFinished(summary.distanceMeters, summary.movingTimeSeconds, summary.avgPaceSecondsPerKm);
      } else {
        onDone();
      }
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Something went wrong. Your run is still saved on this device — try again.');
    } finally {
      setSaving(false);
    }
  }, [summary, activityType, routeId, startedAt, raceRsvpId, onRaceFinished, onActivityFinished, sessionId, onDone]);

  const handleExportGpx = useCallback(async () => {
    setExporting(true);
    try {
      // Full-resolution SQLite log, not the downsampled summary.path used for map display.
      const points = getSessionPoints(sessionId, false);
      const gpx = buildGpx(
        points.map((p) => ({ latitude: p.lat, longitude: p.lng, elevation: p.altitude ?? undefined })),
        `${ACTIVITY_LABEL[activityType]} — ${new Date(startedAt).toLocaleDateString()}`,
      );
      const file = new File(Paths.cache, `rootah_${sessionId}.gpx`);
      file.create({ overwrite: true });
      file.write(gpx);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx' });
      } else {
        Alert.alert('Sharing unavailable', `Run saved to ${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to export GPX.');
    } finally {
      setExporting(false);
    }
  }, [sessionId, activityType, startedAt]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard this run?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          setDiscarding(true);
          deleteSession(sessionId);
          onDone();
        },
      },
    ]);
  }, [sessionId, onDone]);

  if (!summary) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.coral} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <RecordingMap livePath={summary.path} isLive={false} />
        <Pressable style={styles.backButton} onPress={handleDiscard} disabled={saving || discarding}>
          <BackIcon />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{ACTIVITY_LABEL[activityType]} complete</Text>

        <View style={styles.statGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{(summary.distanceMeters / 1000).toFixed(2)}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{formatDuration(summary.movingTimeSeconds)}</Text>
            <Text style={styles.statLabel}>MOVING TIME</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{formatPace(summary.avgPaceSecondsPerKm)}</Text>
            <Text style={styles.statLabel}>/KM PACE</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>+{summary.elevationGainMeters}m</Text>
            <Text style={styles.statLabel}>ELEVATION</Text>
          </View>
        </View>

        {refiningElevation && (
          <View style={styles.refiningRow}>
            <ActivityIndicator size="small" color={colors.stone} />
            <Text style={styles.refiningText}>Refining elevation data…</Text>
          </View>
        )}

        {summary.splits.length > 0 && (
          <View style={styles.splitsCard}>
            <Text style={styles.splitsTitle}>Splits</Text>
            {summary.splits.map((split) => (
              <View key={split.kmNumber} style={styles.splitRow}>
                <Text style={styles.splitLabel}>KM {split.kmNumber}</Text>
                <Text style={styles.splitValue}>{formatDuration(split.splitSeconds)}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving || discarding}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>SAVE RUN</Text>}
        </Pressable>

        <Pressable style={styles.exportButton} onPress={handleExportGpx} disabled={exporting || saving || discarding}>
          {exporting ? <ActivityIndicator color={colors.ink} /> : (
            <>
              <ExportIcon size={16} color={colors.ink} />
              <Text style={styles.exportButtonText}>Export GPX</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.discardButton} onPress={handleDiscard} disabled={saving || discarding}>
          <TrashIcon size={16} color={colors.stone} />
          <Text style={styles.discardButtonText}>Discard</Text>
        </Pressable>
      </ScrollView>
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
  mapWrap: {
    height: 260,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  content: {
    padding: spacing.lg,
    gap: 16,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    alignItems: 'center',
    ...elevation('subtle'),
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.stone,
    marginTop: 4,
  },
  refiningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refiningText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.stone,
  },
  splitsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    ...elevation('subtle'),
  },
  splitsTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 10,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  splitLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  splitValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  saveButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  exportButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  discardButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
});
