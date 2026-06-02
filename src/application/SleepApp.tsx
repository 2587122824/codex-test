import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft,
  Clock3,
  Cloud,
  Heart,
  Home,
  ListMusic,
  LogOut,
  Moon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Square,
  Timer,
  UserCircle,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAudioPlayer } from '../features/player/useAudioPlayer';
import { useAccountSync, type AccountSyncController } from '../features/account/useAccountSync';
import type { RemoteSyncData } from '../features/account/syncService';
import { useSleepLogs } from '../features/sleep-log/useSleepLogs';
import { appConfig } from '../shared/config/env';
import { audioCatalog, getItemsByType, getModule, modules } from '../shared/content/audioCatalog';
import { storageKeys } from '../shared/storage/keys';
import { storage } from '../shared/storage/storage';
import type { AudioItem, AudioType, PlaybackMode } from '../shared/types/audio';
import type { SleepLogEntry, UserSettings } from '../shared/types/sleep';
import { ModuleCard } from '../shared/ui/ModuleCard';
import { PillButton } from '../shared/ui/PillButton';
import { TrackRow } from '../shared/ui/TrackRow';
import { colors, spacing } from '../shared/ui/theme';

type Screen = 'home' | 'module' | 'player' | 'favorites' | 'sleep-log' | 'credits' | 'privacy' | 'settings' | 'account';

const defaultSettings: UserSettings = {
  defaultSleepTimerMinutes: 30,
};

