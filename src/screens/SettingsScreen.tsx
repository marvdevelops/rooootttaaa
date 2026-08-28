import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { BackIcon, CameraIcon, UserIcon } from '../components/icons';
import NotificationSettingsSection from '../components/NotificationSettingsSection';
import { useAuth } from '../lib/AuthContext';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { AvatarError, pickAndUploadAvatar } from '../utils/avatar';

interface Props {
  onClose: () => void;
  onOpenBlockedUsers: () => void;
}

export default function SettingsScreen({ onClose, onOpenBlockedUsers }: Props) {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionHeader}>ACCOUNT</Text>

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
              placeholderTextColor={colors.mist}
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
              placeholderTextColor={colors.mist}
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
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>SAVE</Text>}
          </Pressable>

          {session && <NotificationSettingsSection userId={session.user.id} />}

          <Text style={styles.sectionHeader}>PRIVACY &amp; SAFETY</Text>

          <Pressable style={styles.rowButton} onPress={onOpenBlockedUsers}>
            <UserIcon size={18} color={colors.ink} />
            <Text style={styles.rowButtonText}>Blocked users</Text>
          </Pressable>

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
              <ActivityIndicator size="small" color={colors.danger} />
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
    fontSize: 20,
    letterSpacing: -0.4,
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
  sectionHeader: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.stone,
    marginTop: 8,
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
    borderRadius: radii.lg,
  },
  avatarPlaceholder: {
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontFamily: fonts.extraBold,
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
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  email: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    flexShrink: 1,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    ...elevation('subtle'),
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorBanner: {
    backgroundColor: colors.danger,
    borderRadius: radii.xs,
    padding: 10,
  },
  errorText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  savedBanner: {
    backgroundColor: colors.sage,
    borderRadius: radii.xs,
    padding: 10,
  },
  savedText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  saveButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 6,
    ...elevation('primaryBtn'),
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    lineHeight: 20,
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...elevation('subtle'),
  },
  rowButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
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
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textDecorationLine: 'underline',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  signOutButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.danger,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingBottom: 24,
  },
  deleteButtonText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
    textDecorationLine: 'underline',
  },
});
