import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/theme';

export default function WaypointMarker() {
  return (
    <View style={styles.hitArea}>
      <View style={styles.pin} />
    </View>
  );
}

const styles = StyleSheet.create({
  // PointAnnotation's tap/select target is exactly the size of this rendered
  // view, so the visible dot stays small while this invisible padding gives
  // it a real touch target (well below this, taps miss and fall through to
  // the map underneath instead of selecting the marker).
  hitArea: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.amber,
    borderWidth: 2.5,
    borderColor: colors.ink,
  },
});
