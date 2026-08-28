import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
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
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <ShareIcon size={18} color={colors.surface} />
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
    backgroundColor: 'rgba(26,22,20,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 46,
    gap: 18,
    ...elevation('sheet'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.md,
    ...elevation('card'),
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.9,
    color: colors.stone,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 4,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...elevation('subtle'),
  },
  fileName: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  shareButton: {
    height: 52,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...elevation('primaryBtn'),
  },
  shareButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.surface,
    textAlign: 'center',
  },
});
