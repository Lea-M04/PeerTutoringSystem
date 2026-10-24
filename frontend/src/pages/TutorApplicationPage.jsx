import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

function ApplicationStatus({ status }) {
  return <span className={`application-status status-${status}`}>{status}</span>;
}

export default function TutorApplicationPage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const canApply = roles.includes('student') && !roles.includes('tutor') && !roles.includes('admin');
  const [subjects, setSubjects] = useState([]);
  const [applications, setApplications] = useState([]);
  const [motivation, setMotivation] = useState('');
  const [subjectIds, setSubjectIds] = useState([]);
  const [loading, setLoading] = useState(canApply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!canApply) return undefined;
    let active = true;
    Promise.all([api.subjects(), api.tutorApplications()])
      .then(([subjectResult, applicationResult]) => {
        if (!active) return;
        setSubjects(subjectResult.data);
        setApplications(applicationResult.data);
      })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canApply]);

  if (!canApply) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading tutor application information…" />;

  const hasPendingApplication = applications.some((application) => application.status === 'pending');

  function toggleSubject(id) {
    setSubjectIds((current) => current.includes(id) ? current.filter((subjectId) => subjectId !== id) : [...current, id]);
    setError(null);
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const result = await api.submitTutorApplication({ motivation, subject_ids: subjectIds });
      setApplications((current) => [result.data, ...current]);
      setMotivation('');
      setSubjectIds([]);
      setSuccess('Your application has been submitted for administrator review.');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return <section className="profile-page application-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">TUTOR APPLICATION</span>
    <h1>Share what you <em>know.</em></h1>
    <p className="profile-intro">Tell us why you would like to tutor and choose the subjects you can support. An administrator reviews every application.</p>
    <div className="profile-panel">
      {success && <p className="success-box" role="status">{success}</p>}
      <FormErrors error={error} />
      {hasPendingApplication ? <p className="notice-box" role="status">You already have an application awaiting review. You can apply again if it is rejected.</p> : <form onSubmit={submit}>
        <label className="field-label" htmlFor="application-motivation">Why would you like to become a tutor?</label>
        <textarea id="application-motivation" name="motivation" required minLength="20" maxLength="5000" rows="6" value={motivation} onChange={(event) => { setMotivation(event.target.value); setError(null); setSuccess(''); }} aria-describedby="motivation-help" />
        <span id="motivation-help" className="field-help">Please write between 20 and 5,000 characters.</span>
        <fieldset className="subject-picker">
          <legend className="field-label">Subjects you can tutor</legend>
          {subjects.length === 0 ? <p className="field-help">There are no active subjects available at the moment.</p> : <div className="subject-options">{subjects.map((subject) => <label className="subject-option" key={subject.id}><input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} /><span>{subject.name}</span></label>)}</div>}
          {subjects.length > 0 && subjectIds.length === 0 && <span className="field-help">Choose at least one subject.</span>}
        </fieldset>
        <button className="button form-submit" type="submit" disabled={busy || subjects.length === 0 || subjectIds.length === 0}>{busy ? <><span className="spinner spinner-light" /> Submitting…</> : <>Submit application <span aria-hidden="true">↗</span></>}</button>
      </form>}
    </div>
    <section className="application-history" aria-labelledby="application-history-heading">
      <span className="eyebrow">YOUR RECORD</span>
      <h2 id="application-history-heading">Application history</h2>
      {applications.length === 0 ? <p className="empty-state">You have not submitted a tutor application yet.</p> : <div className="application-list">{applications.map((application) => <article className="application-card" key={application.id}>
        <div className="application-card-heading"><h3>Application #{application.id}</h3><ApplicationStatus status={application.status} /></div>
        <p className="application-date">Submitted {application.created_at ? new Date(application.created_at).toLocaleDateString() : 'recently'}</p>
        <p className="application-motivation">{application.motivation}</p>
        <div className="application-subjects">{application.subjects?.map((subject) => <span className="role-pill" key={subject.id}>{subject.name}</span>)}</div>
        {application.rejection_reason && <p className="rejection-reason"><strong>Review feedback:</strong> {application.rejection_reason}</p>}
      </article>)}</div>}
    </section>
  </section>;
}
