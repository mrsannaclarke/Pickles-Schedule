import { ArrowLeft, CalendarPlus, ClipboardCheck, ImageUp, Trash2, UsersRound } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cancelMySpot, claimSpot, deleteArt, optOutGame, setStaffSlot, uploadArt } from '../api';
import { useAuth } from '../auth';
import { useSchedule } from '../schedule-context';
import { canManageGameOptOut } from '../permissions';
import { ColoredStaffNames } from '../staff-colors';
import { eventCalendarUrl, eventStaffing, formatEventDate, PARTICIPANT_NAMES, TEAM_META, toThumbnailUrl } from '../../lib/schedule';

export default function GamePage() {
  const { eventId } = useParams(); const { user } = useAuth(); const { data, refresh } = useSchedule();
  const event = data.all.find((item) => item.id === eventId); const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(''); const [claimName, setClaimName] = useState(user?.matchNames[0] || user?.displayName || '');
  const names = useMemo(() => Array.from(new Set([...PARTICIPANT_NAMES, ...data.all.flatMap(eventStaffing)])).sort(), [data.all]);
  if (!event || !user) return <main className="page"><Link to="/schedule">← Schedule</Link><div className="status-card">Game not found.</div></main>;
  const meta = TEAM_META[event.team];
  const run = async (key: string, action: () => Promise<unknown>) => { setBusy(key); try { await action(); await refresh(); } catch (e) { alert(e instanceof Error ? e.message : 'Update failed.'); } finally { setBusy(''); } };
  const calendarUrl = eventCalendarUrl(event);
  return <main className="page details-page" style={{ '--team': meta.themeColor } as React.CSSProperties}><Link className="back-link" to="/schedule"><span className="back-link-icon"><ArrowLeft size={20} /></span><span>Back to Schedule</span><span className="back-link-spark" aria-hidden="true">✦</span></Link>
    <header className="details-header"><p className="eyebrow">{meta.title}</p><h1>{event.theme || 'Untitled Theme'}</h1><p>{formatEventDate(event)}</p>{event.opponent ? <p>VS — {event.opponent}</p> : null}</header>
    <section className="panel"><h2>Staffing</h2><ColoredStaffNames prefix="Current" names={eventStaffing(event)} />{[0,1,2].map((index) => <label className="slot" key={index}><span>Slot {index + 1}</span><select value={event.staffSlots[index] || ''} disabled={!!busy || !user.canViewInfo} onChange={(e) => void run(`slot-${index}`, () => setStaffSlot(event, user, index + 1, e.target.value))}><option value="">Open</option><option value="Null">Blocked</option>{names.map((name) => <option key={name}>{name}</option>)}</select></label>)}
      <div className="form-row"><select value={claimName} onChange={(e) => setClaimName(e.target.value)}>{names.map((name) => <option key={name}>{name}</option>)}</select><button className="primary" disabled={!!busy} onClick={() => void run('claim', () => claimSpot(event, user, claimName))}>Claim open spot</button></div>
    </section>
    <section className="panel"><h2>Flash art</h2>{event.artUrls.length ? <div className="photo-grid large">{event.artUrls.map((url, index) => <div className="photo-control" key={url}><a href={event.artOpenUrls[index] || url} target="_blank" rel="noreferrer"><img src={toThumbnailUrl(url, 800)} alt={`Flash art ${index + 1}`} /></a><button className="danger small" disabled={!!busy} onClick={() => void run(`delete-${index}`, () => deleteArt(event, user, index + 1))}><Trash2 size={15} /> Delete</button></div>)}</div> : <p className="muted">No flash has been uploaded yet.</p>}<button onClick={() => inputRef.current?.click()} disabled={!!busy}><ImageUp /> Upload art</button><input hidden ref={inputRef} type="file" accept="image/*" onChange={(e) => { const file=e.target.files?.[0]; if(file) void run('upload', () => uploadArt(event,user,file)); }} /></section>
    <section className="panel"><h2>Useful links</h2><div className="action-grid"><a className="button-link calendar-action" href={calendarUrl} target="_blank" rel="noreferrer"><CalendarPlus /> Add to calendar</a>{event.signUpUrl ? <a className="button-link signup-link" href={event.signUpUrl} target="_blank" rel="noreferrer"><ClipboardCheck /> Sign Up Form</a> : null}{event.responsesUrl ? <a className="button-link responses-link" href={event.responsesUrl} target="_blank" rel="noreferrer"><UsersRound /> Responses</a> : null}</div></section>
    <section className="panel danger-zone"><h2>Dangerous actions</h2><div className="action-grid"><button className="danger" disabled={!!busy} onClick={() => void run('cancel', () => cancelMySpot(event, user))}>Cancel my spot</button>{canManageGameOptOut(user) ? <button className="danger" disabled={!!busy} onClick={() => confirm('Opt this game out for everyone?') && void run('optout', () => optOutGame(event,user))}>Opt out game for everyone</button> : null}</div>
    </section>
  </main>;
}
