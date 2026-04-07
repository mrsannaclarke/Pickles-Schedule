export const SCHEDULE_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbw8fgHWA_1GLhs1GFUoIlKrzx6crRzZuZNhzje9ojoQThvA_F2SLLHmeh026fhwzqKMFQ/exec';

export type TeamKey = 'pickles' | 'bangers' | 'cherry_bombs';

export const TEAM_META: Record<
  TeamKey,
  {
    title: string;
    tint: string;
    themeColor: string;
    cardBackground: string;
    iconName: 'sports-baseball' | 'food-hot-dog' | 'bomb';
    iconLibrary: 'material' | 'material-community';
  }
> = {
  pickles: {
    title: 'Pickles Baseball',
    tint: '#2f8f4d',
    themeColor: '#6fde8f',
    cardBackground: '#1a2a1e',
    iconName: 'sports-baseball',
    iconLibrary: 'material',
  },
  bangers: {
    title: 'Bangers Soccer',
    tint: '#7b4d2a',
    themeColor: '#d6a375',
    cardBackground: '#2b211a',
    iconName: 'food-hot-dog',
    iconLibrary: 'material-community',
  },
  cherry_bombs: {
    title: 'Cherry Bombs Soccer',
    tint: '#ba3a3a',
    themeColor: '#ff7f7f',
    cardBackground: '#2d1919',
    iconName: 'bomb',
    iconLibrary: 'material-community',
  },
};

type RawScheduleResponse = {
  pickles?: unknown;
  bangers?: unknown;
  cherry_bombs?: unknown;
  error?: unknown;
};

export type ScheduleEvent = {
  id: string;
  team: TeamKey;
  raw: string;
  dateLabel: string;
  dateTime: Date | null;
  theme: string | null;
  artUrl: string | null;
  artUrls: string[];
  artOpenUrls: string[];
  tattooers: string[];
  staffNames: string[];
  staffSlots: string[];
  opponent: string | null;
  editArtUrl: string | null;
  signUpUrl: string | null;
  responsesUrl: string | null;
};

export type ScheduleData = {
  byTeam: Record<TeamKey, ScheduleEvent[]>;
  all: ScheduleEvent[];
};

const TEAM_KEYS: TeamKey[] = ['pickles', 'bangers', 'cherry_bombs'];
const WEB_SCHEDULE_CACHE_KEY = 'pickles_schedule_payload_v1';
const WEB_SCHEDULE_CACHE_TTL_MS = 2 * 60 * 1000;

export const PARTICIPANT_NAMES = [
  'Anna',
  'Anne',
  'Agnes',
  'Drew',
  'Jacob',
  'Jake',
  'Jason',
  'Jayden',
  'Jazz',
  'Kevin',
  'Lindsay',
  'Megan',
  'Shy',
  'Sienna',
  'Sisi',
  'Summer',
  'Tomma',
] as const;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeUrl(candidate: string): string | null {
  const value = candidate.trim();
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  return null;
}

function extractDriveFileId(url: string): string | null {
  const filePattern = /\/file\/d\/([a-zA-Z0-9_-]+)/i;
  const fileMatch = url.match(filePattern);
  if (fileMatch?.[1]) return fileMatch[1];

  const queryPattern = /[?&]id=([a-zA-Z0-9_-]+)/i;
  const queryMatch = url.match(queryPattern);
  if (queryMatch?.[1]) return queryMatch[1];

  return null;
}

