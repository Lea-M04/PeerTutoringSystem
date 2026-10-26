import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isApprovedTutor } from '../auth/roles.js';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import { browserTimeZone, formatLocalDateTime, localDateTimeToUtcIso, utcIsoToLocalDateTime } from '../utils/dateTime.js';

const emptyForm = { starts_at: '', ends_at: '' };

export default function TutorAvailabilityPage() {
  const { user } = useAuth();
  const isTutor = isApprovedTutor(user);
  const [items, setItems] = useState([]);
  const [values, setValues] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingOriginal, setEditingOriginal] = useState(null);
  const [loading, setLoading] = useState(isTutor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    const result = await api.tutorAvailability();
    setItems(result.data);
  }, []);

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    api.tutorAvailability()
      .then((result) => { if (active) setItems(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  if (isTutor && loading) return <PageLoader label="Loading your availability…" />;

  if (!isTutor) {
    return <section className="availability-page section-wrap">
      <Link className="text-link back-link" to="/dashboard">← Back to dashboard</Link>
      <span className="eyebrow">TUTOR TOOLS</span><h1>Manage <em>availability.</em></h1>
      <div className="profile-panel"><p>This feature is available to approved Tutors.</p>{user?.roles?.includes('admin') ? <p>Administrators manage platform subjects; tutors manage their own availability.</p> : <Link className="button" to="/tutor-application">View your tutor application</Link>}</div>
    </section>;
  }

  function beginEdit(item) {
    setEditingId(item.id);
    const localValues = {
      starts_at: utcIsoToLocalDateTime(item.starts_at),
      ends_at: utcIsoToLocalDateTime(item.ends_at),
    };
    setEditingOriginal({ starts_at: item.starts_at, ends_at: item.ends_at, localValues });
    setValues(localValues);
    setError(null);
    setSuccess('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingOriginal(null);
    setValues(emptyForm);
    setError(null);
  }

  async function save(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const payload = {
        starts_at: editingOriginal && values.starts_at === editingOriginal.localValues.starts_at
          ? editingOriginal.starts_at
          : localDateTimeToUtcIso(values.starts_at),
        ends_at: editingOriginal && values.ends_at === editingOriginal.localValues.ends_at
          ? editingOriginal.ends_at
          : localDateTimeToUtcIso(values.ends_at),
      };
      if (editingId) {
        const result = await api.updateTutorAvailability(editingId, payload);
        setItems((current) => current.map((item) => item.id === editingId ? result.data : item).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
        setSuccess('Availability updated.');
      } else {
        const result = await api.createTutorAvailability(payload);
        setItems((current) => [...current, result.data].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
        setSuccess('Availability added.');
      }
      setEditingId(null);
      setEditingOriginal(null);
      setValues(emptyForm);
    } catch (caught) {
      setError(caught instanceof RangeError ? { message: caught.message, errors: {} } : caught);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Remove availability from ${formatLocalDateTime(item.starts_at)}?`)) return;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      await api.deleteTutorAvailability(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) cancelEdit();
      setSuccess('Availability removed.');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return <section className="availability-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">PLAN YOUR OPEN HOURS</span><h1>Manage <em>availability.</em></h1>
    <p className="profile-intro">Add future time intervals when students may request a session. Times are shown in {browserTimeZone()}. If daylight-saving time repeats a local time, the earlier occurrence is used.</p>
    {success && <p className="success-box" role="status">{success}</p>}
    <FormErrors error={error} />
    <section className="profile-panel availability-form-panel" aria-labelledby="availability-form-title">
      <h2 id="availability-form-title">{editingId ? 'Edit availability' : 'Add an interval'}</h2>
      <form onSubmit={save}>
        <div className="availability-form-grid">
          <div><label className="field-label" htmlFor="availability-start">Start date and time</label><input id="availability-start" type="datetime-local" required value={values.starts_at} onChange={(event) => setValues((current) => ({ ...current, starts_at: event.target.value }))} /></div>
          <div><label className="field-label" htmlFor="availability-end">End date and time</label><input id="availability-end" type="datetime-local" required value={values.ends_at} onChange={(event) => setValues((current) => ({ ...current, ends_at: event.target.value }))} /></div>
        </div>
        <p className="availability-help">Choose a future start time and a later end time. Availability intervals for the same tutor cannot overlap.</p>
        <div className="subject-form-actions"><button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add availability'}</button>{editingId && <button className="button button-outline" type="button" disabled={busy} onClick={cancelEdit}>Cancel</button>}</div>
      </form>
    </section>
    <section className="availability-list-section" aria-labelledby="availability-list-title">
      <div className="availability-list-heading"><div><span className="eyebrow">YOUR OPEN TIME</span><h2 id="availability-list-title">Availability intervals</h2></div><span className="subject-count">{items.length} {items.length === 1 ? 'interval' : 'intervals'}</span></div>
      {error && items.length === 0 ? <div className="availability-empty"><p>Availability could not be loaded. Please try again.</p><button className="button button-outline" type="button" onClick={() => { setLoading(true); load().then(() => setError(null)).catch(setError).finally(() => setLoading(false)); }}>Try again</button></div>
        : items.length === 0 ? <p className="empty-state">No availability intervals yet. Add a future time above to let students see when you are open.</p>
          : <div className="availability-list">{items.map((item) => <article className="availability-card" key={item.id}>
            {editingId === item.id ? <div className="availability-edit-note">Editing this interval above.</div> : <div className="availability-card-time"><span className="card-label">START</span><strong>{formatLocalDateTime(item.starts_at)}</strong><span className="card-label">END</span><strong>{formatLocalDateTime(item.ends_at)}</strong></div>}
            <div className="availability-card-actions">{editingId !== item.id && <button className="text-button" type="button" disabled={busy} onClick={() => beginEdit(item)}>Edit</button>}<button className="button button-danger" type="button" disabled={busy} onClick={() => remove(item)}>Delete</button></div>
          </article>)}</div>}
    </section>
  </section>;
}
