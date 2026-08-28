import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { BackIcon, CameraIcon, ShareIcon } from '../components/icons';
import ShareCardCanvas from '../components/ShareCardCanvas';
import { supabase } from '../lib/supabase';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { RaceDetails } from '../types/route';
import { getProfile, PublicProfile } from '../utils/profilesApi';
import { saveShareCardPath } from '../utils/racesApi';
import { takePhotoWithCamera } from '../utils/photosApi';

interface Props {
  rsvpId: string;
  raceDetails: RaceDetails;
  distanceMeters: number;
  finishTimeSeconds: number;
  paceSecondsPerKm: number | null;
  raceTitle: string;
  onDone: () => void;
}

export default function RaceShareCardScreen({
  rsvpId,
  raceDetails,
  distanceMeters,
  finishTimeSeconds,
  paceSecondsPerKm,
  raceTitle,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [capturingSelfie, setCapturingSelfie] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (userId) getProfile(userId).then(setProfile).catch(() => {});
    });
  }, []);

  const handleTakeSelfie = useCallback(async () => {
    setCapturingSelfie(true);
    try {
      const photo = await takePhotoWithCamera();
      if (photo) setSelfieUri(photo.uri);
    } catch (e) {
      Alert.alert('Camera error', e instanceof Error ? e.message : 'Could not open the camera.');
    } finally {
      setCapturingSelfie(false);
    }
  }, []);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const cardUri = await captureRef(cardRef, { format: 'jpg', quality: 0.92, result: 'tmpfile' });

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userId) {
        // Best-effort — the share sheet is the primary outcome, a failed
        // storage upload shouldn't block the user from sharing their card.
        try {
          const buffer = await new File(cardUri).arrayBuffer();
          const path = `${rsvpId}/${userId}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('race-share-cards')
            .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
          if (!uploadError) await saveShareCardPath(rsvpId, path);
        } catch {
          // non-fatal
        }
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(cardUri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
      } else {
        Alert.alert('Sharing unavailable', 'Your device does not support sharing images directly.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create the share card.');
    } finally {
      setSharing(false);
    }
  }, [rsvpId]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Nice run!</Text>
      <Text style={styles.subtitle}>Tap the card to add a selfie, then share it.</Text>

      <View style={styles.cardWrap}>
        <Pressable onPress={handleTakeSelfie} disabled={capturingSelfie}>
          <View ref={cardRef} collapsable={false}>
            <ShareCardCanvas
              raceTitle={raceTitle}
              brandPrimaryColor={raceDetails.brandPrimaryColor}
              brandAccentColor={raceDetails.brandAccentColor}
              organizerLogoUrl={raceDetails.eventLogoUrl ?? raceDetails.organizerLogoUrl}
              organizerName={raceDetails.organizerName}
              athleteUsername={profile?.username ?? ''}
              athleteAvatarUrl={profile?.avatarUrl ?? null}
              distanceMeters={distanceMeters}
              finishTimeSeconds={finishTimeSeconds}
              paceSecondsPerKm={paceSecondsPerKm}
              selfieUri={selfieUri}
            />
          </View>
          {capturingSelfie && (
            <View style={styles.cardOverlay}>
              <ActivityIndicator color={colors.white} />
            </View>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.selfieButton} onPress={handleTakeSelfie} disabled={capturingSelfie || sharing}>
        <CameraIcon size={16} color={colors.ink} />
        <Text style={styles.selfieButtonText}>{selfieUri ? 'Retake selfie' : 'Take selfie'}</Text>
      </Pressable>

      <Pressable style={styles.shareButton} onPress={handleShare} disabled={sharing}>
        {sharing ? <ActivityIndicator color={colors.white} /> : (
          <>
            <ShareIcon size={16} color={colors.white} />
            <Text style={styles.shareButtonText}>SHARE</Text>
          </>
        )}
      </Pressable>

      <Pressable style={styles.skipButton} onPress={onDone} disabled={sharing}>
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </Pressable>
      </ScrollView>

      <Pressable style={[styles.backButton, { top: insets.top + 8 }]} onPress={onDone} accessibilityRole="button" accessibilityLabel="Back">
        <BackIcon />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 70,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 16,
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
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  cardWrap: {
    borderRadius: radii.lg,
    ...elevation('card'),
  },
  cardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    marginTop: 24,
    ...elevation('subtle'),
  },
  selfieButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    marginTop: 12,
    ...elevation('primaryBtn'),
  },
  shareButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.4,
  },
  skipButton: {
    paddingVertical: 14,
  },
  skipButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
  },
});
