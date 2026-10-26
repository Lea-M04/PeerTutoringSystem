import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { isAdminUser, isApprovedTutor, isStudentUser } from '../auth/roles.js';
import NotificationBell from './NotificationBell.jsx';

function Mark() {
  return <Link className="brand" to="/" aria-label="Peerwise home"><span className="brand-mark">P</span><span>peerwise<span className="brand-dot">.</span></span></Link>;
}

export function SiteLayout({ children }) {
  const { user, logout } = useAuth();
  const isStudent = isStudentUser(user);
  const isTutor = isApprovedTutor(user);
  const isAdmin = isAdminUser(user);
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const menuRefs = useRef([]);

  useEffect(() => {
    function closeMenus(event) {
      menuRefs.current.forEach((menu) => {
        if (menu && !menu.contains(event.target)) menu.open = false;
      });
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') menuRefs.current.forEach((menu) => { if (menu) menu.open = false; });
    }
    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  async function handleLogout() {
    setLogoutError('');
    try { await logout(); navigate('/', { replace: true }); } catch { setLogoutError('Sign out could not be completed. Please retry.'); }
  }

  function closeMenuAfterNavigation(event) {
    event.currentTarget.closest('details')?.removeAttribute('open');
  }

  const initials = (user?.first_name?.[0] || user?.name?.[0] || 'P').toUpperCase();

  return <div className="site-shell">
    <header className="site-header"><div className="nav-wrap"><Mark />
      <nav aria-label="Main navigation" className="main-nav">
        <NavLink to="/" end>Home</NavLink>
        {user ? <>
          {isStudent && <details className="nav-dropdown" ref={(element) => { menuRefs.current[0] = element; }}>
            <summary aria-label="Student menu">Student <span aria-hidden="true">▾</span></summary>
            <div className="nav-dropdown-menu" aria-label="Student navigation">
              <NavLink to="/tutors" onClick={closeMenuAfterNavigation}>Find Tutors</NavLink>
              <NavLink to="/bookings" onClick={closeMenuAfterNavigation}>My Bookings</NavLink>
              {!isTutor && <NavLink to="/tutor-application" onClick={closeMenuAfterNavigation}>Tutor application</NavLink>}
            </div>
          </details>}
          {isTutor && <details className="nav-dropdown" ref={(element) => { menuRefs.current[1] = element; }}>
            <summary aria-label="Tutor menu">Tutor <span aria-hidden="true">▾</span></summary>
            <div className="nav-dropdown-menu" aria-label="Tutor navigation">
              <NavLink to="/tutor-bookings" onClick={closeMenuAfterNavigation}>Booking Requests</NavLink>
              <NavLink to="/tutor-offerings" onClick={closeMenuAfterNavigation}>My Subjects / Offerings</NavLink>
              <NavLink to="/tutor-availability" onClick={closeMenuAfterNavigation}>My Availability</NavLink>
              <NavLink to="/tutor-reviews" onClick={closeMenuAfterNavigation}>Reviews About Me</NavLink>
              <NavLink to="/tutor-profile" onClick={closeMenuAfterNavigation}>Tutor Profile</NavLink>
            </div>
          </details>}
          {isAdmin && <details className="nav-dropdown" ref={(element) => { menuRefs.current[2] = element; }}>
            <summary aria-label="Admin menu">Admin <span aria-hidden="true">▾</span></summary>
            <div className="nav-dropdown-menu nav-dropdown-menu-admin" aria-label="Admin navigation">
              <NavLink to="/admin/users" onClick={closeMenuAfterNavigation}>User Management</NavLink>
              <NavLink to="/admin/tutor-applications" onClick={closeMenuAfterNavigation}>Tutor Applications</NavLink>
              <NavLink to="/admin/subjects" onClick={closeMenuAfterNavigation}>Subject Management</NavLink>
              <NavLink to="/admin/tutor-offerings" onClick={closeMenuAfterNavigation}>Tutor Offering Management</NavLink>
              <NavLink to="/admin/bookings" onClick={closeMenuAfterNavigation}>Booking Management</NavLink>
            </div>
          </details>}
          <NotificationBell user={user} />
          <details className="nav-dropdown profile-dropdown" ref={(element) => { menuRefs.current[3] = element; }}>
            <summary className="profile-menu-trigger" aria-label={`Open profile menu for ${user.name || 'your account'}`}><span className="profile-menu-avatar" aria-hidden="true">{initials}</span><span className="profile-menu-caret" aria-hidden="true">▾</span></summary>
            <div className="nav-dropdown-menu profile-dropdown-menu" aria-label="Profile menu">
              <NavLink to="/profile" onClick={closeMenuAfterNavigation}>My Profile</NavLink>
              <button type="button" onClick={(event) => { closeMenuAfterNavigation(event); void handleLogout(); }}>Sign Out</button>
            </div>
          </details>
        </> : <><NavLink to="/login">Sign in</NavLink><Link className="button button-small" to="/register">Get started <span aria-hidden="true">↗</span></Link></>}
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
