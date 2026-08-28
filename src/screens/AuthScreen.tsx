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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppleSignInButton from '../components/AppleSignInButton';
import { CloseIcon } from '../components/icons';
import GoogleSignInButton from '../components/GoogleSignInButton';
import Logo from '../components/Logo';
import { useAuth } from '../lib/AuthContext';
import { isGoogleSignInAvailable } from '../lib/googleAuth';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

interface Props {
  /** True right after the user completes a password reset on rootah.com and taps back into the app. */
  passwordResetDone?: boolean;
  onConsumePasswordResetDone?: () => void;
  /**
   * Present when this is shown as a dismissible sign-in prompt (a guest
   * browsing the app tapped a gated action) rather than the sole
   * full-screen entry point. Renders a close button; omit to keep the
   * original standalone behavior with no way to back out.
   */
  onClose?: () => void;
  /** Overrides the default "Sign up to build..." subtitle with copy naming the specific action that triggered this prompt (e.g. "Create an account to save routes"). */
  contextHeadline?: string;
}

export default function AuthScreen({ passwordResetDone, onConsumePasswordResetDone, onClose, contextHeadline }: Props) {
  const insets = useSafeAreaInsets();
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
        {onClose && (
          <Pressable
            style={[styles.closeButton, { top: insets.top + 8 }]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon size={16} />
          </Pressable>
        )}

        <View style={styles.brandRow}>
          <Logo size={44} />
        </View>

        <Text style={styles.title}>
          {isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          {isForgotPassword
            ? "Enter your email and we'll send you a link to set a new password."
            : contextHeadline
              ? contextHeadline
              : isSignUp
                ? 'Sign up to build, save, and share routes.'
                : 'Log in to pick up your routes and maps.'}
        </Text>

        {!isForgotPassword && (isGoogleSignInAvailable() || Platform.OS === 'ios') && (
          <View style={styles.socialSection}>
            <AppleSignInButton onError={setSocialError} />
            {isGoogleSignInAvailable() && <GoogleSignInButton onError={setSocialError} />}

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
                placeholderTextColor={colors.mist}
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
                  placeholderTextColor={colors.mist}
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
                <ActivityIndicator color={colors.white} />
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
  closeButton: {
    position: 'absolute',
    // Vertical offset is applied inline from useSafeAreaInsets().
    right: 16,
    width: 36,
    height: 36,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
    zIndex: 1,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
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
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mist,
  },
  form: {
    gap: 14,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.stone,
    marginBottom: 6,
    textTransform: 'uppercase',
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textDecorationLine: 'underline',
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
  infoBanner: {
    backgroundColor: colors.sage,
    borderRadius: radii.xs,
    padding: 10,
  },
  infoText: {
    color: colors.white,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  submitButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 6,
    ...elevation('primaryBtn'),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    lineHeight: 20,
  },
  switchModeButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchModeText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
  },
  switchModeTextBold: {
    fontFamily: fonts.bold,
    color: colors.coral,
  },
});
