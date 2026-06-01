import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAudioPlayer } from '../features/player/useAudioPlayer';
import { useSleepLogs } from '../features/sleep-log/useSleepLogs';
import { appConfig } from '../shared/config/env';
import { audioCatalog, getItemsByType, getModule, modules } from '../shared/content/audioCatalog';
import { storageKeys } from '../shared/storage/keys';
import { storage } from '../shared/storage/storage';
import type { AudioItem, AudioType } from '../shared/types/audio';
import type { UserSettings } from '../shared/types/sleep';
import { ModuleCard } from '../shared/ui/ModuleCard';
import { PillButton } from '../shared/ui/PillButton';
import { TrackRow } from '../shared/ui/TrackRow';
import { colors, spacing } from '../shared/ui/theme';

type Screen = 'home' | 'module' | 'player' | 'sleep-log' | 'settings';

const defaultSettings: UserSettings = {
  defaultSleepTimerMinutes: 30,
};

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

export default function SleepApp() {
  const player = useAudioPlayer();
  const sleepLogs = useSleepLogs();
  const [screen, setScreen] = useState<Screen>('home');
  const [activeModule, setActiveModule] = useState<AudioType>('music');
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [customTimer, setCustomTimer] = useState('25');

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

  const openTrack = async (track: AudioItem) => {
    await player.playTrack(track);
    setScreen('player');
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
      <StatusBar style="dark" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{appConfig.appEnv.toUpperCase()}</Text>
            <Text style={styles.appTitle}>{appConfig.appName}</Text>
          </View>
          {screen !== 'home' ? (
            <Pressable style={styles.headerButton} onPress={() => setScreen('home')}>
              <Text style={styles.headerButtonText}>首页</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                onFavorite={player.toggleFavorite}
                isFavorite={player.isFavorite}
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
                  onPress={() => openTrack(item)}
                  onFavorite={() => player.toggleFavorite(item.id)}
                />
              ))}
            </View>
          ) : null}

          {screen === 'player' ? (
            <View style={styles.stack}>
              <PlayerPanel
                currentTrack={player.currentTrack}
                playbackState={player.playbackState}
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
                    player.toggleFavorite(player.currentTrack.id);
                  }
                }}
                onTimer={player.setSleepTimer}
                onCustomTimer={setCustomSleepTimer}
              />
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
                <Pressable style={styles.primaryButton} onPress={sleepLogs.addQuickLog}>
                  <Text style={styles.primaryButtonText}>新增</Text>
                </Pressable>
              </View>
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
                    </View>
                    <Pressable onPress={() => sleepLogs.removeLog(log.id)} style={styles.subtleButton}>
                      <Text style={styles.subtleButtonText}>删除</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {screen === 'settings' ? (
            <View style={styles.stack}>
              <Text style={styles.sectionTitle}>设置</Text>
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
                      onPress={() => saveSettings({ defaultSleepTimerMinutes: minutes })}
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
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.tabBar}>
          <TabButton label="助眠" active={screen === 'home' || screen === 'module'} onPress={() => setScreen('home')} />
          <TabButton label="播放" active={screen === 'player'} onPress={() => setScreen('player')} />
          <TabButton label="记录" active={screen === 'sleep-log'} onPress={() => setScreen('sleep-log')} />
          <TabButton label="设置" active={screen === 'settings'} onPress={() => setScreen('settings')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

type QuickSectionsProps = {
  recentTracks: AudioItem[];
  favoriteTracks: AudioItem[];
  onOpenTrack: (track: AudioItem) => void;
  onFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
};

const QuickSections = ({
  recentTracks,
  favoriteTracks,
  onOpenTrack,
  onFavorite,
  isFavorite,
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
          onPress={() => onOpenTrack(item)}
          onFavorite={() => onFavorite(item.id)}
        />
      ))
    )}
    <Text style={styles.sectionTitle}>我的收藏</Text>
    {favoriteTracks.length === 0 ? (
      <EmptyState text="点击列表里的星标即可收藏。" />
    ) : (
      favoriteTracks.slice(0, 3).map((item) => (
        <TrackRow
          key={item.id}
          item={item}
          isFavorite={isFavorite(item.id)}
          onPress={() => onOpenTrack(item)}
          onFavorite={() => onFavorite(item.id)}
        />
      ))
    )}
  </View>
);

type PlayerPanelProps = {
  currentTrack: AudioItem | null;
  playbackState: string;
  positionMillis: number;
  durationMillis: number;
  progress: number;
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
  onTimer: (minutes: number | null) => void;
  onCustomTimer: () => void;
};

