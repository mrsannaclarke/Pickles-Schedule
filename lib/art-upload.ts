import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { fireAndForgetAuditLog } from '@/lib/audit-log';
import { SCHEDULE_ENDPOINT, type ScheduleEvent } from '@/lib/schedule';

type UploadUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

type UploadPayload = {
  action: 'upload_art';
  team: ScheduleEvent['team'];
  dateLabel: string;
  theme: string;
  signUpUrl: string;
  userEmail: string;
  userDisplayName: string;
  userMatchNames: string[];
  userCanViewInfo: boolean;
  tattooers: string[];
  mimeType: string;
  fileName: string;
  base64: string;
};

type DeletePayload = {
  action: 'delete_art';
  team: ScheduleEvent['team'];
  dateLabel: string;
  theme: string;
  signUpUrl: string;
  userEmail: string;
  userDisplayName: string;
  userMatchNames: string[];
  userCanViewInfo: boolean;
  tattooers: string[];
  slot: number;
};

type UploadResponse = {
  ok?: boolean;
  error?: string;
  rowNumber?: number;
  imageUrl?: string;
  slot?: number;
  message?: string;
};

export type UploadArtResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; imageUrl: string; slot: number | null };

export type DeleteArtResult =
  | { status: 'error'; message: string }
  | { status: 'success'; message: string; slot: number | null };

const WEB_IMAGE_MAX_DIMENSION = 2000;
const WEB_IMAGE_JPEG_QUALITY = 0.88;

function extensionFromMime(mimeType: string) {
  const lower = mimeType.toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('heic')) return 'heic';
  if (lower.includes('gif')) return 'gif';
  return 'jpg';
}

function mimeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

async function uriToBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return null;
  }
}

function cancelledPickResult() {
  return { cancelled: true, base64: null, mimeType: 'image/jpeg', fileName: 'upload.jpg' };
}

function blobToBase64Web(blob: Blob): Promise<string | null> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        resolve(null);
        return;
      }

      const marker = 'base64,';
      const idx = reader.result.indexOf(marker);
      resolve(idx >= 0 ? reader.result.slice(idx + marker.length) : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function canvasToBlobWeb(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), mimeType, quality);
  });
}

function loadImageFromObjectUrlWeb(objectUrl: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = objectUrl;
  });
}

async function normalizeImageFileForUploadWeb(file: File): Promise<{
  blob: Blob;
  mimeType: string;
  fileName: string;
}> {
  const originalMimeType = file.type || mimeFromFileName(file.name || '') || 'image/jpeg';
  const originalName = file.name || `upload.${extensionFromMime(originalMimeType)}`;

  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    originalMimeType.toLowerCase() === 'image/gif'
  ) {
    return { blob: file, mimeType: originalMimeType, fileName: originalName };
  }

  const objectUrl = window.URL.createObjectURL(file);

  try {
    const img = await loadImageFromObjectUrlWeb(objectUrl);
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return { blob: file, mimeType: originalMimeType, fileName: originalName };
    }

    const scale = Math.min(1, WEB_IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return { blob: file, mimeType: originalMimeType, fileName: originalName };

    context.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlobWeb(canvas, 'image/jpeg', WEB_IMAGE_JPEG_QUALITY);
    if (!blob) return { blob: file, mimeType: originalMimeType, fileName: originalName };

    const baseName = originalName.replace(/\.[^.]+$/, '') || 'upload';
    return {
      blob,
      mimeType: 'image/jpeg',
      fileName: `${baseName}.jpg`,
    };
  } catch {
    return { blob: file, mimeType: originalMimeType, fileName: originalName };
  } finally {
    window.URL.revokeObjectURL(objectUrl);
  }
}

