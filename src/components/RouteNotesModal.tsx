import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { RouteNote } from '../types/route';
import { CloseIcon, NoteFlagIcon, PlusIcon, TrashIcon } from './icons';

interface Props {
  visible: boolean;
  notes: RouteNote[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onEditText: (id: string, text: string) => void;
  /** Closes this modal and arms "tap the map to place a note" mode. */
  onAddNote: () => void;
}

/** Standalone notes pinned anywhere along the route — independent of Waypoint geometry. */
export default function RouteNotesModal({ visible, notes, onClose, onDelete, onEditText, onAddNote }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Notes ({notes.length})</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <CloseIcon size={16} />
            </Pressable>
          </View>

          {notes.length === 0 ? (
            <Text style={styles.emptyText}>Notes like &ldquo;water stop&rdquo; or &ldquo;turn here&rdquo; show up on the map as flags.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
              {notes.map((note) => (
                <View key={note.id} style={styles.row}>
                  <View style={styles.badge}>
                    <NoteFlagIcon size={13} color={colors.surface} />
                  </View>
                  <TextInput
                    style={styles.noteInput}
                    value={note.text}
                    onChangeText={(text) => onEditText(note.id, text)}
                    placeholder="Add a note (e.g. water stop, turn here)"
                    placeholderTextColor={colors.mist}
                    maxLength={120}
                    autoFocus={!note.text}
                  />
                  <Pressable style={styles.deleteButton} onPress={() => onDelete(note.id)}>
                    <TrashIcon size={15} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <Pressable style={styles.addButton} onPress={onAddNote}>
            <PlusIcon size={16} color={colors.surface} />
            <Text style={styles.addButtonText}>Tap the map to add a note</Text>
          </Pressable>
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
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    gap: 14,
    ...elevation('sheet'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    lineHeight: 20,
  },
  scrollContent: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 10,
    ...elevation('subtle'),
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: radii.icon,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    paddingVertical: 8,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: radii.icon,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    paddingVertical: 13,
    ...elevation('primaryBtn'),
  },
  addButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.surface,
  },
});
