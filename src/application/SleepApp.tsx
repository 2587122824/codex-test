import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
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
  Sparkles,
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
  BackHandler,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  useColorScheme,
  View,
  type ColorSchemeName,
} from 'react-native';

import { useAudioPlayer } from '../features/player/useAudioPlayer';
import { useAccountSync, type AccountSyncController } from '../features/account/useAccountSync';
import type { RemoteSyncData } from '../features/account/syncService';
import { appConfig } from '../shared/config/env';
import { audioCatalog, getItemsByType, getModule, modules } from '../shared/content/audioCatalog';
import { storageKeys } from '../shared/storage/keys';
import { storage } from '../shared/storage/storage';
import type { AudioItem, AudioType, PlaybackMode } from '../shared/types/audio';
import type { UserSettings } from '../shared/types/sleep';
import { ModuleCard } from '../shared/ui/ModuleCard';
import { PillButton } from '../shared/ui/PillButton';
import { TrackRow } from '../shared/ui/TrackRow';
import {
  darkColors,
  lightColors,
  spacing,
  type ThemeColors,
  type ThemeMode,
  type UserThemePreference,
} from '../shared/ui/theme';

type Screen = 'home' | 'module' | 'ai' | 'player' | 'favorites' | 'credits' | 'privacy' | 'settings' | 'account';

const defaultSettings: UserSettings = {
  defaultSleepTimerMinutes: 0,
  themeMode: 'system',
};

const themePreferenceOptions: { value: UserThemePreference; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
];

const isThemePreference = (value: unknown): value is UserThemePreference =>
  value === 'system' || value === 'dark' || value === 'light';

const normalizeSettings = (settings: Partial<UserSettings> | null | undefined): UserSettings => ({
  defaultSleepTimerMinutes: 0,
  themeMode: isThemePreference(settings?.themeMode) ? settings.themeMode : defaultSettings.themeMode,
});

const resolveThemeMode = (preference: UserThemePreference, systemMode: ColorSchemeName): ThemeMode => {
  if (preference === 'dark' || preference === 'light') {
    return preference;
  }

  return systemMode === 'light' ? 'light' : 'dark';
};

let colors: ThemeColors = darkColors;

const betaFeedbackEmail = 'gudemian-feedback@example.com';
const tabBarBottomOffset = spacing.md;
const tabBarEstimatedHeight = 60;
const miniPlayerEstimatedHeight = 58;
const miniPlayerBottomOffset = tabBarBottomOffset + tabBarEstimatedHeight + spacing.sm;
const scrollBottomPadding = tabBarBottomOffset + tabBarEstimatedHeight + spacing.xl;
const scrollBottomPaddingWithMini =
  miniPlayerBottomOffset + miniPlayerEstimatedHeight + spacing.xl;

type AiSleepIntent = {
  id: string;
  title: string;
  summary: string;
  guidance: string;
  trackIds: string[];
  playbackMode: PlaybackMode;
};

const aiSleepDurations = [5, 10, 20, 30];
const defaultAiSleepDuration = 20;

const companionSuggestions = [
  { label: '我有点焦虑', text: '我有点焦虑，想先跟着呼吸放松。', intentId: 'calm-anxiety' },
  { label: '半夜醒了', text: '我半夜醒了，不想听人声。', intentId: 'night-wake' },
  { label: '只想听雨声', text: '只想听雨声和自然白噪音。', intentId: 'nature-noise' },
  { label: '想有人陪', text: '想听一点睡前故事，有人陪我慢下来。', intentId: 'bedtime-story' },
];

const getCompanionIntentId = (text: string, fallbackIntentId: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return fallbackIntentId;

  if (/焦虑|紧张|呼吸|放松|anxious|stress/.test(normalized)) return 'calm-anxiety';
  if (/醒|半夜|睡不回|night|wake/.test(normalized)) return 'night-wake';
  if (/雨|海|风|白噪|自然|噪音|noise|rain|ocean/.test(normalized)) return 'nature-noise';
  if (/故事|陪|说话|孤单|story|voice/.test(normalized)) return 'bedtime-story';
  if (/快|马上|入睡|困|sleep/.test(normalized)) return 'fast-sleep';

  return fallbackIntentId;
};

const allCategoryLabel = '全部';

const categoryPriority: Record<AudioType, string[]> = {
  music: ['冥想音乐', '轻音乐', '舒缓音乐', '呼吸引导'],
  story: ['呼吸引导', '身体放松', '夜醒安抚', '温柔故事', '梦境故事', '自然故事'],
  noise: ['雨声', '粉噪', '棕噪', '风声', '风扇', '海浪', '海岸', '森林', '溪流', '雨夜', '篝火'],
};

