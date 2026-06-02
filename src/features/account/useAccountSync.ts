import type { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { appConfig } from '../../shared/config/env';
import { isSupabaseConfigured, supabase } from '../../shared/supabase/client';
import type { LocalSyncSnapshot, RemoteSyncData } from './syncService';
import { syncUserData } from './syncService';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export type AccountSyncController = {
  configured: boolean;
  session: Session | null;
  user: User | null;
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

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return '同步暂时失败，请稍后再试。';
};

export const useAccountSync = ({ getSnapshot, applyRemoteData }: Options): AccountSyncController => {
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const syncNow = useCallback(async () => {
    if (!supabase || !session?.user) {
      return;
    }

    setSyncState('syncing');
    setSyncError(null);

    try {
      const remote = await syncUserData(session.user.id, getSnapshot());
      applyRemoteData(remote);
      setLastSyncedAt(remote.syncedAt);
      setSyncState('success');
    } catch (error) {
      setSyncError(formatError(error));
      setSyncState('error');
    }
  }, [applyRemoteData, getSnapshot, session?.user]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      void syncNow();
    }
    // Sync once when a signed-in session appears. Local mutations call syncNow explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const signInWithPhone = useCallback(async (phone: string) => {
    if (!supabase) {
      setSyncError('请先配置 Supabase URL 和 publishable key。');
      return;
    }

    setSendingOtp(true);
    setSyncError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        throw error;
      }
    } catch (error) {
      setSyncError(formatError(error));
      throw error;
    } finally {
      setSendingOtp(false);
    }
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    if (!supabase) {
      setSyncError('请先配置 Supabase URL 和 publishable key。');
      return false;
    }

    setVerifyingOtp(true);
    setSyncError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      if (error) {
        throw error;
      }

      setSession(data.session);
      return true;
    } catch (error) {
      setSyncError(formatError(error));
      return false;
    } finally {
      setVerifyingOtp(false);
    }
  }, []);

  const startOAuth = useCallback(async (provider: 'apple' | 'google' | 'wechat') => {
    if (!supabase) {
      setSyncError('请先配置 Supabase URL 和 publishable key。');
      return;
    }

    if (provider === 'wechat') {
      setSyncError('微信登录需要微信开放平台配置，当前版本先预留入口。');
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: appConfig.authRedirectUrl,
      },
    });
    if (error) {
      setSyncError(formatError(error));
      return;
    }

    if (data.url) {
      await Linking.openURL(data.url);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setSyncState('idle');
  }, []);

  return {
    configured: isSupabaseConfigured,
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
