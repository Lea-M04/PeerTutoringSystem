import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

function ProfileField({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>;
}

export default function AdminUserProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [success, setSuccess] = useState('');
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.adminUser(userId)
      .then((result) => { if (active) setProfile(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, userId]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading user profile…" />;

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    setSuccess('');
    try {
      const result = await api.updateAdminUser(userId, form);
      setProfile((current) => ({ ...current, ...result.data }));
      setEditing(false);
      setForm(null);
      setSuccess('Profile changes saved.');
    } catch (caught) {
      setActionError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccountStatus() {
    const nextStatus = !profile.is_active;
    const action = nextStatus ? 'reactivate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} this account?`)) return;

    setActionError(null);
    setSuccess('');
    try {
      const result = await api.updateAdminUserStatus(userId, nextStatus);
      setProfile((current) => ({ ...current, ...result.data }));
      setSuccess(nextStatus ? 'Account reactivated.' : 'Account deactivated. Historical records are preserved.');
    } catch (caught) {
      setActionError(caught);
    }
  }

  function startEditing() {
    setForm({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      faculty_or_university: profile.faculty_or_university || '',
      study_program: profile.study_program || '',
      year_of_study: profile.year_of_study ?? '',
      biography: profile.biography || '',
    });
    setActionError(null);
    setSuccess('');
    setEditing(true);
  }

  const roles = profile?.roles || [];
  const isTutor = roles.includes('tutor');

  return <section className="admin-users-page section-wrap">
    <Link className="text-link back-link" to="/admin/users"><span aria-hidden="true">←</span> Back to users</Link>
    {error ? <div className="profile-panel admin-profile-error"><FormErrors error={error} /><Link className="button button-outline" to="/admin/users">Return to users</Link></div> : profile && <>
      <span className="eyebrow">ADMIN USER PROFILE</span><h1>{profile.name || 'User'} <em>details.</em></h1>
      <div className="admin-profile-actions">
        <span className={`application-status ${profile.is_active ? 'status-approved' : 'status-rejected'}`}>{profile.is_active ? 'Active account' : 'Deactivated account'}</span>
        {profile.id !== user?.id && <>
          {!editing && <button className="button button-outline" type="button" onClick={startEditing}>Edit profile</button>}
          <button className={`button ${profile.is_active ? 'button-danger' : 'button-outline'}`} type="button" onClick={toggleAccountStatus}>{profile.is_active ? 'Deactivate account' : 'Reactivate account'}</button>
        </>}
      </div>
      {success && <p className="success-box" role="status">{success}</p>}
      <FormErrors error={actionError} />
      {editing && <form className="profile-panel admin-profile-section admin-user-edit-form" onSubmit={saveProfile}>
        <h2>Edit permitted profile information</h2>
        <div className="form-grid">
          <label>First name<input required maxLength="100" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
          <label>Last name<input required maxLength="100" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
          <label>University or faculty<input maxLength="180" value={form.faculty_or_university} onChange={(event) => setForm({ ...form, faculty_or_university: event.target.value })} /></label>
          <label>Study program<input maxLength="180" value={form.study_program} onChange={(event) => setForm({ ...form, study_program: event.target.value })} /></label>
          <label>Year of study<input type="number" min="1" max="32767" value={form.year_of_study} onChange={(event) => setForm({ ...form, year_of_study: event.target.value })} /></label>
          <label className="form-full-width">Biography<textarea rows="4" maxLength="1200" value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} /></label>
        </div>
        <div className="admin-profile-actions"><button className="button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button><button className="button button-outline" type="button" disabled={saving} onClick={() => { setEditing(false); setForm(null); setActionError(null); }}>Cancel</button></div>
      </form>}
      <div className="admin-profile-role-row"><div className="admin-user-roles">{roles.map((role) => <span className="role-pill" key={role}>{role}</span>)}{profile.is_approved_tutor && <span className="application-status status-approved">Approved tutor</span>}</div><span>{profile.is_approved_tutor ? 'Tutor status: approved' : isTutor ? 'Tutor status: not approved' : 'Student account'}</span></div>
      <section className="profile-panel admin-profile-section"><h2>Personal and academic information</h2><dl className="admin-profile-details">
        <ProfileField label="First name" value={profile.first_name} /><ProfileField label="Last name" value={profile.last_name} />
        <ProfileField label="University or faculty" value={profile.faculty_or_university} /><ProfileField label="Study program" value={profile.study_program} />
        <ProfileField label="Year of study" value={profile.year_of_study} /><ProfileField label="About me" value={profile.biography} />
      </dl></section>
      {isTutor && <>
        <section className="profile-panel admin-profile-section"><h2>Tutor information</h2><p className="admin-profile-biography">{profile.tutor_profile?.biography || 'Tutor biography not provided.'}</p></section>
        <section className="admin-profile-section"><h2>Active teaching subjects</h2>{profile.tutor_profile?.offerings?.length
          ? <div className="admin-profile-offerings">{profile.tutor_profile.offerings.map((offering) => <article className="directory-offering-card" key={offering.id}><h3>{offering.subject.name}</h3><p>{offering.description || 'Teaching focus not provided.'}</p></article>)}</div>
          : <p className="empty-state">This tutor has no active subject offerings.</p>}</section>
        <section className="admin-profile-section"><h2>Future availability</h2>{profile.tutor_profile?.availability?.length
          ? <div className="directory-availability-list">{profile.tutor_profile.availability.map((item) => <article className="directory-availability-card" key={item.id}><div><span className="card-label">AVAILABLE FROM</span><p>{formatLocalDateTime(item.starts_at)}</p></div><div><span className="card-label">UNTIL</span><p>{formatLocalDateTime(item.ends_at)}</p></div></article>)}</div>
          : <p className="empty-state">This tutor has no future availability intervals.</p>}</section>
      </>}
      <p className="admin-profile-note">Account deactivation preserves historical tutor applications, bookings, reviews, and messages. Permanent deletion is unavailable to protect linked history. Role changes and tutor approval remain in their dedicated workflows.</p>
    </>}
  </section>;
}
