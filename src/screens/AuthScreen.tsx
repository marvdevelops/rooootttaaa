import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// Apple Sign In is built (see AppleSignInButton) but temporarily not
// rendered below — Google is going out first. Apple's availability check is
// device-based, not config-based, so showing it now would offer a button
// that errors on tap until the Apple provider is set up in Supabase. Restore
// the import and the <AppleSignInButton /> line together when that's ready.
// import AppleSignInButton from '../components/AppleSignInButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import Logo from '../components/Logo';
import { useAuth } from '../lib/AuthContext';
import { isGoogleSignInAvailable } from '../lib/googleAuth';
import { brutalShadow, colors, fonts } from '../theme/theme';

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

interface Props {
  /** True right after the user completes a password reset on rootah.com and taps back into the app. */
  passwordResetDone?: boolean;
  onConsumePasswordResetDone?: () => void;
}

export default function AuthScreen({ passwordResetDone, onConsumePasswordResetDone }: Props) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);

  useEffect(() => {
    if (!passwordResetDone) return;
    setMode('signIn');
    setInfo('Password updated. Log in with your new password.');
    onConsumePasswordResetDone?.();
  }, [passwordResetDone, onConsumePasswordResetDone]);

  const isSignUp = mode === 'signUp';
  const isForgotPassword = mode === 'forgotPassword';
  const canSubmit = isForgotPassword
    ? email.trim().length > 3 && !submitting
    : email.trim().length > 3 && password.length >= 6 && !submitting;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setResetSent(false);
  };

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (isForgotPassword) {
        await resetPassword(email.trim());
        setResetSent(true);
      } else if (isSignUp) {
        const result = await signUp(email.trim(), password);
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) setInfo('Account created. Check your email to confirm, then log in.');
        // Otherwise a session was created immediately — the auth listener
        // takes over and the app navigates in on its own.
      } else {
        const result = await signIn(email.trim(), password);
        if (result.error) setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Logo size={44} />
        </View>

        <Text style={styles.title}>
          {isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          {isForgotPassword
            ? "Enter your email and we'll send you a link to set a new password."
            : isSignUp
              ? 'Sign up to build, save, and share routes.'
              : 'Log in to pick up your routes and maps.'}
        </Text>

        {!isForgotPassword && isGoogleSignInAvailable() && (
          <View style={styles.socialSection}>
            <GoogleSignInButton onError={setSocialError} />

            {socialError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{socialError}</Text>
              </View>
            )}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        {isForgotPassword && resetSent ? (
          <View style={styles.form}>
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>
                If an account exists for {email.trim()}, you&apos;ll receive a password reset link shortly. Check
                your spam folder if it doesn&apos;t arrive.
              </Text>
            </View>
            <Pressable style={styles.submitButton} onPress={() => switchMode('signIn')}>
              <Text style={styles.submitButtonText}>BACK TO LOG IN</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <View>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedLight}
                style={styles.input}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
              />
            </View>

            {!isForgotPassword && (
              <View>
                <Text style={styles.label}>PASSWORD</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.mutedLight}
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            )}

            {!isForgotPassword && !isSignUp && (
              <Pressable style={styles.forgotPasswordButton} onPress={() => switchMode('forgotPassword')}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
            )}

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {info && (
              <View style={styles.infoBanner}>
                <Text style={styles.infoText}>{info}</Text>
              </View>
            )}

            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color={colors.sand} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isForgotPassword ? 'SEND RESET LINK' : isSignUp ? 'SIGN UP' : 'LOG IN'}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        <Pressable
          style={styles.switchModeButton}
          onPress={() => switchMode(isForgotPassword ? 'signIn' : isSignUp ? 'signIn' : 'signUp')}
        >
          <Text style={styles.switchModeText}>
            {isForgotPassword
              ? 'Remembered it? '
              : isSignUp
                ? 'Already have an account? '
                : "Don't have an account? "}
            <Text style={styles.switchModeTextBold}>
              {isForgotPassword ? 'Log in' : isSignUp ? 'Log in' : 'Sign up'}
            </Text>
          </Text>
        </Pressable>
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
  socialSection: {
    gap: 10,
    marginBottom: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#c9bfa2',
  },
  dividerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedLight,
  },
  form: {
    gap: 14,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
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
  infoBanner: {
    backgroundColor: colors.green,
    borderRadius: 8,
    padding: 10,
  },
  infoText: {
    color: colors.ink,
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
  switchModeButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchModeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
  },
  switchModeTextBold: {
    fontFamily: fonts.bodyBold,
    color: colors.rust,
  },
});
