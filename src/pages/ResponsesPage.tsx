import { Check, Clipboard, ExternalLink, MessageCircle, Phone, RefreshCw, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fetchGameResponses, type GameResponse } from '../api';
import { useAuth } from '../auth';
import { useSchedule } from '../schedule-context';
import { formatEventDate, TEAM_META } from '../../lib/schedule';

const POLL_INTERVAL_MS = 20_000;

function phoneHref(phone: string) {
  return phone.trim().replace(/(?!^\+)[^\d]/g, '');
}

export default function ResponsesPage() {
  const { eventId } = useParams();
  const { user, googleAccessToken, signIn, signingIn } = useAuth();
  const { data } = useSchedule();
  const event = data.all.find((item) => item.id === eventId);
  const [responses, setResponses] = useState<GameResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);
  const requestRunning = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!event || !user || !googleAccessToken || requestRunning.current) return;
    requestRunning.current = true;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const result = await fetchGameResponses(event, user, googleAccessToken);
      const incomingIds = new Set(result.responses.map((response) => response.id));
      if (knownIds.current) {
        const added = new Set(result.responses.filter((response) => !knownIds.current?.has(response.id)).map((response) => response.id));
        if (added.size) setNewIds(added);
      }
      knownIds.current = incomingIds;
      setResponses(result.responses);
      setFetchedAt(result.fetchedAt);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Responses could not be loaded.');
    } finally {
      requestRunning.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [event, googleAccessToken, user]);

  useEffect(() => {
    queueMicrotask(() => void load(false));
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    if (!newIds.size) return;
    const timer = window.setTimeout(() => setNewIds(new Set()), 8_000);
    return () => window.clearTimeout(timer);
  }, [newIds]);

  if (!user || user.email.startsWith('guest:')) return <Navigate to="/" replace />;
  if (!event) return <main className="page"><Link className="back-link" to="/schedule">← Back to Schedule</Link><div className="status-card">Game not found.</div></main>;
  const meta = TEAM_META[event.team];

  const copyPhone = async (response: GameResponse) => {
    try {
      await navigator.clipboard.writeText(response.phone);
      setCopiedId(response.id);
      window.setTimeout(() => setCopiedId(''), 1800);
    } catch { setError('That phone number could not be copied.'); }
  };

  return <main className="page responses-page" style={{ '--team': meta.themeColor, '--card': meta.cardBackground } as React.CSSProperties}>
    <Link className="back-link" to={`/game/${encodeURIComponent(event.id)}`}><span>← Game Details</span><span className="back-link-spark" aria-hidden="true">✦</span></Link>
    <header className="responses-heading">
      <div><p className="eyebrow">{meta.title}</p><h1>{event.theme || 'Game Responses'}</h1><p>{formatEventDate(event)}</p></div>
      <div className="live-status"><span aria-hidden="true" /> Live</div>
    </header>
    <div className="responses-toolbar">
      <div><strong>{responses.length}</strong><span>{responses.length === 1 ? 'response' : 'responses'}</span>{fetchedAt ? <small>Updated {new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small> : null}</div>
      <button onClick={() => void load(true)} disabled={refreshing || !googleAccessToken}><RefreshCw className={refreshing ? 'spin' : ''} /> Refresh</button>
    </div>
    {!googleAccessToken ? <section className="response-auth-card"><UsersRound /><h2>Confirm your approved account</h2><p>Customer contact details require a fresh Google session from an account on the app allowlist.</p><button className="primary" onClick={signIn} disabled={signingIn}>{signingIn ? 'Opening Google…' : 'Continue with Google'}</button></section> : null}
    {error ? <div className="status-card error">{error}</div> : null}
    {loading && googleAccessToken ? <div className="status-card"><span className="spinner" /> Loading responses…</div> : null}
    {!loading && !error && !responses.length ? <div className="status-card">No responses yet. This page will check again automatically.</div> : null}
    <div className="response-list">
      {responses.map((response) => <article className={`response-card${newIds.has(response.id) ? ' response-new' : ''}`} key={response.id}>
        {newIds.has(response.id) ? <span className="new-response-label">New</span> : null}
        <header><div className="response-avatar" aria-hidden="true">{(response.name || '?').trim().charAt(0).toUpperCase()}</div><div><h2>{response.name || `Signup #${response.rowNumber}`}</h2>{response.submittedAt ? <time>{response.submittedAt}</time> : null}</div></header>
        {response.phone ? <section className="response-phone"><a href={`tel:${phoneHref(response.phone)}`}><Phone /> Call</a><a href={`sms:${phoneHref(response.phone)}`}><MessageCircle /> Text</a><button onClick={() => void copyPhone(response)}><span className="selectable-phone">{response.phone}</span>{copiedId === response.id ? <Check /> : <Clipboard />}</button></section> : null}
        {response.email ? <a className="response-email" href={`mailto:${response.email}`}>{response.email}</a> : null}
        {response.details.length ? <dl>{response.details.map((detail, index) => <div key={`${detail.label}-${index}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
      </article>)}
    </div>
    {event.responsesUrl ? <a className="button-link raw-responses-link" href={event.responsesUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open original response sheet</a> : null}
  </main>;
}
