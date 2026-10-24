import { useEffect, useState } from 'react';
import { FormErrors } from './SiteLayout.jsx';

const fields = [
  ['full_name', 'Full name'],
  ['first_name', 'First name'], ['last_name', 'Last name'],
  ['faculty_or_university', 'University or faculty'], ['study_program', 'Study program'],
  ['year_of_study', 'Year of study'], ['biography', 'Biography'],
];

function profileValues(profile) {
  return {
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    faculty_or_university: profile?.faculty_or_university || '',
    study_program: profile?.study_program || '',
    year_of_study: profile?.year_of_study ?? '',
    biography: profile?.biography || '',
  };
}

function fullName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.name || '';
}

export default function UserProfileCard({ profile, onSave, onSaved }) {
  const [displayProfile, setDisplayProfile] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => profileValues(profile));
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayProfile(profile);
    setValues(profileValues(profile));
  }, [profile]);

  function beginEdit() {
    setValues(profileValues(displayProfile));
    setError(null);
    setSuccess('');
    setEditing(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const saved = await onSave(values);
      setValues(profileValues(saved));
      setDisplayProfile(saved);
      onSaved(saved);
      setEditing(false);
      setSuccess('Your profile has been saved.');
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return <div className="profile-panel">
      <div className="profile-account"><span className="card-label">ACCOUNT EMAIL</span><p>{displayProfile?.email || 'Not provided'}</p><span className="field-help">Email changes are not available here.</span></div>
    {success && <p className="success-box" role="status">{success}</p>}
    {error && <FormErrors error={error} />}
    {!editing ? <>
      <dl className="profile-details">{fields.map(([key, label]) => { const value = key === 'full_name' ? fullName(displayProfile) : displayProfile?.[key]; return <div className="profile-detail" key={key}><dt>{label}</dt><dd>{value === null || value === undefined || value === '' ? 'Not provided' : value}</dd></div>; })}</dl>
      <button className="button form-submit profile-edit-button" type="button" onClick={beginEdit}>Edit profile <span aria-hidden="true">↗</span></button>
    </> : <form onSubmit={submit}>
      <div className="profile-fields two-columns">
        <div><label className="field-label" htmlFor="profile-first-name">First name</label><input id="profile-first-name" name="first_name" autoComplete="given-name" required maxLength="100" value={values.first_name} onChange={(event) => setValues({ ...values, first_name: event.target.value })} /></div>
        <div><label className="field-label" htmlFor="profile-last-name">Last name</label><input id="profile-last-name" name="last_name" autoComplete="family-name" required maxLength="100" value={values.last_name} onChange={(event) => setValues({ ...values, last_name: event.target.value })} /></div>
        <div><label className="field-label" htmlFor="profile-faculty">University or faculty</label><input id="profile-faculty" name="faculty_or_university" maxLength="180" value={values.faculty_or_university} onChange={(event) => setValues({ ...values, faculty_or_university: event.target.value })} /></div>
        <div><label className="field-label" htmlFor="profile-program">Study program</label><input id="profile-program" name="study_program" maxLength="180" value={values.study_program} onChange={(event) => setValues({ ...values, study_program: event.target.value })} /></div>
        <div><label className="field-label" htmlFor="profile-year">Year of study</label><input id="profile-year" name="year_of_study" type="number" min="1" max="32767" step="1" value={values.year_of_study} onChange={(event) => setValues({ ...values, year_of_study: event.target.value })} /></div>
      </div>
      <label className="field-label" htmlFor="profile-biography">Biography</label><textarea id="profile-biography" name="biography" maxLength="1200" rows="5" value={values.biography} onChange={(event) => setValues({ ...values, biography: event.target.value })} />
      <div className="profile-form-actions"><button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Saving…</> : <>Save profile <span aria-hidden="true">↗</span></>}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => { setEditing(false); setError(null); setValues(profileValues(displayProfile)); }}>Cancel</button></div>
    </form>}
  </div>;
}
