import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
            <BellIcon size={26} color={colors.sand} />
          </View>
          <Text style={styles.title}>Stay in the loop</Text>
          <Text style={styles.body}>{message}</Text>

          <Pressable style={styles.allowButton} onPress={onAllow}>
            <Text style={styles.allowButtonText}>ALLOW NOTIFICATIONS</Text>
          </Pressable>
          <Pressable style={styles.dismissButton} onPress={onDismiss}>
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
    backgroundColor: colors.cream,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    ...brutalShadow(5),
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.ink,
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  allowButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  allowButtonText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.sand,
  },
  dismissButton: {
    paddingVertical: 12,
  },
  dismissButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
  },
});