async function pickImageWeb(input: {
  accept?: string;
  capture?: 'environment';
}): Promise<{
  cancelled: boolean;
  base64: string | null;
  mimeType: string;
  fileName: string;
}> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return cancelledPickResult();
  }

  return await new Promise(resolve => {
    const inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.accept = input.accept ?? 'image/*';
    if (input.capture) inputEl.setAttribute('capture', input.capture);
    inputEl.style.position = 'fixed';
    inputEl.style.left = '-9999px';
    inputEl.style.opacity = '0';
    document.body.appendChild(inputEl);

    let done = false;
    let cancelTimer: ReturnType<typeof window.setTimeout> | null = null;

    const cleanup = () => {
      window.removeEventListener('focus', onFocus);
      if (cancelTimer) window.clearTimeout(cancelTimer);
      if (inputEl.parentNode) inputEl.parentNode.removeChild(inputEl);
    };

    const finish = (result: { cancelled: boolean; base64: string | null; mimeType: string; fileName: string }) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };

    const onFocus = () => {
      if (cancelTimer) window.clearTimeout(cancelTimer);
      cancelTimer = window.setTimeout(() => {
        if (done) return;
        const file = inputEl.files && inputEl.files[0];
        if (!file) finish(cancelledPickResult());
      }, 4000);
    };

    window.addEventListener('focus', onFocus);
    inputEl.addEventListener('cancel', () => finish(cancelledPickResult()), { once: true });

    inputEl.addEventListener(
      'change',
      async () => {
        const file = inputEl.files && inputEl.files[0];
        if (!file) {
          finish(cancelledPickResult());
          return;
        }

        try {
          const normalized = await normalizeImageFileForUploadWeb(file);
          const base64 = await blobToBase64Web(normalized.blob);
          finish({
            cancelled: false,
            base64,
            mimeType: normalized.mimeType,
            fileName: normalized.fileName,
          });
        } catch {
          finish(cancelledPickResult());
        }
      },
      { once: true }
    );

    inputEl.click();
  });
}

async function pickImageNative(): Promise<{
  cancelled: boolean;
  base64: string | null;
  mimeType: string;
  fileName: string;
}> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return cancelledPickResult();

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.92,
    base64: true,
  });

  if (picked.canceled || !picked.assets.length) return cancelledPickResult();

  const asset = picked.assets[0];
  const mimeType = asset.mimeType ?? (mimeFromFileName(asset.fileName ?? '') || 'image/jpeg');
  const ext = extensionFromMime(mimeType);
  const fallbackName = `upload.${ext}`;
  let base64 = asset.base64 ?? null;

  if (!base64 && asset.uri) base64 = await uriToBase64(asset.uri);

  return {
    cancelled: false,
    base64,
    mimeType,
    fileName: asset.fileName ?? fallbackName,
  };
}

async function pickImage() {
  if (Platform.OS === 'web') {
    return pickImageWeb({ accept: 'image/*' });
  }

  return pickImageNative();
}

export async function pickAndUploadEventArt(input: {
  event: ScheduleEvent;
  user: UploadUser;
}): Promise<UploadArtResult> {
  const selection = await pickImage();
  if (selection.cancelled) {
    fireAndForgetAuditLog({
      eventType: 'upload_art_cancelled',
      status: 'info',
      message: 'User cancelled image selection.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
    });
    return { status: 'cancelled' };
  }
  if (!selection.base64) {
    fireAndForgetAuditLog({
      eventType: 'upload_art',
      status: 'error',
      message: 'Selected image could not be read.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      details: { fileName: selection.fileName, mimeType: selection.mimeType },
    });
    return { status: 'error', message: 'Selected image could not be read. Please try another file.' };
  }

  const payload: UploadPayload = {
    action: 'upload_art',
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    userEmail: input.user.email,
    userDisplayName: input.user.displayName,
    userMatchNames: input.user.matchNames,
    userCanViewInfo: input.user.canViewInfo,
    tattooers: input.event.tattooers,
    mimeType: selection.mimeType,
    fileName: selection.fileName,
    base64: selection.base64,
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
      eventType: 'upload_art',
      status: 'error',
      message: 'Network error while uploading art.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      details: { fileName: selection.fileName, mimeType: selection.mimeType },
    });
    return { status: 'error', message: 'Network error while uploading art.' };
  }

  const raw = await response.text();
  let parsed: UploadResponse;
  try {
    parsed = JSON.parse(raw) as UploadResponse;
  } catch {
    fireAndForgetAuditLog({
      eventType: 'upload_art',
      status: 'error',
      message: 'Upload endpoint returned an invalid response.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      details: { httpStatus: response.status },
    });
    return { status: 'error', message: 'Upload endpoint returned an invalid response.' };
  }

  if (!response.ok || parsed.error || !parsed.ok || !parsed.imageUrl) {
    fireAndForgetAuditLog({
      eventType: 'upload_art',
      status: 'error',
      message: parsed.error || `Upload failed (HTTP ${response.status}).`,
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : undefined,
      slot: typeof parsed.slot === 'number' ? parsed.slot : undefined,
      details: { httpStatus: response.status },
    });
    return {
      status: 'error',
      message: parsed.error || `Upload failed (HTTP ${response.status}).`,
    };
  }

  fireAndForgetAuditLog({
    eventType: 'upload_art',
    status: 'success',
    message: parsed.message || 'Art uploaded successfully.',
    user: input.user,
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : undefined,
    slot: typeof parsed.slot === 'number' ? parsed.slot : undefined,
    details: {
      imageUrl: parsed.imageUrl,
      httpStatus: response.status,
      fileName: selection.fileName,
      mimeType: selection.mimeType,
    },
  });

  return {
    status: 'success',
    message: parsed.message || 'Art uploaded successfully.',
    imageUrl: parsed.imageUrl,
    slot: typeof parsed.slot === 'number' ? parsed.slot : null,
  };
}


