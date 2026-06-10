import { useCallback, useEffect, useState } from 'react';

import {
  apiRequest,
  clearApiSession,
  isApiConfigured,
  saveApiSession,
  type ApiSession,
  type ApiUser,
} from '../../shared/api/client';
import type { LocalSyncSnapshot, RemoteSyncData } from './syncService';
import { syncUserData } from './syncService';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export type AccountSyncController = {
  configured: boolean;
  session: ApiSession | null;
  user: ApiUser | null;
  syncState: SyncState;
  syncError: string | null;
  lastSyncedAt: string | null;
  sendingOtp: boolean;
  verifyingOtp: boolean;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<boolean>;
  startOAuth: (provider: 'apple' | 'google' | 'wechat') => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

type Options = {
  getSnapshot: () => LocalSyncSnapshot;
  applyRemoteData: (data: RemoteSyncData) => void;
};

type SessionResponse = {
  session: ApiSession;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return '同步暂时失败，请稍后再试。';
};

export const useAccountSync = ({ getSnapshot, applyRemoteData }: Options): AccountSyncController => {
  const [session, setSession] = useState<ApiSession | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const syncNow = useCallback(async () => {
    if (!session?.user) {
      return;
    }

    setSyncState('syncing');
    setSyncError(null);

    try {
      const remote = await syncUserData(getSnapshot());
      applyRemoteData(remote);
      setLastSyncedAt(remote.syncedAt);
      setSyncState('success');
    } catch (error) {
      setSyncError(formatError(error));
      setSyncState('error');
    }
  }, [applyRemoteData, getSnapshot, session?.user]);

  useEffect(() => {
    if (!isApiConfigured) {
      return;
    }

    apiRequest<SessionResponse>('/auth/session', { auth: true })
      .then(({ session: nextSession }) => setSession(nextSession))
      .catch(() => {
        void clearApiSession();
      });
  }, []);

  useEffect(() => {
    if (session?.user) {
      void syncNow();
    }
    // Sync once when a signed-in session appears. Local mutations call syncNow explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const signInWithPhone = useCallback(async (phone: string) => {
    if (!isApiConfigured) {
      setSyncError('请先配置 EXPO_PUBLIC_API_BASE_URL，连接阿里云函数服务。');
      return;
    }

    setSendingOtp(true);
    setSyncError(null);

    try {
      await apiRequest<{ requestId: string }>('/auth/send-code', {
        method: 'POST',
        body: { phone },
      });
    } catch (error) {
      setSyncError(formatError(error));
      throw error;
    } finally {
      setSendingOtp(false);
    }
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    if (!isApiConfigured) {
      setSyncError('请先配置 EXPO_PUBLIC_API_BASE_URL，连接阿里云函数服务。');
      return false;
    }

    setVerifyingOtp(true);
    setSyncError(null);

    try {
      const { session: nextSession } = await apiRequest<SessionResponse>('/auth/verify-code', {
        method: 'POST',
        body: { phone, code: token },
      });
      await saveApiSession(nextSession);
      setSession(nextSession);
      return true;
    } catch (error) {
      setSyncError(formatError(error));
      return false;
    } finally {
      setVerifyingOtp(false);
    }
  }, []);

  const startOAuth = useCallback(async (provider: 'apple' | 'google' | 'wechat') => {
    const labels = {
      apple: 'Apple',
      google: 'Google',
      wechat: '微信',
    };
    setSyncError(`${labels[provider]} 登录已预留入口，需要接入对应开放平台后由阿里云函数换取用户身份。`);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (session) {
        await apiRequest('/auth/logout', { method: 'POST', auth: true });
      }
    } catch {
      // Local sign-out should still work if the network is unavailable.
    }

    await clearApiSession();
    setSession(null);
    setSyncState('idle');
  }, [session]);

  return {
    configured: isApiConfigured,
    session,
    user: session?.user ?? null,
    syncState,
    syncError,
    lastSyncedAt,
    sendingOtp,
    verifyingOtp,
    signInWithPhone,
    verifyPhoneOtp,
    startOAuth,
    signOut,
    syncNow,
  };
};