const getSortedModuleItems = (items: AudioItem[], type: AudioType) => {
  const priority = categoryPriority[type];
  return [...items].sort((a, b) => {
    const aIndex = priority.includes(a.category) ? priority.indexOf(a.category) : priority.length;
    const bIndex = priority.includes(b.category) ? priority.indexOf(b.category) : priority.length;
    const categoryDelta = aIndex - bIndex;
    if (categoryDelta !== 0) return categoryDelta;
    return b.duration - a.duration;
  });
};

const aiSleepIntents: AiSleepIntent[] = [
  {
    id: 'fast-sleep',
    title: '快速入睡',
    summary: '低刺激音乐先降速，再用稳定声场收尾。',
    guidance: '把手机放远一点，跟着声音把注意力从白天慢慢放下来。',
    trackIds: ['music-soft-piano-loop', 'music-breathing-pad', 'music-floating-pad', 'noise-rain-window', 'noise-pink-soft'],
    playbackMode: 'sequential',
  },
  {
    id: 'calm-anxiety',
    title: '焦虑放松',
    summary: '呼吸铺底加轻引导，适合睡前脑子停不下来。',
    guidance: '不需要努力睡着，只要把每一次呼气听完整。',
    trackIds: ['music-breathing-demo', 'story-breath-countdown', 'music-warm-drone', 'story-body-scan', 'noise-brown-bed'],
    playbackMode: 'repeat-all',
  },
  {
    id: 'night-wake',
    title: '半夜醒来',
    summary: '少人声、少变化，帮助重新回到安静状态。',
    guidance: '保持闭眼，先不要看时间，让稳定的环境声接住注意力。',
    trackIds: ['noise-brown-bed', 'noise-room-fan', 'story-midnight-return', 'music-floating-pad', 'noise-soft-wind'],
    playbackMode: 'repeat-all',
  },
  {
    id: 'nature-noise',
    title: '自然白噪音',
    summary: '雨声、海岸和篝火氛围，适合遮盖环境噪音。',
    guidance: '选择一个舒服音量，让声音留在背景里，不用追着听。',
    trackIds: ['noise-rain-window', 'noise-ocean-waves', 'noise-night-wind', 'noise-forest-night', 'noise-creek-stones'],
    playbackMode: 'shuffle',
  },
  {
    id: 'bedtime-story',
    title: '睡前故事',
    summary: '轻故事配合定时关闭，适合需要一点陪伴的夜晚。',
    guidance: '故事只是陪你慢下来，听到哪里睡着都刚刚好。',
    trackIds: ['story-stars-falling', 'story-cloud-boat', 'story-forest-letter', 'story-lake-lantern', 'story-garden-path'],
    playbackMode: 'sequential',
  },
];

const formatDateTime = (isoDate: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));

