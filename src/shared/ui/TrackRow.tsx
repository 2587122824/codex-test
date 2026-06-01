import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioItem } from '../types/audio';
import { colors, spacing } from './theme';

type Props = {
  item: AudioItem;
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
};

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const TrackRow = ({ item, isFavorite, onPress, onFavorite }: Props) => (
  <View style={styles.row}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`播放 ${item.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.trackButton, { opacity: pressed ? 0.82 : 1 }]}
    >
      <View style={[styles.cover, { backgroundColor: item.cover }]}>
        <Text style={styles.coverText}>{item.type === 'noise' ? '∞' : '♪'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.category} · {formatDuration(item.duration)}
        </Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </Pressable>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? '取消收藏' : '收藏'}
      onPress={onFavorite}
      hitSlop={12}
      style={styles.favoriteButton}
    >
      <Text style={[styles.favorite, isFavorite && styles.favoriteActive]}>
        {isFavorite ? '★' : '☆'}
      </Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    minHeight: 118,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  trackButton: {
    flex: 1,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  description: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
  },
  favoriteButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favorite: {
    color: colors.muted,
    fontSize: 24,
  },
  favoriteActive: {
    color: colors.coral,
  },
});
