import { SCHEDULE_ENDPOINT, type ScheduleEvent } from '@/lib/schedule';

type ClaimUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

type ClaimPayload = {
  action: 'claim_spot';
  team: ScheduleEvent['team'];
  dateLabel: string;
  theme: string;
  signUpUrl: string;
  userEmail: string;
  userDisplayName: string;
  userMatchNames: string[];
  userCanViewInfo: boolean;
  tattooers: string[];
  claimName: string;
};

type ClaimResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  slot?: number;
  claimName?: string;
};

export type ClaimSpotResult =
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; slot: number | null; claimName: string | null };

export async function claimEventSpot(input: {
  event: ScheduleEvent;
  user: ClaimUser;
  claimName?: string;
}): Promise<ClaimSpotResult> {
  const preferredName =
    (input.claimName && input.claimName.trim().length > 0 ? input.claimName.trim() : '') ||
    input.user.matchNames.find(name => name && name.trim().length > 0)?.trim() ||
    input.user.displayName ||
    input.user.email;

  const payload: ClaimPayload = {
    action: 'claim_spot',
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    userEmail: input.user.email,
    userDisplayName: input.user.displayName,
    userMatchNames: input.user.matchNames,
    userCanViewInfo: input.user.canViewInfo,
    tattooers: input.event.tattooers,
    claimName: preferredName,
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
    return { status: 'error', message: 'Network error while claiming a spot.' };
  }

  const raw = await response.text();
  let parsed: ClaimResponse;
  try {
    parsed = JSON.parse(raw) as ClaimResponse;
  } catch {
    return { status: 'error', message: 'Claim endpoint returned an invalid response.' };
  }

  if (!response.ok || parsed.error || !parsed.ok) {
    return {
      status: 'error',
      message: parsed.error || parsed.message || `Claim failed (HTTP ${response.status}).`,
    };
  }

  return {
    status: 'success',
    message: parsed.message || 'Spot claimed successfully.',
    slot: typeof parsed.slot === 'number' ? parsed.slot : null,
    claimName: parsed.claimName ?? null,
  };
}
