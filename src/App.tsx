import { lazy, Suspense, useMemo, useState } from 'react';
import { Calendar, House, Info, LogOut, MinusCircle, PlusCircle, RefreshCw, Sparkles, Star, UserPlus } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { EventCard, Status } from './components';
import { useAuth } from './auth';
import { useSchedule } from './schedule-context';
import { eventBlockedSlotCount, eventClaimableOpenSlots, eventStaffing, filterEventsByAnyTattooer, hasMinimumPublishedStaff, nextUpEvent, uniqueStaffNames, type ScheduleEvent } from '../lib/schedule';
import { claimSpot, optOutGame } from './api';
import { canManageGameOptOut, claimRule } from './permissions';
import { normalizeStaffName } from './staff-colors';

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
  const { user } = useAuth();
  const { data, loading, error, refresh } = useSchedule();
  const [busyId, setBusyId] = useState<string | null>(null);
  const options = useMemo(() => uniqueStaffNames(data.all), [data.all]);
  const [adminClaimName, setAdminClaimName] = useState('Tomma');
  const claimName = user?.canViewInfo ? adminClaimName : user?.matchNames[0] || user?.displayName || '';
  const open = useMemo(() => data.all.filter((event) => Boolean(event.theme?.trim()) && eventBlockedSlotCount(event) < 2 && eventClaimableOpenSlots(event) > 0), [data.all]);

  const run = async (event: ScheduleEvent, action: 'claim' | 'optout') => {
    if (!user) return;
    setBusyId(event.id);
    try {
      if (action === 'claim') {
        const rule = claimRule(event.staffSlots, claimName);
        if (!rule.ok) throw new Error(rule.message);
        await claimSpot(event, user, claimName, rule.requestedSlot);
      } else {
        if (!window.confirm(`Opt out “${event.theme || 'this game'}” for everyone?`)) return;
        await optOutGame(event, user);
      }
      await refresh();
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Update failed.'); }
    finally { setBusyId(null); }
  };

  return <Page title="Sign Up" subtitle="Games that still have an open staffing spot.">
    {user?.canViewInfo ? <label className="admin-picker"><span>Sign up as</span><select value={adminClaimName} onChange={(event) => setAdminClaimName(event.target.value)}>{options.map((name) => <option key={name}>{name}</option>)}</select></label> : null}
    <Status loading={loading} error={error} empty={!loading && !error && !open.length ? 'No open games found.' : undefined} />
    <div className="card-list">{open.map((event) => {
      const staff = eventStaffing(event);
      const alreadyClaimed = staff.some((name) => [user?.displayName, ...(user?.matchNames || [])].some((mine) => normalizeStaffName(mine || '') === normalizeStaffName(name)));
      const openSlots = eventClaimableOpenSlots(event);
      const rule = claimRule(event.staffSlots, claimName);
      return <section className="signup-card" key={event.id}>
        {event.tattooers.length === 1 ? <div className="solo-star" title="Solo artist staffed"><Sparkles size={26} /> Solo artist</div> : null}
        <EventCard event={event} />
        <div className="signup-summary"><strong>{openSlots} open {openSlots === 1 ? 'spot' : 'spots'}</strong>{!rule.ok ? <span>{rule.message}</span> : null}</div>
        <div className="signup-actions"><button className="primary" disabled={busyId === event.id || alreadyClaimed || !rule.ok} onClick={() => void run(event, 'claim')}><PlusCircle size={18} />{busyId === event.id ? 'Signing Up…' : alreadyClaimed ? 'Already Signed Up' : !rule.ok ? 'Unavailable' : 'Sign Up'}</button>
        {canManageGameOptOut(user) ? <button className="danger" disabled={busyId === event.id} onClick={() => void run(event, 'optout')}><MinusCircle size={18} /> Opt Out Game</button> : null}</div>
      </section>;
    })}</div>
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
  if (!user?.canViewInfo) return <Navigate to="/" replace />;
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
  const { user, signOut } = useAuth();
  return <div className="app-shell"><header className="user-bar"><span><strong>{user?.displayName}</strong><small>{user?.email}</small></span><button onClick={signOut}><LogOut size={16} /> Switch User</button></header><Routes>
    <Route path="/" element={<HomePage />} /><Route path="/schedule" element={<SchedulePage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/my-games" element={<MyGamesPage />} /><Route path="/info" element={<InfoPage />} />
    <Route path="/game/:eventId" element={<Suspense fallback={<Status loading />}><GamePage /></Suspense>} />
    <Route path="/audit" element={<Suspense fallback={<Status loading />}><AuditPage /></Suspense>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><nav className="bottom-nav">
    <NavLink to="/"><House /><span>Next Up</span></NavLink><NavLink to="/schedule"><Calendar /><span>Schedule</span></NavLink><NavLink to="/my-games"><Star /><span>My Games</span></NavLink><NavLink to="/signup"><UserPlus /><span>Sign Up</span></NavLink>{user?.canViewInfo ? <NavLink to="/info"><Info /><span>Info</span></NavLink> : null}
  </nav></div>;
}

export function App() { const { user } = useAuth(); return user ? <Shell /> : <SignIn />; }
