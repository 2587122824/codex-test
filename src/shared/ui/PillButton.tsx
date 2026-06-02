import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
};

export const PillButton = ({ label, active, onPress }: Props) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      active && styles.active,
      { opacity: pressed ? 0.78 : 1 },
    ]}
  >
    <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  active: {
    backgroundColor: colors.coral,
    borderColor: colors.coral,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  activeLabel: {
    color: '#FFFFFF',
  },
});
