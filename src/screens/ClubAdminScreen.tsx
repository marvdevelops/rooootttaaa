import React, { useCallback, useEffect, useState } from 'react';
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
import { brutalShadow, colors, fonts } from '../theme/theme';
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onClose}>
            <BackIcon />
          </Pressable>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.rust} />
        </View>
      </View>
    );
  }

  const isOwner = club.myRole === 'owner';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
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
            {uploadingLogo ? <ActivityIndicator size="small" color={colors.ink} /> : <CameraIcon size={14} />}
          </View>
          <Text style={styles.logoLabel}>Change club logo</Text>
        </Pressable>

        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={50} placeholder="Club name" placeholderTextColor={colors.mutedLight} />
        <TextInput style={styles.input} value={city} onChangeText={setCity} maxLength={80} placeholder="City" placeholderTextColor={colors.mutedLight} />
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          multiline
          placeholder="About your club"
          placeholderTextColor={colors.mutedLight}
        />
        <View style={styles.privateRow}>
          <Text style={styles.privateLabel}>Private club</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: colors.rust, false: colors.sand }} thumbColor={colors.white} />
        </View>
        <Pressable style={styles.saveButton} onPress={handleSaveDetails} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.saveButtonText}>SAVE CHANGES</Text>}
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
                      <UserIcon size={16} color={colors.muted} />
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
                        <Text style={styles.actionText}>DECLINE</Text>
                      </Pressable>
                      <Pressable style={styles.approveButton} onPress={() => handleRespond(m.userId, true)}>
                        <Text style={[styles.actionText, styles.approveText]}>APPROVE</Text>
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
                <UserIcon size={16} color={colors.muted} />
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
                    <Text style={styles.actionText}>{m.role === 'admin' ? 'DEMOTE' : 'PROMOTE'}</Text>
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
              <Text style={styles.deleteButtonText}>DELETE CLUB</Text>
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
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  loadingWrap: {
    paddingTop: 60,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 8,
  },
  almostFullBanner: {
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  almostFullText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
    marginTop: 20,
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
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  logoPlaceholder: {
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  logoBadge: {
    position: 'absolute',
    bottom: -4,
    left: 40,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  input: {
    height: 48,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 6,
  },
  textarea: {
    minHeight: 80,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  privateLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...brutalShadow(3),
  },
  saveButtonText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.sand,
  },
  emptyBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
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
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberUsername: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 6,
  },
  declineButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.white,
  },
  approveButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: colors.green,
  },
  removeButton: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 6,
    backgroundColor: colors.white,
  },
  actionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  approveText: {
    color: colors.white,
  },
  roleBadge: {
    backgroundColor: colors.aqua,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
  },
  deleteButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.red,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  deleteButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.red,
  },
});
