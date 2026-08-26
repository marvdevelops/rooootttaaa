import React, { useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { TrashIcon } from './icons';
import { colors, fonts, radii } from '../theme/theme';

const DELETE_WIDTH = 84;
const SWIPE_OPEN_THRESHOLD = DELETE_WIDTH / 2;

interface Props {
  onDelete: () => void;
  children: React.ReactNode;
}

/**
 * Swipe-left-to-reveal-delete, built on PanResponder + Animated (no
 * react-native-gesture-handler — that's a native module this project
 * doesn't have installed, and adding it would force a new native build
 * just for this).
 */
export default function SwipeToDeleteRow({ onDelete, children }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const openRow = () => {
    isOpen.current = true;
    Animated.spring(translateX, { toValue: -DELETE_WIDTH, useNativeDriver: true, bounciness: 0 }).start();
  };

  const closeRow = () => {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const next = Math.min(0, Math.max(-DELETE_WIDTH - 24, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const finalX = base + gesture.dx;
        if (finalX < -SWIPE_OPEN_THRESHOLD) openRow();
        else closeRow();
      },
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={styles.deleteBackdrop}>
        <Pressable
          style={styles.deleteButton}
          onPress={() => {
            closeRow();
            onDelete();
          }}
        >
          <TrashIcon size={18} color={colors.white} />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  deleteBackdrop: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteButton: {
    width: DELETE_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white,
  },
});
