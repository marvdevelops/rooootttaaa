import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BackIcon, CalendarIcon, CameraIcon, ClockIcon, CompassIcon, UserIcon } from '../components/icons';
import NotificationSettingsSection from '../components/NotificationSettingsSection';
import { useAuth } from '../lib/AuthContext';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { AvatarError, pickAndUploadAvatar } from '../utils/avatar';

interface Props {
  onClose: () => void;
  onOpenActivity: () => void;
  onOpenMyMaps: () => void;
  onOpenBlockedUsers: () => void;
  onOpenEvents: () => void;
}

export default function ProfileScreen({ onClose, onOpenActivity, onOpenMyMaps, onOpenBlockedUsers, onOpenEvents }: Props) {
  const { session, profile, signOut, updateProfile, deleteAccount } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
  }, [profile]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateProfile({ username: username.trim(), bio: bio.trim() });
    setSaving(false);
    if (result.error) setError(result.error);
    else setSaved(true);
  };

  const handlePickAvatar = async () => {
    if (!session) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const url = await pickAndUploadAvatar(session.user.id);
      if (url) {
        const result = await updateProfile({ avatar_url: url });
        if (result.error) setError(result.error);
      }
    } catch (e) {
      setError(e instanceof AvatarError ? e.message : 'Failed to update profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleOpenTerms = () => {
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://rootah-web-production.up.railway.app';
    Linking.openURL(`${webBaseUrl}/terms`).catch(() => {
      Alert.alert('Error', 'Could not open Terms & Conditions.');
    });
  };

  const handleOpenPrivacy = () => {
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://rootah-web-production.up.railway.app';
    Linking.openURL(`${webBaseUrl}/privacy`).catch(() => {
      Alert.alert('Error', 'Could not open Privacy Policy.');
    });
  };

  const handleSignOut = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      'This deletes your profile, routes, saves, likes, group runs, comments, and RSVPs. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDeleteAccount },
      ],
    );
  };

  const runDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    setDeleting(false);
    if (result.error) {
      Alert.alert('Could not delete account', result.error);
      setError(result.error);
    }
    // On success the session clears and the app's auth gate returns to AuthScreen automatically.
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      "We'll remove your account and everything tied to it. You'll be asked to confirm once more.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: confirmDeleteAccount },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
      </View>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarRow}>
          <Pressable style={styles.avatarWrap} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>
                  {(profile?.username ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <CameraIcon size={14} />
              )}
            </View>
          </Pressable>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>

        <View>
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholder="username"
            placeholderTextColor={colors.mutedLight}
            autoCapitalize="none"
            maxLength={30}
          />
        </View>

        <View>
          <Text style={styles.label}>BIO</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            style={[styles.input, styles.textArea]}
            placeholder="Tell other runners about yourself"
            placeholderTextColor={colors.mutedLight}
            multiline
            maxLength={200}
          />
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {saved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>Profile updated.</Text>
          </View>
        )}

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving || !username.trim()}>
          {saving ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.saveButtonText}>SAVE</Text>}
        </Pressable>

        <View style={styles.navGrid}>
          <Pressable style={styles.navButton} onPress={onOpenMyMaps}>
            <View style={[styles.navIconBadge, styles.navIconBadgeAqua]}>
              <CompassIcon size={26} color={colors.ink} />
            </View>
            <Text style={styles.navButtonText}>MY MAPS</Text>
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
            <Text style={styles.navButtonText}>YOUR EVENTS</Text>
          </Pressable>

          <Pressable style={styles.navButton} onPress={onOpenBlockedUsers}>
            <View style={[styles.navIconBadge, styles.navIconBadgeSand]}>
              <UserIcon size={26} color={colors.ink} />
            </View>
            <Text style={styles.navButtonText}>BLOCKED USERS</Text>
          </Pressable>
        </View>

        {session && <NotificationSettingsSection userId={session.user.id} />}

        <View style={styles.legalRow}>
          <Pressable style={styles.termsButton} onPress={handleOpenTerms}>
            <Text style={styles.termsButtonText}>Terms &amp; Conditions</Text>
          </Pressable>
          <Pressable style={styles.termsButton} onPress={handleOpenPrivacy}>
            <Text style={styles.termsButtonText}>Privacy Policy</Text>
          </Pressable>
        </View>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Log out</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator size="small" color={colors.rustDark} />
          ) : (
            <Text style={styles.deleteButtonText}>Delete account</Text>
          )}
        </Pressable>
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
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  avatarWrap: {
    width: 72,
    height: 72,
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
  avatarBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    flexShrink: 1,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorBanner: {
    backgroundColor: colors.rustDark,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  savedBanner: {
    backgroundColor: colors.green,
    borderRadius: 8,
    padding: 10,
  },
  savedText: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  saveButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...brutalShadow(4),
  },
  saveButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  navButton: {
    width: '47%',
    height: 120,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...brutalShadow(4),
  },
  navIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
  navIconBadgeSand: {
    backgroundColor: colors.sand,
  },
  navButtonText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.ink,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  termsButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  termsButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  signOutButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.rustDark,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 24,
  },
  deleteButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});