function normalizeDriveImageUrl(url: string): string {
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  return `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
}

function normalizeDriveThumbnailUrl(url: string, width: number): string {
  const fileId = extractDriveFileId(url);
  if (!fileId) return url;
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

function asImageUrl(candidate: string): string | null {
  const url = normalizeUrl(candidate);
  if (!url) return null;
  if (/\.(png|jpe?g|webp|gif|heic|heif)(\?|#|$)/i.test(url)) return url;

  if (/drive\.google\.com\/(uc|file\/d\/|open\?id=)/i.test(url)) {
    return normalizeDriveImageUrl(url);
  }

  if (/drive\.usercontent\.google\.com\/download/i.test(url)) {
    return normalizeDriveImageUrl(url);
  }

  if (/lh3\.googleusercontent\.com\/d\//i.test(url)) {
    return url;
  }

  return null;
}

function normalizeDriveOpenUrl(url: string): string | null {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function asOpenImageUrl(candidate: string): string | null {
  const url = normalizeUrl(candidate);
  if (!url) return null;

  const driveOpenUrl = normalizeDriveOpenUrl(url);
  if (driveOpenUrl) return driveOpenUrl;

  return url;
}

function monthIndexFromLabel(monthLabel: string): number | null {
  const key = monthLabel.slice(0, 3).toLowerCase();
  const map: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  return map[key] ?? null;
}

export function parseEventDateLabel(label: string, now = new Date()): Date | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const noWeekday = trimmed.replace(/^[A-Za-z]+,\s*/, '');
  const match = noWeekday.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2})(?:,)?\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i
  );
  if (!match) return null;

  const month = monthIndexFromLabel(match[1]);
  const day = Number(match[2]);
  let hour = Number(match[3]);
  const minute = Number(match[4]);
  const meridian = match[5].toUpperCase();

  if (month === null || Number.isNaN(day) || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  if (meridian === 'PM' && hour < 12) hour += 12;
  if (meridian === 'AM' && hour === 12) hour = 0;

  const year = now.getFullYear();
  const date = new Date(year, month, day, hour, minute, 0, 0);

  // If parsing lands very far in the past, treat it as next season rollover.
  const daysAgo = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo > 120) {
    date.setFullYear(year + 1);
  }

  return date;
}

export function toThumbnailUrl(url: string, width = 420): string {
  const cleaned = url.trim();
  if (!cleaned) return url;

  if (/drive\.google\.com\/(uc|file\/d\/|open\?id=)/i.test(cleaned)) {
    return normalizeDriveThumbnailUrl(cleaned, width);
  }

  if (/drive\.usercontent\.google\.com\/download/i.test(cleaned)) {
    return normalizeDriveThumbnailUrl(cleaned, width);
  }

  const lh3Match = cleaned.match(/^(https:\/\/lh3\.googleusercontent\.com\/d\/[a-zA-Z0-9_-]+)(?:=w\d+)?$/i);
  if (lh3Match?.[1]) {
    return `${lh3Match[1]}=w${width}`;
  }

  return cleaned;
}

export function formatEventDate(event: ScheduleEvent): string {
  if (!event.dateTime) return event.dateLabel;

  return (
    event.dateTime.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) +
    ' • ' +
    event.dateTime.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  );
}

function normalizeStaffName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').replace(/[’']s$/i, '').trim();
}

function staffNameKey(name: string): string {
  return normalizeStaffName(name).toLowerCase();
}

export const MIN_PUBLISHED_STAFF_COUNT = 2;
export const STAFF_SLOT_COUNT = 3;

export function eventStaffing(event: ScheduleEvent): string[] {
  return event.staffNames.length > 0 ? event.staffNames : event.tattooers;
}

export function hasMinimumPublishedStaff(
  event: ScheduleEvent,
  minStaff = MIN_PUBLISHED_STAFF_COUNT
): boolean {
  return eventStaffing(event).length >= minStaff;
}

function isNullSlotValue(value: string): boolean {
  return value.trim().toLowerCase() === 'null';
}

function normalizeStaffSlotToken(slot: string): string {
  const value = slot.trim();
  if (!value || /^open$/i.test(value)) return '';
  if (/^null$/i.test(value)) return 'Null';
  return value;
}

function parseStaffSlotsValue(value: string): string[] {
  const rawSlots = value.split(/\s*\|\|\s*|\s*\/\s*|\s*,\s*/);
  const normalized = rawSlots.map(normalizeStaffSlotToken);
  while (normalized.length < STAFF_SLOT_COUNT) normalized.push('');
  return normalized.slice(0, STAFF_SLOT_COUNT);
}

function parseStaffSlotsFromRawEntry(entry: string): string[] {
  const match = entry.match(
    /(?:^|\|\s*)Staff Slots:\s*(.+?)(?=\s*\|\s*(?:Theme:|Tattooers:|Staffing:|Counter:|VS\s*-|Edit Art:|Edit URL:|Edit:|Sign Up:|Sign Up Responses:|Responses:|Image URL \d+:|Image:|Art:|Flash Art:)|$)/i
  );
  if (!match?.[1]) return [];
  return parseStaffSlotsValue(match[1]);
}

export function eventBlockedSlotCount(event: ScheduleEvent): number {
  if (!event.staffSlots || event.staffSlots.length === 0) return 0;
  return event.staffSlots.filter(slot => isNullSlotValue(slot)).length;
}

export function eventClaimableOpenSlots(event: ScheduleEvent): number {
  if (!event.staffSlots || event.staffSlots.length === 0) {
    return Math.max(0, STAFF_SLOT_COUNT - eventStaffing(event).length);
  }

  return event.staffSlots.filter(slot => {
    const value = slot.trim();
    return value.length === 0 || /^open$/i.test(value);
  }).length;
}

export function parseScheduleEntry(entry: string, team: TeamKey, index: number): ScheduleEvent {
  const rawStaffSlots = parseStaffSlotsFromRawEntry(entry);
  const parts = entry
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  const dateLabel = parts[0] ?? '';
  let theme: string | null = null;
  const artUrls: string[] = [];
  const artOpenUrls: string[] = [];
  let tattooers: string[] = [];
  let staffNames: string[] = [];
  let staffSlots: string[] = rawStaffSlots;
  let opponent: string | null = null;
  let editArtUrl: string | null = null;
  let signUpUrl: string | null = null;
  let responsesUrl: string | null = null;

  const addArtCandidate = (candidate: string | null) => {
    if (!candidate) return;

    const displayUrl = asImageUrl(candidate);
    if (!displayUrl) return;

    if (artUrls.includes(displayUrl)) return;

    const openUrl = asOpenImageUrl(candidate) ?? displayUrl;
    artUrls.push(displayUrl);
    artOpenUrls.push(openUrl);
  };

  for (const part of parts.slice(1)) {
    if (/^theme:/i.test(part)) {
      const value = part.replace(/^theme:\s*/i, '').trim();
      theme = value || null;
      continue;
    }

    if (/^(art:|image:|flash art:|image url \d+:)/i.test(part)) {
      const rawArt = part.replace(/^(art:|image:|flash art:|image url \d+:)\s*/i, '');
      addArtCandidate(rawArt);
      continue;
    }

    if (/^tattooers:/i.test(part)) {
      tattooers = part
        .replace(/^tattooers:\s*/i, '')
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0 && name.toLowerCase() !== 'null');
      continue;
    }

    if (/^staffing:/i.test(part)) {
      staffNames = part
        .replace(/^staffing:\s*/i, '')
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0 && name.toLowerCase() !== 'null');
      continue;
    }

    if (/^staff slots:/i.test(part)) {
      if (staffSlots.length === 0) {
        const rawValue = part.replace(/^staff slots:\s*/i, '');
        staffSlots = parseStaffSlotsValue(rawValue);
      }
      continue;
    }

    if (/^counter:/i.test(part)) {
      const counter = part.replace(/^counter:\s*/i, '').trim();
      if (counter && counter.toLowerCase() !== 'null') {
        staffNames.push(counter);
      }
      continue;
    }

    if (/^vs\s*-/i.test(part)) {
      const value = part.replace(/^vs\s*-\s*/i, '').trim();
      opponent = value || null;
      continue;
    }

    if (/^(edit art:|edit url:|edit:)/i.test(part)) {
      editArtUrl = normalizeUrl(part.replace(/^(edit art:|edit url:|edit:)\s*/i, ''));
      continue;
    }

    if (/^sign up:/i.test(part)) {
      signUpUrl = normalizeUrl(part.replace(/^sign up:\s*/i, ''));
      continue;
    }

    if (/^(sign up responses:|responses:)/i.test(part)) {
      responsesUrl = normalizeUrl(part.replace(/^(sign up responses:|responses:)\s*/i, ''));
      continue;
    }

    // Fallback for unlabeled image URLs in legacy payloads.
    const unlabeledImageUrl = asImageUrl(part);
    if (unlabeledImageUrl) {
      addArtCandidate(part);
      continue;
    }
  }
  const sourceStaffNames = staffNames.length > 0 ? staffNames : tattooers;
  const finalStaffNames: string[] = [];
  const seenStaffNames = new Set<string>();

  for (const name of sourceStaffNames) {
    const display = normalizeStaffName(name);
    const key = staffNameKey(name);
    if (!display || seenStaffNames.has(key)) continue;
    seenStaffNames.add(key);
    finalStaffNames.push(display);
  }

  const finalStaffSlots = (() => {
    if (staffSlots.length > 0) {
      const copy = [...staffSlots];
      while (copy.length < STAFF_SLOT_COUNT) copy.push('');
      return copy.slice(0, STAFF_SLOT_COUNT);
    }

    const copy = [...sourceStaffNames];
    while (copy.length < STAFF_SLOT_COUNT) copy.push('');
    return copy.slice(0, STAFF_SLOT_COUNT);
  })();

  return {
    id: `${team}-${index}`,
    team,
    raw: entry,
    dateLabel,
    dateTime: parseEventDateLabel(dateLabel),
    theme,
    artUrl: artUrls[0] ?? null,
    artUrls,
    artOpenUrls,
    tattooers,
    staffNames: finalStaffNames,
    staffSlots: finalStaffSlots,
    opponent,
    editArtUrl,
    signUpUrl,
    responsesUrl,
  };
}

function compareEvents(a: ScheduleEvent, b: ScheduleEvent): number {
  const aMs = a.dateTime ? a.dateTime.getTime() : Number.MAX_SAFE_INTEGER;
  const bMs = b.dateTime ? b.dateTime.getTime() : Number.MAX_SAFE_INTEGER;
  return aMs - bMs;
}

export function isEventOnOrAfterToday(event: ScheduleEvent, now = new Date()): boolean {
  if (!event.dateTime) return true;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(event.dateTime.getFullYear(), event.dateTime.getMonth(), event.dateTime.getDate());
  return eventDate.getTime() >= today.getTime();
}

export function excludePastEvents(data: ScheduleData, now = new Date()): ScheduleData {
  const all = data.all.filter(event => isEventOnOrAfterToday(event, now));
  return {
    byTeam: groupEventsByTeam(all),
    all,
  };
}

export function groupEventsByTeam(events: ScheduleEvent[]): Record<TeamKey, ScheduleEvent[]> {
  const grouped: Record<TeamKey, ScheduleEvent[]> = {
    pickles: [],
    bangers: [],
    cherry_bombs: [],
  };

  for (const event of events) {
    grouped[event.team].push(event);
  }

  for (const key of TEAM_KEYS) {
    grouped[key].sort(compareEvents);
  }

  return grouped;
}

export function uniqueStaffNames(events: ScheduleEvent[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const addName = (name: string) => {
    const display = normalizeStaffName(name);
    const normalized = staffNameKey(name);
    if (!display || !normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(display);
  };

  for (const name of PARTICIPANT_NAMES) {
    addName(name);
  }

  for (const event of events) {
    const names = eventStaffing(event);
    for (const name of names) {
      addName(name);
    }
  }

  return ordered;
}

export function filterEventsByStaff(events: ScheduleEvent[], staffName: string): ScheduleEvent[] {
  const target = staffNameKey(staffName);
  if (!target) return events;
  return events.filter(event => {
    const names = eventStaffing(event);
    return names.some(name => staffNameKey(name) === target);
  });
}

export function filterEventsByAnyTattooer(events: ScheduleEvent[], names: string[]): ScheduleEvent[] {
  const targets = names.map(name => staffNameKey(name)).filter(Boolean);
  if (targets.length === 0) return [];
  return events.filter(event => {
    const staff = eventStaffing(event);
    return staff.some(name => targets.includes(staffNameKey(name)));
  });
}

export function nextUpEvent(events: ScheduleEvent[], now = new Date()): ScheduleEvent | null {
  const staffed = events.filter(event => hasMinimumPublishedStaff(event));

  const upcoming = staffed
    .filter(event => event.dateTime && event.dateTime.getTime() >= now.getTime())
    .sort(compareEvents);

  if (upcoming.length > 0) return upcoming[0];
  return staffed.length > 0 ? [...staffed].sort(compareEvents)[0] : null;
}

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readWebCachedPayload(): RawScheduleResponse | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(WEB_SCHEDULE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cachedAt?: unknown; payload?: unknown };
    const cachedAt = typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0;
    if (!cachedAt || Date.now() - cachedAt > WEB_SCHEDULE_CACHE_TTL_MS) return null;
    if (!parsed.payload || typeof parsed.payload !== 'object') return null;
    return parsed.payload as RawScheduleResponse;
  } catch {
    return null;
  }
}

function writeWebCachedPayload(payload: RawScheduleResponse) {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(
      WEB_SCHEDULE_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        payload,
      })
    );
  } catch {
    // Ignore storage errors.
  }
}

function buildScheduleDataFromPayload(payload: RawScheduleResponse): ScheduleData {
  if (typeof payload.error === 'string' && payload.error.trim()) {
    throw new Error(payload.error);
  }

  const byTeam: Record<TeamKey, ScheduleEvent[]> = {
    pickles: asStringArray(payload.pickles).map((entry, index) => parseScheduleEntry(entry, 'pickles', index)),
    bangers: asStringArray(payload.bangers).map((entry, index) => parseScheduleEntry(entry, 'bangers', index)),
    cherry_bombs: asStringArray(payload.cherry_bombs).map((entry, index) =>
      parseScheduleEntry(entry, 'cherry_bombs', index)
    ),
  };

  for (const key of TEAM_KEYS) {
    byTeam[key].sort(compareEvents);
  }

  const all = [...byTeam.pickles, ...byTeam.bangers, ...byTeam.cherry_bombs].sort(compareEvents);
  return { byTeam, all };
}

export async function fetchScheduleData(): Promise<ScheduleData> {
  const cachedPayload = readWebCachedPayload();
  if (cachedPayload) {
    return buildScheduleDataFromPayload(cachedPayload);
  }

  const response = await fetch(SCHEDULE_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as RawScheduleResponse;
  writeWebCachedPayload(payload);
  return buildScheduleDataFromPayload(payload);
}