const betaFeedbackEmail = 'codex-sleep-feedback@example.com';

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder} 分钟`;
  }

  return `${hours} 小时 ${remainder} 分钟`;
};

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));

const toDateTimeInput = (isoDate: string) => {
  const date = new Date(isoDate);
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseDateTimeInput = (value: string) => {
  const normalized = value.trim().replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createEntityId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  return randomUUID ? randomUUID.call(globalThis.crypto) : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createSleepLogDraft = () => {
  const wakeAt = new Date();
  const sleepAt = new Date(wakeAt.getTime() - 7.5 * 60 * 60 * 1000);

  return {
    id: createEntityId(),
    sleepAt: sleepAt.toISOString(),
    wakeAt: wakeAt.toISOString(),
    durationMinutes: 450,
    rating: 4 as const,
    note: '睡前完成一次助眠播放',
  };
};

export default function SleepApp() {
  const player = useAudioPlayer();
  const sleepLogs = useSleepLogs();
  const [screen, setScreen] = useState<Screen>('home');
  const [activeModule, setActiveModule] = useState<AudioType>('music');
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [customTimer, setCustomTimer] = useState('25');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [sleepAtInput, setSleepAtInput] = useState('');
  const [wakeAtInput, setWakeAtInput] = useState('');
  const [ratingInput, setRatingInput] = useState('4');
  const [noteInput, setNoteInput] = useState('');

  useEffect(() => {
    storage.getJson(storageKeys.settings, defaultSettings).then(setSettings);
  }, []);

  const saveSettings = (next: UserSettings) => {
    setSettings(next);
    storage.setJson(storageKeys.settings, next);
  };

  const moduleItems = useMemo(() => getItemsByType(activeModule), [activeModule]);
  const activeModuleInfo = getModule(activeModule);
  const recentTracks = player.historyIds
    .map((id) => audioCatalog.find((item) => item.id === id))
    .filter(Boolean) as AudioItem[];
  const favoriteTracks = audioCatalog.filter((item) => player.favoriteIds.includes(item.id));
  const getSyncSnapshot = useCallback(
    () => ({
      favoriteIds: player.favoriteIds,
      historyIds: player.historyIds,
      sleepLogs: sleepLogs.logs,
      settings,
    }),
    [player.favoriteIds, player.historyIds, settings, sleepLogs.logs],
  );
  const applyRemoteData = useCallback(
    (data: RemoteSyncData) => {
      player.replaceLibraryData(data.favoriteIds, data.historyIds);
      sleepLogs.replaceLogs(data.sleepLogs);
      setSettings(data.settings);
      storage.setJson(storageKeys.settings, data.settings);
    },
    [player.replaceLibraryData, sleepLogs.replaceLogs],
  );
  const account = useAccountSync({
    getSnapshot: getSyncSnapshot,
    applyRemoteData,
  });

  const syncIfSignedIn = useCallback(() => {
    if (account.user) {
      setTimeout(() => {
        void account.syncNow();
      }, 0);
    }
  }, [account.syncNow, account.user]);

  const saveSettingsAndSync = (next: UserSettings) => {
    saveSettings(next);
    syncIfSignedIn();
  };

  const toggleFavoriteAndSync = (trackId: string) => {
    player.toggleFavorite(trackId);
    syncIfSignedIn();
  };

  const openTrack = async (track: AudioItem, sourceQueue?: AudioItem[]) => {
    await player.playTrack(track, sourceQueue);
    if (!player.timerEndsAt && settings.defaultSleepTimerMinutes > 0) {
      player.setSleepTimer(settings.defaultSleepTimerMinutes);
    }
    setScreen('player');
    syncIfSignedIn();
  };

  const openFeedback = () => {
    Linking.openURL(
      `mailto:${betaFeedbackEmail}?subject=${encodeURIComponent('Codex Sleep 内测反馈')}`,
    );
  };

  const setCustomSleepTimer = () => {
    const minutes = Number(customTimer);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
      Alert.alert('请输入 1 到 480 分钟之间的定时时长');
      return;
    }
    player.setSleepTimer(minutes);
  };

  const beginSleepLogEdit = (log?: SleepLogEntry) => {
    const draft = log ?? createSleepLogDraft();
    setEditingLogId(log?.id ?? null);
    setSleepAtInput(toDateTimeInput(draft.sleepAt));
    setWakeAtInput(toDateTimeInput(draft.wakeAt));
    setRatingInput(`${draft.rating}`);
    setNoteInput(draft.note ?? '');
  };

  const saveSleepLog = () => {
    const sleepAt = parseDateTimeInput(sleepAtInput);
    const wakeAt = parseDateTimeInput(wakeAtInput);
    const rating = Number(ratingInput);

    if (!sleepAt || !wakeAt || wakeAt <= sleepAt) {
      Alert.alert('请检查睡眠时间', '醒来时间需要晚于入睡时间，格式示例：2026-06-01 23:30');
      return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      Alert.alert('请填写 1 到 5 之间的睡眠评分');
      return;
    }

    const entry: SleepLogEntry = {
      id: editingLogId ?? createEntityId(),
      sleepAt: sleepAt.toISOString(),
      wakeAt: wakeAt.toISOString(),
      durationMinutes: Math.round((wakeAt.getTime() - sleepAt.getTime()) / 60000),
      rating: rating as SleepLogEntry['rating'],
      note: noteInput.trim(),
    };

    if (editingLogId) {
      sleepLogs.updateLog(entry);
    } else {
      sleepLogs.addLog(entry);
    }

    setEditingLogId(null);
    setSleepAtInput('');
    setWakeAtInput('');
    setRatingInput('4');
    setNoteInput('');
    syncIfSignedIn();
  };

  const removeSleepLogAndSync = (id: string) => {
    sleepLogs.removeLog(id);
    syncIfSignedIn();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{appConfig.appEnv.toUpperCase()}</Text>
            <Text style={styles.appTitle}>{appConfig.appName}</Text>
          </View>
          {screen !== 'home' ? (
            <Pressable style={styles.headerButton} onPress={() => setScreen('home')}>
              <Home color={colors.ink} size={18} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            screen === 'player' && styles.playerScrollContent,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {screen === 'home' ? (
            <View style={styles.stack}>
              <View style={styles.hero}>
                <Text style={styles.heroTitle}>今晚慢一点入睡</Text>
                <Text style={styles.heroCopy}>
                  选择音乐、故事或白噪音，设置定时关闭，留下一条简单睡眠记录。
                </Text>
              </View>

              <View style={styles.stack}>
                {modules
                  .filter((module) => {
                    if (module.type === 'music') return appConfig.flags.musicSleep;
                    if (module.type === 'story') return appConfig.flags.storySleep;
                    return appConfig.flags.noiseSleep;
                  })
                  .map((module) => (
                    <ModuleCard
                      key={module.type}
                      module={module}
                      onPress={() => {
                        setActiveModule(module.type);
                        setScreen('module');
                      }}
                    />
                  ))}
              </View>

              <QuickSections
                recentTracks={recentTracks}
                favoriteTracks={favoriteTracks}
                onOpenTrack={openTrack}
                onFavorite={toggleFavoriteAndSync}
                isFavorite={player.isFavorite}
                onOpenFavorites={() => setScreen('favorites')}
              />
            </View>
          ) : null}

          {screen === 'module' && activeModuleInfo ? (
            <View style={styles.stack}>
              <View style={[styles.moduleHeader, { borderColor: activeModuleInfo.accent }]}>
                <Text style={styles.moduleTitle}>{activeModuleInfo.title}</Text>
                <Text style={styles.moduleCopy}>{activeModuleInfo.description}</Text>
              </View>
              {moduleItems.map((item) => (
                <TrackRow
                  key={item.id}
                  item={item}
                  isFavorite={player.isFavorite(item.id)}
                  onPress={() => openTrack(item, moduleItems)}
                  onFavorite={() => toggleFavoriteAndSync(item.id)}
                />
              ))}
            </View>
          ) : null}

          {screen === 'player' ? (
            <View style={styles.stack}>
              <PlayerPanel
                currentTrack={player.currentTrack}
                playbackState={player.playbackState}
                playbackError={player.playbackError}
                positionMillis={player.positionMillis}
                durationMillis={player.durationMillis}
                progress={player.progress}
                activeTimerMinutes={player.activeTimerMinutes}
                remainingSeconds={player.remainingSeconds}
                timerOptions={player.timerOptions}
                customTimer={customTimer}
                setCustomTimer={setCustomTimer}
                isFavorite={player.currentTrack ? player.isFavorite(player.currentTrack.id) : false}
                onTogglePlayback={player.togglePlayback}
                onSeek={player.seekToMillis}
                onStop={player.stop}
                onFavorite={() => {
                  if (player.currentTrack) {
                    toggleFavoriteAndSync(player.currentTrack.id);
                  }
                }}
                onTimer={player.setSleepTimer}
                onCustomTimer={setCustomSleepTimer}
                playbackMode={player.playbackMode}
                queuePosition={player.currentIndex + 1}
                queueLength={player.queue.length}
                onPlaybackMode={player.setPlaybackMode}
                onNext={player.playNext}
                onPrevious={player.playPrevious}
              />
            </View>
          ) : null}

          {screen === 'favorites' ? (
            <View style={styles.stack}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>我的收藏</Text>
                  <Text style={styles.sectionMeta}>集中管理你常听的助眠内容。</Text>
                </View>
              </View>
              {favoriteTracks.length === 0 ? (
                <EmptyState text="还没有收藏内容，回到列表点击星标即可收藏。" />
              ) : (
                favoriteTracks.map((item) => (
                  <TrackRow
                    key={item.id}
                    item={item}
                    isFavorite={player.isFavorite(item.id)}
                    onPress={() => openTrack(item, favoriteTracks)}
                    onFavorite={() => toggleFavoriteAndSync(item.id)}
                  />
                ))
              )}
            </View>
          ) : null}

          {screen === 'sleep-log' ? (
            <View style={styles.stack}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>睡眠记录</Text>
                  <Text style={styles.sectionMeta}>
                    平均睡眠 {sleepLogs.averageMinutes ? formatMinutes(sleepLogs.averageMinutes) : '暂无'}
                  </Text>
                </View>
                <Pressable style={styles.primaryButton} onPress={() => beginSleepLogEdit()}>
                  <Text style={styles.primaryButtonText}>新增</Text>
                </Pressable>
              </View>
              {sleepAtInput || wakeAtInput ? (
                <View style={styles.formPanel}>
                  <Text style={styles.settingTitle}>{editingLogId ? '编辑睡眠记录' : '新增睡眠记录'}</Text>
                  <TextInput
                    value={sleepAtInput}
                    onChangeText={setSleepAtInput}
                    placeholder="入睡时间，例如 2026-06-01 23:30"
                    style={styles.textInput}
                  />
                  <TextInput
                    value={wakeAtInput}
                    onChangeText={setWakeAtInput}
                    placeholder="醒来时间，例如 2026-06-02 07:00"
                    style={styles.textInput}
                  />
                  <TextInput
                    value={ratingInput}
                    onChangeText={setRatingInput}
                    keyboardType="number-pad"
                    placeholder="睡眠评分 1-5"
                    style={styles.textInput}
                  />
                  <TextInput
                    value={noteInput}
                    onChangeText={setNoteInput}
                    placeholder="备注，例如 半夜醒来一次"
                    style={[styles.textInput, styles.noteInput]}
                    multiline
                  />
                  <View style={styles.playerControls}>
                    <Pressable style={styles.primaryButton} onPress={saveSleepLog}>
                      <Text style={styles.primaryButtonText}>保存</Text>
                    </Pressable>
                    <Pressable
                      style={styles.subtleButton}
                      onPress={() => {
                        setEditingLogId(null);
                        setSleepAtInput('');
                        setWakeAtInput('');
                        setNoteInput('');
                      }}
                    >
                      <Text style={styles.subtleButtonText}>取消</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {sleepLogs.logs.length === 0 ? (
                <EmptyState text="还没有睡眠记录，先新增一条快速记录。" />
              ) : (
                sleepLogs.logs.map((log) => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={styles.logBody}>
                      <Text style={styles.logTitle}>{formatMinutes(log.durationMinutes)}</Text>
                      <Text style={styles.logMeta}>
                        {formatDateTime(log.sleepAt)} - {formatDateTime(log.wakeAt)}
                      </Text>
                      <Text style={styles.logMeta}>睡眠评分：{log.rating}/5</Text>
                      {log.note ? <Text style={styles.logMeta}>备注：{log.note}</Text> : null}
                    </View>
                    <View style={styles.logActions}>
                      <Pressable onPress={() => beginSleepLogEdit(log)} style={styles.subtleButton}>
                        <Text style={styles.subtleButtonText}>编辑</Text>
                      </Pressable>
                      <Pressable onPress={() => removeSleepLogAndSync(log.id)} style={styles.subtleButton}>
                        <Text style={styles.subtleButtonText}>删除</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {screen === 'settings' ? (
            <View style={styles.stack}>
              <Text style={styles.sectionTitle}>设置</Text>
              <View style={styles.settingRow}>
                <View style={styles.accountSummaryRow}>
                  <View style={styles.accountSummaryIcon}>
                    <Cloud color={colors.green} size={20} />
                  </View>
                  <View style={styles.settingCopy}>
                    <Text style={styles.settingTitle}>账号与同步</Text>
                    <Text style={styles.settingMeta}>
                      {account.user
                        ? `已登录 · ${account.syncState === 'syncing' ? '同步中' : account.lastSyncedAt ? '已同步' : '待同步'}`
                        : account.configured
                          ? '游客使用中，可登录同步数据'
                          : '未配置阿里云 API，当前仅本地保存'}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.subtleButton} onPress={() => setScreen('account')}>
                  <Text style={styles.subtleButtonText}>{account.user ? '管理账号' : '登录 / 注册'}</Text>
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>默认定时关闭</Text>
                  <Text style={styles.settingMeta}>{settings.defaultSleepTimerMinutes} 分钟</Text>
                </View>
                <View style={styles.pillWrap}>
                  {[15, 30, 45, 60].map((minutes) => (
                    <PillButton
                      key={minutes}
                      label={`${minutes}`}
                      active={settings.defaultSleepTimerMinutes === minutes}
                      onPress={() => saveSettingsAndSync({ defaultSleepTimerMinutes: minutes })}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingTitle}>内容来源</Text>
                <Text style={styles.settingMeta}>
                  {appConfig.audioSource === 'local' ? '本地内置音频' : appConfig.audioSource}
                </Text>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingTitle}>内测反馈</Text>
                <Text style={styles.settingMeta}>
                  遇到播放失败、定时不准或文案问题，可以把复现步骤发给我们。
                </Text>
                <View style={styles.playerControls}>
                  <Pressable style={styles.subtleButton} onPress={openFeedback}>
                    <Text style={styles.subtleButtonText}>发送反馈</Text>
                  </Pressable>
                </View>
                <Text style={styles.settingMeta}>{betaFeedbackEmail}</Text>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingTitle}>上线合规</Text>
                <Text style={styles.settingMeta}>查看音频版权和隐私说明，确保上架资料与 App 行为一致。</Text>
                <View style={styles.playerControls}>
                  <Pressable style={styles.subtleButton} onPress={() => setScreen('credits')}>
                    <Text style={styles.subtleButtonText}>音频版权</Text>
                  </Pressable>
                  <Pressable style={styles.subtleButton} onPress={() => setScreen('privacy')}>
                    <Text style={styles.subtleButtonText}>隐私说明</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {screen === 'account' ? (
            <AccountPanel
              account={account}
              onBack={() => setScreen('settings')}
            />
          ) : null}

          {screen === 'credits' ? (
            <View style={styles.stack}>
              <Text style={styles.sectionTitle}>音频来源与版权</Text>
              <Text style={styles.sectionMeta}>
                当前 MVP 使用项目本地生成样例音频。替换正式素材时，需要保留作者、授权和来源链接。
              </Text>
              {audioCatalog.map((item) => (
                <View key={item.id} style={styles.legalRow}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingMeta}>作者：{item.source.author}</Text>
                  <Text style={styles.settingMeta}>授权：{item.source.license}</Text>
                  <Text style={styles.settingMeta}>来源：{item.source.name}</Text>
                  <Text style={styles.settingMeta}>链接：{item.source.url}</Text>
                  <Text style={styles.settingMeta}>
                    {item.source.attributionRequired ? '需要在 App 内署名' : '无需额外署名'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {screen === 'privacy' ? (
            <View style={styles.stack}>
              <Text style={styles.sectionTitle}>隐私说明</Text>
              <View style={styles.legalRow}>
                <Text style={styles.settingTitle}>本地数据</Text>
                <Text style={styles.settingMeta}>
                  游客模式不上传数据。收藏、最近播放、设置和睡眠记录会先保存在本机，离线时仍可使用。
                </Text>
              </View>
              <View style={styles.legalRow}>
                <Text style={styles.settingTitle}>账号同步</Text>
                <Text style={styles.settingMeta}>
                  登录后会把手机号账号标识、收藏、最近播放、设置和睡眠记录同步到云端，用于多设备恢复和备份。当前不上传音频文件，不接入广告或分析 SDK。
                </Text>
              </View>
              <View style={styles.legalRow}>
                <Text style={styles.settingTitle}>健康声明</Text>
                <Text style={styles.settingMeta}>
                  本 App 只提供放松和睡前陪伴，不用于诊断、治疗或替代专业医疗建议。
                </Text>
              </View>
              <View style={styles.legalRow}>
                <Text style={styles.settingTitle}>正式上线前</Text>
                <Text style={styles.settingMeta}>
                  Google Play 数据安全表单和隐私政策需要声明账号与同步数据；后续正式版应提供删除账号和清除云端数据入口。
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {player.currentTrack && screen !== 'player' ? (
          <MiniPlayerBar
            currentTrack={player.currentTrack}
            playbackState={player.playbackState}
            progress={player.progress}
            onOpen={() => setScreen('player')}
            onTogglePlayback={player.togglePlayback}
          />
        ) : null}

        {screen !== 'player' ? (
          <View style={[styles.tabBar, player.currentTrack && styles.tabBarWithMini]}>
            <TabButton
              label="助眠"
              icon={(color) => <Moon color={color} size={18} />}
              active={screen === 'home' || screen === 'module'}
              onPress={() => setScreen('home')}
            />
            <TabButton
              label="播放"
              icon={(color) => <Play color={color} fill={color} size={18} />}
              active={false}
              onPress={() => setScreen('player')}
            />
            <TabButton
              label="记录"
              icon={(color) => <Clock3 color={color} size={18} />}
              active={screen === 'sleep-log'}
              onPress={() => setScreen('sleep-log')}
            />
            <TabButton
              label="设置"
              icon={(color) => <Settings color={color} size={18} />}
              active={screen === 'settings' || screen === 'account' || screen === 'credits' || screen === 'privacy'}
              onPress={() => setScreen('settings')}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

type QuickSectionsProps = {
  recentTracks: AudioItem[];
  favoriteTracks: AudioItem[];
  onOpenTrack: (track: AudioItem, sourceQueue?: AudioItem[]) => void;
  onFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
  onOpenFavorites: () => void;
};

const formatSyncTime = (isoDate: string | null) => {
  if (!isoDate) {
    return '尚未同步';
  }

  return `上次同步 ${formatDateTime(isoDate)}`;
};

const AccountPanel = ({
  account,
  onBack,
}: {
  account: AccountSyncController;
  onBack: () => void;
}) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone.startsWith('+')) {
      Alert.alert('请输入国际区号', '手机号需要包含国家区号，例如 +86 13800000000。');
      return;
    }

    await account.signInWithPhone(normalizedPhone);
    setOtpSent(true);
  };

  const verifyOtp = async () => {
    const ok = await account.verifyPhoneOtp(phone.trim(), otp.trim());
    if (ok) {
      setOtp('');
      setOtpSent(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>账号与同步</Text>
          <Text style={styles.sectionMeta}>登录后同步收藏、最近播放、睡眠记录和设置。</Text>
        </View>
        <IconButton label="返回设置" onPress={onBack}>
          <ChevronLeft color={colors.ink} size={18} />
        </IconButton>
      </View>

      {!account.configured ? (
        <View style={styles.settingRow}>
          <View style={styles.accountSummaryRow}>
            <UserCircle color={colors.amber} size={22} />
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>当前为游客模式</Text>
              <Text style={styles.settingMeta}>
                配置 EXPO_PUBLIC_API_BASE_URL 后即可启用阿里云账号登录与同步。
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {account.user ? (
        <View style={styles.settingRow}>
          <View style={styles.accountSummaryRow}>
            <View style={styles.accountSummaryIcon}>
              <UserCircle color={colors.green} size={22} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>已登录</Text>
              <Text style={styles.settingMeta}>
                {account.user.phone || account.user.nickname || account.user.id}
              </Text>
              <Text style={styles.settingMeta}>
                {account.syncState === 'syncing' ? '正在同步本机数据' : formatSyncTime(account.lastSyncedAt)}
              </Text>
            </View>
          </View>
          {account.syncError ? <Text style={styles.errorText}>{account.syncError}</Text> : null}
          <View style={styles.playerControls}>
            <Pressable style={styles.subtleButton} onPress={account.syncNow}>
              <View style={styles.inlineButtonContent}>
                <RefreshCw color={colors.ink} size={16} />
                <Text style={styles.subtleButtonText}>立即同步</Text>
              </View>
            </Pressable>
            <Pressable style={styles.subtleButton} onPress={account.signOut}>
              <View style={styles.inlineButtonContent}>
                <LogOut color={colors.ink} size={16} />
                <Text style={styles.subtleButtonText}>退出登录</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : account.configured ? (
        <View style={styles.settingRow}>
          <View style={styles.accountSummaryRow}>
            <Smartphone color={colors.green} size={22} />
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>手机号验证码登录 / 注册</Text>
              <Text style={styles.settingMeta}>游客数据会在登录成功后自动合并到云端。</Text>
            </View>
          </View>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+86 13800000000"
            placeholderTextColor={colors.subtle}
            style={styles.textInput}
          />
          {otpSent ? (
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="短信验证码"
              placeholderTextColor={colors.subtle}
              style={styles.textInput}
            />
          ) : null}
          {account.syncError ? <Text style={styles.errorText}>{account.syncError}</Text> : null}
          <Pressable
            style={styles.primaryButton}
            onPress={otpSent ? verifyOtp : sendOtp}
            disabled={account.sendingOtp || account.verifyingOtp}
          >
            <Text style={styles.primaryButtonText}>
              {otpSent
                ? account.verifyingOtp
                  ? '验证中'
                  : '登录并同步'
                : account.sendingOtp
                  ? '发送中'
                  : '发送验证码'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {account.configured ? (
      <View style={styles.settingRow}>
        <Text style={styles.settingTitle}>社交登录</Text>
        <Text style={styles.settingMeta}>
          微信登录需要微信开放平台；Apple/Google 登录需要对应平台配置，再由阿里云函数统一换取 App 会话。
        </Text>
        <View style={styles.playerControls}>
          <Pressable style={styles.subtleButton} onPress={() => account.startOAuth('wechat')}>
            <Text style={styles.subtleButtonText}>微信</Text>
          </Pressable>
          <Pressable style={styles.subtleButton} onPress={() => account.startOAuth('apple')}>
            <Text style={styles.subtleButtonText}>Apple</Text>
          </Pressable>
          <Pressable style={styles.subtleButton} onPress={() => account.startOAuth('google')}>
            <Text style={styles.subtleButtonText}>Google</Text>
          </Pressable>
        </View>
      </View>
      ) : null}
    </View>
  );
};

const QuickSections = ({
  recentTracks,
  favoriteTracks,
  onOpenTrack,
  onFavorite,
  isFavorite,
  onOpenFavorites,
}: QuickSectionsProps) => (
  <View style={styles.stack}>
    <Text style={styles.sectionTitle}>最近播放</Text>
    {recentTracks.length === 0 ? (
      <EmptyState text="播放任意内容后，这里会显示最近记录。" />
    ) : (
      recentTracks.slice(0, 3).map((item) => (
        <TrackRow
          key={item.id}
          item={item}
          isFavorite={isFavorite(item.id)}
          onPress={() => onOpenTrack(item, recentTracks)}
          onFavorite={() => onFavorite(item.id)}
        />
      ))
    )}
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>我的收藏</Text>
      <Pressable style={styles.subtleButton} onPress={onOpenFavorites}>
        <Text style={styles.subtleButtonText}>查看全部</Text>
      </Pressable>
    </View>
    {favoriteTracks.length === 0 ? (
      <EmptyState text="点击列表里的星标即可收藏。" />
    ) : (
      favoriteTracks.slice(0, 3).map((item) => (
        <TrackRow
          key={item.id}
          item={item}
          isFavorite={isFavorite(item.id)}
          onPress={() => onOpenTrack(item, favoriteTracks)}
          onFavorite={() => onFavorite(item.id)}
        />
      ))
    )}
  </View>
);

type PlayerPanelProps = {
  currentTrack: AudioItem | null;
  playbackMode: PlaybackMode;
  playbackState: string;
  playbackError: string | null;
  positionMillis: number;
  durationMillis: number;
  progress: number;
  queuePosition: number;
  queueLength: number;
  activeTimerMinutes: number | null;
  remainingSeconds: number;
  timerOptions: number[];
  customTimer: string;
  setCustomTimer: (value: string) => void;
  isFavorite: boolean;
  onTogglePlayback: () => void;
  onSeek: (millis: number) => void;
  onStop: () => void;
  onFavorite: () => void;
  onPlaybackMode: (mode: PlaybackMode) => void;
  onNext: () => void;
  onPrevious: () => void;
  onTimer: (minutes: number | null) => void;
  onCustomTimer: () => void;
};

const playbackModeOptions: { mode: PlaybackMode; label: string }[] = [
  { mode: 'repeat-one', label: '单曲循环' },
  { mode: 'sequential', label: '顺序播放' },
  { mode: 'repeat-all', label: '列表循环' },
  { mode: 'shuffle', label: '随机播放' },
];

const getPlaybackModeLabel = (mode: PlaybackMode) =>
  playbackModeOptions.find((option) => option.mode === mode)?.label ?? '列表循环';

const getPlaybackModeIcon = (mode: PlaybackMode, color = colors.muted) => {
  if (mode === 'shuffle') {
    return <Shuffle color={color} size={16} />;
  }

  if (mode === 'sequential') {
    return <ListMusic color={color} size={16} />;
  }

  return <RotateCcw color={color} size={16} />;
};

const PlayerPanel = ({
  currentTrack,
  playbackMode,
  playbackState,
  playbackError,
  positionMillis,
  durationMillis,
  progress,
  queuePosition,
  queueLength,
  activeTimerMinutes,
  remainingSeconds,
  timerOptions,
  customTimer,
  setCustomTimer,
  isFavorite,
  onTogglePlayback,
  onSeek,
  onStop,
  onFavorite,
  onPlaybackMode,
  onNext,
  onPrevious,
  onTimer,
  onCustomTimer,
}: PlayerPanelProps) => {
  if (!currentTrack) {
    return <EmptyState text="还没有正在播放的内容，请先从首页选择一首音乐、故事或白噪音。" />;
  }

  const timerSummary = activeTimerMinutes
    ? `剩余 ${Math.ceil(remainingSeconds / 60)} 分钟`
    : '未开启';

  return (
    <View style={styles.playerPanel}>
      <View style={styles.playerTopBar}>
        <View style={styles.playerSourcePill}>
          <Text style={styles.playerSourcePillText}>{currentTrack.category}</Text>
        </View>
        <Text style={styles.playerQueueText}>
          {queueLength > 0 ? `${queuePosition} / ${queueLength}` : '1 / 1'}
        </Text>
      </View>

      <View style={styles.playerHeroArea}>
        <View style={[styles.playerDisc, { borderColor: currentTrack.cover }]}>
          <View style={[styles.playerDiscInner, { backgroundColor: currentTrack.cover }]}>
            <Play color={colors.white} fill={colors.white} size={34} />
          </View>
        </View>
        <View style={styles.playerHeading}>
          <Text style={styles.playerTitle} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.playerMeta} numberOfLines={1}>
            {getPlaybackModeLabel(playbackMode)} · {timerSummary}
          </Text>
        </View>
      </View>

      <View style={styles.playerPrimaryArea}>
        <ProgressBar
          positionMillis={positionMillis}
          durationMillis={durationMillis}
          progress={progress}
          onSeek={onSeek}
        />
        <CaptionDisplay currentTrack={currentTrack} positionMillis={positionMillis} />
        {playbackError ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{playbackError}</Text>
            <Pressable style={styles.subtleButton} onPress={onNext}>
              <Text style={styles.subtleButtonText}>换一首</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.playerControls}>
          <IconButton label="上一首" onPress={onPrevious} variant="ghost">
            <SkipBack color={colors.ink} fill={colors.ink} size={24} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playbackState === 'playing' ? '暂停' : '播放'}
            style={({ pressed }) => [styles.playButton, { opacity: pressed ? 0.84 : 1 }]}
            onPress={onTogglePlayback}
          >
            {playbackState === 'playing' ? (
              <Pause color={colors.white} fill={colors.white} size={34} />
            ) : (
              <Play color={colors.white} fill={colors.white} size={34} />
            )}
          </Pressable>
          <IconButton label="下一首" onPress={onNext} variant="ghost">
            <SkipForward color={colors.ink} fill={colors.ink} size={24} />
          </IconButton>
        </View>
        <View style={styles.timerSummaryRow}>
          <Timer color={colors.green} size={16} />
          <Text style={styles.timerSummaryText}>
            {activeTimerMinutes ? `定时关闭 · ${timerSummary}` : '定时关闭未开启'}
          </Text>
        </View>
      </View>

      <View style={styles.timerBlock}>
        <View style={styles.playerSectionHeader}>
          <Text style={styles.sectionTitle}>定时关闭</Text>
          <Text style={styles.modeSummary}>
            {activeTimerMinutes
              ? `约 ${activeTimerMinutes} 分钟后关闭`
              : '未开启'}
          </Text>
        </View>
        <View style={styles.pillWrap}>
          {timerOptions.map((minutes) => (
            <PillButton
              key={minutes}
              label={`${minutes} 分`}
              active={activeTimerMinutes === minutes}
              onPress={() => onTimer(minutes)}
            />
          ))}
          <PillButton label="关闭" active={!activeTimerMinutes} onPress={() => onTimer(null)} />
        </View>
        {activeTimerMinutes ? (
          <Text style={styles.sectionMeta}>剩余 {Math.ceil(remainingSeconds / 60)} 分钟</Text>
        ) : null}
      </View>

      <View style={styles.playbackModeBlock}>
        <View style={styles.playerSectionHeader}>
          <Text style={styles.sectionTitle}>播放模式</Text>
          <View style={styles.modeSummaryPill}>
            {getPlaybackModeIcon(playbackMode, colors.green)}
            <Text style={styles.modeSummary}>{getPlaybackModeLabel(playbackMode)}</Text>
          </View>
        </View>
        <View style={styles.modeGrid}>
          {playbackModeOptions.map((option) => (
            <Pressable
              key={option.mode}
              style={[
                styles.modeButton,
                playbackMode === option.mode && styles.modeButtonActive,
              ]}
              onPress={() => onPlaybackMode(option.mode)}
            >
              {getPlaybackModeIcon(
                option.mode,
                playbackMode === option.mode ? colors.white : colors.muted,
              )}
              <Text
                style={[
                  styles.modeButtonText,
                  playbackMode === option.mode && styles.modeButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.customTimerBlock}>
        <View style={styles.playerSectionHeader}>
          <Text style={styles.sectionTitle}>自定义定时</Text>
          <Text style={styles.modeSummary}>1-480 分钟</Text>
        </View>
        <View style={styles.customTimerRow}>
          <TextInput
            value={customTimer}
            onChangeText={setCustomTimer}
            keyboardType="number-pad"
            placeholder="自定义分钟"
            style={styles.timerInput}
          />
          <Pressable style={styles.subtleButton} onPress={onCustomTimer}>
            <Text style={styles.subtleButtonText}>设置</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.secondaryActions}>
        <IconButton label={isFavorite ? '已收藏' : '收藏'} onPress={onFavorite}>
          <Heart
            color={isFavorite ? colors.coral : colors.muted}
            fill={isFavorite ? colors.coral : 'transparent'}
            size={18}
          />
        </IconButton>
        <IconButton label="停止" onPress={onStop}>
          <Square color={colors.muted} fill={colors.muted} size={15} />
        </IconButton>
      </View>

      <View style={styles.detailsBlock}>
        <Text style={styles.playerDescription}>{currentTrack.description}</Text>
        <Text style={styles.playerSource}>
          来源：{currentTrack.source.name} · {currentTrack.source.license}
        </Text>
      </View>
    </View>
  );
};

const formatPlaybackTime = (millis: number) => {
  if (!Number.isFinite(millis)) {
    return '0:00';
  }

  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

type ProgressBarProps = {
  positionMillis: number;
  durationMillis: number;
  progress: number;
  onSeek: (millis: number) => void;
};

const ProgressBar = ({ positionMillis, durationMillis, progress, onSeek }: ProgressBarProps) => {
  const [barWidth, setBarWidth] = useState(1);
  const canSeek = Number.isFinite(durationMillis) && durationMillis > 0;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0;

  return (
    <View style={styles.progressBlock}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="播放进度"
        onLayout={(event) => setBarWidth(Math.max(1, event.nativeEvent.layout.width))}
        onPress={(event) => {
          if (!canSeek) {
            return;
          }

          const nextProgress = event.nativeEvent.locationX / barWidth;
          onSeek(Math.max(0, Math.min(nextProgress, 1)) * durationMillis);
        }}
        style={styles.progressTrack}
      >
        <View style={styles.progressRail}>
          <View style={[styles.progressFill, { width: `${safeProgress * 100}%` }]} />
        </View>
        <View style={[styles.progressThumb, { left: `${safeProgress * 100}%` }]} />
      </Pressable>
      <View style={styles.progressTimes}>
        <Text style={styles.progressTime}>{formatPlaybackTime(positionMillis)}</Text>
        <Text style={styles.progressTime}>{formatPlaybackTime(durationMillis)}</Text>
      </View>
    </View>
  );
};

const CaptionDisplay = ({
  currentTrack,
  positionMillis,
}: {
  currentTrack: AudioItem;
  positionMillis: number;
}) => {
  const captions = currentTrack.captions ?? [];
  const currentSecond = positionMillis / 1000;
  const activeIndex = captions.findIndex(
    (caption) => currentSecond >= caption.start && currentSecond < caption.end,
  );
  const targetIndex =
    activeIndex !== -1
      ? activeIndex
      : currentSecond >= (captions[captions.length - 1]?.end ?? 0)
        ? Math.max(captions.length - 1, 0)
        : 0;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const [displayIndex, setDisplayIndex] = useState(targetIndex);
  const current = captions[displayIndex];

  useEffect(() => {
    setDisplayIndex(targetIndex);
    fadeOpacity.setValue(1);
  }, [currentTrack.id, fadeOpacity]);

  useEffect(() => {
    if (targetIndex === displayIndex) {
      return;
    }

    Animated.sequence([
      Animated.timing(fadeOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(fadeOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      setDisplayIndex(targetIndex);
    }, 160);

    return () => clearTimeout(timeout);
  }, [displayIndex, fadeOpacity, targetIndex]);

  if (!current) {
    return (
      <View style={styles.captionBox}>
        <Animated.View style={[styles.captionFadeGroup, { opacity: fadeOpacity }]}>
          <Text style={styles.captionCurrent}>慢慢呼吸，让声音陪你安静下来。</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.captionBox}>
      <Animated.View style={[styles.captionFadeGroup, { opacity: fadeOpacity }]}>
        <Text style={styles.captionCurrent}>{current.text}</Text>
      </Animated.View>
    </View>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const IconButton = ({
  label,
  children,
  onPress,
  variant = 'subtle',
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  variant?: 'subtle' | 'ghost';
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [
      styles.iconButton,
      variant === 'ghost' && styles.iconButtonGhost,
      { opacity: pressed ? 0.78 : 1 },
    ]}
  >
    {children}
  </Pressable>
);

const MiniPlayerBar = ({
  currentTrack,
  playbackState,
  progress,
  onOpen,
  onTogglePlayback,
}: {
  currentTrack: AudioItem;
  playbackState: string;
  progress: number;
  onOpen: () => void;
  onTogglePlayback: () => void;
}) => {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开播放器：${currentTrack.title}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.miniPlayer, { opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.miniCover, { backgroundColor: currentTrack.cover }]}>
        <Play color={colors.white} fill={colors.white} size={14} />
      </View>
      <View style={styles.miniBody}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <View style={styles.miniProgressRail}>
          <View style={[styles.miniProgressFill, { width: `${safeProgress * 100}%` }]} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playbackState === 'playing' ? '暂停' : '播放'}
        onPress={(event) => {
          event.stopPropagation();
          onTogglePlayback();
        }}
        hitSlop={10}
        style={styles.miniPlayButton}
      >
        {playbackState === 'playing' ? (
          <Pause color={colors.ink} fill={colors.ink} size={18} />
        ) : (
          <Play color={colors.ink} fill={colors.ink} size={18} />
        )}
      </Pressable>
    </Pressable>
  );
};

const TabButton = ({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: (color: string) => ReactNode;
  active: boolean;
  onPress: () => void;
}) => {
  const color = active ? colors.white : colors.muted;

  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <View style={styles.tabIcon}>{icon(color)}</View>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  app: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  appTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerButtonText: {
    color: colors.ink,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 138,
    width: '100%',
  },
  playerScrollContent: {
    paddingBottom: spacing.lg,
  },
  stack: {
    gap: spacing.md,
  },
  hero: {
    backgroundColor: colors.night,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    minHeight: 148,
    justifyContent: 'center',
  },
  heroTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.sm,
    flexShrink: 1,
  },
  moduleHeader: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.lg,
  },
  moduleTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  moduleCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  playerPanel: {
    backgroundColor: colors.night,
    borderRadius: 8,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  playerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerSourcePill: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerSourcePillText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
  },
  playerQueueText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  playerHeroArea: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  playerDisc: {
    width: 202,
    height: 202,
    borderRadius: 101,
    borderWidth: 2,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerDiscInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerHeading: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 0,
  },
  playerTitle: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
  },
  playerMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  playerPrimaryArea: {
    gap: spacing.md,
  },
  playerDescription: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
  },
  playerSource: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: colors.coral,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '800',
  },
  errorBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBlock: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  progressTrack: {
    height: 24,
    justifyContent: 'center',
  },
  progressRail: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.coral,
  },
  progressThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.coral,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  captionBox: {
    alignSelf: 'stretch',
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  captionFadeGroup: {
    minHeight: 40,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  captionSide: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    opacity: 0.66,
  },
  captionHidden: {
    opacity: 0,
  },
  captionCurrent: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSummaryRow: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  timerSummaryText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  playbackModeBlock: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  customTimerBlock: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modeSummaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeSummary: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modeButton: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeButtonActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  detailsBlock: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.coral,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '900',
  },
  subtleButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtleButtonText: {
    color: colors.ink,
    fontWeight: '800',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonGhost: {
    width: 54,
    height: 54,
    backgroundColor: colors.surfaceSoft,
  },
  timerBlock: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  customTimerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  timerInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    color: colors.ink,
  },
  empty: {
    minHeight: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  logRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  logActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  logBody: {
    flex: 1,
    gap: spacing.xs,
  },
  logTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  logMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  settingRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  accountSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  accountSummaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  legalRow: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.xs,
  },
  textInput: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    color: colors.ink,
  },
  noteInput: {
    minHeight: 76,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  settingCopy: {
    gap: spacing.xs,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  settingMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  miniPlayer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 78,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  miniCover: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  miniTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  miniProgressRail: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.coral,
  },
  miniPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  tabBarWithMini: {
    bottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabButtonActive: {
    backgroundColor: colors.coral,
  },
  tabIcon: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    color: colors.muted,
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: colors.white,
  },
});
