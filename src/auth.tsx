import { useGoogleLogin } from '@react-oauth/google';
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

export type AuthUser = { email: string; displayName: string; matchNames: string[]; canViewInfo: boolean };
type AllowedUser = AuthUser;

const ALLOWED_USERS: AllowedUser[] = [
  { email: 'tattoosbytomma@gmail.com', displayName: 'Tomma', matchNames: ['Tomma'], canViewInfo: false },
  { email: 'ladyshytattoos@gmail.com', displayName: 'Shy', matchNames: ['Shy', 'Lady Shy'], canViewInfo: false },
  { email: 'events.anatomytattoo@gmail.com', displayName: 'Shy', matchNames: ['Shy', 'Lady Shy'], canViewInfo: false },
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
  { email: 'anatomytattoo@gmail.com', displayName: 'Anatomy Tattoo', matchNames: ['Anatomy Tattoo'], canViewInfo: true },
  { email: 'mrs.annaclarke@gmail.com', displayName: 'Anna', matchNames: ['Anna'], canViewInfo: true },
  { email: 'admin@anatomytattoo.com', displayName: 'Anna', matchNames: ['Anna'], canViewInfo: true },
];

const STORAGE_KEY = 'pickles_schedule_auth_user_v2';
const GUEST_PASSWORD = 'Tomma3021!';

function allowedUser(email: string) {
  const key = email.trim().toLowerCase();
  return ALLOWED_USERS.find((item) => item.email.toLowerCase() === key) ?? null;
}

function restore(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed.email.startsWith('guest:')) return parsed;
    return allowedUser(parsed.email);
  } catch { return null; }
}

type AuthValue = {
  user: AuthUser | null;
  googleAccessToken: string;
  signingIn: boolean;
  error: string | null;
  signIn: () => void;
  signInGuest: (name: string, password: string) => boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);
const GOOGLE_TOKEN_KEY = 'pickles_google_access_token';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => restore());
  const [googleAccessToken, setGoogleAccessToken] = useState(() => sessionStorage.getItem(GOOGLE_TOKEN_KEY) || '');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((next: AuthUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const googleLogin = useGoogleLogin({
    scope: 'openid profile email',
    onSuccess: async ({ access_token }) => {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (!response.ok) throw new Error('Google profile could not be loaded.');
        const profile = await response.json() as { email?: string };
        const next = profile.email ? allowedUser(profile.email) : null;
        if (!next) throw new Error(`This Google account is not approved for the Pickles app.`);
        sessionStorage.setItem(GOOGLE_TOKEN_KEY, access_token);
        setGoogleAccessToken(access_token);
        persist(next);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Google sign-in failed.');
      } finally { setSigningIn(false); }
    },
    onError: () => { setSigningIn(false); setError('Google sign-in failed.'); },
  });

  const value = useMemo<AuthValue>(() => ({
    user, googleAccessToken, signingIn, error,
    signIn: () => { setSigningIn(true); setError(null); googleLogin(); },
    signInGuest: (name, password) => {
      const normalized = name.trim().toLowerCase();
      const displayName = normalized === 'jacob' ? 'Jacob' : normalized === 'kevin' ? 'Kevin' : null;
      if (!displayName || password !== GUEST_PASSWORD) { setError('Guest name or password is incorrect.'); return false; }
      persist({ email: `guest:${normalized}`, displayName, matchNames: [displayName], canViewInfo: false });
      return true;
    },
    signOut: () => { sessionStorage.removeItem(GOOGLE_TOKEN_KEY); setGoogleAccessToken(''); persist(null); setError(null); },
  }), [error, googleAccessToken, googleLogin, persist, signingIn, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
