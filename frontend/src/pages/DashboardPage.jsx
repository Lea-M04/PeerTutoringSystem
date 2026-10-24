import { Link, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const roles = user?.roles || [];
  const isUnapprovedStudent = roles.includes('student') && !roles.includes('tutor') && !roles.includes('admin');
  const isAdmin = roles.includes('admin');
  return <section className="dashboard section-wrap">{location.state?.notice && <p className="success-box" role="status">{location.state.notice}</p>}<span className="eyebrow">YOUR SPACE</span><h1>Welcome, <em>{user?.name?.split(' ')[0] || 'learner'}.</em></h1><p className="dashboard-lede">This is your starting point for peer learning.</p>
    <div className="dashboard-card"><div className="avatar" aria-hidden="true">{user?.name?.trim()?.charAt(0)?.toUpperCase() || 'L'}</div><div><span className="card-label">SIGNED IN AS</span><h2>{user?.name}</h2><p>{user?.email}</p></div><div className="role-list"><span className="card-label">YOUR ROLE{roles.length === 1 ? '' : 'S'}</span><div>{roles.length ? roles.map((role) => <span className="role-pill" key={role}>{role}</span>) : <span className="role-pill">Student</span>}</div></div></div>
    <div className="dashboard-links"><Link className="button" to="/profile">View or edit profile <span aria-hidden="true">↗</span></Link>{roles.includes('tutor') && <Link className="button button-outline" to="/tutor-profile">Tutor profile <span aria-hidden="true">↗</span></Link>}{isUnapprovedStudent && <Link className="button button-outline" to="/tutor-application">Become a Tutor <span aria-hidden="true">↗</span></Link>}{isAdmin && <Link className="button button-outline" to="/admin/tutor-applications">Manage tutor applications <span aria-hidden="true">↗</span></Link>}</div>
    <div className="coming-card"><span className="coming-icon">✳</span><div><span className="eyebrow">A FOUNDATION TO BUILD ON</span><h2>Your learning tools are on their way.</h2><p>Tutor discovery, bookings, and session management will arrive in future project phases.</p></div></div><Link className="text-link dashboard-home" to="/">Back to home <span aria-hidden="true">↗</span></Link>
  </section>;
}
