import type { ScheduleEvent } from '@/lib/schedule';

const SLOT_3_ONLY_NAMES = new Set(['kevin', 'jacob', 'jason']);

function normalizeName(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/[’']s$/i, '')
    .trim()
    .toLowerCase();
}

function isOpenSlotValue(value: string): boolean {
  const token = String(value || '').trim().toLowerCase();
  return token === '' || token === 'open';
}

function isBlockedSlotValue(value: string): boolean {
  return String(value || '').trim().toLowerCase() === 'null';
}

export function isSlot3OnlySigner(name: string): boolean {
  return SLOT_3_ONLY_NAMES.has(normalizeName(name));
}

export function validateClaimRule(event: ScheduleEvent, claimName: string): {
  ok: boolean;
  message?: string;
  requestedSlot?: number;
} {
  if (!isSlot3OnlySigner(claimName)) {
    return { ok: true };
  }

  const slot3 = event.staffSlots?.[2] ?? '';
  if (isBlockedSlotValue(slot3)) {
    return {
      ok: false,
      message: 'This game blocks slot 3, so this signer cannot be added.',
    };
  }

  if (!isOpenSlotValue(slot3)) {
    return {
      ok: false,
      message: 'This signer can only use slot 3, and slot 3 is already taken.',
    };
  }

  return { ok: true, requestedSlot: 3 };
}
