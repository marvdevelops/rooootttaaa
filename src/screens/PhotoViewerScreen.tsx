import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import ReportModal from '../components/ReportModal';
import { BackIcon, TrashIcon, UserIcon } from '../components/icons';
import { colors, fonts } from '../theme/theme';
import { deleteRoutePhoto, listRoutePhotos, RoutePhoto } from '../utils/photosApi';
import { createReport, ReportReason } from '../utils/reportsApi';

interface Props {
  routeId: string;
  initialPhotoId: string;
  onClose: () => void;
  onDeleted: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PhotoViewerScreen({ routeId, initialPhotoId, onClose, onDeleted }: Props) {
  const [photos, setPhotos] = useState<RoutePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingPhotoId, setReportingPhotoId] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const listRef = useRef<FlatList<RoutePhoto>>(null);

  useEffect(() => {
    listRoutePhotos(routeId)
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [routeId]);

  const initialIndex = useMemo(() => {
    const idx = photos.findIndex((p) => p.id === initialPhotoId);
    return idx >= 0 ? idx : 0;
  }, [photos, initialPhotoId]);

  const handleDelete = (photo: RoutePhoto) => {
    Alert.alert('Delete photo', 'This removes it for everyone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRoutePhoto(photo.id, photo.storagePath, photo.thumbnailPath);
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
            onDeleted();
            if (photos.length <= 1) onClose();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete photo.');
          }
        },
      },
    ]);
  };

  const handleReport = (photoId: string) => {
    setReportingPhotoId(photoId);
    setShowReportModal(true);
  };

  const submitReport = async (reason: ReportReason, details: string) => {
    if (!reportingPhotoId) return;
    setIsReporting(true);
    try {
      await createReport('route_photo', reportingPhotoId, reason, details);
      setShowReportModal(false);
      Alert.alert('Reported', 'Thanks for flagging this — our team will take a look.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit report.');
    } finally {
      setIsReporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.sand} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={photos}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="contain" />
            <View style={styles.overlay}>
              <View style={styles.userRow}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <UserIcon size={14} color={colors.sand} />
                  </View>
                )}
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.date}>{formatDate(item.takenAt ?? item.createdAt)}</Text>
              </View>
              {!!item.caption && <Text style={styles.caption}>{item.caption}</Text>}

              <View style={styles.actions}>
                {item.isOwnedByMe ? (
                  <Pressable style={styles.actionButton} onPress={() => handleDelete(item)} hitSlop={8}>
                    <TrashIcon size={16} color={colors.sand} />
                    <Text style={styles.actionText}>Delete</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.actionButton} onPress={() => handleReport(item.id)} hitSlop={8}>
                    <Text style={styles.actionText}>Report</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      />

      <Pressable style={styles.closeButton} onPress={onClose}>
        <BackIcon color={colors.sand} />
      </Pressable>

      <ReportModal
        visible={showReportModal}
        isSubmitting={isReporting}
        onClose={() => setShowReportModal(false)}
        onSubmit={submitReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '75%',
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    gap: 6,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
  },
  avatarPlaceholder: {
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.sand,
  },
  date: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.mutedLight,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.sand,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.sand,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
