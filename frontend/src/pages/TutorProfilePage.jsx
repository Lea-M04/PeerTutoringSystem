import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isApprovedTutor } from '../auth/roles.js';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import UserProfileCard from '../components/UserProfileCard.jsx';

export default function TutorProfilePage() {
  const { user, updateProfile } = useAuth();
  const isTutor = isApprovedTutor(user);
  const [profile, setProfile] = useState(null);
  const [tutorProfile, setTutorProfile] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [biography, setBiography] = useState('');
  const [editingTutorBio, setEditingTutorBio] = useState(false);
  const [loading, setLoading] = useState(isTutor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    Promise.all([api.currentUser(), api.tutorProfile(), api.tutorOfferings()])
      .then(([userResult, tutorResult, offeringsResult]) => {
        if (!active) return;
        setProfile(userResult.data);
        setTutorProfile(tutorResult.data);
        setOfferings(offeringsResult.data);
        setBiography(tutorResult.data.biography || '');
      })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  if (!isTutor) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading your tutor profile…" />;

  async function submitTutorBio(event) {
    event.preventDefault();
    setBusy(true); setError(null); setSuccess('');
    try {
      const result = await api.updateTutorProfile({ biography });
      setTutorProfile(result.data);
      setBiography(result.data.biography || '');
      setEditingTutorBio(false);
      setSuccess('Your tutor profile has been saved.');
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }

  return <section className="profile-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">TUTOR DETAILS</span><h1>My tutor <em>profile.</em></h1>
    <p className="profile-intro">Your saved student details and tutor information.</p>
    {error && !profile && <FormErrors error={error} />}
    {profile && <><h2 className="profile-section-heading">Personal profile</h2><UserProfileCard profile={profile} onSave={updateProfile} onSaved={setProfile} />
      <h2 className="profile-section-heading">Tutor biography</h2><div className="profile-panel">
        {success && <p className="success-box" role="status">{success}</p>}
        {error && profile && <FormErrors error={error} />}
        {!editingTutorBio ? <><p className="profile-biography">{tutorProfile?.biography || 'Not provided'}</p><button className="button form-submit profile-edit-button" type="button" onClick={() => { setError(null); setSuccess(''); setEditingTutorBio(true); }}>Edit tutor profile <span aria-hidden="true">↗</span></button></> : <form onSubmit={submitTutorBio}>
          <label className="field-label" htmlFor="tutor-biography">Tutor biography</label><textarea id="tutor-biography" name="biography" maxLength="1200" rows="7" value={biography} onChange={(event) => { setBiography(event.target.value); setError(null); setSuccess(''); }} aria-describedby="tutor-biography-help" />
          <span id="tutor-biography-help" className="field-help">Describe your tutoring approach in up to 1,200 characters.</span>
          <div className="profile-form-actions"><button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Saving…</> : <>Save tutor profile <span aria-hidden="true">↗</span></>}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => { setEditingTutorBio(false); setBiography(tutorProfile?.biography || ''); setError(null); }}>Cancel</button></div>
        </form>}
      </div>
      <section aria-labelledby="tutor-offerings-heading"><div className="dashboard-profile-heading tutor-offerings-heading"><div><span className="eyebrow">WHAT I CAN HELP WITH</span><h2 id="tutor-offerings-heading">My teaching subjects</h2></div><Link className="button button-outline" to="/tutor-offerings">Manage My Teaching Subjects <span aria-hidden="true">↗</span></Link></div>
        {offerings.length === 0 ? <div className="empty-state tutor-offerings-empty"><p>You have not added any active subject offerings yet. Add subjects so students can find you in the tutor directory.</p><Link className="text-link" to="/tutor-offerings">Manage your teaching subjects <span aria-hidden="true">↗</span></Link></div> : <div className="directory-offerings">{offerings.map((offering) => <article className="directory-offering-card" key={offering.id}><h3>{offering.subject.name}</h3><p>{offering.description || 'Teaching focus not provided.'}</p></article>)}</div>}
      </section></>}
  </section>;
}
