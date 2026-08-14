import { memo, useRef, useState } from 'react';
import { CalendarDays, ClipboardList, ExternalLink, ImageUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatEventDate, TEAM_META, toThumbnailUrl, type ScheduleEvent } from '../lib/schedule';
import { uploadArt } from './api';
import { useAuth } from './auth';
import { useSchedule } from './schedule-context';

export function Status({ loading, error, empty }: { loading?: boolean; error?: string | null; empty?: string }) {
  if (loading) return <div className="status-card"><span className="spinner" /> Loading schedule…</div>;
  if (error) return <div className="status-card error">{error}</div>;
  if (empty) return <div className="status-card">{empty}</div>;
  return null;
}

export const EventCard = memo(function EventCard({ event }: { event: ScheduleEvent }) {
  const { user } = useAuth();
  const { refresh } = useSchedule();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const meta = TEAM_META[event.team];
  const photos = event.artUrls.length ? event.artUrls : event.artUrl ? [event.artUrl] : [];

  const onFile = async (file?: File) => {
    if (!file || !user) return;
    setBusy(true);
    try { await uploadArt(event, user, file); await refresh(); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Upload failed.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  return <article className="event-card" style={{ '--team': meta.themeColor, '--card': meta.cardBackground } as React.CSSProperties}>
    {photos.length ? <div className="photo-grid">{photos.map((url, index) =>
      <a href={event.artOpenUrls[index] || url} target="_blank" rel="noreferrer" key={`${url}-${index}`}>
        <img src={toThumbnailUrl(url, 480)} alt={`Flash art ${index + 1}`} loading="lazy" decoding="async" />
      </a>)}</div> : null}
    <div className="eyebrow">{meta.title}</div>
    <Link className="card-title" to={`/game/${encodeURIComponent(event.id)}`}>{event.theme || 'Untitled Theme'}</Link>
    <div className="event-meta"><CalendarDays size={16} /> {formatEventDate(event)}</div>
    <div className="event-meta"><Users size={16} /> {(event.staffNames.length ? event.staffNames : event.tattooers).join(', ') || 'Open staffing'}</div>
    {event.opponent ? <div className="event-meta">VS — {event.opponent}</div> : null}
    <div className="card-actions">
      <button className="icon-button" disabled={busy || !user} onClick={() => inputRef.current?.click()} aria-label="Upload art"><ImageUp size={19} />{busy ? ' Uploading…' : ' Upload art'}</button>
      <input ref={inputRef} hidden type="file" accept="image/*" onChange={(e) => void onFile(e.target.files?.[0])} />
      {event.responsesUrl ? <a className="icon-button" href={event.responsesUrl} target="_blank" rel="noreferrer"><ClipboardList size={19} /> Responses</a> : null}
      {event.signUpUrl ? <a className="icon-button" href={event.signUpUrl} target="_blank" rel="noreferrer"><ExternalLink size={19} /> Form</a> : null}
    </div>
  </article>;
});
