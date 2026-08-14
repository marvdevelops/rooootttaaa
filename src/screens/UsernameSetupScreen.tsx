import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Logo from '../components/Logo';
import { useAuth } from '../lib/AuthContext';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { isUsernameAvailable, USERNAME_PATTERN } from '../utils/profilesApi';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const CHECK_DEBOUNCE_MS = 400;

export default function UsernameSetupScreen() {
  const { session, suggestedUsername, completeUsernameSetup } = useAuth();
  const [username, setUsername] = useState(suggestedUsername ?? '');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkId = useRef(0);

  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.length === 0) {
      setAvailability('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(trimmed)) {
      setAvailability('invalid');
      return;
    }

    setAvailability('checking');
    const id = ++checkId.current;
    const t = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(trimmed, session?.user.id);
        if (checkId.current === id) setAvailability(available ? 'available' : 'taken');
      } catch {
        if (checkId.current === id) setAvailability('idle');
      }
    }, CHECK_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [username, session?.user.id]);

  const canSubmit = availability === 'available' && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await completeUsernameSetup(username.trim());
      if (result.error) setError(result.error);
      // On success, AuthContext flips `needsUsernameSetup` off and Root() takes over.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Logo size={44} />
        </View>

        <Text style={styles.title}>Welcome to Rootah!</Text>
        <Text style={styles.subtitle}>Choose a username to get started — this is how other users will find you.</Text>

        <View style={styles.form}>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={colors.mutedLight}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />

          {availability === 'checking' && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.statusTextMuted}>Checking availability…</Text>
            </View>
          )}
          {availability === 'available' && <Text style={styles.statusTextGood}>Available</Text>}
          {availability === 'taken' && <Text style={styles.statusTextBad}>That username is taken</Text>}
          {availability === 'invalid' && (
            <Text style={styles.statusTextBad}>3-20 characters — letters, numbers, and underscores only</Text>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
            {submitting ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.submitButtonText}>CONTINUE →</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 60,
    gap: 8,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  form: {
    gap: 10,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTextMuted: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
  },
  statusTextGood: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.green,
  },
  statusTextBad: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.rustDark,
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
  submitButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...brutalShadow(4),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
});
