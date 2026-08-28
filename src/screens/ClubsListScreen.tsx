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
import { BackIcon, LockIcon, PlusIcon, UsersIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { RunClub } from '../types/club';
import { listNearbyClubs } from '../utils/clubsApi';

interface Props {
  userCity: string | null;
  onClose: () => void;
  onOpenClub: (clubId: string) => void;
  onCreateClub: () => void;
}

export default function ClubsListScreen({ userCity, onClose, onOpenClub, onCreateClub }: Props) {
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let results = await listNearbyClubs(userCity);
      if (results.length === 0 && userCity) {
        // Fall back to all PH clubs if none in the user's specific city.
        results = await listNearbyClubs(null);
      }
      setClubs(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clubs.');
    } finally {
      setLoading(false);
    }
  }, [userCity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Run Clubs</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      ) : (
        <FlatList
          data={clubs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          ListHeaderComponent={
            <Pressable style={styles.createCard} onPress={onCreateClub}>
              <View style={styles.createIcon}>
                <PlusIcon size={20} color={colors.white} />
              </View>
              <View style={styles.createTextWrap}>
                <Text style={styles.createTitle}>Create a club</Text>
                <Text style={styles.createBody}>Bring your whole running group onto Rootah.</Text>
              </View>
            </Pressable>
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No clubs yet</Text>
                <Text style={styles.emptyBody}>Be the first to start one in your area.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpenClub(item.id)}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <UsersIcon size={22} color={colors.stone} />
                </View>
              )}
              <View style={styles.cardTextWrap}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.isPrivate && <LockIcon size={12} color={colors.stone} />}
                </View>
                {item.city && <Text style={styles.cardMeta}>📍 {item.city}</Text>}
                {item.memberCount > 1 && (
                  <Text style={styles.cardMeta}>
                    👥 {item.memberCount} members
                  </Text>
                )}
              </View>
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
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  errorBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: 10,
  },
  errorText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.coral,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.base,
    ...elevation('card'),
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTextWrap: {
    flex: 1,
    gap: 2,
  },
  createTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.white,
  },
  createBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
    lineHeight: 16,
  },
  emptyState: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.base,
    ...elevation('card'),
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sheetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
    gap: 2,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  cardMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
  },
});
