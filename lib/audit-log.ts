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

type GetAuditLogsPayload = {
  action: 'get_audit_logs';
  userEmail?: string;
  userDisplayName?: string;
  userMatchNames?: string[];
  userCanViewInfo?: boolean;
  limit?: number;
};

type AuditLogResponse = {
  ok?: boolean;
  error?: string;
  logs?: AuditLogEntry[];
  total?: number;
};

export type AuditLogEntry = {
  serverTimestamp: string;
  clientTimestamp: string;
  eventType: string;
  status: AuditStatus | string;
  message: string;
  userEmail: string;
  userDisplayName: string;
  userMatchNames: string;
  userCanViewInfo: string;
  team: string;
  dateLabel: string;
  theme: string;
  signUpUrl: string;
  rowNumber: string | number;
  slot: string | number;
  claimName: string;
  platform: string;
  userAgent: string;
  details: string;
};

export const AUDIT_LOG_ALLOWED_EMAILS = new Set(['admin@anatomytattoo.com', 'anatomytattoo@gmail.com']);

export function canAccessAuditLogByEmail(email: string | null | undefined): boolean {
  const key = String(email || '').trim().toLowerCase();
  return AUDIT_LOG_ALLOWED_EMAILS.has(key);
}

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

export async function fetchAuditLogs(input: {
  user?: AuditUser | null;
  limit?: number;
}): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const payload: GetAuditLogsPayload = {
    action: 'get_audit_logs',
    userEmail: input.user?.email,
    userDisplayName: input.user?.displayName,
    userMatchNames: input.user?.matchNames,
    userCanViewInfo: input.user?.canViewInfo,
    limit: input.limit,
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
    throw new Error('Network error while loading audit logs.');
  }

  let parsed: AuditLogResponse;
  try {
    parsed = (await response.json()) as AuditLogResponse;
  } catch {
    throw new Error('Audit log endpoint returned an invalid response.');
  }

  if (!response.ok || !parsed.ok) {
    throw new Error(parsed.error || `Failed to load audit logs (HTTP ${response.status}).`);
  }

  return {
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    total: typeof parsed.total === 'number' ? parsed.total : 0,
  };
}
