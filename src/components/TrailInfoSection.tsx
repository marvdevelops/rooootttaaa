import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { PathPoint, TrailDifficulty, TrailInfo } from '../types/route';
import { elevationGainLossGrade } from '../utils/elevationProfile';
import { listRecentTrailPhotos, RoutePhoto } from '../utils/photosApi';
import { getTrailInfo, updateTrailCondition } from '../utils/trailInfoApi';

interface Props {
  routeId: string;
  isTrail: boolean;
  isOwnedByMe: boolean;
  elevationPath: PathPoint[];
  onOpenPhoto: (photoId: string) => void;
}

const SURFACE_LABEL: Record<string, string> = {
  paved: 'Paved',
  gravel: 'Gravel',
  dirt: 'Dirt',
  rock: 'Rock',
  mixed: 'Mixed',
};

const DIFFICULTY_CONFIG: Record<TrailDifficulty, { color: string; label: string }> = {
  easy: { color: '#22C55E', label: 'Easy' },
  moderate: { color: '#F59E0B', label: 'Moderate' },
  hard: { color: '#EF4444', label: 'Hard' },
  expert: { color: '#7C3AED', label: 'Expert' },
};

function timeAgo(ms: number): string {
  const diffDay = Math.floor((Date.now() - ms) / 86_400_000);
  if (diffDay <= 0) return 'today';
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  return new Date(ms).toLocaleDateString();
}

export default function TrailInfoSection({ routeId, isTrail, isOwnedByMe, elevationPath, onOpenPhoto }: Props) {
  const [trailInfo, setTrailInfo] = useState<TrailInfo | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<RoutePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCondition, setEditingCondition] = useState(false);
  const [conditionDraft, setConditionDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isTrail) {
      setLoading(false);
      return;
    }
    Promise.all([getTrailInfo(routeId), listRecentTrailPhotos(routeId, 2)])
      .then(([info, photos]) => {
        setTrailInfo(info);
        setRecentPhotos(photos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [routeId, isTrail]);

  const { gainM, lossM, maxGradePercent } = useMemo(() => elevationGainLossGrade(elevationPath), [elevationPath]);

  const handleStartEditCondition = () => {
    setConditionDraft(trailInfo?.conditionNote ?? '');
    setEditingCondition(true);
  };

  const handleSaveCondition = async () => {
    setSaving(true);
    try {
      await updateTrailCondition(routeId, conditionDraft.trim() || null);
      setTrailInfo((prev) =>
        prev
          ? { ...prev, conditionNote: conditionDraft.trim() || null, conditionUpdatedAt: Date.now() }
          : prev,
      );
      setEditingCondition(false);
    } catch {
      // Silent — the condition note is a nice-to-have, not worth a blocking error banner here.
    } finally {
      setSaving(false);
    }
  };

  if (!isTrail || loading) return null;

  const difficulty = trailInfo?.technicalDifficulty ? DIFFICULTY_CONFIG[trailInfo.technicalDifficulty] : null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Trail info</Text>

      {(gainM > 0 || lossM > 0) && (
        <Text style={styles.gainLoss}>
          ↑ {Math.round(gainM)}m · ↓ {Math.round(lossM)}m
          {maxGradePercent > 0 ? ` · Max grade ${Math.round(maxGradePercent)}%` : ''}
        </Text>
      )}

      {trailInfo?.surface && (
        <View style={styles.row}>
          <Text style={styles.rowText}>Surface: {SURFACE_LABEL[trailInfo.surface] ?? trailInfo.surface}</Text>
        </View>
      )}

      {difficulty && (
        <View style={[styles.diffBadge, { backgroundColor: `${difficulty.color}20`, borderColor: difficulty.color }]}>
          <Text style={[styles.diffLabel, { color: difficulty.color }]}>{difficulty.label}</Text>
        </View>
      )}

      {trailInfo && (
        <View style={styles.chips}>
          {trailInfo.hasWaterCrossing && <Chip icon="💧" label="Water crossing" />}
          {trailInfo.hasStream && <Chip icon="🏞" label="Stream nearby" />}
          {trailInfo.isShaded && <Chip icon="🌲" label="Shaded" />}
          {trailInfo.isDogFriendly && <Chip icon="🐕" label="Dog friendly" />}
          {trailInfo.requiresPermit && <Chip icon="📋" label="Permit required" />}
        </View>
      )}

      {editingCondition ? (
        <View style={styles.conditionEdit}>
          <TextInput
            value={conditionDraft}
            onChangeText={setConditionDraft}
            placeholder="e.g. Muddy after rain, stream is knee-deep in August"
            placeholderTextColor={colors.mutedLight}
            style={styles.conditionInput}
            multiline
            maxLength={200}
            autoFocus
          />
          <View style={styles.conditionEditActions}>
            <Pressable onPress={() => setEditingCondition(false)} disabled={saving} hitSlop={8}>
              <Text style={styles.conditionCancel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.conditionSaveButton} onPress={handleSaveCondition} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.sand} /> : <Text style={styles.conditionSaveText}>SAVE</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {trailInfo?.conditionNote && (
            <View style={styles.conditionNote}>
              <Text style={styles.conditionLabel}>Current conditions</Text>
              <Text style={styles.conditionText}>{trailInfo.conditionNote}</Text>
              {trailInfo.conditionUpdatedAt && (
                <Text style={styles.conditionDate}>Updated {timeAgo(trailInfo.conditionUpdatedAt)}</Text>
              )}
            </View>
          )}
          {isOwnedByMe && (
            <Pressable onPress={handleStartEditCondition} hitSlop={8}>
              <Text style={styles.updateLink}>
                {trailInfo?.conditionNote ? 'Update conditions' : '+ Add conditions'}
              </Text>
            </Pressable>
          )}

          {recentPhotos.length > 0 && (
            <View style={styles.conditionPhotos}>
              {recentPhotos.map((photo) => (
                <Pressable key={photo.id} style={styles.conditionPhotoWrap} onPress={() => onOpenPhoto(photo.id)}>
                  <Image source={{ uri: photo.thumbnailUrl ?? photo.imageUrl }} style={styles.conditionThumb} />
                  {photo.takenAt && <Text style={styles.conditionPhotoDate}>{timeAgo(photo.takenAt)}</Text>}
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>
        {icon} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    ...brutalShadow(3),
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  gainLoss: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
  },
  diffBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  diffLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.sand,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
  conditionNote: {
    backgroundColor: colors.cream,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  conditionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  conditionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  conditionDate: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.mutedLight,
    marginTop: 2,
  },
  updateLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.rust,
  },
  conditionPhotos: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  conditionPhotoWrap: {
    gap: 3,
  },
  conditionThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.sand,
  },
  conditionPhotoDate: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.mutedLight,
  },
  conditionEdit: {
    gap: 8,
  },
  conditionInput: {
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  conditionEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
  },
  conditionCancel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
  },
  conditionSaveButton: {
    backgroundColor: colors.rust,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  conditionSaveText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.sand,
  },
});
