import { GoogleSignin, isCancelledResponse, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { GoogleIcon } from './icons';
import { useAuth } from '../lib/AuthContext';
import { ensureGoogleSignInConfigured, isGoogleSignInAvailable } from '../lib/googleAuth';
import { colors, elevation, fonts, radii } from '../theme/theme';

interface Props {
  onError: (message: string) => void;
}

export default function GoogleSignInButton({ onError }: Props) {
  const { signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!isGoogleSignInAvailable()) return null;

  const handlePress = async () => {
    setSubmitting(true);
    try {
      ensureGoogleSignInConfigured();
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) return;
      if (!isSuccessResponse(response) || !response.data.idToken) {
        onError('Google did not return a sign-in token. Please try again.');
        return;
      }

      const result = await signInWithGoogle(response.data.idToken, response.data.user.givenName);
      if (result.error) onError(result.error);
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : null;
      if (code !== statusCodes.SIGN_IN_CANCELLED) {
        onError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Pressable style={styles.button} onPress={handlePress} disabled={submitting}>
      {submitting ? <ActivityIndicator color={colors.ink} /> : <GoogleIcon size={18} />}
      <Text style={styles.text}>Continue with Google</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
    ...elevation('subtle'),
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 20,
  },
});
