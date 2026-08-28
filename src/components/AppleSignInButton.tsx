import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { radii } from '../theme/theme';

interface Props {
  onError: (message: string) => void;
}

/** iOS only — Apple rejects apps offering any third-party social login without also offering this. Render null on Android or unsupported iOS versions rather than skip the mount, so callers don't need their own Platform check. */
export default function AppleSignInButton({ onError }: Props) {
  const { signInWithApple } = useAuth();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        onError('Apple did not return a sign-in token. Please try again.');
        return;
      }

      // Apple only ever sends the name on the very first authorization for
      // this app — there's nothing to fall back on for returning users, so
      // it's captured here and handed to AuthContext as a prefill suggestion.
      const result = await signInWithApple(credential.identityToken, credential.fullName?.givenName ?? null);
      if (result.error) onError(result.error);
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : null;
      if (code !== 'ERR_REQUEST_CANCELED') {
        onError(e instanceof Error ? e.message : 'Apple sign-in failed. Please try again.');
      }
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radii.pill}
      style={styles.button}
      onPress={handlePress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 52,
  },
});
