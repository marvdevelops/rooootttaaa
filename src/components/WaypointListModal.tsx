import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { Waypoint } from '../types/route';
import { CloseIcon, TrashIcon } from './icons';

interface Props {
  visible: boolean;
  waypoints: Waypoint[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

function labelFor(index: number, count: number): string {
  if (index === 0) return 'S';
  if (index === count - 1) return 'E';
  return String(index + 1);
}

/** Pure route geometry — draws/shapes the line. For race notes, see RouteNotesModal instead. */
export default function WaypointListModal({ visible, waypoints, onClose, onDelete }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Points ({waypoints.length})</Text>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <CloseIcon size={16} />
            </Pressable>
          </View>

          {waypoints.length === 0 ? (
            <Text style={styles.emptyText}>Tap the map to start adding points.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
              {waypoints.map((wp, index) => (
                <View key={wp.id} style={styles.row}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{labelFor(index, waypoints.length)}</Text>
                  </View>
                  <Text style={styles.rowLabel}>
                    {index === 0 ? 'Start' : index === waypoints.length - 1 ? 'End' : `Point ${index + 1}`}
                  </Text>
                  <Pressable style={styles.deleteButton} onPress={() => onDelete(wp.id)}>
                    <TrashIcon size={15} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '75%',
    paddingTop: 26,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    ...elevation('sheet'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
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
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.stone,
    paddingHorizontal: 22,
    paddingBottom: 26,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 10,
    ...elevation('subtle'),
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: radii.icon,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.surface,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: radii.icon,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