export default function SleepApp() {
  const player = useAudioPlayer();
  const systemColorScheme = useColorScheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentScreenRef = useRef<Screen>('home');
  const screenHistoryRef = useRef<Screen[]>([]);
  const lastHomeBackPressRef = useRef(0);
  const [screen, setScreen] = useState<Screen>('home');
  const [activeModule, setActiveModule] = useState<AudioType>('music');
  const [selectedModuleCategory, setSelectedModuleCategory] = useState(allCategoryLabel);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [customTimer, setCustomTimer] = useState('25');
  const [selectedAiIntentId, setSelectedAiIntentId] = useState(aiSleepIntents[0].id);
  const [selectedAiDuration, setSelectedAiDuration] = useState(defaultAiSleepDuration);
  const [aiCompanionInput, setAiCompanionInput] = useState('');
  const [syncRequestId, setSyncRequestId] = useState(0);
  const settingsRef = useRef<UserSettings>(defaultSettings);
  const resolvedThemeMode = resolveThemeMode(settings.themeMode, systemColorScheme);
  const themeColors = resolvedThemeMode === 'light' ? lightColors : darkColors;
  const themedStyles = useMemo(() => createStyles(themeColors), [themeColors]);
  colors = themeColors;
  styles = themedStyles;

  useEffect(() => {
    storage.getJson(storageKeys.settings, defaultSettings).then((storedSettings) => {
      const nextSettings = normalizeSettings(storedSettings);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
    });
  }, []);

  useEffect(() => {
    currentScreenRef.current = screen;
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);

    return () => clearTimeout(timeout);
  }, [screen]);

  const navigateTo = useCallback((nextScreen: Screen) => {
    const currentScreen = currentScreenRef.current;
    if (currentScreen === nextScreen) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    screenHistoryRef.current = [...screenHistoryRef.current, currentScreen].slice(-16);
    setScreen(nextScreen);
  }, []);

  const navigateBack = useCallback(() => {
    if (currentScreenRef.current === 'home') {
      const now = Date.now();
      if (now - lastHomeBackPressRef.current < 1800) {
        BackHandler.exitApp();
        return true;
      }

      lastHomeBackPressRef.current = now;
      ToastAndroid.show('再按一次退出古德眠', ToastAndroid.SHORT);
      return true;
    }

    const previousScreen = screenHistoryRef.current.pop();
    if (previousScreen) {
      setScreen(previousScreen);
      return true;
    }

    setScreen('home');
    return true;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', navigateBack);
    return () => subscription.remove();
  }, [navigateBack]);

  const moduleItems = useMemo(() => getItemsByType(activeModule), [activeModule]);
  const sortedModuleItems = useMemo(
    () => getSortedModuleItems(moduleItems, activeModule),
    [activeModule, moduleItems],
  );
  const moduleCategories = useMemo(
    () => [allCategoryLabel, ...Array.from(new Set(sortedModuleItems.map((item) => item.category)))],
    [sortedModuleItems],
  );
  const visibleModuleItems = useMemo(
    () =>
      selectedModuleCategory === allCategoryLabel
        ? sortedModuleItems
        : sortedModuleItems.filter((item) => item.category === selectedModuleCategory),
    [selectedModuleCategory, sortedModuleItems],
  );
  const activeModuleInfo = getModule(activeModule);
  const favoriteTracks = audioCatalog.filter((item) => player.favoriteIds.includes(item.id));
  const selectedAiIntent =
    aiSleepIntents.find((intent) => intent.id === selectedAiIntentId) ?? aiSleepIntents[0];
  const selectedAiTracks = selectedAiIntent.trackIds
    .map((id) => audioCatalog.find((item) => item.id === id))
    .filter(Boolean) as AudioItem[];
  const getSyncSnapshot = useCallback(
    () => ({
      favoriteIds: player.favoriteIds,
      historyIds: player.historyIds,
      sleepLogs: [],
      settings: settingsRef.current,
    }),
    [player.favoriteIds, player.historyIds],
  );
  const applyRemoteData = useCallback(
    (data: RemoteSyncData) => {
      player.replaceLibraryData(data.favoriteIds, data.historyIds);
      const nextSettings = normalizeSettings(data.settings);
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      storage.setJson(storageKeys.settings, nextSettings);
    },
    [player.replaceLibraryData],
  );
  const account = useAccountSync({
    getSnapshot: getSyncSnapshot,
    applyRemoteData,
  });

  const requestSyncIfSignedIn = useCallback(() => {
    if (account.user) {
      setSyncRequestId((value) => value + 1);
    }
  }, [account.user]);

  useEffect(() => {
    if (!account.user || syncRequestId === 0) {
      return undefined;
    }

    const syncTimer = setTimeout(() => {
      void account.syncNow();
    }, 0);

    return () => clearTimeout(syncTimer);
  }, [account.syncNow, account.user, syncRequestId]);

  const saveSettingsAndSync = (nextSettings: UserSettings) => {
    const normalizedSettings = normalizeSettings(nextSettings);
    settingsRef.current = normalizedSettings;
    setSettings(normalizedSettings);
    storage.setJson(storageKeys.settings, normalizedSettings);
    requestSyncIfSignedIn();
  };

  const toggleFavoriteAndSync = (trackId: string) => {
    player.toggleFavorite(trackId);
    requestSyncIfSignedIn();
  };

  const openTrack = async (track: AudioItem, sourceQueue?: AudioItem[]) => {
    await player.playTrack(track, sourceQueue);
    navigateTo('player');
    requestSyncIfSignedIn();
  };

  const startAiSleep = async () => {
    if (!selectedAiTracks[0]) {
      Alert.alert('暂无可播放内容', '当前推荐队列没有找到对应音频，请先检查本地音频目录。');
      return;
    }

    player.setPlaybackMode(selectedAiIntent.playbackMode);
    await player.playTrack(selectedAiTracks[0], selectedAiTracks);
    player.setSleepTimer(selectedAiDuration);
    navigateTo('player');
    requestSyncIfSignedIn();
  };

  const updateCompanionRequest = (text: string) => {
    setAiCompanionInput(text);
    setSelectedAiIntentId((currentIntentId) => getCompanionIntentId(text, currentIntentId));
  };

  const openFeedback = () => {
    Linking.openURL(
      `mailto:${betaFeedbackEmail}?subject=${encodeURIComponent('古德眠内测反馈')}`,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={resolvedThemeMode === 'light' ? 'dark' : 'light'} />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{appConfig.appEnv.toUpperCase()}</Text>
          <Text style={styles.appTitle}>{appConfig.appName}</Text>
          </View>
          {screen !== 'home' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="返回首页"
              style={styles.headerButton}
              onPress={() => navigateTo('home')}
            >
              <Home color={colors.ink} size={18} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            player.currentTrack && screen !== 'player' && styles.scrollContentWithMiniPlayer,
            screen === 'player' && styles.playerScrollContent,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {screen === 'home' ? (
            <View style={styles.stack}>
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
                      colors={colors}
                      onPress={() => {
                        setActiveModule(module.type);
                        setSelectedModuleCategory(allCategoryLabel);
                        navigateTo('module');
                      }}
                    />
                  ))}
              </View>
            </View>
          ) : null}

          {screen === 'module' && activeModuleInfo ? (
            <View style={styles.stack}>
              <View style={[styles.moduleHeader, { borderColor: activeModuleInfo.accent }]}>
                <View style={styles.moduleHeaderTop}>
                  <Text style={styles.moduleTitle}>{activeModuleInfo.title}</Text>
                  <Text style={styles.moduleCount}>
                    {visibleModuleItems.length} / {moduleItems.length}
                  </Text>
                </View>
                <Text style={styles.moduleCopy}>{activeModuleInfo.description}</Text>
                <Text style={styles.moduleFilterMeta}>
                  {selectedModuleCategory === allCategoryLabel
                    ? '推荐排序 · 全部内容'
                    : `筛选 · ${selectedModuleCategory}`}
                </Text>
              </View>
              <View style={styles.categoryChips}>
                {moduleCategories.map((category) => {
                  const active = category === selectedModuleCategory;
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityLabel={`筛选 ${category}`}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => setSelectedModuleCategory(category)}
                    >
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {visibleModuleItems.map((item) => (
                <TrackRow
                  key={item.id}
                  item={item}
                  colors={colors}
                  isFavorite={player.isFavorite(item.id)}
                  onPress={() => openTrack(item, visibleModuleItems)}
                  onFavorite={() => toggleFavoriteAndSync(item.id)}
                />
              ))}
            </View>
          ) : null}

          {screen === 'ai' ? (
            <AiSleepPanel
              intents={aiSleepIntents}
              durations={aiSleepDurations}
              selectedIntentId={selectedAiIntentId}
              selectedDuration={selectedAiDuration}
              companionInput={aiCompanionInput}
              selectedTracks={selectedAiTracks}
              onSelectIntent={setSelectedAiIntentId}
              onSelectDuration={setSelectedAiDuration}
              onCompanionInput={updateCompanionRequest}
              onStart={startAiSleep}
            />
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
                    colors={colors}
                    isFavorite={player.isFavorite(item.id)}
                    onPress={() => openTrack(item, favoriteTracks)}
                    onFavorite={() => toggleFavoriteAndSync(item.id)}
                  />
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
                <Pressable style={styles.subtleButton} onPress={() => navigateTo('account')}>
                  <Text style={styles.subtleButtonText}>{account.user ? '管理账号' : '登录 / 注册'}</Text>
                </Pressable>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>外观主题</Text>
                  <Text style={styles.settingMeta}>
                    {settings.themeMode === 'system'
                      ? `跟随系统 · 当前为${resolvedThemeMode === 'light' ? '浅色' : '深色'}`
                      : settings.themeMode === 'light'
                        ? '使用低刺激浅色界面'
                        : '使用睡前深色界面'}
                  </Text>
                </View>
                <View style={styles.pillWrap}>
                  {themePreferenceOptions.map((option) => (
                    <PillButton
                      key={option.value}
                      label={option.label}
                      colors={colors}
                      active={settings.themeMode === option.value}
                      onPress={() => saveSettingsAndSync({ ...settingsRef.current, themeMode: option.value })}
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
                  遇到播放失败、布局遮挡、AI 推荐不合适、登录同步或音频问题，可以把复现步骤发给我们。
                </Text>
                <View style={styles.playerControls}>
                  <Pressable style={styles.subtleButton} onPress={openFeedback}>
                    <Text style={styles.subtleButtonText}>发送反馈</Text>
                  </Pressable>
                </View>
                <Text style={styles.settingMeta} numberOfLines={1}>
                  {betaFeedbackEmail}
                </Text>
              </View>
              <View style={styles.settingRow}>
                <Text style={styles.settingTitle}>上线合规</Text>
                <Text style={styles.settingMeta}>查看音频版权和隐私说明，确保上架资料与 App 行为一致。</Text>
                <View style={styles.playerControls}>
                  <Pressable style={styles.subtleButton} onPress={() => navigateTo('credits')}>
                    <Text style={styles.subtleButtonText}>音频版权</Text>
                  </Pressable>
                  <Pressable style={styles.subtleButton} onPress={() => navigateTo('privacy')}>
                    <Text style={styles.subtleButtonText}>隐私说明</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {screen === 'account' ? (
            <AccountPanel
              account={account}
              onBack={() => navigateTo('settings')}
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
                  <Text style={styles.settingMeta} numberOfLines={1}>
                    链接：{item.source.url}
                  </Text>
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
                  游客模式不上传数据。收藏、最近播放、设置和本次播放定时状态会先保存在本机，离线时仍可使用。
                </Text>
              </View>
              <View style={styles.legalRow}>
                <Text style={styles.settingTitle}>账号同步</Text>
                <Text style={styles.settingMeta}>
                  登录后会把手机号账号标识、收藏、最近播放和设置同步到云端，用于多设备恢复和备份。当前不上传音频文件，不接入广告或分析 SDK。
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
            onOpen={() => navigateTo('player')}
            onTogglePlayback={player.togglePlayback}
          />
        ) : null}

        {screen !== 'player' ? (
          <View style={[styles.tabBar, player.currentTrack && styles.tabBarWithMini]}>
            <TabButton
              label="首页"
              icon={(color) => <Moon color={color} size={18} />}
              active={screen === 'home' || screen === 'module'}
              onPress={() => navigateTo('home')}
            />
            <TabButton
              label="AI助眠"
              icon={(color) => <Sparkles color={color} size={18} />}
              active={screen === 'ai'}
              onPress={() => navigateTo('ai')}
            />
            <TabButton
              label="收藏"
              icon={(color) => <Heart color={color} fill={screen === 'favorites' ? color : 'transparent'} size={18} />}
              active={screen === 'favorites'}
              onPress={() => navigateTo('favorites')}
            />
            <TabButton
              label="设置"
              icon={(color) => <Settings color={color} size={18} />}
              active={screen === 'settings' || screen === 'account' || screen === 'credits' || screen === 'privacy'}
              onPress={() => navigateTo('settings')}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const formatSyncTime = (isoDate: string | null) => {
  if (!isoDate) {
    return '尚未同步';
  }

  return `上次同步 ${formatDateTime(isoDate)}`;
};

const normalizeChinaPhoneInput = (value: string) => {
  const compact = value.trim().replace(/[\s-]/g, '');

  if (/^\+\d{8,15}$/.test(compact)) {
    return compact;
  }

  const digits = compact.replace(/\D/g, '');
  const localDigits = digits.startsWith('86') && digits.length === 13 ? digits.slice(2) : digits;

  return /^1[3-9]\d{9}$/.test(localDigits) ? `+86${localDigits}` : null;
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
    const normalizedPhone = normalizeChinaPhoneInput(phone);
    if (!normalizedPhone) {
      Alert.alert('请输入正确的手机号', '内测登录默认使用中国大陆手机号，请输入 11 位手机号。');
      return;
    }

    await account.signInWithPhone(normalizedPhone);
    setOtpSent(true);
  };

  const verifyOtp = async () => {
    const normalizedPhone = normalizeChinaPhoneInput(phone);
    if (!normalizedPhone) {
      Alert.alert('请输入正确的手机号', '内测登录默认使用中国大陆手机号，请输入 11 位手机号。');
      return;
    }

    if (!/^\d{4,8}$/.test(otp.trim())) {
      Alert.alert('请输入验证码', '请输入短信里的数字验证码。');
      return;
    }

    const ok = await account.verifyPhoneOtp(normalizedPhone, otp.trim());
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
          <Text style={styles.sectionMeta}>登录后同步收藏、最近播放和设置。</Text>
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
              <Text style={styles.settingMeta} numberOfLines={1}>
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
              <Text style={styles.settingMeta}>默认中国大陆手机号，游客数据会在登录成功后自动合并到云端。</Text>
            </View>
          </View>
          <View style={styles.phoneInputRow}>
            <View style={styles.phonePrefixBox}>
              <Text style={styles.phonePrefixText}>+86</Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setOtpSent(false);
              }}
              keyboardType="phone-pad"
              placeholder="请输入 11 位手机号"
              placeholderTextColor={colors.subtle}
              style={styles.phoneInput}
              maxLength={13}
            />
          </View>
          {otpSent ? (
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              placeholder="短信验证码"
              placeholderTextColor={colors.subtle}
              style={styles.textInput}
              maxLength={8}
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

const AiSleepPanel = ({
  intents,
  durations,
  selectedIntentId,
  selectedDuration,
  companionInput,
  selectedTracks,
  onSelectIntent,
  onSelectDuration,
  onCompanionInput,
  onStart,
}: {
  intents: AiSleepIntent[];
  durations: number[];
  selectedIntentId: string;
  selectedDuration: number;
  companionInput: string;
  selectedTracks: AudioItem[];
  onSelectIntent: (intentId: string) => void;
  onSelectDuration: (duration: number) => void;
  onCompanionInput: (text: string) => void;
  onStart: () => void;
}) => {
  const selectedIntent =
    intents.find((intent) => intent.id === selectedIntentId) ?? intents[0];
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [durationExpanded, setDurationExpanded] = useState(false);
  const leadTrack = selectedTracks[0];

  useEffect(() => {
    setQueueExpanded(false);
  }, [selectedIntentId]);

  return (
    <View style={styles.stack}>
      <View style={styles.companionPanel}>
        <View style={styles.companionHeader}>
          <View style={styles.aiHeroIcon}>
            <Sparkles color={colors.white} size={20} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.companionKicker}>今晚慢一点入睡</Text>
            <Text style={styles.heroTitle}>AI助眠</Text>
            <Text style={styles.companionStatus}>{selectedIntent.guidance}</Text>
          </View>
        </View>

        <TextInput
          value={companionInput}
          onChangeText={onCompanionInput}
          placeholder="你可以随时说：我有点焦虑、半夜醒了、想听雨声..."
          placeholderTextColor={colors.muted}
          style={styles.companionInput}
          multiline
          accessibilityLabel="输入或模拟说出助眠需求"
        />

        <View style={styles.companionChips}>
          {companionSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion.label}
              accessibilityRole="button"
              accessibilityLabel={`告诉 AI ${suggestion.label}`}
              style={[
                styles.companionChip,
                selectedIntentId === suggestion.intentId && styles.companionChipActive,
              ]}
              onPress={() => onCompanionInput(suggestion.text)}
            >
              <Text
                style={[
                  styles.companionChipText,
                  selectedIntentId === suggestion.intentId && styles.companionChipTextActive,
                ]}
              >
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.aiControlCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={durationExpanded ? '收起助眠时长选择' : '展开助眠时长选择'}
          style={styles.aiQueueHeader}
          onPress={() => setDurationExpanded((value) => !value)}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>助眠时长</Text>
            <Text style={styles.settingMeta}>本次 AI 助眠会使用这个时长</Text>
          </View>
          <View style={styles.aiQueueToggle}>
            <Text style={styles.aiQueueToggleText}>
              {durationExpanded ? '收起' : `${selectedDuration} 分钟`}
            </Text>
            {durationExpanded ? (
              <ChevronUp color={colors.muted} size={18} />
            ) : (
              <ChevronDown color={colors.muted} size={18} />
            )}
          </View>
        </Pressable>

        {durationExpanded ? (
          <View style={styles.pillWrap}>
            {durations.map((minutes) => (
              <PillButton
                key={minutes}
                label={`${minutes} 分钟`}
                colors={colors}
                active={selectedDuration === minutes}
                onPress={() => {
                  onSelectDuration(minutes);
                  setDurationExpanded(false);
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.aiRecommendation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={queueExpanded ? '收起助眠播放队列' : '展开助眠播放队列'}
          style={styles.aiQueueHeader}
          onPress={() => setQueueExpanded((value) => !value)}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>正在陪你听</Text>
            <Text style={styles.settingMeta}>{selectedIntent.title}</Text>
          </View>
          <View style={styles.aiQueueToggle}>
            <Text style={styles.aiQueueToggleText}>
              {queueExpanded ? '收起' : `${selectedTracks.length} 首`}
            </Text>
            {queueExpanded ? (
              <ChevronUp color={colors.muted} size={18} />
            ) : (
              <ChevronDown color={colors.muted} size={18} />
            )}
          </View>
        </Pressable>

        {leadTrack ? (
          <View style={styles.aiQueueSummary}>
            <View style={styles.aiQueueBadge}>
              <Text style={styles.aiQueueBadgeText}>1</Text>
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.aiTrackTitle} numberOfLines={1}>{leadTrack.title}</Text>
              <Text style={styles.settingMeta} numberOfLines={1}>
                先从 {leadTrack.category} 开始，后面还有 {Math.max(selectedTracks.length - 1, 0)} 首
              </Text>
            </View>
          </View>
        ) : null}

        {queueExpanded ? (
          <View style={styles.aiTrackList}>
            {selectedTracks.slice(1).map((track, index) => (
              <View key={track.id} style={styles.aiTrackChip}>
                <Text style={styles.aiTrackIndex}>{index + 2}</Text>
                <View style={styles.settingCopy}>
                  <Text style={styles.aiTrackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.settingMeta} numberOfLines={1}>{track.category}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.aiDisclaimer}>
          内测阶段先用输入模拟随时说话，并按本地规则切换音频。真实语音监听会在确认麦克风权限、隐私策略和供应商后单独接入。
        </Text>
        <Pressable style={styles.primaryButton} onPress={onStart}>
          <Text style={styles.primaryButtonText}>按这个陪我睡</Text>
        </Pressable>
      </View>
    </View>
  );
};

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

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}:${restSeconds.toString().padStart(2, '0')}`;
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
  const [timerExpanded, setTimerExpanded] = useState(false);
  const [modeExpanded, setModeExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  if (!currentTrack) {
    return <EmptyState text="还没有正在播放的内容，请先从首页选择一首音乐、故事或白噪音。" />;
  }

  const timerSummary = activeTimerMinutes
    ? `剩余 ${Math.ceil(remainingSeconds / 60)} 分钟`
    : '未开启';
  const countdownText = activeTimerMinutes ? formatCountdown(remainingSeconds) : '--:--';
  const sleepHint = activeTimerMinutes
    ? remainingSeconds <= 5 * 60
      ? '快到时间了，声音会慢慢淡下去'
      : '最后 30 秒会淡出并停止'
    : '建议开启定时，让声音陪到刚刚好';

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
        <View style={[styles.playerSleepOrb, { borderColor: currentTrack.cover }]}>
          <Text style={styles.playerSleepKicker}>睡前模式</Text>
          <Text style={styles.playerCountdown}>{countdownText}</Text>
          <Text style={styles.playerSleepHint}>{sleepHint}</Text>
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

      <View style={styles.playerFoldBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={timerExpanded ? '收起定时关闭设置' : '展开定时关闭设置'}
          style={styles.playerFoldHeader}
          onPress={() => setTimerExpanded((value) => !value)}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.sectionTitle}>本次定时关闭</Text>
            <Text style={styles.sectionMeta}>
              {activeTimerMinutes ? `当前播放约 ${activeTimerMinutes} 分钟后关闭` : '当前播放未开启'}
            </Text>
          </View>
          <View style={styles.playerFoldToggle}>
            <Text style={styles.modeSummary}>{timerExpanded ? '收起' : timerSummary}</Text>
            {timerExpanded ? (
              <ChevronUp color={colors.muted} size={18} />
            ) : (
              <ChevronDown color={colors.muted} size={18} />
            )}
          </View>
        </Pressable>
        {timerExpanded ? (
          <View style={styles.playerFoldBody}>
            <View style={styles.pillWrap}>
              {timerOptions.map((minutes) => (
                <PillButton
                  key={minutes}
                  label={`${minutes} 分`}
                  colors={colors}
                  active={activeTimerMinutes === minutes}
                  onPress={() => onTimer(minutes)}
                />
              ))}
              <PillButton label="关闭" colors={colors} active={!activeTimerMinutes} onPress={() => onTimer(null)} />
            </View>
            {activeTimerMinutes ? (
              <Text style={styles.sectionMeta}>剩余 {Math.ceil(remainingSeconds / 60)} 分钟，最后 30 秒会逐步淡出。</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.playerFoldBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={modeExpanded ? '收起播放模式设置' : '展开播放模式设置'}
          style={styles.playerFoldHeader}
          onPress={() => setModeExpanded((value) => !value)}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.sectionTitle}>播放模式</Text>
            <Text style={styles.sectionMeta}>睡前只保留一个轻量入口</Text>
          </View>
          <View style={styles.playerFoldToggle}>
            {getPlaybackModeIcon(playbackMode, colors.green)}
            <Text style={styles.modeSummary}>{getPlaybackModeLabel(playbackMode)}</Text>
            {modeExpanded ? (
              <ChevronUp color={colors.muted} size={18} />
            ) : (
              <ChevronDown color={colors.muted} size={18} />
            )}
          </View>
        </Pressable>
        {modeExpanded ? (
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
        ) : null}
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

      <View style={styles.playerFoldBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={detailsExpanded ? '收起音频详情' : '展开音频详情'}
          style={styles.playerFoldHeader}
          onPress={() => setDetailsExpanded((value) => !value)}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.sectionTitle}>音频详情</Text>
            <Text style={styles.sectionMeta}>来源、说明和自定义定时</Text>
          </View>
          {detailsExpanded ? (
            <ChevronUp color={colors.muted} size={18} />
          ) : (
            <ChevronDown color={colors.muted} size={18} />
          )}
        </Pressable>
        {detailsExpanded ? (
          <View style={styles.playerFoldBody}>
            <Text style={styles.playerDescription}>{currentTrack.description}</Text>
            <Text style={styles.playerSource}>
              来源：{currentTrack.source.name} · {currentTrack.source.license}
            </Text>
            <View style={styles.customTimerRow}>
              <TextInput
                value={customTimer}
                onChangeText={setCustomTimer}
                keyboardType="number-pad"
                placeholder="自定义分钟"
                style={styles.timerInput}
              />
              <Pressable style={styles.subtleButton} onPress={onCustomTimer}>
                <Text style={styles.subtleButtonText}>设置定时</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
    <View style={styles.miniPlayer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`打开播放器：${currentTrack.title}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.miniOpenButton, { opacity: pressed ? 0.88 : 1 }]}
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
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playbackState === 'playing' ? '暂停' : '播放'}
        onPress={(event) => {
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
    </View>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <View style={styles.tabIcon}>{icon(color)}</View>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    paddingBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  eyebrow: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
  appTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  headerButton: {
    width: 36,
    height: 36,
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
    paddingBottom: scrollBottomPadding,
    width: '100%',
  },
  scrollContentWithMiniPlayer: {
    paddingBottom: scrollBottomPaddingWithMini,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 86,
    justifyContent: 'center',
  },
  aiHero: {
    backgroundColor: colors.night,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  aiHeroIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 26,
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
  moduleHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minWidth: 0,
  },
  moduleTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    flexShrink: 1,
  },
  moduleCount: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
  },
  moduleCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  moduleFilterMeta: {
    color: colors.subtle,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  categoryChipActive: {
    borderColor: colors.green,
    backgroundColor: colors.surfaceElevated,
  },
  categoryChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  categoryChipTextActive: {
    color: colors.green,
  },
  aiIntentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  aiIntentCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 136,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  aiIntentCardActive: {
    borderColor: colors.green,
    backgroundColor: colors.surfaceElevated,
  },
  aiIntentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  aiIntentTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    flexShrink: 1,
  },
  aiIntentSummary: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  companionPanel: {
    backgroundColor: colors.night,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  companionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  companionStatus: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  companionKicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
  },
  companionInput: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  companionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  companionChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  companionChipActive: {
    borderColor: colors.green,
    backgroundColor: colors.surfaceElevated,
  },
  companionChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  companionChipTextActive: {
    color: colors.green,
  },
  aiControlCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  aiRecommendation: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  aiQueueHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minWidth: 0,
  },
  aiQueueToggle: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiQueueToggleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  aiQueueSummary: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  aiQueueBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiQueueBadgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  aiTrackList: {
    gap: spacing.sm,
  },
  aiTrackChip: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  aiTrackIndex: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.green,
    color: colors.white,
    textAlign: 'center',
    fontWeight: '900',
    lineHeight: 24,
  },
  aiTrackTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  aiDisclaimer: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minWidth: 0,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    flexShrink: 1,
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
    flexShrink: 0,
  },
  playerHeroArea: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  playerSleepOrb: {
    width: 224,
    minHeight: 178,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  playerSleepKicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '900',
  },
  playerCountdown: {
    color: colors.ink,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '900',
    letterSpacing: 0,
  },
  playerSleepHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
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
  playerFoldBlock: {
    alignSelf: 'stretch',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  playerFoldHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minWidth: 0,
  },
  playerFoldToggle: {
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  playerFoldBody: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playerSectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexShrink: 1,
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
    flexShrink: 1,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '900',
    textAlign: 'center',
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
    flexShrink: 1,
  },
  subtleButtonText: {
    color: colors.ink,
    fontWeight: '800',
    textAlign: 'center',
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  timerInput: {
    flex: 1,
    minWidth: 130,
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
    width: '100%',
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    color: colors.ink,
  },
  phoneInputRow: {
    width: '100%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  phonePrefixBox: {
    minWidth: 58,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  phonePrefixText: {
    color: colors.ink,
    fontWeight: '900',
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    color: colors.ink,
  },
  settingCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    flexShrink: 1,
  },
  settingMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    flexShrink: 1,
  },
  miniPlayer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: miniPlayerBottomOffset,
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
  miniOpenButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
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
    bottom: tabBarBottomOffset,
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
    bottom: tabBarBottomOffset,
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

let styles = createStyles(colors);
