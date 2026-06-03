import { Pressable, StyleSheet, Text } from 'react-native';

import { colors as defaultColors, spacing, type ThemeColors } from './theme';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
  colors?: ThemeColors;
};

export const PillButton = ({ label, active, onPress, colors = defaultColors }: Props) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      {
        backgroundColor: active ? colors.coral : colors.surface,
        borderColor: active ? colors.coral : colors.line,
      },
      { opacity: pressed ? 0.78 : 1 },
    ]}
  >
    <Text style={[styles.label, { color: active ? colors.white : colors.ink }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
