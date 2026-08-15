import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { BackIcon } from '../components/icons';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { createClub } from '../utils/clubsApi';
import { RunClub } from '../types/club';

interface Props {
  onClose: () => void;
  onCreated: (club: RunClub) => void;
  defaultCity?: string | null;
}

export default function CreateClubScreen({ onClose, onCreated, defaultCity }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState(defaultCity ?? '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const club = await createClub({ name, description, city, isPrivate });
      onCreated(club);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create club.');
    } finally {
      setSaving(false);
    }
  }, [name, description, city, isPrivate, onCreated]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Create a Club</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Club name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. BGC Runners"
          placeholderTextColor={colors.mutedLight}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Taguig"
          placeholderTextColor={colors.mutedLight}
          value={city}
          onChangeText={setCity}
          maxLength={80}
        />

        <Text style={styles.label}>About your club (optional)</Text>
        <TextInput
          style={styles.textarea}
          placeholder="What's your club about?"
          placeholderTextColor={colors.mutedLight}
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
            trackColor={{ true: colors.rust, false: colors.sand }}
            thumbColor={colors.white}
          />
        </View>

        <Pressable style={styles.createButton} onPress={handleCreate} disabled={saving || !name.trim()}>
          {saving ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.createButtonText}>CREATE CLUB</Text>}
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
  form: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 8,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    marginTop: 12,
  },
  input: {
    height: 50,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  textarea: {
    minHeight: 90,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 14,
  },
  privateLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  privateSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  createButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    ...brutalShadow(4),
  },
  createButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.sand,
  },
});
