import React, { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BackIcon, CameraIcon, TrashIcon, UserIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ClubMember, RunClub } from '../types/club';
import { AvatarError, pickAndUploadClubAvatar } from '../utils/avatar';
import {
  ClubFullError,
  deleteClub,
  getClub,
  listClubMembers,
  removeClubMember,
  respondToClubJoinRequest,
  setClubMemberRole,
  updateClub,
} from '../utils/clubsApi';

interface Props {
  clubId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function ClubAdminScreen({ clubId, onClose, onDeleted }: Props) {
  const insets = useSafeAreaInsets();
  const [club, setClub] = useState<RunClub | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<ClubMember[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const refresh = useCallback(async () => {
    const c = await getClub(clubId);
    setClub(c);
    setName(c.name);
    setDescription(c.description ?? '');
    setCity(c.city ?? '');
    setIsPrivate(c.isPrivate);
    const [pendingList, activeList] = await Promise.all([
      c.isPrivate ? listClubMembers(clubId, 'pending') : Promise.resolve([]),
      listClubMembers(clubId, 'active'),
    ]);
    setPending(pendingList);
    setMembers(activeList);
  }, [clubId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSaveDetails = useCallback(async () => {
    setSaving(true);
    try {
      await updateClub(clubId, { name, description, city, isPrivate });
      await refresh();
      Alert.alert('Saved', 'Club details updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }, [clubId, name, description, city, isPrivate, refresh]);

  const handlePickLogo = useCallback(async () => {
    setUploadingLogo(true);
    try {
      const url = await pickAndUploadClubAvatar(clubId);
      if (url) {
        await updateClub(clubId, { avatarUrl: url });
        await refresh();
      }
    } catch (e) {
      Alert.alert('Error', e instanceof AvatarError ? e.message : 'Failed to update club logo.');
    } finally {
      setUploadingLogo(false);
    }
  }, [clubId, refresh]);

  const handleRespond = useCallback(
    async (userId: string, approve: boolean) => {
      setRespondingId(userId);
      try {
        await respondToClubJoinRequest(clubId, userId, approve);
        await refresh();
      } catch (e) {
        if (e instanceof ClubFullError) {
          Alert.alert('Club full', e.message);
        } else {
          Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update this request.');
        }
      } finally {
        setRespondingId(null);
      }
    },
    [clubId, refresh],
  );

  const handlePromote = useCallback(
    (userId: string, currentRole: ClubMember['role']) => {
      const nextRole = currentRole === 'admin' ? 'member' : 'admin';
      setClubMemberRole(clubId, userId, nextRole)
        .then(refresh)
        .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update role.'));
    },
    [clubId, refresh],
  );

  const handleRemoveMember = useCallback(
    (userId: string, username: string) => {
      Alert.alert('Remove member', `Remove ${username} from the club?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeClubMember(clubId, userId)
              .then(refresh)
              .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove member.')),
        },
      ]);
    },
    [clubId, refresh],
  );

  const handleDelete = useCallback(() => {
    if (!club) return;
    Alert.alert('Delete club', `Permanently delete ${club.name}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClub(clubId);
            onDeleted();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete club.');
          }
        },
      },
    ]);
  }, [club, clubId, onDeleted]);

  if (!club) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
            <BackIcon />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </View>
    );
  }

  const isOwner = club.myRole === 'owner';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Manage Club</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {club.memberCount >= 20 && club.memberCount < 25 && (
          <View style={styles.almostFullBanner}>
            <Text style={styles.almostFullText}>
              Your club is almost full — {club.memberCount} of 25 members. Upgrade to Pro for unlimited members.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Club details</Text>

        <Pressable style={styles.logoRow} onPress={handlePickLogo} disabled={uploadingLogo}>
          {club.avatarUrl ? (
            <Image source={{ uri: club.avatarUrl }} style={styles.logoImage} />
          ) : (
            <View style={[styles.logoImage, styles.logoPlaceholder]}>
              <Text style={styles.logoPlaceholderText}>{club.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.logoBadge}>
            {uploadingLogo ? <ActivityIndicator size="small" color={colors.white} /> : <CameraIcon size={14} color={colors.white} />}
          </View>
          <Text style={styles.logoLabel}>Change club logo</Text>
        </Pressable>

        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={50} placeholder="Club name" placeholderTextColor={colors.mist} />
        <TextInput style={styles.input} value={city} onChangeText={setCity} maxLength={80} placeholder="City" placeholderTextColor={colors.mist} />
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          multiline
          placeholder="About your club"
          placeholderTextColor={colors.mist}
        />
        <View style={styles.privateRow}>
          <Text style={styles.privateLabel}>Private club</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: colors.coral, false: '#E0DAD2' }} thumbColor={colors.white} />
        </View>
        <Pressable style={styles.saveButton} onPress={handleSaveDetails} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save changes</Text>}
        </Pressable>

        {club.isPrivate && (
          <>
            <Text style={styles.sectionTitle}>Pending requests ({pending.length})</Text>
            {pending.length === 0 ? (
              <Text style={styles.emptyBody}>No pending requests.</Text>
            ) : (
              pending.map((m) => (
                <View key={m.userId} style={styles.memberRow}>
                  {m.avatarUrl ? (
                    <Image source={{ uri: m.avatarUrl }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.avatarPlaceholder]}>
                      <UserIcon size={16} color={colors.stone} />
                    </View>
                  )}
                  <Text style={styles.memberUsername} numberOfLines={1}>
                    {m.username}
                  </Text>
                  {respondingId === m.userId ? (
                    <ActivityIndicator size="small" color={colors.ink} />
                  ) : (
                    <View style={styles.memberActions}>
                      <Pressable style={styles.declineButton} onPress={() => handleRespond(m.userId, false)}>
                        <Text style={styles.actionText}>Decline</Text>
                      </Pressable>
                      <Pressable style={styles.approveButton} onPress={() => handleRespond(m.userId, true)}>
                        <Text style={[styles.actionText, styles.approveText]}>Approve</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Members ({members.length})</Text>
        {members.map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            {m.avatarUrl ? (
              <Image source={{ uri: m.avatarUrl }} style={styles.memberAvatar} />
            ) : (
              <View style={[styles.memberAvatar, styles.avatarPlaceholder]}>
                <UserIcon size={16} color={colors.stone} />
              </View>
            )}
            <Text style={styles.memberUsername} numberOfLines={1}>
              {m.username}
            </Text>
            {m.role === 'owner' ? (
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>OWNER</Text>
              </View>
            ) : (
              isOwner && (
                <View style={styles.memberActions}>
                  <Pressable style={styles.declineButton} onPress={() => handlePromote(m.userId, m.role)}>
                    <Text style={styles.actionText}>{m.role === 'admin' ? 'Demote' : 'Promote'}</Text>
                  </Pressable>
                  <Pressable style={styles.removeButton} onPress={() => handleRemoveMember(m.userId, m.username)}>
                    <TrashIcon size={14} color={colors.ink} />
                  </Pressable>
                </View>
              )
            )}
          </View>
        ))}

        {isOwner && (
          <>
            <Text style={styles.sectionTitle}>Danger zone</Text>
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete club</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
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
  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: 8,
  },
  almostFullBanner: {
    backgroundColor: colors.amber,
    borderRadius: radii.sm,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  almostFullText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: colors.ink,
    marginTop: spacing.xl,
    marginBottom: 6,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  logoImage: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
  },
  logoPlaceholder: {
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.white,
  },
  logoBadge: {
    position: 'absolute',
    bottom: -4,
    left: 40,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  logoLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  input: {
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 6,
    ...elevation('subtle'),
  },
  textarea: {
    minHeight: 80,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
    marginTop: 6,
    ...elevation('subtle'),
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  privateLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  saveButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: spacing.md,
    ...elevation('primaryBtn'),
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  emptyBody: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarPlaceholder: {
    backgroundColor: colors.sheetBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberUsername: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 6,
  },
  declineButton: {
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  approveButton: {
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.sage,
    ...elevation('smallCta'),
  },
  removeButton: {
    borderRadius: radii.pill,
    padding: 8,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink,
  },
  approveText: {
    color: colors.white,
  },
  roleBadge: {
    backgroundColor: colors.teal,
    borderRadius: radii.xs,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
  },
  deleteButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 6,
  },
  deleteButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
});
