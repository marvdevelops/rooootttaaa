import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { CloudRoute } from '../types/route';
import TopRouteCard from './TopRouteCard';

interface Props {
  routes: CloudRoute[];
  city: string | null;
  isFallback: boolean;
  onOpenRoute: (route: CloudRoute) => void;
  onSeeAll: () => void;
}

export default function TopRoutesStrip({ routes, city, isFallback, onOpenRoute, onSeeAll }: Props) {
  if (routes.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {isFallback ? `Most run in ${city ?? 'the Philippines'}` : `🏆 Top in ${city ?? 'the Philippines'}`}
        </Text>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all →</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={routes}
        keyExtractor={(r) => r.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <TopRouteCard route={item} isTop={!isFallback} rank={isFallback ? undefined : index + 1} onPress={() => onOpenRoute(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
    flexShrink: 1,
  },
  seeAll: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.rust,
  },
  list: {
    gap: 10,
  },
});
