import { BookOpenText, ChevronRight, Music2, Waves } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioType, ModuleDefinition } from '../types/audio';
import { colors as defaultColors, spacing, type ThemeColors } from './theme';

type Props = {
  module: ModuleDefinition;
  onPress: () => void;
  colors?: ThemeColors;
};

const getModuleIcon = (type: AudioType, color: string) => {
  if (type === 'story') {
    return <BookOpenText color={color} size={23} strokeWidth={2.2} />;
  }

  if (type === 'noise') {
    return <Waves color={color} size={24} strokeWidth={2.2} />;
  }

  return <Music2 color={color} size={24} strokeWidth={2.2} />;
};

export const ModuleCard = ({ module, onPress, colors = defaultColors }: Props) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={module.title}
    onPress={onPress}
    style={({ pressed }) => [
      styles.card,
      { backgroundColor: colors.surface, borderColor: colors.line },
      { borderLeftColor: module.accent, opacity: pressed ? 0.82 : 1 },
    ]}
  >
    <View
      style={[
        styles.iconBadge,
        {
          backgroundColor: module.accent,
          shadowColor: module.accent,
        },
      ]}
    >
      {getModuleIcon(module.type, colors.white)}
    </View>
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.ink }]}>{module.title}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
        {module.subtitle}
      </Text>
    </View>
    <ChevronRight color={colors.muted} size={20} />
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
  },
});
