import { lazy, Suspense, useMemo, useState } from 'react';
import { Calendar, House, Info, LogOut, RefreshCw, Star, UserPlus } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { EventCard, Status } from './components';
import { useAuth } from './auth';
import { useSchedule } from './schedule-context';
import { filterEventsByAnyTattooer, hasMinimumPublishedStaff, nextUpEvent } from '../lib/schedule';

const GamePage = lazy(() => import('./pages/GamePage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));

function SignIn() {
  const auth = useAuth();
  const [name, setName] = useState('Jacob');
  const [password, setPassword] = useState('');
  return <main className="signin-shell">
    <section className="signin-card">
      <img className="app-mark" src="/pickles-app-logo.png" alt="Pickles Schedule anatomical heart logo" />
      <p className="eyebrow">Anatomy Tattoo</p><h1>Pickles Schedule</h1>
      <p className="muted">Staff scheduling, flash uploads, signup forms, and game details.</p>
      <button className="primary wide" disabled={auth.signingIn} onClick={auth.signIn}>{auth.signingIn ? 'Opening Google…' : 'Continue with Google'}</button>
      <details><summary>Guest counter access</summary>
        <div className="guest-fields"><select value={name} onChange={(e) => setName(e.target.value)}><option>Jacob</option><option>Kevin</option></select>
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={() => auth.signInGuest(name, password)}>Sign in as guest</button></div>
      </details>
      {auth.error ? <p className="inline-error">{auth.error}</p> : null}
    </section>
  </main>;
}

function HomePage() {
  const { data, loading, error } = useSchedule();
  const next = useMemo(() => nextUpEvent(data.all), [data.all]);
  return <Page title="Next Up" subtitle="The next staffed game on the test-season sheet.">
    <Status loading={loading} error={error} empty={!loading && !error && !next ? 'No staffed games found.' : undefined} />
    {next ? <EventCard event={next} /> : null}
  </Page>;
}

function SchedulePage() {
  const { data, loading, error } = useSchedule();
  const events = useMemo(() => data.all.filter((event) => hasMinimumPublishedStaff(event)), [data.all]);
  return <Page title="Schedule" subtitle="All games with at least two staffed spots.">
    <Status loading={loading} error={error} empty={!loading && !error && !events.length ? 'No staffed games found.' : undefined} />
    <div className="card-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div>
  </Page>;
}

function SignupPage() {
  const { data, loading, error } = useSchedule();
  const open = useMemo(() => data.all.filter((event) => event.staffSlots.some((slot) => !slot.trim() || slot.toLowerCase() === 'open')), [data.all]);
  return <Page title="Sign Up" subtitle="Games that still have an open staffing spot.">
    <Status loading={loading} error={error} empty={!loading && !error && !open.length ? 'No open games found.' : undefined} />
    <div className="card-list">{open.map((event) => <EventCard event={event} key={event.id} />)}</div>
  </Page>;
}

function MyGamesPage() {
  const { user } = useAuth(); const { data, loading, error } = useSchedule();
  const events = useMemo(() => user ? filterEventsByAnyTattooer(data.all, [...user.matchNames, user.displayName]) : [], [data.all, user]);
  return <Page title="My Games" subtitle={`Games assigned to ${user?.displayName || 'you'}.`}>
    <Status loading={loading} error={error} empty={!loading && !error && !events.length ? 'You have no games on this sheet.' : undefined} />
    <div className="card-list">{events.map((event) => <EventCard event={event} key={event.id} />)}</div>
  </Page>;
}

function InfoPage() {
  const { user, signOut } = useAuth();
  return <Page title="Info" subtitle="Test-season app configuration.">
    <section className="info-card"><p>Signed in as <strong>{user?.email}</strong></p><p className="access-code">CODE 4587</p>
      <p>This React + Vite build uses the completed season’s sheet as writable test data.</p>
      <p>Signup forms and signup entry sheets are generated 10 days in advance. Authorized staff can claim games, update slots, and upload flash.</p>
      <div className="link-row"><a href="https://www.portlandpicklesbaseball.com" target="_blank" rel="noreferrer">Pickles</a><a href="https://www.cherrybombers.com" target="_blank" rel="noreferrer">Cherry Bombs</a><a href="https://www.portlandbangers.com" target="_blank" rel="noreferrer">Bangers</a></div>
      {user?.canViewInfo ? <NavLink className="button-link" to="/audit">Open audit log</NavLink> : null}
      <button className="danger" onClick={signOut}><LogOut size={17} /> Sign out</button>
    </section>
  </Page>;
}

function Page({ title, subtitle, children }: React.PropsWithChildren<{ title: string; subtitle: string }>) {
  const { refresh, refreshing } = useSchedule();
  return <main className="page"><header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div><button className="refresh" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'spin' : ''} /> Refresh</button></header>{children}</main>;
}

function Shell() {
  return <div className="app-shell"><Routes>
    <Route path="/" element={<HomePage />} /><Route path="/schedule" element={<SchedulePage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/my-games" element={<MyGamesPage />} /><Route path="/info" element={<InfoPage />} />
    <Route path="/game/:eventId" element={<Suspense fallback={<Status loading />}><GamePage /></Suspense>} />
    <Route path="/audit" element={<Suspense fallback={<Status loading />}><AuditPage /></Suspense>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><nav className="bottom-nav">
    <NavLink to="/"><House /><span>Next Up</span></NavLink><NavLink to="/schedule"><Calendar /><span>Schedule</span></NavLink><NavLink to="/signup"><UserPlus /><span>Sign Up</span></NavLink><NavLink to="/my-games"><Star /><span>My Games</span></NavLink><NavLink to="/info"><Info /><span>Info</span></NavLink>
  </nav></div>;
}

export function App() { const { user } = useAuth(); return user ? <Shell /> : <SignIn />; }
