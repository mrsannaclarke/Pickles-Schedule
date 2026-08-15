import type { AuthUser } from './auth';

const OPT_OUT_EMAILS = new Set([
  'tattoosbytomma@gmail.com', 'ladyshytattoos@gmail.com', 'events.anatomytattoo@gmail.com',
  'mrs.annaclarke@gmail.com', 'admin@anatomytattoo.com', 'anatomytattoo@gmail.com',
]);
const OPT_OUT_NAMES = new Set(['tomma', 'shy', 'lady shy', 'anna']);
const SLOT_3_ONLY_NAMES = new Set(['kevin', 'jacob', 'jason']);

export function canManageGameOptOut(user: AuthUser | null) {
  if (!user) return false;
  return OPT_OUT_EMAILS.has(user.email.toLowerCase()) || [user.displayName, ...user.matchNames].some((name) => OPT_OUT_NAMES.has(name.toLowerCase()));
}

export function claimRule(staffSlots: string[], claimName: string): { ok: boolean; requestedSlot?: number; message?: string } {
  if (!SLOT_3_ONLY_NAMES.has(claimName.trim().toLowerCase())) return { ok: true };
  const slot = (staffSlots[2] || '').trim().toLowerCase();
  if (slot === 'null') return { ok: false, message: 'Slot 3 is blocked for this game.' };
  if (slot && slot !== 'open') return { ok: false, message: 'This signer can only use slot 3, which is already taken.' };
  return { ok: true, requestedSlot: 3 };
}
