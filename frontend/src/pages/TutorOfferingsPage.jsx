import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

export default function TutorOfferingsPage() {
  const { user } = useAuth();
  const isTutor = user?.roles?.includes('tutor') || false;
  const [subjects, setSubjects] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingValues, setEditingValues] = useState({ subject_id: '', description: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(isTutor);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [subjectResult, offeringResult] = await Promise.all([api.subjects(), api.tutorOfferings()]);
    setSubjects(subjectResult.data);
    setOfferings(offeringResult.data);
  }

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    Promise.all([api.subjects(), api.tutorOfferings()])
      .then(([subjectResult, offeringResult]) => {
        if (!active) return;
        setSubjects(subjectResult.data);
        setOfferings(offeringResult.data);
      })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  if (isTutor && loading) return <PageLoader label="Loading your subject offerings…" />;

  if (!isTutor) {
    return <section className="profile-page section-wrap"><Link className="text-link back-link" to="/dashboard">← Back to dashboard</Link><span className="eyebrow">TUTOR TOOLS</span><h1>Manage my <em>teaching subjects.</em></h1><div className="profile-panel"><p className="profile-intro">This area is available to approved Tutors.</p>{user?.roles?.includes('admin') ? <><p>You manage the platform subject catalogue separately.</p><Link className="button" to="/admin/subjects">Manage Subjects <span aria-hidden="true">↗</span></Link></> : <><p>Submit a tutor application and wait for administrator approval to unlock subject offerings.</p><Link className="button" to="/tutor-application">View tutor application <span aria-hidden="true">↗</span></Link></>}</div></section>;
  }

  async function addOffering(event) {
    event.preventDefault();
    setBusy(true); setError(null); setSuccess('');
    try {
      await api.createTutorOffering({ subject_id: Number(subjectId), description });
      setSubjectId(''); setDescription('');
      await load();
      setSuccess('Subject offering added.');
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }

  function beginEdit(offering) {
    setEditingId(offering.id);
    setEditingValues({ subject_id: String(offering.subject.id), description: offering.description || '' });
    setError(null); setSuccess('');
  }

  async function saveEdit(event) {
    event.preventDefault();
    setBusy(true); setError(null); setSuccess('');
    try {
      await api.updateTutorOffering(editingId, { subject_id: Number(editingValues.subject_id), description: editingValues.description });
      setEditingId(null);
      await load();
      setSuccess('Subject offering updated.');
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }

  async function remove(offering) {
    if (!window.confirm(`Remove your ${offering.subject.name} offering?`)) return;
    setBusy(true); setError(null); setSuccess('');
    try {
      await api.deleteTutorOffering(offering.id);
      setOfferings((current) => current.filter((item) => item.id !== offering.id));
      setSuccess('Subject offering removed.');
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }

  const availableSubjects = subjects.filter((subject) => !offerings.some((offering) => offering.subject.id === subject.id));

  return <section className="profile-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">TEACH WHAT YOU KNOW</span><h1>My teaching <em>subjects.</em></h1>
    <p className="profile-intro">Choose active subjects from the platform catalogue and add a short teaching focus.</p>
    {success && <p className="success-box" role="status">{success}</p>}<FormErrors error={error} />
    <div className="profile-panel subject-offering-form"><h2>Add a subject</h2>
      {availableSubjects.length === 0 ? <p className="notice-box" role="status">{subjects.length === 0 ? 'There are no active subjects yet. Please check back later.' : 'You already offer every active subject in the catalogue.'}</p> : <form onSubmit={addOffering}>
        <label className="field-label" htmlFor="offering-subject">Active subject</label><select id="offering-subject" required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Choose a subject</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <label className="field-label" htmlFor="offering-description">Teaching focus <span className="label-hint">Optional, up to 1,200 characters</span></label><textarea id="offering-description" maxLength="1200" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} />
        <button className="button form-submit" type="submit" disabled={busy || !subjectId}>{busy ? 'Saving…' : 'Add offering'}</button>
      </form>}
    </div>
    <section className="subject-offerings-list" aria-labelledby="offerings-heading"><div className="subject-list-heading"><div><span className="eyebrow">YOUR CURRENT SUBJECTS</span><h2 id="offerings-heading">Offerings</h2></div><span className="subject-count">{offerings.length} {offerings.length === 1 ? 'subject' : 'subjects'}</span></div>
      {offerings.length === 0 ? <p className="empty-state">You have not added any subject offerings yet.</p> : <div className="subject-list">{offerings.map((offering) => <article className="subject-admin-card offering-card" key={offering.id}>
        {editingId === offering.id ? <form className="offering-edit-form" onSubmit={saveEdit}>
          <label className="field-label" htmlFor={`edit-subject-${offering.id}`}>Subject</label><select id={`edit-subject-${offering.id}`} required value={editingValues.subject_id} onChange={(event) => setEditingValues({ ...editingValues, subject_id: event.target.value })}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
          <label className="field-label" htmlFor={`edit-description-${offering.id}`}>Teaching focus</label><textarea id={`edit-description-${offering.id}`} maxLength="1200" rows="3" value={editingValues.description} onChange={(event) => setEditingValues({ ...editingValues, description: event.target.value })} />
          <div className="subject-form-actions"><button className="button" type="submit" disabled={busy}>Save changes</button><button className="button button-outline" type="button" disabled={busy} onClick={() => setEditingId(null)}>Cancel</button></div>
        </form> : <><div className="subject-admin-content"><div className="subject-admin-title"><h3>{offering.subject.name}</h3><span className="role-pill">Active catalogue subject</span></div><p>{offering.description || 'Teaching focus not provided.'}</p></div><div className="subject-admin-actions"><button className="text-button" type="button" disabled={busy} onClick={() => beginEdit(offering)}>Edit</button><button className="button button-danger" type="button" disabled={busy} onClick={() => remove(offering)}>Remove</button></div></>}
      </article>)}</div>}
    </section>
  </section>;
}
