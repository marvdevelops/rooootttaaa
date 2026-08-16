import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import BadgeStrip from '../components/BadgeStrip';
import { BackIcon, CalendarIcon, ClockIcon, CompassIcon, GearIcon, PlusIcon } from '../components/icons';
import { useAuth } from '../lib/AuthContext';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
}

export default function ProfileScreen({
  onClose,
  onOpenActivity,
  onOpenMyMaps,
  onOpenEvents,
  onOpenSettings,
  onOpenClub,
  onOpenCreateClub,
}: Props) {
  const { profile } = useAuth();
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
            <Text style={styles.username}>@{profile?.username ?? 'runner'}</Text>
            {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>
        </View>

        {profile && <BadgeStrip userId={profile.id} />}

        <View style={styles.navGrid}>
          <Pressable style={styles.navButton} onPress={onOpenMyMaps}>
            <View style={[styles.navIconBadge, styles.navIconBadgeAqua]}>
              <CompassIcon size={26} color={colors.ink} />
            </View>
            <Text style={styles.navButtonText}>ROUTES</Text>
          </Pressable>

          <Pressable style={styles.navButton} onPress={onOpenActivity}>
            <View style={[styles.navIconBadge, styles.navIconBadgeAmber]}>
              <ClockIcon size={26} color={colors.ink} />
            </View>
            <Text style={styles.navButtonText}>ACTIVITY</Text>
          </Pressable>

          <Pressable style={styles.navButton} onPress={onOpenEvents}>
            <View style={[styles.navIconBadge, styles.navIconBadgeRust]}>
              <CalendarIcon size={26} color={colors.sand} />
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
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  username: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  bio: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  navGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  navButton: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...brutalShadow(4),
  },
  navIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBadgeAqua: {
    backgroundColor: colors.aqua,
  },
  navIconBadgeAmber: {
    backgroundColor: colors.amber,
  },
  navIconBadgeRust: {
    backgroundColor: colors.rust,
  },
  navButtonText: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.ink,
    textAlign: 'center',
  },
  sectionHeader: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.muted,
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
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: 180,
  },
  clubAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
  },
  clubAvatarPlaceholder: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarPlaceholderText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.ink,
  },
  clubChipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    flexShrink: 1,
  },
  createClubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sand,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderStyle: 'dashed',
  },
});
