import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { fireAndForgetAuditLog } from '@/lib/audit-log';

WebBrowser.maybeCompleteAuthSession();

type AllowedUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

// Populate this list when you're ready to lock down access.
// If the list is empty, any Google account can sign in.
const ALLOWED_USERS: AllowedUser[] = [
  { email: 'tattoosbytomma@gmail.com', displayName: 'Tomma', matchNames: ['Tomma'], canViewInfo: false },
  { email: 'ladyshytattoos@gmail.com', displayName: 'Shy', matchNames: ['Shy', 'Lady Shy'], canViewInfo: false },
  {
    email: 'events.anatomytattoo@gmail.com',
    displayName: 'Shy',
    matchNames: ['Shy', 'Lady Shy'],
    canViewInfo: false,
  },
  { email: 'sketchu2@gmail.com', displayName: 'Summer', matchNames: ['Summer'], canViewInfo: false },
  { email: 'siennarosey@gmail.com', displayName: 'Sienna', matchNames: ['Sienna'], canViewInfo: false },
  { email: 'sailorsisilia@gmail.com', displayName: 'Sisi', matchNames: ['Sisi'], canViewInfo: false },
  { email: 'info@agneshamilton.com', displayName: 'Agnes', matchNames: ['Agnes'], canViewInfo: false },
  { email: 'meganechtattoos@gmail.com', displayName: 'Megan', matchNames: ['Megan'], canViewInfo: false },
  { email: 'meganechevarria96@gmail.com', displayName: 'Megan', matchNames: ['Megan'], canViewInfo: false },
  { email: 'jazzstahrtattoo@gmail.com', displayName: 'Jazz', matchNames: ['Jazz'], canViewInfo: false },
  { email: 'jazzstahr@gmail.com', displayName: 'Jazz', matchNames: ['Jazz'], canViewInfo: false },
  { email: 'appointments@drewlinden.com', displayName: 'Drew', matchNames: ['Drew'], canViewInfo: false },
  { email: 'drew@drewlinden.com', displayName: 'Drew', matchNames: ['Drew'], canViewInfo: false },
  { email: 'honeyandsass@gmail.com', displayName: 'Lindsay', matchNames: ['Lindsay'], canViewInfo: false },
  { email: 'inkdiva66@gmail.com', displayName: 'Anne', matchNames: ['Anne'], canViewInfo: false },
  { email: 'jaketongtattoos@gmail.com', displayName: 'Jake', matchNames: ['Jake'], canViewInfo: false },
  { email: 'artsofjayden@gmail.com', displayName: 'Jayden', matchNames: ['Jayden'], canViewInfo: false },
  { email: 'jamueller01@gmail.com', displayName: 'Jayden', matchNames: ['Jayden'], canViewInfo: false },
  { email: 'luckymalony@gmail.com', displayName: 'Lucky', matchNames: ['Lucky'], canViewInfo: false },
  { email: 'sirjasonbarnes@gmail.com', displayName: 'Jason', matchNames: ['Jason'], canViewInfo: false },
  { email: 'breannenorling@gmail.com', displayName: 'Bree', matchNames: ['Bree', 'Breanne'], canViewInfo: true },
  {
    email: 'anatomytattoo@gmail.com',
    displayName: 'Anatomy Tattoo',
    matchNames: ['Anatomy Tattoo'],
    canViewInfo: true,
  },
  { email: 'mrs.annaclarke@gmail.com', displayName: 'Anna', matchNames: ['Anna'], canViewInfo: true },
  { email: 'admin@anatomytattoo.com', displayName: 'Anna', matchNames: ['Anna'], canViewInfo: true },
];

const GUEST_COUNTER_NAMES = ['Jacob', 'Kevin'] as const;
const GUEST_PASSWORD = 'Tomma3021!';
const AUTH_STORAGE_KEY = 'pickles_schedule_auth_user_v1';
const DEFAULT_WEB_CLIENT_ID =
  '782128846272-hvq1st144odrrq2vuhdjc6gtlrrsfgbf.apps.googleusercontent.com';
const DEFAULT_PROD_WEB_REDIRECT_URI = 'https://mrsannaclarke.github.io/Pickles-Schedule/';

