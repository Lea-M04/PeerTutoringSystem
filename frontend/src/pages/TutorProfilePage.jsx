import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

export default function TutorProfilePage() {
  const { user } = useAuth();
  const isTutor = user?.roles?.includes('tutor') || false;
  const [biography, setBiography] = useState('');
  const [loading, setLoading] = useState(isTutor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    api.tutorProfile()
      .then((result) => { if (active) setBiography(result.data.biography || ''); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  if (!isTutor) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading your tutor profile…" />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const result = await api.updateTutorProfile({ biography });
      setBiography(result.data.biography || '');
      setSuccess('Your tutor profile has been saved.');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return <section className="profile-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">TUTOR DETAILS</span>
    <h1>My tutor <em>profile.</em></h1>
    <p className="profile-intro">Tell learners what it is like to study with you.</p>
    <div className="profile-panel">
      {success && <p className="success-box" role="status">{success}</p>}
      <FormErrors error={error} />
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="tutor-biography">Tutor biography</label>
        <textarea id="tutor-biography" name="biography" maxLength="1200" rows="7" value={biography} onChange={(event) => { setBiography(event.target.value); setError(null); setSuccess(''); }} aria-describedby="tutor-biography-help" />
        <span id="tutor-biography-help" className="field-help">Describe your tutoring approach in up to 1,200 characters.</span>
        <button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Saving…</> : <>Save tutor profile <span aria-hidden="true">↗</span></>}</button>
      </form>
    </div>
  </section>;
}
