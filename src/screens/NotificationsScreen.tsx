import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { AppNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from '../utils/notificationsApi';

interface Props {
  onClose: () => void;
  onOpenRoute: (routeId: string) => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onOpenClub: (clubId: string) => void;
}

function relativeTime(ms: number): string {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export default function NotificationsScreen({ onClose, onOpenRoute, onOpenGroupRun, onOpenClub }: Props) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await listNotifications());
    } catch {
      // non-critical — the screen just shows an empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // best-effort — a stale unread badge isn't worth surfacing an error for
    }
  }, []);

  const handlePress = useCallback(
    async (n: AppNotification) => {
      if (!n.isRead) {
        setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        markNotificationRead(n.id).catch(() => {});
      }

      const data = n.data;
      // Mirrors the push-notification tap deep-link routing in App.tsx —
      // in-app taps should land on the same screen a push tap would.
      if (n.type === 'route_liked' && typeof data.route_id === 'string') {
        onOpenRoute(data.route_id);
      } else if (
        (n.type === 'group_run_join_request' || n.type === 'group_run_rsvp_decision' || n.type === 'club_new_run') &&
        typeof data.run_id === 'string'
      ) {
        onOpenGroupRun(data.run_id);
      } else if (n.type === 'club_join_request' && typeof data.club_id === 'string') {
        onOpenClub(data.club_id);
      }
    },
    [onOpenRoute, onOpenGroupRun, onOpenClub],
  );

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {hasUnread ? (
          <Pressable onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.coral} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={[styles.row, !item.isRead && styles.rowUnread]} onPress={() => handlePress(item)}>
              <Text style={[styles.rowBody, !item.isRead && styles.rowBodyUnread]}>{item.body}</Text>
              <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.ink,
  },
  markAllText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.coral,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
    gap: 8,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    ...elevation('subtle'),
  },
  rowUnread: {
    backgroundColor: '#FDF0EC',
  },
  rowBody: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: colors.ink,
  },
  rowBodyUnread: {
    fontFamily: fonts.bold,
  },
  rowTime: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.mist,
    marginTop: 4,
  },
});
