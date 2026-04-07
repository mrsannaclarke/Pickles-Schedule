import { SCHEDULE_ENDPOINT, type ScheduleEvent } from '@/lib/schedule';

type StaffActionUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

type StaffActionPayloadBase = {
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

type SetStaffSlotPayload = StaffActionPayloadBase & {
  action: 'set_staff_slot';
  slot: number;
  staffName: string;
};

type CancelMySpotPayload = StaffActionPayloadBase & {
  action: 'cancel_my_spot';
};

type StaffActionResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  slot?: number;
};

export type StaffActionResult =
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; slot: number | null };

function buildPayloadBase(event: ScheduleEvent, user: StaffActionUser): StaffActionPayloadBase {
  return {
    team: event.team,
    dateLabel: event.dateLabel ?? '',
    theme: event.theme ?? '',
    signUpUrl: event.signUpUrl ?? '',
    userEmail: user.email,
    userDisplayName: user.displayName,
    userMatchNames: user.matchNames,
    userCanViewInfo: user.canViewInfo,
    tattooers: event.tattooers,
  };
}

async function postStaffAction(payload: SetStaffSlotPayload | CancelMySpotPayload): Promise<StaffActionResult> {
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
    return { status: 'error', message: 'Network error while updating staff.' };
  }

  const raw = await response.text();
  let parsed: StaffActionResponse;
  try {
    parsed = JSON.parse(raw) as StaffActionResponse;
  } catch {
    return { status: 'error', message: 'Staff action endpoint returned an invalid response.' };
  }

  if (!response.ok || parsed.error || !parsed.ok) {
    return {
      status: 'error',
      message: parsed.error || parsed.message || `Staff update failed (HTTP ${response.status}).`,
    };
  }

  return {
    status: 'success',
    message: parsed.message || 'Staff updated successfully.',
    slot: typeof parsed.slot === 'number' ? parsed.slot : null,
  };
}

export async function setStaffSlotForEvent(input: {
  event: ScheduleEvent;
  user: StaffActionUser;
  slot: number;
  staffName: string;
}): Promise<StaffActionResult> {
  const payload: SetStaffSlotPayload = {
    ...buildPayloadBase(input.event, input.user),
    action: 'set_staff_slot',
    slot: input.slot,
    staffName: input.staffName,
  };
  return postStaffAction(payload);
}

export async function cancelMySpotForEvent(input: {
  event: ScheduleEvent;
  user: StaffActionUser;
}): Promise<StaffActionResult> {
  const payload: CancelMySpotPayload = {
    ...buildPayloadBase(input.event, input.user),
    action: 'cancel_my_spot',
  };
  return postStaffAction(payload);
}
