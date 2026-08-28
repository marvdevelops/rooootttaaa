import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { BellIcon } from './icons';

interface Props {
  visible: boolean;
  message: string;
  onAllow: () => void;
  onDismiss: () => void;
}

/** Our own UI, shown before ever triggering the OS permission prompt — asking cold on first launch has no context and gets reflexively declined. */
export default function NotificationPermissionModal({ visible, message, onAllow, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <BellIcon size={26} color={colors.white} />
          </View>
          <Text style={styles.title}>Stay in the loop</Text>
          <Text style={styles.body}>{message}</Text>

          <Pressable style={styles.allowButton} onPress={onAllow}>
            <Text style={styles.allowButtonText}>ALLOW NOTIFICATIONS</Text>
          </Pressable>
          <Pressable style={styles.dismissButton} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.dismissButtonText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,42,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.sheetBg,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    ...elevation('sheet'),
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...elevation('subtle'),
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  allowButton: {
    width: '100%',
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...elevation('primaryBtn'),
  },
  allowButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
    lineHeight: 20,
  },
  dismissButton: {
    paddingVertical: 12,
  },
  dismissButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.stone,
  },
});
