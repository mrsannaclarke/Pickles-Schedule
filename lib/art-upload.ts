import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

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

type UploadSource = 'drive' | 'library' | 'camera' | 'file';

const DRIVE_IMAGES_FOLDER_URL =
  'https://drive.google.com/drive/folders/1J2m41QYj6RuOfGXug04hAiIHHkZVBlov?usp=drive_link';

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

function extractDriveFileId(value: string): string | null {
  const filePathMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (filePathMatch?.[1]) return filePathMatch[1];

  const queryIdMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (queryIdMatch?.[1]) return queryIdMatch[1];

  const lh3Match = value.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i);
  if (lh3Match?.[1]) return lh3Match[1];

  return null;
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

    const cleanup = () => {
      window.removeEventListener('focus', onFocus);
      if (inputEl.parentNode) inputEl.parentNode.removeChild(inputEl);
    };

    const finish = (result: { cancelled: boolean; base64: string | null; mimeType: string; fileName: string }) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(result);
    };

    const onFocus = () => {
      setTimeout(() => {
        if (done) return;
        const file = inputEl.files && inputEl.files[0];
        if (!file) finish(cancelledPickResult());
      }, 500);
    };

    window.addEventListener('focus', onFocus);

    inputEl.addEventListener(
      'change',
      () => {
        const file = inputEl.files && inputEl.files[0];
        if (!file) {
          finish(cancelledPickResult());
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result !== 'string') {
            finish(cancelledPickResult());
            return;
          }

          const marker = 'base64,';
          const idx = reader.result.indexOf(marker);
          const base64 = idx >= 0 ? reader.result.slice(idx + marker.length) : null;

          finish({
            cancelled: false,
            base64,
            mimeType: file.type || 'image/jpeg',
            fileName: file.name || `upload.${extensionFromMime(file.type || 'image/jpeg')}`,
          });
        };
        reader.onerror = () => finish(cancelledPickResult());
        reader.readAsDataURL(file);
      },
      { once: true }
    );

    inputEl.click();
  });
}

function chooseUploadSourceWeb(): UploadSource | null {
  if (typeof window === 'undefined') return null;

  const answer = window.prompt(
    [
      'Art Upload Station',
      'Choose image source:',
      '1) Choose from Drive folder',
      '2) Upload from camera roll',
      '3) Take photo',
      '4) Upload file',
      '',
      'Enter 1, 2, 3, or 4.',
    ].join('\n'),
    '2'
  );

  if (!answer) return null;
  const normalized = answer.trim().toLowerCase();

  if (normalized === '1') return 'drive';
  if (normalized === '2') return 'library';
  if (normalized === '3') return 'camera';
  if (normalized === '4') return 'file';

  return null;
}

function chooseUploadSourceNative(): Promise<UploadSource | null> {
  return new Promise(resolve => {
    Alert.alert('Upload Art', 'Choose image source', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Camera Roll', onPress: () => resolve('library') },
      { text: 'Take Photo', onPress: () => resolve('camera') },
      { text: 'Upload File', onPress: () => resolve('file') },
    ]);
  });
}

async function pickImageFromDriveLinkWeb(): Promise<{
  cancelled: boolean;
  base64: string | null;
  mimeType: string;
  fileName: string;
}> {
  if (typeof window === 'undefined') return cancelledPickResult();

  window.open(DRIVE_IMAGES_FOLDER_URL, '_blank', 'noopener,noreferrer');

  const urlInput = window.prompt(
    [
      'Paste the image link from Drive (from the Pickles images folder).',
      'You can paste either:',
      '- a drive.google.com/file/... link',
      '- a drive.google.com/uc?... link',
      '- or an lh3.googleusercontent.com/d/... link',
    ].join('\n')
  );

  if (!urlInput) return cancelledPickResult();

  const fileId = extractDriveFileId(urlInput.trim());
  const fetchUrl = fileId ? `https://lh3.googleusercontent.com/d/${fileId}=w2000` : urlInput.trim();

  let response: Response;
  try {
    response = await fetch(fetchUrl);
  } catch {
    return cancelledPickResult();
  }

  if (!response.ok) return cancelledPickResult();

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    return cancelledPickResult();
  }

  const base64 = await blobToBase64Web(blob);
  if (!base64) return cancelledPickResult();

  const mimeType = blob.type || 'image/jpeg';
  const ext = extensionFromMime(mimeType);
  const fileName = fileId ? `drive-${fileId}.${ext}` : `drive-image.${ext}`;

  return {
    cancelled: false,
    base64,
    mimeType,
    fileName,
  };
}

async function pickImageNative(source: UploadSource): Promise<{
  cancelled: boolean;
  base64: string | null;
  mimeType: string;
  fileName: string;
}> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return cancelledPickResult();

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.92,
      base64: true,
    });

    if (picked.canceled || !picked.assets.length) return cancelledPickResult();

    const asset = picked.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = extensionFromMime(mimeType);
    const fallbackName = `camera.${ext}`;
    let base64 = asset.base64 ?? null;

    if (!base64 && asset.uri) base64 = await uriToBase64(asset.uri);

    return {
      cancelled: false,
      base64,
      mimeType,
      fileName: asset.fileName ?? fallbackName,
    };
  }

  // 'library' and 'file' both route through image library on native.
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
  const source = Platform.OS === 'web' ? chooseUploadSourceWeb() : await chooseUploadSourceNative();
  if (!source) return cancelledPickResult();

  if (Platform.OS === 'web') {
    if (source === 'drive') return pickImageFromDriveLinkWeb();
    if (source === 'camera') return pickImageWeb({ accept: 'image/*', capture: 'environment' });
    if (source === 'file') return pickImageWeb({ accept: 'image/*' });
    return pickImageWeb({ accept: 'image/*' });
  }

  return pickImageNative(source);
}

export async function pickAndUploadEventArt(input: {
  event: ScheduleEvent;
  user: UploadUser;
}): Promise<UploadArtResult> {
  const selection = await pickImage();
  if (selection.cancelled) return { status: 'cancelled' };
  if (!selection.base64) {
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
