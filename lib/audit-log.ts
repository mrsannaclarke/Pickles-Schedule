import { Platform } from 'react-native';

import { SCHEDULE_ENDPOINT } from '@/lib/schedule';

type AuditUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

type AuditStatus = 'info' | 'success' | 'error';

type AuditLogPayload = {
  action: 'audit_log';
  eventType: string;
  status: AuditStatus;
  message?: string;
  clientTimestamp: string;
  userEmail?: string;
  userDisplayName?: string;
  userMatchNames?: string[];
  userCanViewInfo?: boolean;
  team?: string;
  dateLabel?: string;
  theme?: string;
  signUpUrl?: string;
  rowNumber?: number;
  slot?: number;
  claimName?: string;
  details?: string;
  platform: string;
  userAgent?: string;
};

export async function writeAuditLog(input: {
  eventType: string;
  status?: AuditStatus;
  message?: string;
  user?: AuditUser | null;
  team?: string;
  dateLabel?: string;
  theme?: string;
  signUpUrl?: string;
  rowNumber?: number;
  slot?: number;
  claimName?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const payload: AuditLogPayload = {
    action: 'audit_log',
    eventType: input.eventType,
    status: input.status ?? 'info',
    message: input.message,
    clientTimestamp: new Date().toISOString(),
    userEmail: input.user?.email,
    userDisplayName: input.user?.displayName,
    userMatchNames: input.user?.matchNames,
    userCanViewInfo: input.user?.canViewInfo,
    team: input.team,
    dateLabel: input.dateLabel,
    theme: input.theme,
    signUpUrl: input.signUpUrl,
    rowNumber: input.rowNumber,
    slot: input.slot,
    claimName: input.claimName,
    details: input.details ? JSON.stringify(input.details) : undefined,
    platform: Platform.OS,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  try {
    await fetch(SCHEDULE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Logging must never break user actions.
  }
}

export function fireAndForgetAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  void writeAuditLog(input);
}
