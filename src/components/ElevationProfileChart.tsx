import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { PathPoint } from '../types/route';
import { buildElevationProfile, ChartPoint, ElevationSegment } from '../utils/elevationProfile';

interface Props {
  path: PathPoint[];
  compact?: boolean;
  /** Omits the card's own background/border, for use inside another card (e.g. a glass overlay). */
  transparent?: boolean;
  /** Distance covered so far along `path`, in km — draws a marker at the runner's current position on the profile (live recording overlay). */
  progressKm?: number;
  /** Light text/axis colors for use over a dark, translucent card (e.g. the live recording overlay). */
  onDark?: boolean;
}

const VB_WIDTH = 100;
const VB_HEIGHT = 50;
const PLOT_TOP = 4;
const PLOT_BOTTOM = 40;
const MIN_LABEL_GAP_KM_FRACTION = 0.08;

interface PolylinePiece {
  color: string;
  points: string;
}

function toChartXY(point: ChartPoint, totalKm: number, minElevation: number, maxElevation: number) {
  const x = totalKm === 0 ? 0 : (point.km / totalKm) * VB_WIDTH;
  const range = maxElevation - minElevation || 1;
  const y = PLOT_BOTTOM - ((point.elevation - minElevation) / range) * (PLOT_BOTTOM - PLOT_TOP);
  return { x, y };
}

