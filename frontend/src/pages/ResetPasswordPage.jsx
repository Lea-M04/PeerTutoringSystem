import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { api } from '../api/client.js';
import { FormErrors } from '../components/SiteLayout.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const { token: pathToken } = useParams();
  const token = params.get('token') || pathToken || '';
  const [values, setValues] = useState({ email: params.get('email') || '', password: '', password_confirmation: '' });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!token) {
      setError({ message: 'This reset link is missing its security information. Request a new link to continue.', errors: {} });
      return;
    }
    if (!event.currentTarget.reportValidity()) return;
    if (values.password !== values.password_confirmation) {
      setError({ message: 'Please check your details.', errors: { password_confirmation: ['The passwords do not match.'] } });
      return;
    }
    setBusy(true); setError(null); setSuccess('');
    try {
      const result = await api.resetPassword({ ...values, token });
      setSuccess(result.message);
    } catch (caught) {
      const safeErrors = Object.fromEntries(Object.entries(caught.errors || {}).filter(([field]) => field !== 'token'));
      const validationText = Object.values(safeErrors).flat().join(' ').toLowerCase();
      if (caught.status === 422 && /reset|token|expired|invalid/.test(`${caught.message || ''} ${validationText}`.toLowerCase())) {
        setError({ message: 'This reset link is invalid or has expired. Request a new password reset link to continue.', errors: {} });
      } else {
        setError({ ...caught, errors: safeErrors });
      }
    }
    finally { setBusy(false); }
  }

  return <section className="auth-section section-wrap"><div className="auth-aside"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Choose a<br /><em>new password.</em></h1><p>Reset links expire and can only be used once.</p></div>
    <div className="form-panel"><span className="form-kicker">SECURE YOUR ACCOUNT</span><h2>Reset password</h2><p className="form-intro">Choose a new password for your account.</p>{success && <p className="success-box" role="status">{success} <Link to="/login">Sign in</Link></p>}{!token && !success && <div className="error-box" role="alert"><strong>This reset link is missing its security information.</strong><p>Request a new password reset link to continue.</p><Link to="/forgot-password">Request a new link</Link></div>}<FormErrors error={error} />
      {!success && token && <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="reset-email">Email address</label><input id="reset-email" type="email" autoComplete="email" required maxLength="255" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
        <label className="field-label" htmlFor="reset-password">New password <span className="label-hint">12 characters minimum</span></label><input id="reset-password" type="password" autoComplete="new-password" required minLength="12" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} />
        <label className="field-label" htmlFor="reset-password-confirmation">Confirm new password</label><input id="reset-password-confirmation" type="password" autoComplete="new-password" required minLength="12" value={values.password_confirmation} onChange={(event) => setValues({ ...values, password_confirmation: event.target.value })} />
        <button className="button form-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Resetting…</> : <>Reset password <span aria-hidden="true">↗</span></>}</button>
      </form>}
      <p className="form-switch">{!token && !success && <Link to="/forgot-password">Return to forgot password</Link>} <Link to="/login">Return to sign in</Link></p>
    </div></section>;
}
