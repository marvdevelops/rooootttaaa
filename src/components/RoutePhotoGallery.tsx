import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { hasCompletedRoute } from '../utils/completionsApi';
import { listRoutePhotos, RoutePhoto } from '../utils/photosApi';
import { CameraIcon } from './icons';

interface Props {
  routeId: string;
  photoCount: number;
  onOpenUpload: () => void;
  onOpenPhoto: (photoId: string) => void;
  onSeeAll: () => void;
}

function timeAgo(ms: number): string {
  const diffDay = Math.floor((Date.now() - ms) / 86_400_000);
  if (diffDay <= 0) return 'today';
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay} days ago`;
  return new Date(ms).toLocaleDateString();
}

export default function RoutePhotoGallery({ routeId, photoCount, onOpenUpload, onOpenPhoto, onSeeAll }: Props) {
  const [photos, setPhotos] = useState<RoutePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [canAddPhoto, setCanAddPhoto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRoutePhotos(routeId, 4), hasCompletedRoute(routeId)])
      .then(([p, completed]) => {
        if (cancelled) return;
        setPhotos(p);
        setCanAddPhoto(completed);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  if (loading) return null;

  if (photos.length === 0) {
    if (!canAddPhoto) return null;
    return (
      <Pressable style={styles.emptyGallery} onPress={onOpenUpload}>
        <CameraIcon size={22} color={colors.muted} />
        <Text style={styles.emptyText}>Be the first to add a photo</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.gallery}>
      <View style={styles.header}>
        <Text style={styles.title}>📷 Photos ({photoCount})</Text>
        {canAddPhoto && (
          <Pressable onPress={onOpenUpload} hitSlop={8}>
            <Text style={styles.addLink}>+ Add a photo</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        {photos.slice(0, 4).map((photo) => (
          <Pressable key={photo.id} style={styles.thumbWrap} onPress={() => onOpenPhoto(photo.id)}>
            <Image source={{ uri: photo.thumbnailUrl ?? photo.imageUrl }} style={styles.thumb} />
          </Pressable>
        ))}
      </View>

      {photos[0]?.caption && (
        <Text style={styles.latestCaption} numberOfLines={1}>
          &quot;{photos[0].caption}&quot; · {timeAgo(photos[0].createdAt)}
        </Text>
      )}

      {photoCount > 4 && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all {photoCount} photos →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  addLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.rust,
  },
  grid: {
    flexDirection: 'row',
    gap: 6,
  },
  thumbWrap: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.sand,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  latestCaption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
  },
  seeAll: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.rust,
  },
  emptyGallery: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
  },
  emptyText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
  },
});
