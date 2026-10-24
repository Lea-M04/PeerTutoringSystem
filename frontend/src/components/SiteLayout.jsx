import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

function Mark() {
  return <Link className="brand" to="/" aria-label="Peerwise home"><span className="brand-mark">P</span><span>peerwise<span className="brand-dot">.</span></span></Link>;
}

export function SiteLayout({ children }) {
  const { user, logout } = useAuth();
  const roles = user?.roles || [];
  const isStudent = roles.includes('student');
  const isTutor = roles.includes('tutor');
  const isAdmin = roles.includes('admin');
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  async function handleLogout() {
    setLogoutError('');
    try { await logout(); navigate('/'); } catch { setLogoutError('Sign out could not be completed. Please retry.'); }
  }

  return <div className="site-shell">
    <header className="site-header"><div className="nav-wrap"><Mark />
      <nav aria-label="Main navigation" className="main-nav">
        <NavLink to="/" end>Home</NavLink>
        {user ? <><NavLink to="/dashboard">Dashboard</NavLink>{isStudent && <NavLink to="/tutors">Find Tutors</NavLink>}{isTutor && <NavLink to="/tutor-offerings">Manage My Teaching Subjects</NavLink>}{isAdmin && <NavLink to="/admin/subjects">Manage Subjects</NavLink>}<button className="nav-action" onClick={handleLogout}>Sign out</button></> : <><NavLink to="/login">Sign in</NavLink><Link className="button button-small" to="/register">Get started <span aria-hidden="true">↗</span></Link></>}
      </nav>
    </div></header>
    <main>{logoutError && <div className="section-wrap"><p className="error-box" role="alert">{logoutError}</p></div>}{children}</main>
    <footer className="site-footer"><div className="footer-inner"><Mark /><p>Good learning happens together.</p><span>Peer Tutoring Management System</span></div></footer>
  </div>;
}

export function PageLoader({ label = 'Loading your account…' }) {
  return <div className="page-loader" role="status"><span className="spinner" />{label}</div>;
}

export function FormErrors({ error }) {
  if (!error) return null;
  const messages = Object.values(error.errors || {}).flat();
  return <div className="error-box" role="alert"><strong>{error.message}</strong>{messages.length > 0 && <ul>{messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>}</div>;
}
