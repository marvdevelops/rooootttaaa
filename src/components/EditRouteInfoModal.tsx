import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { CloseIcon } from './icons';

interface Props {
  visible: boolean;
  initialName: string;
  initialDescription: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

/** Lightweight name/description editor for the route owner — no re-routing, geometry, or activity-type changes (that's the full builder edit flow). */
export default function EditRouteInfoModal({ visible, initialName, initialDescription, isSaving, onClose, onSave }: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  const canSave = name.trim().length > 0 && !isSaving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit route info</Text>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <CloseIcon size={16} />
            </Pressable>
          </View>

          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Route name"
            placeholderTextColor={colors.mist}
            maxLength={80}
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description (optional)"
            placeholderTextColor={colors.mist}
            multiline
            maxLength={500}
          />

          <Pressable
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={() => canSave && onSave(name.trim(), description.trim())}
            disabled={!canSave}
          >
            {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>SAVE CHANGES</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,22,20,0.5)',
  },
  sheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    ...elevation('sheet'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.stone,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    marginTop: 6,
    ...elevation('subtle'),
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    ...elevation('primaryBtn'),
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
    letterSpacing: 0.3,
  },
});
