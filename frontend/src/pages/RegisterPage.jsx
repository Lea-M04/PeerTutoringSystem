import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors } from '../components/SiteLayout.jsx';

export default function RegisterPage() {
  const { register } = useAuth(); const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '', password_confirmation: '' }); const [error, setError] = useState(null); const [busy, setBusy] = useState(false); const [success, setSuccess] = useState('');
  function update(event) { setValues({ ...values, [event.target.name]: event.target.value }); setError(null); }
  async function submit(event) {
    event.preventDefault(); setError(null); setSuccess('');
    if (values.password.length < 12) { setError({ message: 'Please check your details.', errors: { password: ['Use at least 12 characters.'] } }); return; }
    if (values.password !== values.password_confirmation) { setError({ message: 'Please check your details.', errors: { password_confirmation: ['The passwords do not match.'] } }); return; }
    setBusy(true);
    try { await register(values); setSuccess('Your account is ready. Opening Home…'); navigate('/', { replace: true, state: { notice: 'Your account is ready.' } }); }
    catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }
  return <section className="auth-section section-wrap register-section"><div className="auth-aside"><span className="eyebrow">MAKE LEARNING SOCIAL</span><h1>There is a seat<br />for <em>you here.</em></h1><p>Join a community where students learn from students.</p><div className="aside-decoration"><span>✳</span><p>Every expert was once a beginner.</p></div></div>
    <div className="form-panel"><span className="form-kicker">YOUR FIRST STEP</span><h2>Create your account</h2><p className="form-intro">A little about you, and you are in.</p>{success && <p className="success-box" role="status">{success}</p>}<FormErrors error={error} />
      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="name">Full name</label><input id="name" name="name" type="text" autoComplete="name" required maxLength="120" value={values.name} onChange={update} placeholder="Your name" />
        <label className="field-label" htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength="255" value={values.email} onChange={update} placeholder="you@university.edu" />
        <label className="field-label" htmlFor="password">Password <span className="label-hint">12 characters minimum</span></label><input id="password" name="password" type="password" autoComplete="new-password" required minLength="12" value={values.password} onChange={update} placeholder="Create a password" />
        <label className="field-label" htmlFor="password_confirmation">Confirm password</label><input id="password_confirmation" name="password_confirmation" type="password" autoComplete="new-password" required minLength="12" value={values.password_confirmation} onChange={update} placeholder="Enter it once more" />
        <button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Creating account…</> : <>Create account <span aria-hidden="true">↗</span></>}</button>
      </form><p className="form-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </div></section>;
}
