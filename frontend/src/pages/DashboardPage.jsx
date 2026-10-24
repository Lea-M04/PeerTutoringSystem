import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const roles = user?.roles || [];
  const isStudent = roles.includes('student');
  const isUnapprovedStudent = roles.includes('student') && !roles.includes('tutor') && !roles.includes('admin');
  const isAdmin = roles.includes('admin');
  const [latestApplication, setLatestApplication] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(isStudent);
  const [applicationError, setApplicationError] = useState(false);

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    api.tutorApplications()
      .then((result) => { if (active) setLatestApplication(result.data[0] || null); })
      .catch(() => { if (active) setApplicationError(true); })
      .finally(() => { if (active) setApplicationLoading(false); });
    return () => { active = false; };
  }, [isStudent]);

  return <section className="dashboard section-wrap">{location.state?.notice && <p className="success-box" role="status">{location.state.notice}</p>}<span className="eyebrow">YOUR SPACE</span><h1>Welcome, <em>{user?.name?.split(' ')[0] || 'learner'}.</em></h1><p className="dashboard-lede">This is your starting point for peer learning.</p>
    {isStudent && applicationLoading && <p className="notice-box" role="status">Checking your tutor application status…</p>}
    {isStudent && applicationError && <p className="error-box" role="alert">Your tutor application status could not be loaded. Refresh the page or open your application history.</p>}
    {latestApplication?.status === 'rejected' && <div className="application-dashboard-alert" role="status"><span className="eyebrow">TUTOR APPLICATION UPDATE</span><h2>Your tutor application has been rejected.</h2><p><strong>Administrator feedback:</strong> {latestApplication.rejection_reason || 'No reason was recorded.'}</p><Link className="button" to="/tutor-application">View application details and apply again <span aria-hidden="true">↗</span></Link></div>}
    {latestApplication?.status === 'pending' && <div className="notice-box" role="status"><strong>Tutor application pending.</strong> An administrator is reviewing your latest application.</div>}
    {latestApplication?.status === 'approved' && <div className="success-box" role="status"><strong>Tutor application approved.</strong> Your Student role remains active alongside your Tutor role.</div>}
    <div className="dashboard-card"><div className="avatar" aria-hidden="true">{user?.name?.trim()?.charAt(0)?.toUpperCase() || 'L'}</div><div><span className="card-label">SIGNED IN AS</span><h2>{user?.name}</h2><p>{user?.email}</p></div><div className="role-list"><span className="card-label">YOUR ROLE{roles.length === 1 ? '' : 'S'}</span><div>{roles.length ? roles.map((role) => <span className="role-pill" key={role}>{role}</span>) : <span className="role-pill">Student</span>}</div></div></div>
    <div className="dashboard-links"><Link className="button" to="/profile">View or edit profile <span aria-hidden="true">↗</span></Link>{roles.includes('tutor') && <Link className="button button-outline" to="/tutor-profile">Tutor profile <span aria-hidden="true">↗</span></Link>}{isUnapprovedStudent && <Link className="button button-outline" to="/tutor-application">Become a Tutor <span aria-hidden="true">↗</span></Link>}{isAdmin && <><Link className="button button-outline" to="/admin/tutor-applications">Manage tutor applications <span aria-hidden="true">↗</span></Link><Link className="button button-outline" to="/admin/subjects">Manage Subjects <span aria-hidden="true">↗</span></Link></>}</div>
    <div className="coming-card"><span className="coming-icon">✳</span><div><span className="eyebrow">A FOUNDATION TO BUILD ON</span><h2>Your learning tools are on their way.</h2><p>Tutor discovery, bookings, and session management will arrive in future project phases.</p></div></div><Link className="text-link dashboard-home" to="/">Back to home <span aria-hidden="true">↗</span></Link>
  </section>;
}
