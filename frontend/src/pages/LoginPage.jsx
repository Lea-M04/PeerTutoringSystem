import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors } from '../components/SiteLayout.jsx';

export default function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' }); const [error, setError] = useState(null); const [busy, setBusy] = useState(false); const [success, setSuccess] = useState('');
  function update(event) { setValues({ ...values, [event.target.name]: event.target.value }); setError(null); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null); setSuccess('');
    try { await login(values); setSuccess('You are signed in. Opening your dashboard…'); navigate(location.state?.from?.pathname || '/dashboard', { replace: true, state: { notice: 'You are signed in.' } }); }
    catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }
  return <section className="auth-section section-wrap"><div className="auth-aside"><span className="eyebrow">WELCOME BACK</span><h1>Good to see<br />you <em>again.</em></h1><p>Your next study session is just around the corner.</p><div className="aside-decoration"><span>“</span><p>Learning is a shared journey.</p></div></div>
    <div className="form-panel"><span className="form-kicker">YOUR LEARNING COMMUNITY</span><h2>Sign in</h2><p className="form-intro">Pick up where you left off.</p>
      {location.state?.message && <p className="notice-box" role="status">{location.state.message}</p>}{success && <p className="success-box" role="status">{success}</p>}<FormErrors error={error} />
      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength="255" value={values.email} onChange={update} placeholder="you@university.edu" />
        <label className="field-label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required value={values.password} onChange={update} placeholder="Enter your password" />
        <button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Signing in…</> : <>Sign in <span aria-hidden="true">↗</span></>}</button>
      </form><p className="form-switch"><Link to="/forgot-password">Forgot Password?</Link></p><p className="form-switch">New to the community? <Link to="/register">Create an account</Link></p>
    </div></section>;
}
