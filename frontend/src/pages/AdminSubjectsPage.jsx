import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

const emptyForm = { name: '', description: '' };

export default function AdminSubjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [values, setValues] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.adminSubjects()
      .then((result) => { if (active) setSubjects(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading subjects…" />;

  function beginEdit(subject) {
    setEditingSubject(subject);
    setValues({ name: subject.name, description: subject.description || '' });
    setError(null);
    setSuccess('');
  }

  function resetForm() {
    setEditingSubject(null);
    setValues(emptyForm);
    setError(null);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const result = editingSubject
        ? await api.updateSubject(editingSubject.id, values)
        : await api.createSubject(values);
      if (editingSubject) {
        setSubjects((current) => current.map((subject) => subject.id === result.data.id ? result.data : subject));
        setSuccess(`“${result.data.name}” has been updated.`);
      } else {
        setSubjects((current) => [...current, result.data].sort((left, right) => left.name.localeCompare(right.name)));
        setSuccess(`“${result.data.name}” has been created.`);
      }
      setEditingSubject(null);
      setValues(emptyForm);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(subject) {
    setStatusBusyId(subject.id);
    setError(null);
    setSuccess('');
    try {
      const result = await api.updateSubjectStatus(subject.id, !subject.is_active);
      setSubjects((current) => current.map((item) => item.id === result.data.id ? result.data : item));
      setSuccess(`“${result.data.name}” is now ${result.data.is_active ? 'active' : 'inactive'}.`);
    } catch (caught) {
      setError(caught);
    } finally {
      setStatusBusyId(null);
    }
  }

  async function deleteSubject(subject) {
    if (!window.confirm(`Permanently delete “${subject.name}” if it has no linked tutor applications, offerings, or bookings? Linked subjects must be deactivated instead.`)) return;
    setStatusBusyId(subject.id);
    setError(null);
    setSuccess('');
    try {
      await api.deleteSubject(subject.id);
      setSubjects((current) => current.filter((item) => item.id !== subject.id));
      setSuccess(`“${subject.name}” was deleted.`);
    } catch (caught) {
      setError(caught);
    } finally {
      setStatusBusyId(null);
    }
  }

  return <section className="profile-page subjects-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">ADMINISTRATION</span>
    <h1>Manage <em>subjects.</em></h1>
    <p className="profile-intro">Maintain the global catalogue used by Tutor applications and offerings. Deactivate a linked subject to preserve its history; permanent deletion is limited to unused subjects.</p>
    {success && <p className="success-box" role="status">{success}</p>}
    <FormErrors error={error} />
    <div className="profile-panel subject-form-panel">
      <h2>{editingSubject ? 'Edit subject' : 'Add a subject'}</h2>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="subject-name">Subject name</label>
        <input id="subject-name" name="name" required maxLength="150" value={values.name} onChange={(event) => { setValues((current) => ({ ...current, name: event.target.value })); setError(null); setSuccess(''); }} />
        <label className="field-label" htmlFor="subject-description">Description <span className="label-hint">Optional</span></label>
        <textarea id="subject-description" name="description" maxLength="4000" rows="3" value={values.description} onChange={(event) => { setValues((current) => ({ ...current, description: event.target.value })); setError(null); setSuccess(''); }} />
        <div className="subject-form-actions"><button className="button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingSubject ? 'Save changes' : 'Create subject'}</button>{editingSubject && <button className="button button-outline" type="button" onClick={resetForm} disabled={busy}>Cancel edit</button>}</div>
      </form>
    </div>
    <section className="subject-management-list" aria-labelledby="subject-list-heading">
      <div className="subject-list-heading"><div><span className="eyebrow">SUBJECT CATALOGUE</span><h2 id="subject-list-heading">All subjects</h2></div><span className="subject-count">{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}</span></div>
      {subjects.length === 0 ? <div className="profile-panel empty-state" role="status">No subjects have been created yet. Add the first subject above.</div> : <div className="subject-list">{subjects.map((subject) => <article className="subject-admin-card" key={subject.id}>
        <div className="subject-admin-content"><div className="subject-admin-title"><h3>{subject.name}</h3><span className={`application-status ${subject.is_active ? 'status-approved' : 'status-rejected'}`}>{subject.is_active ? 'Active' : 'Inactive'}</span></div><p>{subject.description || 'No description provided.'}</p></div>
        <div className="subject-admin-actions"><button className="text-button" type="button" onClick={() => beginEdit(subject)}>Edit</button><button className={`button ${subject.is_active ? 'button-danger' : 'button-outline'}`} type="button" disabled={statusBusyId === subject.id} onClick={() => toggleStatus(subject)}>{statusBusyId === subject.id ? 'Saving…' : subject.is_active ? 'Deactivate' : 'Activate'}</button><button className="text-button" type="button" disabled={statusBusyId === subject.id} onClick={() => deleteSubject(subject)}>Delete if unused</button></div>
      </article>)}</div>}
    </section>
  </section>;
}
