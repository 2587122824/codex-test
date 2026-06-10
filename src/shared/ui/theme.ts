export const darkColors = {
  background: '#11151D',
  surface: '#1A202C',
  surfaceElevated: '#222938',
  surfaceSoft: '#151A24',
  ink: '#F5F7FB',
  muted: '#9AA7BC',
  subtle: '#657188',
  line: '#303746',
  night: '#0B0F17',
  coral: '#F27962',
  green: '#34C6A2',
  blue: '#7BA0FF',
  amber: '#E6A84E',
  white: '#FFFFFF',
};

export const lightColors = {
  background: '#F4F1EC',
  surface: '#FFFFFF',
  surfaceElevated: '#F7F4EF',
  surfaceSoft: '#ECE7DE',
  ink: '#18202D',
  muted: '#637087',
  subtle: '#8A94A6',
  line: '#DDD5C9',
  night: '#FAF7F1',
  coral: '#E9705C',
  green: '#168F78',
  blue: '#5F7FE5',
  amber: '#B7791F',
  white: '#FFFFFF',
};

export type ThemeColors = typeof darkColors;
export type ThemeMode = 'dark' | 'light';
export type UserThemePreference = 'system' | ThemeMode;

export const colors = darkColors;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
