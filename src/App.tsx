import { lazy, Suspense, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Info, LogOut, Menu, MinusCircle, PenTool, PlusCircle, RefreshCw, Sparkles, Star, X } from 'lucide-react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { EventCard, Status } from './components';
import { useAuth } from './auth';
import { useSchedule } from './schedule-context';
import { eventBlockedSlotCount, eventClaimableOpenSlots, eventStaffing, filterEventsByStaff, hasMinimumPublishedStaff, nextUpEvent, uniqueStaffNames, type ScheduleEvent } from '../lib/schedule';
import { claimSpot, optOutGame } from './api';
import { canManageGameOptOut, claimRule } from './permissions';
import { normalizeStaffName, staffNameColor } from './staff-colors';

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
  return <Page title="Next Up">
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
  const artistOptions = useMemo(() => uniqueStaffNames(data.all), [data.all]);
  const defaultArtist = user?.email.toLowerCase() === 'anatomytattoo@gmail.com'
    ? 'Tomma'
    : user?.matchNames[0] || user?.displayName || '';
  const [selectedArtist, setSelectedArtist] = useState(defaultArtist);

  const events = useMemo(() => selectedArtist ? filterEventsByStaff(data.all, selectedArtist) : [], [data.all, selectedArtist]);
  const confirmed = useMemo(() => events.filter((event) => event.tattooers.length !== 1), [events]);
  const needsStaffing = useMemo(() => events.filter((event) => event.tattooers.length === 1), [events]);
  const pickerOptions = useMemo(() => {
    if (!defaultArtist || artistOptions.some((name) => normalizeStaffName(name) === normalizeStaffName(defaultArtist))) return artistOptions;
    return [defaultArtist, ...artistOptions];
  }, [artistOptions, defaultArtist]);

  return <Page title="My Games" subtitle="Review an artist’s assignments and open staffing needs.">
    <section className="artist-toolbar" aria-label="Artist game filter">
      <label htmlFor="artist-picker">View games for</label>
      <div className="artist-select-wrap">
        <span className="artist-dot" style={{ background: staffNameColor(selectedArtist) }} aria-hidden="true" />
        <select id="artist-picker" value={selectedArtist} onChange={(event) => setSelectedArtist(event.target.value)}>
          {pickerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <div className="game-summary" aria-label="Game totals">
        <span><strong>{confirmed.length}</strong> confirmed</span>
        <span><strong>{needsStaffing.length}</strong> need staffing</span>
      </div>
    </section>
    <Status loading={loading} error={error} empty={!loading && !error && !events.length ? `${selectedArtist || 'This artist'} has no games on this sheet.` : undefined} />
    {confirmed.length ? <section className="game-section"><div className="section-heading"><h2>Confirmed games</h2><span>{confirmed.length}</span></div><div className="card-list">{confirmed.map((event) => <EventCard event={event} key={event.id} />)}</div></section> : null}
    {needsStaffing.length ? <section className="game-section needs-staffing"><div className="section-heading"><h2>Needs another artist</h2><span>{needsStaffing.length}</span></div><p className="section-note">These games currently have only one assigned artist.</p><div className="card-list">{needsStaffing.map((event) => <EventCard event={event} key={event.id} />)}</div></section> : null}
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

function Page({ title, subtitle, children }: React.PropsWithChildren<{ title: string; subtitle?: string }>) {
  const { refresh, refreshing } = useSchedule();
  const pageClass = `page page-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return <main className={pageClass}><header className={`page-header${subtitle ? '' : ' page-header-actions-only'}`}>{subtitle ? <p>{subtitle}</p> : null}<button className="refresh" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'spin' : ''} /> Refresh</button></header>{children}</main>;
}

function Shell() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const currentTitle = pathname.startsWith('/my-games') ? 'My Games' : pathname.startsWith('/signup') ? 'Sign Up' : pathname.startsWith('/schedule') ? 'Schedule' : pathname.startsWith('/info') ? 'Info' : pathname.startsWith('/game/') ? 'Game Details' : 'Next Up';
  return <div className="app-shell"><header className="user-bar"><NavLink className="brand-lockup" to="/" aria-label="Pickles Schedule home"><img src="/pickles-app-logo.png" alt="" /><span><strong>{currentTitle}</strong><small>Pickles Schedule</small></span></NavLink><div className="profile-control"><button className="profile-trigger" aria-expanded={profileOpen} aria-controls="profile-menu" onClick={() => setProfileOpen((open) => !open)}><span><strong>{user?.displayName}</strong><small>Account</small></span>{profileOpen ? <X /> : <Menu />}</button>{profileOpen ? <div className="profile-menu" id="profile-menu"><div><strong>{user?.displayName}</strong><small>{user?.email}</small></div>{user?.canViewInfo ? <NavLink to="/info" onClick={() => setProfileOpen(false)}><Info /> App info</NavLink> : null}<button onClick={signOut}><LogOut /> Switch User</button></div> : null}</div></header><Routes>
    <Route path="/" element={<HomePage />} /><Route path="/schedule" element={<SchedulePage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/my-games" element={<MyGamesPage />} /><Route path="/info" element={<InfoPage />} />
    <Route path="/game/:eventId" element={<Suspense fallback={<Status loading />}><GamePage /></Suspense>} />
    <Route path="/audit" element={<Suspense fallback={<Status loading />}><AuditPage /></Suspense>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><nav className="bottom-nav">
    <NavLink to="/"><Clock3 /><span>Next Up</span></NavLink><NavLink to="/schedule"><CalendarDays /><span>Schedule</span></NavLink><NavLink to="/my-games"><Star /><span>My Games</span></NavLink><NavLink to="/signup"><PenTool /><span>Sign Up</span></NavLink>
  </nav></div>;
}

export function App() { const { user } = useAuth(); return user ? <Shell /> : <SignIn />; }
