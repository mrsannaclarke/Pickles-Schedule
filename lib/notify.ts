import { Alert, Platform } from 'react-native';

type NotifyTone = 'info' | 'success' | 'error';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const WEB_TOAST_ROOT_ID = 'pickles-toast-root';

function inferTone(title: string): NotifyTone {
  const key = title.trim().toLowerCase();
  if (/(failed|error|not allowed|unavailable|denied|invalid)/i.test(key)) return 'error';
  if (/(success|claimed|updated|saved|signed|uploaded|opted|cancelled)/i.test(key)) return 'success';
  return 'info';
}

function toastColors(tone: NotifyTone) {
  if (tone === 'success') {
    return { border: '#2f8f4d', bg: '#1a2a1e', title: '#8af2ad', text: '#e9f8ee' };
  }
  if (tone === 'error') {
    return { border: '#ba3a3a', bg: '#2d1919', title: '#ff9fa5', text: '#ffe5e7' };
  }
  return { border: '#3f5563', bg: '#1b2127', title: '#d7e6f1', text: '#edf4f9' };
}

function webToast(title: string, message: string, tone: NotifyTone) {
  if (typeof document === 'undefined') return;

  let root = document.getElementById(WEB_TOAST_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = WEB_TOAST_ROOT_ID;
    root.style.position = 'fixed';
    root.style.top = '12px';
    root.style.right = '12px';
    root.style.zIndex = '2147483647';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '10px';
    root.style.maxWidth = 'min(92vw, 360px)';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);
  }

  const colors = toastColors(tone);
  const toast = document.createElement('div');
  toast.style.pointerEvents = 'auto';
  toast.style.border = `1px solid ${colors.border}`;
  toast.style.background = colors.bg;
  toast.style.borderRadius = '12px';
  toast.style.padding = '10px 12px';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.32)';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-6px)';
  toast.style.transition = 'opacity 180ms ease, transform 180ms ease';

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.color = colors.title;
  titleEl.style.fontWeight = '700';
  titleEl.style.fontSize = '14px';
  titleEl.style.marginBottom = '4px';

  const msgEl = document.createElement('div');
  msgEl.textContent = message;
  msgEl.style.color = colors.text;
  msgEl.style.fontSize = '13px';
  msgEl.style.lineHeight = '1.35';

  toast.appendChild(titleEl);
  toast.appendChild(msgEl);
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  const remove = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      if (root && root.childElementCount === 0 && root.parentNode) root.parentNode.removeChild(root);
    }, 180);
  };

  toast.addEventListener('click', remove, { once: true });
  setTimeout(remove, 4200);
}

export function notify(title: string, message: string, tone?: NotifyTone) {
  const resolvedTone = tone ?? inferTone(title);
  if (Platform.OS === 'web') {
    webToast(title, message, resolvedTone);
    return;
  }

  Alert.alert(title, message);
}

export function notifySuccess(title: string, message: string) {
  notify(title, message, 'success');
}

export function notifyError(title: string, message: string) {
  notify(title, message, 'error');
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
  } = options;

  if (Platform.OS === 'web') {
    const askConfirm = (globalThis as any).confirm;
    if (typeof askConfirm !== 'function') return Promise.resolve(true);
    return Promise.resolve(askConfirm(`${title}\n\n${message}`));
  }

  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
