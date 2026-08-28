import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';
import { CloseIcon } from './icons';

interface Props {
  imageUrl: string | null;
  onClose: () => void;
}

/** Full-screen, tap-to-open poster/banner view — the event card's own image is cropped to a short hero strip, this shows it uncropped at full size. Generic enough to reuse for any single-image "view full size" need. */
export default function PosterViewerModal({ imageUrl, onClose }: Props) {
  return (
    <Modal visible={!!imageUrl} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {imageUrl && <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />}
        <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <CloseIcon size={16} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
