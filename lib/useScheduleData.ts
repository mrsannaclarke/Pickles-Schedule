import { useCallback, useEffect, useState } from 'react';

import { excludePastEvents, fetchScheduleData, type ScheduleData } from '@/lib/schedule';

const EMPTY_SCHEDULE: ScheduleData = {
  byTeam: { pickles: [], bangers: [], cherry_bombs: [] },
  all: [],
};

const CACHE_TTL_MS = 30_000;

let cachedData: ScheduleData = EMPTY_SCHEDULE;
let cachedAt = 0;
let inFlightLoad: Promise<ScheduleData> | null = null;

function hasFreshCache(now = Date.now()): boolean {
  if (cachedAt <= 0) return false;
  return now - cachedAt < CACHE_TTL_MS;
}

async function fetchAndCacheSchedule(): Promise<ScheduleData> {
  const next = await fetchScheduleData();
  const filtered = excludePastEvents(next);
  cachedData = filtered;
  cachedAt = Date.now();
  return filtered;
}

async function loadSharedSchedule(force = false): Promise<ScheduleData> {
  if (!force && hasFreshCache()) return cachedData;

  if (!inFlightLoad) {
    inFlightLoad = fetchAndCacheSchedule().finally(() => {
      inFlightLoad = null;
    });
  }

  return inFlightLoad;
}

export function useScheduleData() {
  const [data, setData] = useState<ScheduleData>(cachedAt > 0 ? cachedData : EMPTY_SCHEDULE);
  const [isLoading, setIsLoading] = useState(cachedAt <= 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSchedule = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else if (!hasFreshCache()) {
      setIsLoading(true);
    }

    setErrorMessage(null);

    try {
      const next = await loadSharedSchedule(refresh);
      setData(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load schedule.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  return {
    data,
    isLoading,
    isRefreshing,
    errorMessage,
    loadSchedule,
  };
}