const PlayerPanel = ({
  currentTrack,
  playbackState,
  positionMillis,
  durationMillis,
  progress,
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
  onTimer,
  onCustomTimer,
}: PlayerPanelProps) => {
  if (!currentTrack) {
    return <EmptyState text="还没有正在播放的内容，请先从首页选择一首音乐、故事或白噪音。" />;
  }

  return (
    <View style={styles.playerPanel}>
      <View style={[styles.playerCover, { backgroundColor: currentTrack.cover }]}>
        <Text style={styles.playerCoverText}>{currentTrack.type === 'noise' ? '∞' : '♪'}</Text>
      </View>
      <Text style={styles.playerTitle}>{currentTrack.title}</Text>
      <Text style={styles.playerMeta}>{currentTrack.category}</Text>
      <Text style={styles.playerDescription}>{currentTrack.description}</Text>
      <Text style={styles.playerSource}>
        来源：{currentTrack.source.name} · {currentTrack.source.license}
      </Text>

      <ProgressBar
        positionMillis={positionMillis}
        durationMillis={durationMillis}
        progress={progress}
        onSeek={onSeek}
      />
      <CaptionDisplay currentTrack={currentTrack} positionMillis={positionMillis} />

      <View style={styles.playerControls}>
        <Pressable style={styles.primaryButton} onPress={onTogglePlayback}>
          <Text style={styles.primaryButtonText}>
            {playbackState === 'playing' ? '暂停' : playbackState === 'loading' ? '加载中' : '播放'}
          </Text>
        </Pressable>
        <Pressable style={styles.subtleButton} onPress={onStop}>
          <Text style={styles.subtleButtonText}>停止</Text>
        </Pressable>
        <Pressable style={styles.subtleButton} onPress={onFavorite}>
          <Text style={styles.subtleButtonText}>{isFavorite ? '已收藏' : '收藏'}</Text>
        </Pressable>
      </View>

      <View style={styles.timerBlock}>
        <Text style={styles.sectionTitle}>定时关闭</Text>
        <Text style={styles.sectionMeta}>
          {activeTimerMinutes
            ? `约 ${activeTimerMinutes} 分钟后关闭，剩余 ${Math.ceil(remainingSeconds / 60)} 分钟`
            : '未开启'}
        </Text>
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
    </View>
  );
};

const formatPlaybackTime = (millis: number) => {
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
  const safeProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View style={styles.progressBlock}>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="播放进度"
        onLayout={(event) => setBarWidth(Math.max(1, event.nativeEvent.layout.width))}
        onPress={(event) => {
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
  const targetIndex = activeIndex === -1 ? 0 : activeIndex;
  const fadeOpacity = useRef(new Animated.Value(1)).current;
  const [displayIndex, setDisplayIndex] = useState(targetIndex);
  const previous = captions[displayIndex - 1];
  const current = captions[displayIndex];
  const next = captions[displayIndex + 1];

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
        <Text style={[styles.captionSide, !previous && styles.captionHidden]}>
          {previous?.text ?? current.text}
        </Text>
        <Text style={styles.captionCurrent}>{current.text}</Text>
        <Text style={[styles.captionSide, !next && styles.captionHidden]}>
          {next?.text ?? current.text}
        </Text>
      </Animated.View>
    </View>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const TabButton = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
    <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.coral,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  appTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  headerButton: {
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
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
    paddingBottom: 112,
  },
  stack: {
    gap: spacing.md,
  },
  hero: {
    backgroundColor: colors.night,
    borderRadius: 8,
    padding: spacing.lg,
    minHeight: 152,
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  heroCopy: {
    color: '#DDE4F3',
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.sm,
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
    fontWeight: '800',
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
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  playerPanel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  playerCover: {
    width: 120,
    height: 120,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCoverText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
  },
  playerTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerMeta: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  playerDescription: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  playerSource: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  progressBlock: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  progressTrack: {
    height: 28,
    justifyContent: 'center',
  },
  progressRail: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.coral,
  },
  progressThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: colors.night,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  captionBox: {
    alignSelf: 'stretch',
    minHeight: 112,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    justifyContent: 'center',
  },
  captionFadeGroup: {
    minHeight: 82,
    justifyContent: 'center',
    gap: spacing.sm,
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
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: colors.night,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  subtleButton: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtleButtonText: {
    color: colors.ink,
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logBody: {
    flex: 1,
    gap: spacing.xs,
  },
  logTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
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
  settingCopy: {
    gap: spacing.xs,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  settingMeta: {
    color: colors.muted,
    fontSize: 13,
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
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.night,
  },
  tabButtonText: {
    color: colors.muted,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
});
