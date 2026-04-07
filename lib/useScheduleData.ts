import { useCallback, useEffect, useState } from 'react';

import { excludePastEvents, fetchScheduleData, type ScheduleData } from '@/lib/schedule';

const EMPTY_SCHEDULE: ScheduleData = {
  byTeam: { pickles: [], bangers: [], cherry_bombs: [] },
  all: [],
};

export function useScheduleData() {
  const [data, setData] = useState<ScheduleData>(EMPTY_SCHEDULE);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSchedule = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    if (!refresh) setIsLoading(true);
    setErrorMessage(null);

    try {
      const next = await fetchScheduleData();
      setData(excludePastEvents(next));
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