function resolveWebRedirectUri(): string {
  const explicit = process.env.EXPO_PUBLIC_GOOGLE_WEB_REDIRECT_URI;
  if (explicit && explicit.trim()) return explicit.trim();

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const origin = String(window.location.origin || '').replace(/\/+$/, '');

    if (host === 'localhost' || host === '127.0.0.1') return `${origin}/`;
    return `${origin}/Pickles-Schedule/`;
  }

  return DEFAULT_PROD_WEB_REDIRECT_URI;
}

type AuthUser = {
  email: string;
  displayName: string;
  matchNames: string[];
  canViewInfo: boolean;
};

type AuthContextValue = {
  status: 'signed_out' | 'signing_in' | 'signed_in';
  user: AuthUser | null;
  errorMessage: string | null;
  canSignIn: boolean;
  signIn: () => Promise<void>;
  signInAsGuest: (name: string, password: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  return (
    typeof user.email === 'string' &&
    typeof user.displayName === 'string' &&
    Array.isArray(user.matchNames) &&
    typeof user.canViewInfo === 'boolean'
  );
}

function restoreUserFromStorage(): AuthUser | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isAuthUser(parsed)) return null;

    // Reconcile persisted users against the current allowlist.
    if (parsed.email.startsWith('guest:')) {
      return parsed;
    }

    const allowlisted = allowedUserForEmail(parsed.email);
    if (ALLOWED_USERS.length > 0 && !allowlisted) return null;

    return allowlisted
      ? {
          email: allowlisted.email,
          displayName: allowlisted.displayName,
          matchNames: allowlisted.matchNames,
          canViewInfo: allowlisted.canViewInfo,
        }
      : parsed;
  } catch {
    return null;
  }
}

