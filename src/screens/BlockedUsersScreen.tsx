import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BackIcon } from '../components/icons';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { BlockedUser, listBlockedUsers, unblockUser } from '../utils/blocksApi';

interface Props {
  onClose: () => void;
}

export default function BlockedUsersScreen({ onClose }: Props) {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listBlockedUsers());
    } catch {
      // non-critical — the screen just shows an empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUnblock = useCallback(async (user: BlockedUser) => {
    setUnblockingId(user.id);
    try {
      await unblockUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      // leave them in the list — user can retry
    } finally {
      setUnblockingId(null);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Blocked users</Text>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.coral} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>You haven&apos;t blocked anyone.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarPlaceholderText}>{item.username.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.username} numberOfLines={1}>
                {item.username}
              </Text>
              <Pressable
                style={styles.unblockButton}
                onPress={() => handleUnblock(item)}
                disabled={unblockingId === item.id}
              >
                {unblockingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <Text style={styles.unblockButtonText}>UNBLOCK</Text>
                )}
              </Pressable>
            </View>
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
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  loadingState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 10,
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    ...elevation('card'),
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  username: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  unblockButton: {
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 20,
    backgroundColor: colors.cream,
  },
  unblockButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
});
