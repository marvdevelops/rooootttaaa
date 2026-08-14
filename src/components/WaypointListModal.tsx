import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { Waypoint } from '../types/route';
import { CloseIcon, TrashIcon } from './icons';

interface Props {
  visible: boolean;
  waypoints: Waypoint[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onEditNote: (id: string, note: string) => void;
}

function labelFor(index: number, count: number): string {
  if (index === 0) return 'S';
  if (index === count - 1) return 'E';
  return String(index + 1);
}

export default function WaypointListModal({ visible, waypoints, onClose, onDelete, onEditNote }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Points ({waypoints.length})</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
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
                  <TextInput
                    style={styles.noteInput}
                    value={wp.note ?? ''}
                    onChangeText={(text) => onEditNote(wp.id, text)}
                    placeholder="Add a note (e.g. water stop, turn here)"
                    placeholderTextColor={colors.mutedLight}
                    maxLength={120}
                  />
                  <Pressable style={styles.deleteButton} onPress={() => onDelete(wp.id)}>
                    <TrashIcon size={15} color={colors.rustDark} />
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
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingTop: 26,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
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
  emptyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
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
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 8,
    ...brutalShadow(2),
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.ink,
  },
  noteInput: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    paddingVertical: 4,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
