import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { FormErrors } from '../components/SiteLayout.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setBusy(true); setError(null); setMessage('');
    try {
      const result = await api.requestPasswordReset(email);
      setMessage(result.message);
    } catch (caught) { setError(caught); }
    finally { setBusy(false); }
  }

  return <section className="auth-section section-wrap"><div className="auth-aside"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Find your<br /><em>way back.</em></h1><p>Request a password reset link for your account.</p></div>
    <div className="form-panel"><span className="form-kicker">RESET YOUR PASSWORD</span><h2>Forgot password?</h2><p className="form-intro">Enter your account email. We will show the same confirmation whether or not it matches an account.</p>{message && <p className="success-box" role="status">{message}</p>}<FormErrors error={error} />
      <form onSubmit={submit} noValidate><label className="field-label" htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required maxLength="255" value={email} onChange={(event) => { setEmail(event.target.value); setError(null); setMessage(''); }} placeholder="you@university.edu" /><button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Sending request…</> : <>Request reset link <span aria-hidden="true">↗</span></>}</button></form>
      <p className="form-switch"><Link to="/login">Return to sign in</Link></p>
    </div></section>;
}
