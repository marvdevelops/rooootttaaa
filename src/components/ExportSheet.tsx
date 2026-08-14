import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { CloseIcon, FileIcon, ShareIcon } from './icons';

interface Props {
  visible: boolean;
  distanceKm: number;
  elevationGainM: number;
  pointCount: number;
  fileName: string;
  isSharing: boolean;
  onClose: () => void;
  onShare: () => void;
}

export default function ExportSheet({
  visible,
  distanceKm,
  elevationGainM,
  pointCount,
  fileName,
  isSharing,
  onClose,
  onShare,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Route ready</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <CloseIcon size={16} />
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>DISTANCE</Text>
              <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>ELEVATION</Text>
              <Text style={styles.statValue}>+{Math.round(elevationGainM)} m</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>POINTS</Text>
              <Text style={styles.statValue}>{pointCount}</Text>
            </View>
          </View>

          <View style={styles.fileRow}>
            <FileIcon size={18} />
            <Text style={styles.fileName}>{fileName}</Text>
          </View>

          <Pressable style={styles.shareButton} onPress={onShare} disabled={isSharing}>
            {isSharing ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <ShareIcon size={18} />
                <Text style={styles.shareButtonText}>SHARE TO GARMIN / COROS</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 46,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 10,
  },
  statLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.muted,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
    marginTop: 2,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  fileName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  shareButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.aqua,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...brutalShadow(4),
  },
  shareButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
});
