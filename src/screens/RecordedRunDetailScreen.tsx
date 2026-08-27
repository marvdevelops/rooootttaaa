import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import RecordingMap from '../components/RecordingMap';
import { BackIcon, CompassIcon, ExportIcon, TrashIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ActivityType } from '../types/route';
import { formatDuration } from '../utils/completionsApi';
import { buildGpx } from '../utils/gpx';
import { deleteRecordedRun, getRecordedRun, RecordedRunDetail } from '../utils/recordingUpload';

interface Props {
  runId: string;
  onClose: () => void;
  onOpenRoute: (routeId: string) => void;
  onDeleted: () => void;
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Reopens a previously saved recording's full stats for review — the
 * activity feed used to only let you jump to the ROUTE, with no way back
 * to the run's own numbers (splits, pace, elevation) once the one-time
 * post-finish summary screen was gone. Reads from recorded_runs/run_splits
 * instead of the SQLite session (deleted on save), so this is read-only:
 * no save/discard, just review, export, and delete.
 */
export default function RecordedRunDetailScreen({ runId, onClose, onOpenRoute, onDeleted }: Props) {
  const [run, setRun] = useState<RecordedRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRecordedRun(runId)
      .then(setRun)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load this run.'))
      .finally(() => setLoading(false));
  }, [runId]);

  const handleExportGpx = useCallback(async () => {
    if (!run) return;
    setExporting(true);
    try {
      const gpx = buildGpx(run.path, `${ACTIVITY_LABEL[run.activityType]} — ${new Date(run.startedAt).toLocaleDateString()}`);
      const file = new File(Paths.cache, `rootah_${run.id}.gpx`);
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
  }, [run]);

  const handleDelete = useCallback(() => {
    if (!run) return;
    Alert.alert('Delete this run?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteRecordedRun(run.id);
            onDeleted();
          } catch (e) {
            setDeleting(false);
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete run.');
          }
        },
      },
    ]);
  }, [run, onDeleted]);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.coral} size="large" />
        </View>
      )}

      {error && (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.backButtonInline} onPress={onClose}>
            <Text style={styles.backButtonInlineText}>Go back</Text>
          </Pressable>
        </View>
      )}

      {run && (
        <>
          <View style={styles.mapWrap}>
            <RecordingMap livePath={run.path} isLive={false} />
            <Pressable style={styles.backButton} onPress={onClose}>
              <BackIcon />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{ACTIVITY_LABEL[run.activityType]}</Text>
            <Text style={styles.date}>{formatDate(run.startedAt)}</Text>

            <View style={styles.statGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{(run.distanceMeters / 1000).toFixed(2)}</Text>
                <Text style={styles.statLabel}>KM</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{formatDuration(run.movingTimeSeconds)}</Text>
                <Text style={styles.statLabel}>MOVING TIME</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>{formatPace(run.avgPaceSecondsPerKm)}</Text>
                <Text style={styles.statLabel}>/KM PACE</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statValue}>+{Math.round(run.elevationGainMeters)}m</Text>
                <Text style={styles.statLabel}>ELEVATION</Text>
              </View>
            </View>

            {run.splits.length > 0 && (
              <View style={styles.splitsCard}>
                <Text style={styles.splitsTitle}>Splits</Text>
                {run.splits.map((split) => (
                  <View key={split.kmNumber} style={styles.splitRow}>
                    <Text style={styles.splitLabel}>KM {split.kmNumber}</Text>
                    <Text style={styles.splitValue}>{formatDuration(split.splitSeconds)}</Text>
                  </View>
                ))}
              </View>
            )}

            {run.routeId && (
              <Pressable style={styles.actionButton} onPress={() => run.routeId && onOpenRoute(run.routeId)}>
                <CompassIcon size={16} color={colors.ink} />
                <Text style={styles.actionButtonText}>View route</Text>
              </Pressable>
            )}

            <Pressable style={styles.actionButton} onPress={handleExportGpx} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <ExportIcon size={16} color={colors.ink} />
                  <Text style={styles.actionButtonText}>Export GPX</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color={colors.stone} />
              ) : (
                <>
                  <TrashIcon size={16} color={colors.stone} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    textAlign: 'center',
  },
  backButtonInline: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonInlineText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.coral,
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
  date: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textAlign: 'center',
    marginTop: -8,
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  actionButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  deleteButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
});
