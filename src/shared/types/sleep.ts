export type SleepLogEntry = {
  id: string;
  sleepAt: string;
  wakeAt: string;
  durationMinutes: number;
  rating: 1 | 2 | 3 | 4 | 5;
  note?: string;
};

export type UserSettings = {
  defaultSleepTimerMinutes: number;
};
