import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import BookingStatus from '../components/BookingStatus.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

const reservingStatuses = ['pending', 'accepted'];
const bookingCategories = [
  ['accepted', 'Upcoming / Accepted'],
  ['pending', 'Pending'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Cancelled'],
  ['completed', 'Completed'],
];

function canCancel(booking) {
  return reservingStatuses.includes(booking.status)
    && new Date(booking.starts_at).getTime() - Date.now() >= 12 * 60 * 60 * 1000;
}

export default function StudentBookingsPage() {
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') && !user?.roles?.includes('admin');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(Boolean(isStudent));
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('accepted');

  const load = useCallback(async () => {
    const result = await api.studentBookings();
    setBookings(result.data);
  }, []);

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    api.studentBookings()
      .then((result) => { if (active) setBookings(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isStudent]);

  if (!isStudent) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading your bookings…" />;

  const visibleBookings = bookings.filter((booking) => booking.status === activeStatus);

  async function cancel(booking) {
    setBusyId(booking.id);
    setActionError(null);
    setSuccess('');
    try {
      const result = await api.cancelBooking(booking.id);
      setBookings((current) => current.map((item) => item.id === booking.id ? result.data : item));
      setSuccess('Your booking was cancelled.');
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusyId(null);
    }
  }

  return <section className="booking-page section-wrap">
    <Link className="text-link back-link" to="/">← Back to Home</Link>
    <span className="eyebrow">YOUR LEARNING SCHEDULE</span><h1>My <em>bookings.</em></h1>
    {success && <p className="success-box" role="status">{success}</p>}
    <FormErrors error={actionError} />
    {error ? <div className="booking-empty"><FormErrors error={error} /><button className="button button-outline" type="button" onClick={() => { setLoading(true); load().then(() => setError(null)).catch(setError).finally(() => setLoading(false)); }}>Try again</button></div>
      : bookings.length === 0 ? <div className="booking-empty"><h2>No bookings yet</h2><p>Find a tutor and request one of their future availability intervals.</p><Link className="button" to="/tutors">Find Tutors <span aria-hidden="true">↗</span></Link></div>
        : <>
          <div className="booking-tabs" role="tablist" aria-label="Filter student bookings">{bookingCategories.map(([status, label]) => <button className="booking-tab" id={`student-booking-tab-${status}`} type="button" role="tab" aria-selected={activeStatus === status} aria-controls="student-booking-panel" key={status} onClick={() => setActiveStatus(status)}>{label}<span className="booking-tab-count">{bookings.filter((booking) => booking.status === status).length}</span></button>)}</div>
          <div id="student-booking-panel" role="tabpanel" aria-labelledby={`student-booking-tab-${activeStatus}`}>
          {visibleBookings.length === 0 ? <div className="booking-empty"><h2>No {bookingCategories.find(([status]) => status === activeStatus)?.[1].toLocaleLowerCase()}.</h2><p>Bookings with this status will appear here.</p>{activeStatus === 'accepted' && <Link className="button button-outline" to="/tutors">Find Tutors</Link>}</div>
            : <div className="booking-list">{visibleBookings.map((booking) => <article className="booking-card" key={booking.id}>
          <div className="booking-card-heading"><div><span className="card-label">TUTOR</span><h2>{booking.tutor?.name || [booking.tutor?.first_name, booking.tutor?.last_name].filter(Boolean).join(' ') || 'Tutor'}</h2></div><BookingStatus status={booking.status} /></div>
          <dl className="booking-times"><div><dt>Starts</dt><dd>{formatLocalDateTime(booking.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatLocalDateTime(booking.ends_at)}</dd></div></dl>
          <p className="booking-subject"><strong>Subject:</strong> {booking.subject?.name || 'Subject not recorded'}</p>
          {booking.status === 'accepted' && new Date(booking.ends_at).getTime() <= Date.now() && <p className="booking-session-note">The session time has passed. Its status remains Accepted until the Tutor marks it completed.</p>}
          <div className="booking-actions"><Link className="text-link" to={`/bookings/${booking.id}`}>{booking.status === 'completed' && !booking.review ? 'Leave a review' : booking.review ? 'View your review' : 'Booking details'} <span aria-hidden="true">↗</span></Link>{canCancel(booking) && <button className="button button-danger" type="button" disabled={busyId === booking.id} onClick={() => cancel(booking)}>{busyId === booking.id ? 'Cancelling…' : 'Cancel booking'}</button>}{reservingStatuses.includes(booking.status) && !canCancel(booking) && <p className="booking-note">Cancellation is available at least 12 hours before the start time. The API confirms eligibility.</p>}</div>
        </article>)}</div>}
          </div>
        </>}
  </section>;
}
