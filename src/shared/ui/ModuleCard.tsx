import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ModuleDefinition } from '../types/audio';
import { colors, spacing } from './theme';

type Props = {
  module: ModuleDefinition;
  onPress: () => void;
};

export const ModuleCard = ({ module, onPress }: Props) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={module.title}
    onPress={onPress}
    style={({ pressed }) => [
      styles.card,
      { borderLeftColor: module.accent, opacity: pressed ? 0.82 : 1 },
    ]}
  >
    <View style={[styles.mark, { backgroundColor: module.accent }]} />
    <View style={styles.content}>
      <Text style={styles.title}>{module.title}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {module.subtitle}
      </Text>
    </View>
    <ChevronRight color={colors.muted} size={20} />
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
});
