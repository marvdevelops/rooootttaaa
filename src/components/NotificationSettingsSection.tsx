import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BellIcon } from './icons';
import { getSystemPermissionStatus } from '../lib/pushNotifications';
import { colors, elevation, fonts, radii } from '../theme/theme';
import {
  getNotificationPreferences,
  NotificationPreferences,
  updateNotificationPreferences,
} from '../utils/notificationPreferencesApi';

interface Props {
  userId: string;
}

const TOGGLE_ROWS: { key: keyof NotificationPreferences; label: string; body: string }[] = [
  { key: 'likesEnabled', label: 'Likes', body: 'When someone likes your route' },
  { key: 'rsvpsEnabled', label: 'RSVPs', body: 'When someone joins your event' },
  { key: 'commentsEnabled', label: 'Comments', body: 'When someone comments on your event' },
  { key: 'repliesEnabled', label: 'Replies', body: 'When someone replies to your comment' },
];

export default function NotificationSettingsSection({ userId }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [systemDenied, setSystemDenied] = useState(false);

  useEffect(() => {
    getNotificationPreferences(userId)
      .then(setPrefs)
      .catch(() => {
        // Non-critical — the rest of the profile still works without this section.
      });
    getSystemPermissionStatus().then((status) => setSystemDenied(status === 'denied'));
  }, [userId]);

  const handleToggle = useCallback(
    (key: keyof NotificationPreferences, value: boolean) => {
      setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
      updateNotificationPreferences(userId, { [key]: value }).catch(() => {
        // Revert on failure — best-effort, no toast to keep this section lightweight.
        setPrefs((prev) => (prev ? { ...prev, [key]: !value } : prev));
      });
    },
    [userId],
  );

  if (!prefs) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>

      {systemDenied && (
        <Pressable style={styles.deniedBanner} onPress={() => Linking.openSettings()}>
          <BellIcon size={16} color={colors.ink} />
          <Text style={styles.deniedBannerText}>
            Notifications are disabled in your system settings. Tap to open Settings.
          </Text>
        </Pressable>
      )}

      <View style={styles.card}>
        {TOGGLE_ROWS.map((row, i) => (
          <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowBody}>{row.body}</Text>
            </View>
            <Switch
              value={prefs[row.key]}
              onValueChange={(value) => handleToggle(row.key, value)}
              trackColor={{ false: colors.cream, true: colors.coral }}
              thumbColor={colors.white}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.stone,
  },
  deniedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.amber,
    borderRadius: radii.sm,
    padding: 12,
  },
  deniedBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 17,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    ...elevation('card'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  rowBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
});