function persistUserToStorage(user: AuthUser | null) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (user) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore persistence failures (private mode/storage limits).
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function inferMatchNames(email: string, googleName: string): string[] {
  const local = email.split('@')[0] ?? '';
  const guesses = [local, titleCase(local), googleName];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of guesses) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = normalizeName(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function allowedUserForEmail(email: string): AllowedUser | null {
  const target = normalizeName(email);
  return ALLOWED_USERS.find(user => normalizeName(user.email) === target) ?? null;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google user info failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { email?: string; name?: string };
  if (!payload.email) {
    throw new Error('Google sign-in did not return an email.');
  }

  return {
    email: payload.email,
    name: payload.name ?? payload.email,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthContextValue['status']>('signed_out');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_WEB_CLIENT_ID;
  const webRedirectUri = Platform.OS === 'web' ? resolveWebRedirectUri() : undefined;
  const iosClientIdForRequest = iosClientId ?? 'missing-ios-client-id';
  const androidClientIdForRequest = androidClientId ?? 'missing-android-client-id';
  const webClientIdForRequest = webClientId ?? 'missing-web-client-id';

  const [request, response, promptAsync] = Google.useAuthRequest({
    scopes: ['openid', 'profile', 'email'],
    iosClientId: iosClientIdForRequest,
    androidClientId: androidClientIdForRequest,
    webClientId: webClientIdForRequest,
    redirectUri: webRedirectUri,
  });

  const canSignIn = useMemo(
    () => (Platform.OS === 'web' ? Boolean(webClientId) : Boolean(iosClientId || androidClientId)),
    [androidClientId, iosClientId, webClientId]
  );

  useEffect(() => {
    const restored = restoreUserFromStorage();
    if (!restored) return;
    setUser(restored);
    setStatus('signed_in');
  }, []);

  useEffect(() => {
    persistUserToStorage(status === 'signed_in' ? user : null);
  }, [status, user]);

  useEffect(() => {
    if (!response) return;

    if (response.type !== 'success') {
      setStatus('signed_out');
      if (response.type === 'error') {
        const maybeError = (response as any)?.error?.message || (response as any)?.params?.error_description;
        setErrorMessage(maybeError ? String(maybeError) : 'Google sign-in failed.');
      }
      return;
    }

    const accessToken = response.authentication?.accessToken;
    if (!accessToken) {
      setStatus('signed_out');
      setErrorMessage('Google sign-in succeeded but no access token was returned.');
      return;
    }

    (async () => {
      try {
        const info = await fetchGoogleUserInfo(accessToken);
        const allowlisted = allowedUserForEmail(info.email);

        if (ALLOWED_USERS.length > 0 && !allowlisted) {
          fireAndForgetAuditLog({
            eventType: 'auth_google_sign_in_denied',
            status: 'error',
            message: 'Signed in account is not on allowlist.',
            user: {
              email: info.email,
              displayName: info.name,
              matchNames: inferMatchNames(info.email, info.name),
              canViewInfo: false,
            },
          });
          setStatus('signed_out');
          setUser(null);
          setErrorMessage(`Signed in as ${info.email}, but this account is not on the allowlist.`);
          return;
        }

        const nextUser: AuthUser = allowlisted
          ? {
              email: allowlisted.email,
              displayName: allowlisted.displayName,
              matchNames: allowlisted.matchNames,
              canViewInfo: allowlisted.canViewInfo,
            }
          : {
              email: info.email,
              displayName: info.name,
              matchNames: inferMatchNames(info.email, info.name),
              canViewInfo: false,
            };

        setUser(nextUser);
        setStatus('signed_in');
        setErrorMessage(null);
        fireAndForgetAuditLog({
          eventType: 'auth_google_sign_in_success',
          status: 'success',
          message: 'Google sign-in successful.',
          user: nextUser,
        });
      } catch (error) {
        fireAndForgetAuditLog({
          eventType: 'auth_google_sign_in_error',
          status: 'error',
          message: error instanceof Error ? error.message : 'Google sign-in failed.',
        });
        setStatus('signed_out');
        setUser(null);
        setErrorMessage(error instanceof Error ? error.message : 'Google sign-in failed.');
      }
    })();
  }, [response]);

  const signIn = async () => {
    if (!canSignIn) {
      setErrorMessage(
        Platform.OS === 'web'
          ? 'Google sign-in on web requires EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your .env file.'
          : 'Google sign-in on mobile requires EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and/or EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID. Use a development build (not Expo Go) for Google OAuth.'
      );
      return;
    }
    if (!request) {
      setErrorMessage('Google sign-in is not ready yet. Please try again.');
      return;
    }

    setStatus('signing_in');
    setErrorMessage(null);

    const result = await promptAsync();
    if (result.type !== 'success') {
      setStatus('signed_out');
    }
  };

  const signInAsGuest = (name: string, password: string) => {
    const nameKey = normalizeName(name || '');
    const matchedName = GUEST_COUNTER_NAMES.find(allowed => normalizeName(allowed) === nameKey);
    if (!matchedName) {
      fireAndForgetAuditLog({
        eventType: 'auth_guest_sign_in_error',
        status: 'error',
        message: 'Invalid guest name provided.',
        details: { attemptedName: name || '' },
      });
      setErrorMessage('Guest access is only available for Jacob or Kevin.');
      return;
    }

    if (String(password || '') !== GUEST_PASSWORD) {
      fireAndForgetAuditLog({
        eventType: 'auth_guest_sign_in_error',
        status: 'error',
        message: 'Incorrect guest password.',
        details: { guestName: matchedName },
      });
      setErrorMessage('Guest password is incorrect.');
      return;
    }

    const guestUser = {
      email: `guest:${matchedName.toLowerCase()}`,
      displayName: `${matchedName} (Guest)`,
      matchNames: [matchedName],
      canViewInfo: false,
    };
    setUser(guestUser);
    setStatus('signed_in');
    setErrorMessage(null);
    fireAndForgetAuditLog({
      eventType: 'auth_guest_sign_in_success',
      status: 'success',
      message: 'Guest sign-in successful.',
      user: guestUser,
    });
  };

  const signOut = () => {
    const userBeforeSignOut = user;
    fireAndForgetAuditLog({
      eventType: 'auth_sign_out',
      status: 'info',
      message: 'User signed out.',
      user: userBeforeSignOut,
    });
    setUser(null);
    setErrorMessage(null);
    setStatus('signed_out');
  };

  const value: AuthContextValue = {
    status,
    user,
    errorMessage,
    canSignIn,
    signIn,
    signInAsGuest,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
