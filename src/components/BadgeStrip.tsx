import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { listUserBadges, UserBadge } from '../utils/badgesApi';
import { CloseIcon } from './icons';

interface Props {
  userId: string;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BadgeStrip({ userId }: Props) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [selected, setSelected] = useState<UserBadge | null>(null);

  useEffect(() => {
    let cancelled = false;
    listUserBadges(userId)
      .then((b) => {
        if (!cancelled) setBadges(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (badges.length === 0) return null;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {badges.map((ub) => (
          <Pressable key={ub.id} style={styles.chip} onPress={() => setSelected(ub)}>
            <Text style={styles.icon}>{ub.badge.icon}</Text>
            <Text style={styles.name}>{ub.badge.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailIcon}>{selected?.badge.icon}</Text>
              <Pressable style={styles.closeButton} onPress={() => setSelected(null)}>
                <CloseIcon size={16} />
              </Pressable>
            </View>
            <Text style={styles.detailName}>{selected?.badge.name}</Text>
            <Text style={styles.detailDescription}>{selected?.badge.description}</Text>
            {selected && <Text style={styles.detailDate}>Earned {formatDate(selected.grantedAt)}</Text>}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  icon: {
    fontSize: 16,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,42,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  detailCard: {
    width: '100%',
    backgroundColor: colors.sand,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    ...brutalShadow(4),
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailIcon: {
    fontSize: 32,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  detailDescription: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 19,
  },
  detailDate: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});
