import { confirmAction } from '@/lib/notify';
import { fireAndForgetAuditLog } from '@/lib/audit-log';
import { SCHEDULE_ENDPOINT, type ScheduleEvent } from '@/lib/schedule';

type OptOutUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

type OptOutPayload = {
  action: 'opt_out_game';
  team: ScheduleEvent['team'];
  dateLabel: string;
  theme: string;
  signUpUrl: string;
  userEmail: string;
  userDisplayName: string;
  userMatchNames: string[];
  userCanViewInfo: boolean;
  tattooers: string[];
};

type OptOutResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  rowNumber?: number;
};

export type OptOutGameResult =
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; rowNumber: number | null };

const OPT_OUT_EMAILS = new Set([
  'tattoosbytomma@gmail.com',
  'ladyshytattoos@gmail.com',
  'events.anatomytattoo@gmail.com',
  'mrs.annaclarke@gmail.com',
  'admin@anatomytattoo.com',
  'anatomytattoo@gmail.com',
]);

const OPT_OUT_NAMES = new Set(['tomma', 'shy', 'lady shy', 'anna']);

function normalizeName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '').replace(/[’']s$/i, '').trim().toLowerCase();
}

export function canManageGameOptOut(user: OptOutUser | null | undefined): boolean {
  if (!user) return false;
  const email = user.email.trim().toLowerCase();
  if (OPT_OUT_EMAILS.has(email)) return true;

  const names = [user.displayName, ...user.matchNames];
  return names.some(name => OPT_OUT_NAMES.has(normalizeName(name)));
}

export function confirmGameOptOut(theme: string): Promise<boolean> {
  const themeLabel = theme.trim() || 'this game';
  return confirmAction({
    title: 'Team Opt-Out',
    message: `Opt out "${themeLabel}" for everyone?\n\nThis will set staffing slots to Null and pause form generation for this game.`,
    confirmLabel: 'Opt Out',
    cancelLabel: 'Keep Game',
    destructive: true,
  });
}

export async function optOutGameForEveryone(input: {
  event: ScheduleEvent;
  user: OptOutUser;
}): Promise<OptOutGameResult> {
  const payload: OptOutPayload = {
    action: 'opt_out_game',
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    userEmail: input.user.email,
    userDisplayName: input.user.displayName,
    userMatchNames: input.user.matchNames,
    userCanViewInfo: input.user.canViewInfo,
    tattooers: input.event.tattooers,
  };

  let response: Response;
  try {
    response = await fetch(SCHEDULE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    fireAndForgetAuditLog({
      eventType: 'opt_out_game',
      status: 'error',
      message: 'Network error while opting out game.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
    });
    return { status: 'error', message: 'Network error while opting out game.' };
  }

  const raw = await response.text();
  let parsed: OptOutResponse;
  try {
    parsed = JSON.parse(raw) as OptOutResponse;
  } catch {
    fireAndForgetAuditLog({
      eventType: 'opt_out_game',
      status: 'error',
      message: 'Opt-out endpoint returned an invalid response.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      details: { httpStatus: response.status },
    });
    return { status: 'error', message: 'Opt-out endpoint returned an invalid response.' };
  }

  if (!response.ok || parsed.error || !parsed.ok) {
    fireAndForgetAuditLog({
      eventType: 'opt_out_game',
      status: 'error',
      message: parsed.error || parsed.message || `Opt out failed (HTTP ${response.status}).`,
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : undefined,
      details: { httpStatus: response.status },
    });
    return {
      status: 'error',
      message: parsed.error || parsed.message || `Opt out failed (HTTP ${response.status}).`,
    };
  }

  fireAndForgetAuditLog({
    eventType: 'opt_out_game',
    status: 'success',
    message: parsed.message || 'Game opted out successfully.',
    user: input.user,
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : undefined,
    details: { httpStatus: response.status },
  });

  return {
    status: 'success',
    message: parsed.message || 'Game opted out successfully.',
    rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : null,
  };
}
