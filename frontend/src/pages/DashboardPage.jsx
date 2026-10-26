import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isAdminUser, isApprovedTutor, isStudentUser } from '../auth/roles.js';
import { formatLocalDateTime } from '../utils/dateTime.js';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

const bookingStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];

export default function DashboardPage() {
  const { user } = useAuth();
  const location = useLocation();
  const roles = user?.roles || [];
  const isStudent = isStudentUser(user);
  const isTutor = isApprovedTutor(user);
  const isAdmin = isAdminUser(user);
  const [latestApplication, setLatestApplication] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(isStudent);
  const [applicationError, setApplicationError] = useState(null);
  const [profile, setProfile] = useState(user);
  const [profileError, setProfileError] = useState(false);
  const [studentBookings, setStudentBookings] = useState([]);
  const [studentBookingsLoading, setStudentBookingsLoading] = useState(isStudent);
  const [studentBookingsError, setStudentBookingsError] = useState(null);
  const [tutorBookings, setTutorBookings] = useState([]);
  const [tutorBookingsLoading, setTutorBookingsLoading] = useState(isTutor);
  const [tutorBookingsError, setTutorBookingsError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(isAdmin);
  const [overviewError, setOverviewError] = useState(null);

  useEffect(() => {
    let active = true;
    api.currentUser()
      .then((result) => { if (active) setProfile(result.data); })
      .catch(() => { if (active) setProfileError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    api.tutorApplications()
      .then((result) => { if (active) setLatestApplication(result.data[0] || null); })
      .catch(setApplicationError)
      .finally(() => { if (active) setApplicationLoading(false); });
    api.studentBookings()
      .then((result) => { if (active) setStudentBookings(result.data); })
      .catch(setStudentBookingsError)
      .finally(() => { if (active) setStudentBookingsLoading(false); });
    return () => { active = false; };
  }, [isStudent]);

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    api.tutorBookings()
      .then((result) => { if (active) setTutorBookings(result.data); })
      .catch(setTutorBookingsError)
      .finally(() => { if (active) setTutorBookingsLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.adminOverview()
      .then((result) => { if (active) setOverview(result.data); })
      .catch(setOverviewError)
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  const upcomingBookings = useMemo(() => studentBookings
    .filter((booking) => booking.status === 'accepted' && new Date(booking.ends_at).getTime() > Date.now())
    .sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at)), [studentBookings]);
  const pendingStudentBookings = studentBookings.filter((booking) => booking.status === 'pending').length;
  const pendingTutorBookings = tutorBookings.filter((booking) => booking.status === 'pending').length;

  return <section className="dashboard section-wrap">
    {location.state?.notice && <p className="success-box" role="status">{location.state.notice}</p>}
    <span className="eyebrow">{isAdmin ? 'SYSTEM OVERVIEW' : 'YOUR PEER LEARNING SPACE'}</span>
    <h1>{isAdmin ? <>Admin <em>Home.</em></> : <>Welcome, <em>{profile?.first_name || profile?.name?.split(' ')[0] || 'learner'}.</em></>}</h1>
    <p className="dashboard-lede">{isAdmin ? 'Manage the people, learning catalogue, and activity in Peerwise.' : 'Your starting point for peer learning, tutoring, and sessions.'}</p>

    <div className="dashboard-card"><div className="avatar" aria-hidden="true">{profile?.name?.trim()?.charAt(0)?.toUpperCase() || 'P'}</div><div><span className="card-label">SIGNED IN AS</span><h2>{profile?.name || 'Account'}</h2><p>{profile?.email}</p></div><div className="role-list"><span className="card-label">YOUR ROLE{roles.length === 1 ? '' : 'S'}</span><div>{roles.map((role) => <span className="role-pill" key={role}>{role}</span>)}</div></div></div>
    {profileError && <p className="error-box" role="alert">Your saved profile information could not be refreshed. Visit My Profile to retry.</p>}

    {isStudent && <section className="home-role-section" aria-labelledby="home-student-heading">
      <span className="eyebrow">STUDENT SPACE</span><h2 id="home-student-heading">Learn with a peer</h2>
      <p>Find approved tutors, request a session for an available time, and keep track of your bookings.</p>
      <div className="dashboard-links"><Link className="button" to="/tutors">Find Tutors <span aria-hidden="true">↗</span></Link><Link className="button button-outline" to="/bookings">My Bookings <span aria-hidden="true">↗</span></Link></div>
      {studentBookingsLoading ? <p className="notice-box" role="status">Loading your booking overview…</p>
        : studentBookingsError ? <FormErrors error={studentBookingsError} />
          : studentBookings.length === 0 ? <p className="empty-state">You have no bookings yet. Find a tutor to get started.</p>
            : <>
              <div className="home-overview-grid"><article className="overview-card"><span>Pending requests</span><strong>{pendingStudentBookings}</strong></article><article className="overview-card"><span>Accepted upcoming sessions</span><strong>{upcomingBookings.length}</strong></article><article className="overview-card"><span>Total booking history</span><strong>{studentBookings.length}</strong></article></div>
              {upcomingBookings[0] && <p className="home-next-session"><strong>Next session:</strong> {upcomingBookings[0].tutor?.name || 'Tutor'} · {upcomingBookings[0].subject?.name || 'Subject not recorded'} · {formatLocalDateTime(upcomingBookings[0].starts_at)}</p>}
            </>}
      {applicationLoading && <p className="notice-box" role="status">Checking your tutor application status…</p>}
      {applicationError && <FormErrors error={applicationError} />}
      {latestApplication?.status === 'rejected' && <div className="application-dashboard-alert" role="status"><span className="eyebrow">TUTOR APPLICATION UPDATE</span><h2>Your tutor application was rejected.</h2><p><strong>Administrator feedback:</strong> {latestApplication.rejection_reason || 'No reason was recorded.'}</p><Link className="button" to="/tutor-application">View and reapply <span aria-hidden="true">↗</span></Link></div>}
      {latestApplication?.status === 'pending' && <p className="notice-box" role="status"><strong>Tutor application pending.</strong> An administrator is reviewing your latest application.</p>}
      {isStudent && !isTutor && <Link className="text-link" to="/tutor-application">Become a Tutor <span aria-hidden="true">↗</span></Link>}
    </section>}

    {isTutor && <section className="home-role-section" aria-labelledby="home-tutor-heading">
      <span className="eyebrow">TUTOR SPACE</span><h2 id="home-tutor-heading">Support your peers</h2>
      <p>Your account keeps its Student access while providing approved Tutor tools.</p>
      <div className="dashboard-links"><Link className="button" to="/tutor-bookings">Booking Requests <span aria-hidden="true">↗</span></Link><Link className="button button-outline" to="/tutor-offerings">My Subjects / Offerings <span aria-hidden="true">↗</span></Link><Link className="button button-outline" to="/tutor-availability">My Availability <span aria-hidden="true">↗</span></Link><Link className="button button-outline" to="/tutor-reviews">Reviews About Me <span aria-hidden="true">↗</span></Link></div>
      {tutorBookingsLoading ? <p className="notice-box" role="status">Loading incoming booking overview…</p>
        : tutorBookingsError ? <FormErrors error={tutorBookingsError} />
          : <div className="home-overview-grid"><article className="overview-card"><span>Pending requests</span><strong>{pendingTutorBookings}</strong></article><article className="overview-card"><span>Accepted sessions</span><strong>{tutorBookings.filter((booking) => booking.status === 'accepted').length}</strong></article><article className="overview-card"><span>Total booking history</span><strong>{tutorBookings.length}</strong></article></div>}
    </section>}

    {isAdmin && <section className="home-role-section" aria-labelledby="home-admin-heading">
      <span className="eyebrow">ADMINISTRATION</span><h2 id="home-admin-heading">System management</h2>
      <div className="dashboard-links"><Link className="button" to="/admin/users">User Management</Link><Link className="button button-outline" to="/admin/tutor-applications">Tutor Applications</Link><Link className="button button-outline" to="/admin/subjects">Subject Management</Link><Link className="button button-outline" to="/admin/tutor-offerings">Tutor Offering Management</Link><Link className="button button-outline" to="/admin/bookings">Booking Management</Link></div>
      {overviewLoading ? <p className="notice-box" role="status">Loading system overview…</p>
        : overviewError ? <FormErrors error={overviewError} />
          : overview && <div className="admin-overview-grid"><article className="overview-card"><span>Total users</span><strong>{overview.users.total}</strong></article><article className="overview-card"><span>Active users</span><strong>{overview.users.active}</strong></article><article className="overview-card"><span>Approved tutors</span><strong>{overview.tutors}</strong></article><article className="overview-card"><span>Pending tutor applications</span><strong>{overview.pending_tutor_applications}</strong></article><article className="overview-card"><span>Active subjects</span><strong>{overview.active_subjects}</strong></article>{bookingStatuses.map((status) => <article className="overview-card" key={status}><span>{status} bookings</span><strong>{overview.bookings[status]}</strong></article>)}</div>}
    </section>}

    <section className="dashboard-profile-card" aria-labelledby="dashboard-profile-heading"><div className="dashboard-profile-heading"><div><span className="eyebrow">YOUR SAVED DETAILS</span><h2 id="dashboard-profile-heading">Profile at a glance</h2></div><Link className="text-link" to="/profile">My Profile <span aria-hidden="true">↗</span></Link></div><dl className="dashboard-profile-details"><div><dt>Full name</dt><dd>{profile?.name || 'Not provided'}</dd></div><div><dt>University or faculty</dt><dd>{profile?.faculty_or_university || 'Not provided'}</dd></div><div><dt>Study program</dt><dd>{profile?.study_program || 'Not provided'}</dd></div><div><dt>Year of study</dt><dd>{profile?.year_of_study ?? 'Not provided'}</dd></div><div className="dashboard-bio"><dt>About me</dt><dd>{profile?.biography || 'Not provided'}</dd></div></dl></section>
  </section>;
}