export async function deleteEventArt(input: {
  event: ScheduleEvent;
  user: UploadUser;
  slot: number;
}): Promise<DeleteArtResult> {
  const payload: DeletePayload = {
    action: 'delete_art',
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    userEmail: input.user.email,
    userDisplayName: input.user.displayName,
    userMatchNames: input.user.matchNames,
    userCanViewInfo: input.user.canViewInfo,
    tattooers: input.event.tattooers,
    slot: input.slot,
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
      eventType: 'delete_art',
      status: 'error',
      message: 'Network error while deleting art.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      slot: input.slot,
    });
    return { status: 'error', message: 'Network error while deleting art.' };
  }

  const raw = await response.text();
  let parsed: UploadResponse;
  try {
    parsed = JSON.parse(raw) as UploadResponse;
  } catch {
    fireAndForgetAuditLog({
      eventType: 'delete_art',
      status: 'error',
      message: 'Delete endpoint returned an invalid response.',
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      slot: input.slot,
      details: { httpStatus: response.status },
    });
    return { status: 'error', message: 'Delete endpoint returned an invalid response.' };
  }

  if (!response.ok || parsed.error || !parsed.ok) {
    fireAndForgetAuditLog({
      eventType: 'delete_art',
      status: 'error',
      message: parsed.error || parsed.message || ('Delete failed (HTTP ' + response.status + ').'),
      user: input.user,
      team: input.event.team,
      dateLabel: input.event.dateLabel ?? '',
      theme: input.event.theme ?? '',
      signUpUrl: input.event.signUpUrl ?? '',
      rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : undefined,
      slot: typeof parsed.slot === 'number' ? parsed.slot : input.slot,
      details: { httpStatus: response.status },
    });
    return {
      status: 'error',
      message: parsed.error || parsed.message || ('Delete failed (HTTP ' + response.status + ').'),
    };
  }

  fireAndForgetAuditLog({
    eventType: 'delete_art',
    status: 'success',
    message: parsed.message || 'Image deleted successfully.',
    user: input.user,
    team: input.event.team,
    dateLabel: input.event.dateLabel ?? '',
    theme: input.event.theme ?? '',
    signUpUrl: input.event.signUpUrl ?? '',
    rowNumber: typeof parsed.rowNumber === 'number' ? parsed.rowNumber : undefined,
    slot: typeof parsed.slot === 'number' ? parsed.slot : input.slot,
    details: { httpStatus: response.status },
  });

  return {
    status: 'success',
    message: parsed.message || 'Image deleted successfully.',
    slot: typeof parsed.slot === 'number' ? parsed.slot : null,
  };
}
