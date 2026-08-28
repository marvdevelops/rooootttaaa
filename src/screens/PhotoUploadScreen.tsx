import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CameraIcon, ImportIcon } from '../components/icons';
import { colors, elevation, fonts, radii } from '../theme/theme';
import {
  PhotoUploadError,
  PickedPhoto,
  pickPhotoFromLibrary,
  takePhotoWithCamera,
  uploadRoutePhoto,
} from '../utils/photosApi';

interface Props {
  routeId: string;
  completionId?: string;
  onClose: () => void;
  onUploaded: () => void;
}

export default function PhotoUploadScreen({ routeId, completionId, onClose, onUploaded }: Props) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePick = async (source: 'library' | 'camera') => {
    try {
      const result = source === 'library' ? await pickPhotoFromLibrary() : await takePhotoWithCamera();
      if (result) setPhoto(result);
    } catch (e) {
      Alert.alert('Error', e instanceof PhotoUploadError ? e.message : 'Failed to open picker.');
    }
  };

  const handleUpload = async () => {
    if (!photo) return;
    setUploading(true);
    try {
      await uploadRoutePhoto({ routeId, photo, caption, takenAt, completionId });
      onUploaded();
    } catch (e) {
      Alert.alert('Upload failed', e instanceof PhotoUploadError ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
        <Text style={styles.title}>Add a photo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.prompt}>What does this route look like?</Text>
        <Text style={styles.promptSub}>
          The trail surface, the view from the top, a flooded crossing — useful beats pretty.
        </Text>

        {!photo ? (
          <View style={styles.pickerRow}>
            <Pressable style={styles.pickButton} onPress={() => handlePick('library')}>
              <ImportIcon size={20} color={colors.ink} />
              <Text style={styles.pickButtonText}>Choose from library</Text>
            </Pressable>
            <Pressable style={styles.pickButton} onPress={() => handlePick('camera')}>
              <CameraIcon size={20} color={colors.ink} />
              <Text style={styles.pickButtonText}>Take a photo</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Image source={{ uri: photo.uri }} style={styles.preview} />

            <View>
              <Text style={styles.label}>CAPTION (OPTIONAL)</Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="e.g. Muddy section near km 4"
                placeholderTextColor={colors.mist}
                style={styles.input}
                maxLength={150}
              />
            </View>

            <View>
              <Text style={styles.label}>WHEN DID YOU TAKE THIS?</Text>
              <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>{takenAt.toLocaleDateString()}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={takenAt}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setTakenAt(date);
                  }}
                />
              )}
            </View>

            <Pressable style={styles.uploadButton} onPress={handleUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator color={colors.sheetBg} /> : <Text style={styles.uploadButtonText}>ADD PHOTO</Text>}
            </Pressable>
            <Pressable onPress={() => setPhoto(null)} disabled={uploading} hitSlop={8}>
              <Text style={styles.retakeLink}>Choose different photo</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 14,
  },
  prompt: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  promptSub: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    marginTop: -8,
    lineHeight: 18,
  },
  pickerRow: {
    gap: 10,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    ...elevation('card'),
  },
  pickButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.md,
    backgroundColor: colors.sheetBg,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    ...elevation('subtle'),
  },
  dateButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    ...elevation('subtle'),
  },
  dateButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  uploadButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  uploadButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.surface,
  },
  retakeLink: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.stone,
    textAlign: 'center',
  },
});
