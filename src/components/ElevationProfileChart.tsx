import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { colors, fonts } from '../theme/theme';
import { PathPoint } from '../types/route';
import { buildElevationProfile, ChartPoint, ElevationSegment } from '../utils/elevationProfile';

interface Props {
  path: PathPoint[];
  compact?: boolean;
  /** Omits the card's own background/border, for use inside another card (e.g. a glass overlay). */
  transparent?: boolean;
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

export default function ElevationProfileChart({ path, compact = false, transparent = false }: Props) {
  const profile = useMemo(() => buildElevationProfile(path), [path]);

  const polylines = useMemo<PolylinePiece[]>(() => {
    if (profile.points.length < 2) return [];
    const pieces: PolylinePiece[] = [];
    let segIdx = 0;

    for (let i = 1; i < profile.points.length; i++) {
      while (segIdx < profile.segments.length - 1 && profile.points[i].km > profile.segments[segIdx].endKm) {
        segIdx++;
      }
      const color = profile.segments[segIdx]?.color ?? colors.rust;
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
      <Text style={[styles.title, compact && styles.titleCompact]}>Elevation Profile</Text>

      <View style={[styles.chartRow, compact && styles.chartRowCompact]}>
        <View style={styles.yAxis}>
          {yLabels.map((v, i) => (
            <Text key={i} style={styles.axisLabel}>
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
                stroke={colors.mutedLight}
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
          </Svg>
        </View>
      </View>

      {!compact && (
        <View style={styles.xAxisRow}>
          {xLabels.map((km, i) => (
            <Text key={i} style={styles.axisLabel}>
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
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardCompact: {
    padding: 8,
    gap: 4,
    borderRadius: 12,
  },
  cardTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 14,
    padding: 14,
  },
  emptyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
  },
  titleCompact: {
    fontSize: 11,
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
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    color: colors.muted,
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
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
});
