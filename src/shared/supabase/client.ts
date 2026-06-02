import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { appConfig } from '../config/env';

const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }

    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export const isSupabaseConfigured =
  appConfig.supabaseUrl.length > 0 && appConfig.supabasePublishableKey.length > 0;

export const supabase = isSupabaseConfigured
  ? createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;
