import React, { useCallback, useState } from 'react';
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
import { BackIcon, CameraIcon } from '../components/icons';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { AvatarError, PickedImageAsset, pickImageAsset, uploadClubAvatarAsset } from '../utils/avatar';
import { createClub, updateClub } from '../utils/clubsApi';
import { RunClub } from '../types/club';

interface Props {
  onClose: () => void;
  onCreated: (club: RunClub) => void;
  defaultCity?: string | null;
}

export default function CreateClubScreen({ onClose, onCreated, defaultCity }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState(defaultCity ?? '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  // Storage uploads are keyed by club id, which doesn't exist yet at pick
  // time — so the picked image is staged locally and only uploaded once the
  // club row (and its id) exists, right after creation.
  const [pickedLogo, setPickedLogo] = useState<PickedImageAsset | null>(null);

  const handlePickLogo = useCallback(async () => {
    try {
      const asset = await pickImageAsset();
      if (asset) setPickedLogo(asset);
    } catch (e) {
      Alert.alert('Error', e instanceof AvatarError ? e.message : 'Failed to pick a photo.');
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const club = await createClub({ name, description, city, isPrivate });
      if (pickedLogo) {
        try {
          const avatarUrl = await uploadClubAvatarAsset(club.id, pickedLogo);
          await updateClub(club.id, { avatarUrl });
          club.avatarUrl = avatarUrl;
        } catch {
          // Club is already created — a failed logo upload shouldn't block
          // finishing the flow; the admin can add one later from club settings.
        }
      }
      onCreated(club);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create club.');
    } finally {
      setSaving(false);
    }
  }, [name, description, city, isPrivate, pickedLogo, onCreated]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Create a Club</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.logoPicker} onPress={handlePickLogo}>
          {pickedLogo ? (
            <Image source={{ uri: pickedLogo.uri }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <CameraIcon size={22} color={colors.stone} />
            </View>
          )}
          <Text style={styles.logoPickerLabel}>{pickedLogo ? 'Change photo' : 'Add club photo'}</Text>
        </Pressable>

        <Text style={styles.label}>Club name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. BGC Runners"
          placeholderTextColor={colors.mist}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Taguig"
          placeholderTextColor={colors.mist}
          value={city}
          onChangeText={setCity}
          maxLength={80}
        />

        <Text style={styles.label}>About your club (optional)</Text>
        <TextInput
          style={styles.textarea}
          placeholder="What's your club about?"
          placeholderTextColor={colors.mist}
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          multiline
        />

        <View style={styles.privateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.privateLabel}>Private club</Text>
            <Text style={styles.privateSub}>New members need approval to join.</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ true: colors.coral, false: '#E0DAD2' }}
            thumbColor={colors.white}
          />
        </View>

        <Pressable style={styles.createButton} onPress={handleCreate} disabled={saving || !name.trim()}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.createButtonText}>Create club</Text>}
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
  form: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: 8,
  },
  logoPicker: {
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 84,
    height: 84,
    borderRadius: radii.lg,
    ...elevation('card'),
  },
  logoPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  logoPickerLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.coral,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    marginTop: spacing.md,
  },
  input: {
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    ...elevation('subtle'),
  },
  textarea: {
    minHeight: 90,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
    ...elevation('subtle'),
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.base,
    ...elevation('subtle'),
  },
  privateLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  privateSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
    marginTop: 2,
  },
  createButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: spacing.xxl,
    ...elevation('primaryBtn'),
  },
  createButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
});
