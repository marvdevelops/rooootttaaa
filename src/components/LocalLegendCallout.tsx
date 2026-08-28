import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { getRouteLeader, RouteLeader } from '../utils/badgesApi';

interface Props {
  routeId: string;
  onOpenProfile: (userId: string) => void;
}

export default function LocalLegendCallout({ routeId, onOpenProfile }: Props) {
  const [leader, setLeader] = useState<RouteLeader | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRouteLeader(routeId)
      .then((l) => {
        if (!cancelled) setLeader(l);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  if (!leader) return null;

  return (
    <Pressable style={styles.row} onPress={() => onOpenProfile(leader.userId)}>
      <Text style={styles.icon}>🌟</Text>
      {leader.avatarUrl ? (
        <Image source={{ uri: leader.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}
      <Text style={styles.text}>
        <Text style={styles.bold}>@{leader.username}</Text> has run this more than anyone
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amber,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    ...elevation('subtle'),
  },
  icon: {
    fontSize: 14,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 7,
  },
  avatarPlaceholder: {
    backgroundColor: colors.cream,
  },
  text: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.surface,
  },
  bold: {
    fontFamily: fonts.bold,
  },
});