export default function ElevationProfileChart({ path, compact = false, transparent = false, progressKm, onDark = false }: Props) {
  const profile = useMemo(() => buildElevationProfile(path), [path]);

  const progressMarker = useMemo(() => {
    if (progressKm == null || profile.totalKm === 0 || profile.points.length < 2) return null;
    const clampedKm = Math.min(Math.max(progressKm, 0), profile.totalKm);
    // Find the elevation at clampedKm by interpolating between the two bracketing points.
    let i = 1;
    while (i < profile.points.length - 1 && profile.points[i].km < clampedKm) i++;
    const a = profile.points[i - 1];
    const b = profile.points[i];
    const t = b.km === a.km ? 0 : (clampedKm - a.km) / (b.km - a.km);
    const elevationAtKm = a.elevation + (b.elevation - a.elevation) * t;
    return toChartXY({ km: clampedKm, elevation: elevationAtKm }, profile.totalKm, profile.minElevation, profile.maxElevation);
  }, [progressKm, profile]);

  const polylines = useMemo<PolylinePiece[]>(() => {
    if (profile.points.length < 2) return [];
    const pieces: PolylinePiece[] = [];
    let segIdx = 0;

    for (let i = 1; i < profile.points.length; i++) {
      while (segIdx < profile.segments.length - 1 && profile.points[i].km > profile.segments[segIdx].endKm) {
        segIdx++;
      }
      const color = profile.segments[segIdx]?.color ?? colors.coral;
      const a = toChartXY(profile.points[i - 1], profile.totalKm, profile.minElevation, profile.maxElevation);
      const b = toChartXY(profile.points[i], profile.totalKm, profile.minElevation, profile.maxElevation);

      const last = pieces[pieces.length - 1];
      if (last && last.color === color) {
        last.points += ` ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
      } else {
        pieces.push({ color, points: `${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}` });
      }
    }
    return pieces;
  }, [profile]);

  const xLabels = useMemo(() => {
    if (profile.totalKm === 0) return [];
    const boundaries = [0, ...profile.segments.map((s) => s.endKm)];
    const shown: number[] = [];
    let lastShown = -Infinity;
    for (const km of boundaries) {
      if (km - lastShown >= profile.totalKm * MIN_LABEL_GAP_KM_FRACTION || km === 0) {
        shown.push(km);
        lastShown = km;
      }
    }
    if (shown[shown.length - 1] !== profile.totalKm) shown.push(profile.totalKm);
    return shown;
  }, [profile]);

  const yLabels = useMemo(() => {
    const { minElevation, maxElevation } = profile;
    if (minElevation === maxElevation && minElevation === 0 && profile.points.length === 0) return [];
    const ticks = 4;
    return Array.from({ length: ticks }, (_, i) => Math.round(maxElevation - ((maxElevation - minElevation) * i) / (ticks - 1)));
  }, [profile]);

  if (profile.points.length < 2) {
    if (compact) return null;
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>Elevation profile will appear once your route has points.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact, transparent && styles.cardTransparent]}>
      <Text style={[styles.title, compact && styles.titleCompact, onDark && styles.titleOnDark]}>Elevation Profile</Text>

      <View style={[styles.chartRow, compact && styles.chartRowCompact]}>
        <View style={styles.yAxis}>
          {yLabels.map((v, i) => (
            <Text key={i} style={[styles.axisLabel, onDark && styles.axisLabelOnDark]}>
              {v} m
            </Text>
          ))}
        </View>

        <View style={styles.chartArea}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} preserveAspectRatio="none">
            {[0, 1, 2, 3].map((i) => (
              <Line
                key={i}
                x1={0}
                x2={VB_WIDTH}
                y1={PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) * i) / 3}
                y2={PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) * i) / 3}
                stroke={colors.mist}
                strokeWidth={0.2}
                strokeOpacity={0.4}
              />
            ))}
            {polylines.map((piece, i) => (
              <Polyline
                key={i}
                points={piece.points}
                fill="none"
                stroke={piece.color}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {progressMarker && (
              <>
                <Line
                  x1={progressMarker.x}
                  x2={progressMarker.x}
                  y1={PLOT_TOP}
                  y2={PLOT_BOTTOM}
                  stroke={onDark ? colors.white : colors.ink}
                  strokeOpacity={0.55}
                  strokeWidth={0.6}
                  strokeDasharray="1.5,1.2"
                  vectorEffect="non-scaling-stroke"
                />
                <Circle cx={progressMarker.x} cy={progressMarker.y} r={1.8} fill={colors.coral} stroke={onDark ? colors.white : colors.surface} strokeWidth={0.6} />
              </>
            )}
          </Svg>
        </View>
      </View>

      {!compact && (
        <View style={styles.xAxisRow}>
          {xLabels.map((km, i) => (
            <Text key={i} style={[styles.axisLabel, onDark && styles.axisLabelOnDark]}>
              {km.toFixed(1)} km
            </Text>
          ))}
        </View>
      )}

      <View style={[styles.segmentBar, compact && styles.segmentBarCompact]}>
        {profile.segments.map((segment: ElevationSegment, i) => {
          const widthPct = ((segment.endKm - segment.startKm) / profile.totalKm) * 100;
          const showLabel = !compact && widthPct > 14;
          return (
            <View key={i} style={[styles.segmentChip, { flexGrow: widthPct, backgroundColor: segment.color }]}>
              {showLabel && (
                <Text style={styles.segmentText} numberOfLines={1}>
                  {segment.gainM >= 1 ? `↗${Math.round(segment.gainM)}m ` : ''}
                  {segment.lossM >= 1 ? `↘${Math.round(segment.lossM)}m` : ''}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    gap: 8,
    ...elevation('card'),
  },
  cardCompact: {
    padding: 8,
    gap: 4,
    borderRadius: radii.sm,
  },
  cardTransparent: {
    backgroundColor: 'transparent',
    padding: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    ...elevation('card'),
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  titleCompact: {
    fontSize: 11,
  },
  titleOnDark: {
    color: colors.white,
  },
  chartRow: {
    flexDirection: 'row',
    height: 110,
  },
  chartRowCompact: {
    height: 44,
  },
  yAxis: {
    justifyContent: 'space-between',
    paddingRight: 6,
    paddingVertical: 4,
  },
  chartArea: {
    flex: 1,
  },
  axisLabel: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.stone,
  },
  axisLabelOnDark: {
    color: 'rgba(255,255,255,0.6)',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segmentBar: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    height: 30,
  },
  segmentBarCompact: {
    height: 10,
    borderRadius: 5,
  },
  segmentChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 2,
  },
  segmentText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
  },
});
