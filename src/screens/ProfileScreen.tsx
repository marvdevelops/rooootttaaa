import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BadgeStrip from '../components/BadgeStrip';
import { BackIcon, CalendarIcon, ClockIcon, CompassIcon, GearIcon, PlusIcon } from '../components/icons';
import ProBadge from '../components/ProBadge';
import { useAuth } from '../lib/AuthContext';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { RunClub } from '../types/club';
import { listMyClubs } from '../utils/clubsApi';

interface Props {
  onClose: () => void;
  onOpenActivity: () => void;
  onOpenMyMaps: () => void;
  onOpenEvents: () => void;
  onOpenSettings: () => void;
  onOpenClub: (clubId: string) => void;
  onOpenCreateClub: () => void;
  onOpenPaywall: () => void;
}

export default function ProfileScreen({
  onClose,
  onOpenActivity,
  onOpenMyMaps,
  onOpenEvents,
  onOpenSettings,
  onOpenClub,
  onOpenCreateClub,
  onOpenPaywall,
}: Props) {
  const { profile, tier } = useAuth();
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMyClubs()
      .then((c) => {
        if (!cancelled) setClubs(c);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingClubs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <Pressable style={styles.backButton} onPress={onOpenSettings}>
          <GearIcon size={18} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.contentInner}>
        <View style={styles.identityRow}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {(profile?.username ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.identityText}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>@{profile?.username ?? 'runner'}</Text>
              {tier === 'paid' && <ProBadge />}
            </View>
            {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>
        </View>

        <Pressable style={styles.proCard} onPress={onOpenPaywall}>
          <View style={styles.proCardText}>
            <Text style={styles.proCardTitle}>{tier === 'paid' ? 'Rootah Pro' : 'Go Rootah Pro'}</Text>
            <Text style={styles.proCardSubtitle}>
              {tier === 'paid' ? 'Manage your plan or restore a purchase' : 'Unlimited routes, group runs, and more'}
            </Text>
          </View>
          <Text style={styles.proCardArrow}>→</Text>
        </Pressable>

        {profile && <BadgeStrip userId={profile.id} />}

        <View style={styles.navGrid}>
          <Pressable style={styles.navButton} onPress={onOpenMyMaps}>
            <View style={[styles.navIconBadge, styles.navIconBadgeTeal]}>
              <CompassIcon size={26} color={colors.white} />
            </View>
            <Text style={styles.navButtonText}>ROUTES</Text>
          </Pressable>

          <Pressable style={styles.navButton} onPress={onOpenActivity}>
            <View style={[styles.navIconBadge, styles.navIconBadgeAmber]}>
              <ClockIcon size={26} color={colors.white} />
            </View>
            <Text style={styles.navButtonText}>ACTIVITY</Text>
          </Pressable>

          <Pressable style={styles.navButton} onPress={onOpenEvents}>
            <View style={[styles.navIconBadge, styles.navIconBadgeCoral]}>
              <CalendarIcon size={26} color={colors.white} />
            </View>
            <Text style={styles.navButtonText}>EVENTS</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeader}>MY CLUBS</Text>

        {loadingClubs ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 8 }} />
        ) : (
          <View style={styles.clubsRow}>
            {clubs.map((club) => (
              <Pressable key={club.id} style={styles.clubChip} onPress={() => onOpenClub(club.id)}>
                {club.avatarUrl ? (
                  <Image source={{ uri: club.avatarUrl }} style={styles.clubAvatar} />
                ) : (
                  <View style={[styles.clubAvatar, styles.clubAvatarPlaceholder]}>
                    <Text style={styles.clubAvatarPlaceholderText}>{club.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.clubChipText} numberOfLines={1}>
                  {club.name}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.createClubChip} onPress={onOpenCreateClub}>
              <PlusIcon size={16} color={colors.ink} />
              <Text style={styles.clubChipText}>Create a club</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
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
  contentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: 18,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
  },
  avatarPlaceholder: {
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: colors.white,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  bio: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.base,
    ...elevation('card'),
  },
  proCardText: {
    gap: 2,
  },
  proCardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.white,
  },
  proCardSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  proCardArrow: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.coral,
  },
  navGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  navButton: {
    flex: 1,
    height: 100,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...elevation('card'),
  },
  navIconBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.icon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBadgeTeal: {
    backgroundColor: colors.teal,
  },
  navIconBadgeAmber: {
    backgroundColor: colors.amber,
  },
  navIconBadgeCoral: {
    backgroundColor: colors.coral,
  },
  navButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.08,
    color: colors.ink,
    textAlign: 'center',
  },
  sectionHeader: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.08,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: -8,
  },
  clubsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  clubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 180,
    ...elevation('subtle'),
  },
  clubAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
  },
  clubAvatarPlaceholder: {
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarPlaceholderText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.white,
  },
  clubChipText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    flexShrink: 1,
  },
  createClubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});
