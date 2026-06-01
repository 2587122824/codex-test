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
      <Text style={styles.subtitle}>{module.subtitle}</Text>
      <Text style={styles.description}>{module.description}</Text>
    </View>
    <Text style={styles.arrow}>›</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    minHeight: 126,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  description: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  arrow: {
    color: colors.muted,
    fontSize: 34,
  },
});
