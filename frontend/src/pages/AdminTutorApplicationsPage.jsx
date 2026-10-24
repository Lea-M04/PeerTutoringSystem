import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

export default function AdminTutorApplicationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [busyId, setBusyId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const loadApplications = useCallback(async () => {
    const result = await api.pendingTutorApplications();
    setApplications(result.data);
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.pendingTutorApplications()
      .then((result) => { if (active) setApplications(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading pending applications…" />;

  async function review(application, action) {
    setBusyId(application.id);
    setError(null);
    setSuccess('');
    try {
      if (action === 'approve') {
        await api.approveTutorApplication(application.id);
        setSuccess(`Application #${application.id} was approved. The applicant is now a tutor and remains a student.`);
      } else {
        await api.rejectTutorApplication(application.id, reason);
        setSuccess(`Application #${application.id} was rejected.`);
        setReason('');
        setRejectingId(null);
      }
      await loadApplications();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusyId(null);
    }
  }

  async function downloadTranscript(application) {
    setDownloadingId(application.id);
    setError(null);
    try {
      const file = await api.downloadTutorApplicationTranscript(application.id);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `application-${application.id}-transcript.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught);
    } finally {
      setDownloadingId(null);
    }
  }

  return <section className="profile-page admin-applications-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">ADMINISTRATION</span>
    <h1>Tutor <em>applications.</em></h1>
    <p className="profile-intro">Review applicants and their proposed subjects. Approval grants the Tutor role while preserving Student access.</p>
    {success && <p className="success-box" role="status">{success}</p>}
    <FormErrors error={error} />
    {applications.length === 0 ? <div className="profile-panel empty-state" role="status">There are no pending tutor applications.</div> : <div className="application-list">{applications.map((application) => <article className="application-card admin-application-card" key={application.id}>
      <div className="application-card-heading"><div><span className="card-label">APPLICATION #{application.id}</span><h2>{application.applicant?.name || 'Student applicant'}</h2><p className="application-date">{application.applicant?.email}</p><p className="application-date">Submitted {application.created_at ? new Date(application.created_at).toLocaleString() : 'date unavailable'}</p></div><span className={`application-status status-${application.status}`}>{application.status}</span></div>
      <dl className="applicant-academic"><div><dt>University or faculty</dt><dd>{application.applicant?.faculty_or_university || 'Not provided'}</dd></div><div><dt>Study program</dt><dd>{application.applicant?.study_program || 'Not provided'}</dd></div><div><dt>Year of study</dt><dd>{application.applicant?.year_of_study || 'Not provided'}</dd></div></dl>
      <p className="admin-motivation">{application.motivation}</p>
      <div className="application-subjects">{application.subjects?.map((subject) => <span className="role-pill" key={subject.id}>{subject.name}</span>)}</div>
      <div className="transcript-action">{application.transcript_available ? <button className="button button-outline" type="button" disabled={downloadingId === application.id} onClick={() => downloadTranscript(application)}>{downloadingId === application.id ? 'Preparing transcript…' : 'Download academic transcript'}</button> : <span className="field-help">No transcript is attached to this historical application.</span>}</div>
      <div className="review-actions"><button className="button" type="button" disabled={busyId === application.id} onClick={() => review(application, 'approve')}>{busyId === application.id ? 'Working…' : 'Approve'}</button>
        {rejectingId === application.id ? <form className="rejection-form" onSubmit={(event) => { event.preventDefault(); review(application, 'reject'); }}>
          <label className="field-label" htmlFor={`rejection-reason-${application.id}`}>Reason for rejection</label>
          <textarea id={`rejection-reason-${application.id}`} required minLength="10" maxLength="1000" rows="3" value={reason} onChange={(event) => { setReason(event.target.value); setError(null); }} />
          <span className="field-help">Give the applicant specific feedback (at least 10 characters).</span>
          <div className="review-actions"><button className="button button-danger" type="submit" disabled={busyId === application.id || reason.trim().length < 10}>{busyId === application.id ? 'Working…' : 'Confirm rejection'}</button><button className="button button-outline" type="button" onClick={() => { setRejectingId(null); setReason(''); }}>Keep pending</button></div>
        </form> : <button className="button button-danger" type="button" disabled={busyId === application.id} onClick={() => { setRejectingId(application.id); setReason(''); setError(null); }}>Reject</button>}
      </div>
    </article>)}</div>}
  </section>;
}
