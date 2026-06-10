import { Heart, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioItem } from '../types/audio';
import { colors as defaultColors, spacing, type ThemeColors } from './theme';

type Props = {
  item: AudioItem;
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
  colors?: ThemeColors;
};

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const TrackRow = ({ item, isFavorite, onPress, onFavorite, colors = defaultColors }: Props) => (
  <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`播放 ${item.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.trackButton, { opacity: pressed ? 0.82 : 1 }]}
    >
      <View style={[styles.cover, { backgroundColor: item.cover }]}>
        <Play color={colors.white} fill={colors.white} size={20} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.ink }]}>{item.title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {item.category} · {formatDuration(item.duration)}
        </Text>
        <Text style={[styles.source, { color: colors.subtle }]} numberOfLines={1}>
          {item.source.license}
        </Text>
      </View>
    </Pressable>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? '取消收藏' : '收藏'}
      onPress={onFavorite}
      hitSlop={12}
      style={styles.favoriteButton}
    >
      <Heart
        color={isFavorite ? colors.coral : colors.muted}
        fill={isFavorite ? colors.coral : 'transparent'}
        size={20}
      />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    minHeight: 86,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.md,
  },
  trackButton: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cover: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
  },
  source: {
    fontSize: 11,
    fontWeight: '700',
  },
  favoriteButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
