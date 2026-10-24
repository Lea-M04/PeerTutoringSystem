import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors } from '../components/SiteLayout.jsx';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [values, setValues] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    faculty_or_university: user?.faculty_or_university || '',
    study_program: user?.study_program || '',
    biography: user?.biography || '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  function update(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
    setError(null);
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const savedProfile = await updateProfile(values);
      setValues({
        first_name: savedProfile.first_name || '',
        last_name: savedProfile.last_name || '',
        faculty_or_university: savedProfile.faculty_or_university || '',
        study_program: savedProfile.study_program || '',
        biography: savedProfile.biography || '',
      });
      setSuccess('Your profile has been saved.');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return <section className="profile-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">YOUR ACCOUNT</span>
    <h1>My <em>profile.</em></h1>
    <p className="profile-intro">Share a little about who you are and what you study.</p>
    <div className="profile-panel">
      <div className="profile-account"><span className="card-label">ACCOUNT EMAIL</span><p>{user?.email}</p><span className="field-help">Email changes are not available here.</span></div>
      {user?.first_name || user?.last_name ? null : <p className="notice-box" role="status">Your account name is currently “{user?.name}”. Add your first and last name below to complete your profile.</p>}
      {success && <p className="success-box" role="status">{success}</p>}
      <FormErrors error={error} />
      <form onSubmit={submit}>
        <div className="profile-fields two-columns">
          <div><label className="field-label" htmlFor="first_name">First name</label><input id="first_name" name="first_name" autoComplete="given-name" required maxLength="100" value={values.first_name} onChange={update} /></div>
          <div><label className="field-label" htmlFor="last_name">Last name</label><input id="last_name" name="last_name" autoComplete="family-name" required maxLength="100" value={values.last_name} onChange={update} /></div>
          <div><label className="field-label" htmlFor="faculty_or_university">Faculty or university</label><input id="faculty_or_university" name="faculty_or_university" maxLength="180" value={values.faculty_or_university} onChange={update} /></div>
          <div><label className="field-label" htmlFor="study_program">Study program</label><input id="study_program" name="study_program" maxLength="180" value={values.study_program} onChange={update} /></div>
        </div>
        <label className="field-label" htmlFor="biography">Short biography</label>
        <textarea id="biography" name="biography" maxLength="1200" rows="5" value={values.biography} onChange={update} aria-describedby="biography-help" />
        <span id="biography-help" className="field-help">Up to 1,200 characters.</span>
        <button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Saving…</> : <>Save profile <span aria-hidden="true">↗</span></>}</button>
      </form>
    </div>
  </section>;
}
