import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { fetchScheduleData, type ScheduleData } from '../lib/schedule';

const EMPTY: ScheduleData = { byTeam: { pickles: [], bangers: [], cherry_bombs: [] }, all: [] };
let cached = EMPTY;
let cachedAt = 0;
let inFlight: Promise<ScheduleData> | null = null;

type ScheduleValue = { data: ScheduleData; loading: boolean; refreshing: boolean; error: string | null; refresh: () => Promise<void> };
const ScheduleContext = createContext<ScheduleValue | null>(null);

async function sharedLoad(force: boolean) {
  if (!force && cachedAt && Date.now() - cachedAt < 30_000) return cached;
  if (!inFlight || force) {
    inFlight = fetchScheduleData(force).then((next) => {
      cached = next; cachedAt = Date.now(); return next;
    }).finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function ScheduleProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(!cachedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try { setError(null); setData(await sharedLoad(force)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load schedule.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { queueMicrotask(() => void load(false)); }, [load]);
  const refresh = useCallback(() => load(true), [load]);
  const value = useMemo(() => ({ data, loading, refreshing, error, refresh }), [data, error, loading, refresh, refreshing]);
  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const value = useContext(ScheduleContext);
  if (!value) throw new Error('useSchedule must be used inside ScheduleProvider');
  return value;
}
