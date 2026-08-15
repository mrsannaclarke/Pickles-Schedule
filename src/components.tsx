import { memo, useRef, useState } from 'react';
import { CalendarDays, ClipboardCheck, CloudUpload, Info, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatEventDate, TEAM_META, toThumbnailUrl, type ScheduleEvent } from '../lib/schedule';
import { uploadArt } from './api';
import { useAuth } from './auth';
import { useSchedule } from './schedule-context';
import { ColoredStaffNames } from './staff-colors';

const TEAM_ICON_GLYPHS = {
  pickles: '\uea51',
  bangers: '\udb86\udc4b',
  cherry_bombs: '\udb81\ude91',
} as const;

function TeamIcon({ team }: { team: ScheduleEvent['team'] }) {
  const isMaterialIcon = team === 'pickles';
  return <span className={`team-icon ${isMaterialIcon ? 'material-icons' : 'material-community-icons'}`} aria-hidden="true">{TEAM_ICON_GLYPHS[team]}</span>;
}

export function Status({ loading, error, empty }: { loading?: boolean; error?: string | null; empty?: string }) {
  if (loading) return <div className="status-card"><span className="spinner" /> Loading schedule…</div>;
  if (error) return <div className="status-card error">{error}</div>;
  if (empty) return <div className="status-card">{empty}</div>;
  return null;
}

export const EventCard = memo(function EventCard({ event }: { event: ScheduleEvent }) {
  const { user } = useAuth();
  const { refresh } = useSchedule();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const meta = TEAM_META[event.team];
  const photos = event.artUrls.length ? event.artUrls : event.artUrl ? [event.artUrl] : [];
  const detailsPath = `/game/${encodeURIComponent(event.id)}`;

  const openDetails = (target: EventTarget | null) => {
    if (target instanceof Element && target.closest('a, button, input, select, textarea')) return;
    navigate(detailsPath);
  };

  const onFile = async (file?: File) => {
    if (!file || !user) return;
    setBusy(true);
    try { await uploadArt(event, user, file); await refresh(); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Upload failed.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  return <article className="event-card" role="link" tabIndex={0} aria-label={`Open details for ${event.theme || meta.title}`} onClick={(clickEvent) => openDetails(clickEvent.target)} onKeyDown={(keyEvent) => {
    if (keyEvent.target === keyEvent.currentTarget && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
      keyEvent.preventDefault();
      navigate(detailsPath);
    }
  }} style={{ '--team': meta.themeColor, '--card': meta.cardBackground } as React.CSSProperties}>
    <div className="event-card-body">
      <div className="event-card-heading">
        <div className="event-date"><CalendarDays size={22} /><strong>{formatEventDate(event)}</strong></div>
        <div className="event-identity"><div className="eyebrow team-label"><TeamIcon team={event.team} />{meta.title}</div><Link className="card-title" to={detailsPath}>{event.theme || 'Untitled Theme'}</Link></div>
      </div>
      <ColoredStaffNames prefix="Staffing" names={event.staffNames.length ? event.staffNames : event.tattooers} />
      {event.opponent ? <div className="event-meta">VS — {event.opponent}</div> : null}
    </div>
    {photos.length ? <div className="flash-art"><span>Flash art</span><div className="photo-grid">{photos.map((url, index) =>
      <a href={event.artOpenUrls[index] || url} target="_blank" rel="noreferrer" key={`${url}-${index}`}>
        <img src={toThumbnailUrl(url, 480)} alt={`Flash art ${index + 1}`} loading="lazy" decoding="async" />
      </a>)}</div></div> : null}
    <div className="card-actions">
      <button className="icon-button upload-action" disabled={busy || !user} onClick={() => inputRef.current?.click()} aria-label="Upload art"><CloudUpload />{busy ? 'Uploading…' : 'Upload Art'}</button>
      <input ref={inputRef} hidden type="file" accept="image/*" onChange={(e) => void onFile(e.target.files?.[0])} />
      {event.responsesUrl ? <a className="icon-button responses-action" href={event.responsesUrl} target="_blank" rel="noreferrer"><UsersRound />Responses</a> : null}
      {event.signUpUrl ? <a className="icon-button form-action" href={event.signUpUrl} target="_blank" rel="noreferrer"><ClipboardCheck />Sign Up Form</a> : null}
      <Link className="icon-button details-action" to={detailsPath}><Info />Details</Link>
    </div>
  </article>;
});
