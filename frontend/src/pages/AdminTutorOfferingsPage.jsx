import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

const emptyForm = { tutor_profile_id: '', subject_id: '', description: '' };

export default function AdminTutorOfferingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [tutors, setTutors] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [tutorFilter, setTutorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function loadData() {
    const [tutorResult, subjectResult, offeringResult] = await Promise.all([
      api.adminTutors(), api.adminSubjects(), api.adminTutorOfferings(),
    ]);
    setTutors(tutorResult.data);
    setSubjects(subjectResult.data);
    setOfferings(offeringResult.data);
  }

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    loadData()
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  const visibleOfferings = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return offerings.filter((offering) => {
      const matchesTerm = !term || [offering.tutor?.name, offering.subject?.name, offering.description]
        .filter(Boolean).some((value) => value.toLocaleLowerCase().includes(term));
      const matchesTutor = tutorFilter === 'all' || String(offering.tutor?.id) === tutorFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? offering.is_active : !offering.is_active);
      return matchesTerm && matchesTutor && matchesStatus;
    });
  }, [offerings, search, tutorFilter, statusFilter]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (loading) return <PageLoader label="Loading tutor offerings…" />;

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setActionError(null);
  }

  function beginEdit(offering) {
    setEditing(offering);
    setForm({ tutor_profile_id: String(offering.tutor.id), subject_id: String(offering.subject.id), description: offering.description || '' });
    setActionError(null);
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    setSuccess('');
    try {
      const result = editing
        ? await api.updateAdminTutorOffering(editing.id, {
          ...(String(editing.subject.id) === form.subject_id ? {} : { subject_id: Number(form.subject_id) }),
          description: form.description || null,
        })
        : await api.createAdminTutorOffering({
          tutor_profile_id: Number(form.tutor_profile_id),
          subject_id: Number(form.subject_id),
          description: form.description || null,
        });
      setOfferings((current) => editing
        ? current.map((item) => item.id === result.data.id ? result.data : item)
        : [...current, result.data]);
      setSuccess(editing ? 'Tutor offering updated.' : 'Tutor offering created.');
      resetForm();
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function remove(offering) {
    if (!window.confirm(`Remove ${offering.subject.name} from ${offering.tutor.name}? Existing booking history will be preserved.`)) return;
    setActionError(null);
    setSuccess('');
    try {
      await api.deleteAdminTutorOffering(offering.id);
      setOfferings((current) => current.filter((item) => item.id !== offering.id));
      setSuccess('Tutor offering removed.');
    } catch (caught) {
      setActionError(caught);
    }
  }

  const availableSubjects = subjects.filter((subject) => subject.is_active || (editing && subject.id === editing.subject.id));

  return <section className="admin-users-page section-wrap">
    <Link className="text-link back-link" to="/">← Back to Home</Link>
    <span className="eyebrow">ADMINISTRATION</span><h1>Tutor offering <em>management.</em></h1>
    <p className="profile-intro">Manage the relationship between an approved Tutor and an existing catalogue subject. Tutor availability remains general and independent of subject.</p>
    {error && <div className="booking-empty"><FormErrors error={error} /><button className="button button-outline" type="button" onClick={() => { setLoading(true); setError(null); loadData().catch(setError).finally(() => setLoading(false)); }}>Retry</button></div>}
    {success && <p className="success-box" role="status">{success}</p>}
    <FormErrors error={actionError} />
    <form className="profile-panel admin-offering-form" onSubmit={submit}>
      <h2>{editing ? 'Edit offering' : 'Add an offering'}</h2>
      <div className="form-grid">
        <label>{editing ? `Tutor: ${editing.tutor.name}` : 'Approved tutor'}
          <select required disabled={Boolean(editing)} value={form.tutor_profile_id} onChange={(event) => setForm({ ...form, tutor_profile_id: event.target.value })}>
            <option value="">Choose a tutor</option>{tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.name}</option>)}
          </select>
        </label>
        <label>Catalogue subject
          <select required value={form.subject_id} onChange={(event) => setForm({ ...form, subject_id: event.target.value })}>
            <option value="">Choose an active subject</option>{availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.is_active ? '' : ' (inactive)'}</option>)}
          </select>
        </label>
        <label className="form-full-width">Teaching focus (optional)
          <textarea maxLength="1200" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
      </div>
      <div className="subject-form-actions"><button className="button" type="submit" disabled={busy || subjects.every((subject) => !subject.is_active) || (!editing && tutors.length === 0)}>{busy ? 'Saving…' : editing ? 'Save offering' : 'Add offering'}</button>{editing && <button className="button button-outline" type="button" disabled={busy} onClick={resetForm}>Cancel</button>}</div>
      {tutors.length === 0 && <p className="field-help">There are no active approved tutors available for assignment.</p>}
      {subjects.every((subject) => !subject.is_active) && <p className="field-help">Activate a catalogue subject before adding an offering.</p>}
    </form>
    <div className="admin-offering-filters">
      <label htmlFor="offering-search">Search tutor, subject, or teaching focus<input id="offering-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label htmlFor="offering-tutor-filter">Tutor<select id="offering-tutor-filter" value={tutorFilter} onChange={(event) => setTutorFilter(event.target.value)}><option value="all">All tutors</option>{tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.name}</option>)}</select></label>
      <label htmlFor="offering-status-filter">Catalogue status<select id="offering-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    </div>
    <div className="subject-list-heading"><h2>Current offerings</h2><span className="subject-count">{visibleOfferings.length} shown</span></div>
    {offerings.length === 0 ? <div className="profile-panel empty-state">No Tutor offerings exist yet. Add one using an approved tutor and an active catalogue subject.</div>
      : visibleOfferings.length === 0 ? <div className="profile-panel empty-state">No offerings match these filters.</div>
        : <div className="subject-list">{visibleOfferings.map((offering) => <article className="subject-admin-card" key={offering.id}>
          <div className="subject-admin-content"><div className="subject-admin-title"><h3>{offering.tutor.name} → {offering.subject.name}</h3><span className={`application-status ${offering.is_active ? 'status-approved' : 'status-rejected'}`}>{offering.is_active ? 'Active' : 'Inactive catalogue subject'}</span></div><p>{offering.description || 'Teaching focus not provided.'}</p></div>
          <div className="subject-admin-actions"><button className="text-button" type="button" onClick={() => beginEdit(offering)}>Edit</button><button className="button button-danger" type="button" onClick={() => remove(offering)}>Remove</button></div>
        </article>)}</div>}
    <p className="field-help">An offering linked to booking history cannot be removed. Deactivate the global catalogue subject to stop it being offered for new bookings.</p>
  </section>;
}
