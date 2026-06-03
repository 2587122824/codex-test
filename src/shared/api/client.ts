import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { appConfig } from '../config/env';
import { storage } from '../storage/storage';

const accessTokenKey = 'gudemian.aliyun-access-token';
const refreshTokenKey = 'gudemian.aliyun-refresh-token';

export type ApiSession = {
  user: ApiUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
};

export type ApiUser = {
  id: string;
  phone?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

const isWeb = Platform.OS === 'web';

const tokenStorage = {
  async getItem(key: string) {
    return isWeb ? storage.getJson<string | null>(key, null) : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (isWeb) {
      await storage.setJson(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (isWeb) {
      await storage.remove(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export const isApiConfigured = appConfig.apiBaseUrl.trim().length > 0;

const buildUrl = (path: string) => {
  const baseUrl = appConfig.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

export const saveApiSession = async (session: ApiSession) => {
  await tokenStorage.setItem(accessTokenKey, session.accessToken);
  if (session.refreshToken) {
    await tokenStorage.setItem(refreshTokenKey, session.refreshToken);
  }
};

export const clearApiSession = async () => {
  await Promise.all([
    tokenStorage.removeItem(accessTokenKey),
    tokenStorage.removeItem(refreshTokenKey),
  ]);
};

export const getAccessToken = () => tokenStorage.getItem(accessTokenKey);

const getRefreshToken = () => tokenStorage.getItem(refreshTokenKey);

const refreshApiSession = async () => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok || !data || typeof data !== 'object' || !('session' in data)) {
    await clearApiSession();
    return null;
  }

  const session = (data as { session: ApiSession }).session;
  await saveApiSession(session);
  return session.accessToken;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new Error('Aliyun API is not configured.');
  }

  const send = async (accessToken?: string | null) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.auth) {
      if (!accessToken) {
        throw new Error('Please sign in before syncing.');
      }
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return fetch(buildUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  };

  const accessToken = options.auth ? await getAccessToken() : null;
  let response = await send(accessToken);

  if (options.auth && response.status === 401) {
    const refreshedAccessToken = await refreshApiSession();
    if (refreshedAccessToken) {
      response = await send(refreshedAccessToken);
    }
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Cloud service request failed.';
    throw new Error(message);
  }

  return data as T;
}
