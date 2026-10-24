import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

const maxTranscriptMb = Number(import.meta.env.VITE_TUTOR_APPLICATION_TRANSCRIPT_MAX_MB || 10);

function ApplicationStatus({ status }) {
  return <span className={`application-status status-${status}`}>{status}</span>;
}

export default function TutorApplicationPage() {
  const { user, refreshUser } = useAuth();
  const roles = user?.roles || [];
  const canApply = roles.includes('student') && !roles.includes('tutor') && !roles.includes('admin');
  const [subjects, setSubjects] = useState([]);
  const [applications, setApplications] = useState([]);
  const [values, setValues] = useState({
    motivation: '',
    faculty_or_university: user?.faculty_or_university || '',
    study_program: user?.study_program || '',
    year_of_study: user?.year_of_study || '',
  });
  const [subjectIds, setSubjectIds] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const formRef = useRef(null);
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

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError(null);
    setSuccess('');
  }

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
      const result = await api.submitTutorApplication({ ...values, subject_ids: subjectIds, transcript });
      setApplications((current) => [result.data, ...current]);
      setValues((current) => ({ ...current, motivation: '' }));
      setSubjectIds([]);
      setTranscript(null);
      formRef.current?.reset();
      setSuccess('Your application and transcript have been submitted for administrator review.');
      refreshUser().catch(() => {});
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
    <p className="profile-intro">Tell us about your studies, why you would like to tutor, choose your subjects, and attach your complete academic transcript. An administrator reviews every application.</p>
    <div className="profile-panel">
      {success && <p className="success-box" role="status">{success}</p>}
      <FormErrors error={error} />
      {hasPendingApplication ? <p className="notice-box" role="status">You already have an application awaiting review. You can apply again if it is rejected.</p> : <form ref={formRef} onSubmit={submit}>
        <fieldset className="profile-fields two-columns">
          <legend className="field-label">Academic information</legend>
          <div><label className="field-label" htmlFor="application-university">University or faculty</label><input id="application-university" name="faculty_or_university" required maxLength="180" value={values.faculty_or_university} onChange={update} /></div>
          <div><label className="field-label" htmlFor="application-program">Study program</label><input id="application-program" name="study_program" required maxLength="180" value={values.study_program} onChange={update} /></div>
          <div><label className="field-label" htmlFor="application-year">Year of study</label><input id="application-year" name="year_of_study" type="number" min="1" max="32767" step="1" required value={values.year_of_study} onChange={update} /></div>
        </fieldset>
        <label className="field-label" htmlFor="application-motivation">Why would you like to become a tutor?</label>
        <textarea id="application-motivation" name="motivation" required minLength="20" maxLength="5000" rows="6" value={values.motivation} onChange={update} aria-describedby="motivation-help" />
        <span id="motivation-help" className="field-help">Please write between 20 and 5,000 characters.</span>
        <fieldset className="subject-picker">
          <legend className="field-label">Subjects you can tutor</legend>
          {subjects.length === 0 ? <p className="field-help">There are no active subjects available at the moment.</p> : <div className="subject-options">{subjects.map((subject) => <label className="subject-option" key={subject.id}><input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} /><span>{subject.name}</span></label>)}</div>}
          {subjects.length > 0 && subjectIds.length === 0 && <span className="field-help">Choose at least one subject.</span>}
        </fieldset>
        <label className="field-label" htmlFor="application-transcript">Complete academic transcript (PDF)</label>
        <input id="application-transcript" name="transcript" type="file" accept="application/pdf,.pdf" required onChange={(event) => {
          const selected = event.target.files?.[0] || null;
          setSuccess('');
          if (selected && selected.size > maxTranscriptMb * 1024 * 1024) {
            setTranscript(null);
            setError({ message: `Choose a PDF no larger than ${maxTranscriptMb} MB.`, errors: {} });
            event.target.value = '';
            return;
          }
          if (selected && selected.type && selected.type !== 'application/pdf') {
            setTranscript(null);
            setError({ message: 'Choose an academic transcript in PDF format.', errors: {} });
            event.target.value = '';
            return;
          }
          setTranscript(selected);
          setError(null);
        }} aria-describedby="transcript-help" />
        <span id="transcript-help" className="field-help">PDF only, up to {maxTranscriptMb} MB. The file is stored privately and can only be downloaded by an authorized administrator.</span>
        <button className="button form-submit" type="submit" disabled={busy || subjects.length === 0 || subjectIds.length === 0 || !transcript}>{busy ? <><span className="spinner spinner-light" /> Submitting…</> : <>Submit application <span aria-hidden="true">↗</span></>}</button>
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
