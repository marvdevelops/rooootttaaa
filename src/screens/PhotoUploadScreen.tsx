import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackIcon, CameraIcon, ImportIcon } from '../components/icons';
import { brutalShadow, colors, fonts } from '../theme/theme';
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onClose}>
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
                placeholderTextColor={colors.mutedLight}
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
              {uploading ? <ActivityIndicator color={colors.sand} /> : <Text style={styles.uploadButtonText}>ADD PHOTO</Text>}
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 14,
  },
  prompt: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
  },
  promptSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
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
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
  pickButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.sand,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
  },
  dateButton: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  dateButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  uploadButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  uploadButtonText: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.sand,
  },
  retakeLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
});
