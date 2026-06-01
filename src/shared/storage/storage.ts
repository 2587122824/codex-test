import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async getJson<T>(key: string, fallback: T): Promise<T> {
    const value = await AsyncStorage.getItem(key);
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  },

  async setJson<T>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },
};
