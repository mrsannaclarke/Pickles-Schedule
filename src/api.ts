import type { AuthUser } from './auth';
import { SCHEDULE_ENDPOINT } from './config';
import type { ScheduleEvent } from '../lib/schedule';

type ApiResult = { ok?: boolean; error?: string; message?: string; slot?: number; rowNumber?: number; imageUrl?: string; logs?: AuditEntry[]; total?: number };
export type AuditEntry = Record<string, string | number>;

function eventPayload(event: ScheduleEvent, user: AuthUser) {
  return {
    team: event.team, dateLabel: event.dateLabel ?? '', theme: event.theme ?? '',
    signUpUrl: event.signUpUrl ?? '', tattooers: event.tattooers,
    userEmail: user.email, userDisplayName: user.displayName,
    userMatchNames: user.matchNames, userCanViewInfo: user.canViewInfo,
  };
}

async function post(payload: Record<string, unknown>): Promise<ApiResult> {
  const response = await fetch(SCHEDULE_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let result: ApiResult;
  try { result = JSON.parse(raw) as ApiResult; }
  catch { throw new Error('The schedule service returned an invalid response.'); }
  if (!response.ok || !result.ok) throw new Error(result.error || result.message || `Request failed (${response.status}).`);
  return result;
}

export async function claimSpot(event: ScheduleEvent, user: AuthUser, claimName: string, requestedSlot?: number) {
  return post({ action: 'claim_spot', ...eventPayload(event, user), claimName, requestedSlot });
}
export async function setStaffSlot(event: ScheduleEvent, user: AuthUser, slot: number, staffName: string) {
  return post({ action: 'set_staff_slot', ...eventPayload(event, user), slot, staffName });
}
export async function cancelMySpot(event: ScheduleEvent, user: AuthUser) {
  return post({ action: 'cancel_my_spot', ...eventPayload(event, user) });
}
export async function optOutGame(event: ScheduleEvent, user: AuthUser) {
  return post({ action: 'opt_out_game', ...eventPayload(event, user) });
}
export async function deleteArt(event: ScheduleEvent, user: AuthUser, slot: number) {
  return post({ action: 'delete_art', ...eventPayload(event, user), slot });
}

function fileToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split('base64,')[1] || '') : reject(new Error('Image could not be read.'));
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

async function normalizeImage(file: File) {
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return { blob: file, mimeType: file.type || 'image/jpeg', fileName: file.name };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, mimeType: file.type || 'image/jpeg', fileName: file.name };
  }
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return { blob: file, mimeType: file.type || 'image/jpeg', fileName: file.name };
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  return { blob: blob || file, mimeType: blob ? 'image/jpeg' : file.type, fileName: blob ? `${file.name.replace(/\.[^.]+$/, '')}.jpg` : file.name };
}

export async function uploadArt(event: ScheduleEvent, user: AuthUser, file: File) {
  const normalized = await normalizeImage(file);
  const base64 = await fileToBase64(normalized.blob);
  return post({ action: 'upload_art', ...eventPayload(event, user), mimeType: normalized.mimeType, fileName: normalized.fileName, base64 });
}

export async function fetchAuditLog(user: AuthUser) {
  const result = await post({ action: 'get_audit_logs', userEmail: user.email, userDisplayName: user.displayName, userMatchNames: user.matchNames, userCanViewInfo: user.canViewInfo, limit: 200 });
  return { logs: result.logs || [], total: result.total || 0 };
}
