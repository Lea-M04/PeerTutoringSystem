import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isApprovedTutor } from '../auth/roles.js';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import BookingStatus from '../components/BookingStatus.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

const bookingCategories = [
  ['pending', 'Pending / New Requests'],
  ['accepted', 'Accepted'],
  ['rejected', 'Rejected'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

export default function TutorBookingsPage() {
  const { user } = useAuth();
  const isTutor = isApprovedTutor(user);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(Boolean(isTutor));
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeStatus, setActiveStatus] = useState('pending');

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    api.tutorBookings()
      .then((result) => { if (active) setBookings(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  if (!isTutor) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading booking requests…" />;

  async function review(booking, action) {
    setBusyId(booking.id);
    setActionError(null);
    setSuccess('');
    try {
      const result = action === 'accept' ? await api.acceptBooking(booking.id) : await api.rejectBooking(booking.id);
      setBookings((current) => current.map((item) => item.id === booking.id ? result.data : item));
      setSuccess(action === 'accept' ? 'Booking request accepted.' : 'Booking request rejected.');
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusyId(null);
    }
  }

  async function complete(booking) {
    setBusyId(booking.id);
    setActionError(null);
    setSuccess('');
    try {
      const result = await api.completeBooking(booking.id);
      setBookings((current) => current.map((item) => item.id === booking.id ? result.data : item));
      setSuccess('Tutoring session marked as completed.');
    } catch (caught) {
      setActionError(caught);
    } finally {
      setBusyId(null);
    }
  }

  function canComplete(booking) {
    return booking.status === 'accepted'
      && Number.isFinite(new Date(booking.ends_at).getTime())
      && new Date(booking.ends_at).getTime() <= currentTime;
  }

  const visibleBookings = bookings.filter((booking) => booking.status === activeStatus);

  return <section className="booking-page section-wrap">
    <Link className="text-link back-link" to="/">← Back to Home</Link>
    <span className="eyebrow">TUTOR SCHEDULE</span><h1>Booking <em>requests.</em></h1>
    <p className="profile-intro">Accepted sessions can be marked completed after their scheduled end time.</p>
    {success && <p className="success-box" role="status">{success}</p>}
    <FormErrors error={actionError} />
    {error ? <div className="booking-empty"><FormErrors error={error} /><button className="button button-outline" type="button" onClick={() => { setLoading(true); api.tutorBookings().then((result) => { setBookings(result.data); setError(null); }).catch(setError).finally(() => setLoading(false)); }}>Try again</button></div>
      : bookings.length === 0 ? <div className="booking-empty"><h2>No booking requests yet</h2><p>New requests for your available intervals will appear here.</p><Link className="button button-outline" to="/tutor-availability">Manage Availability</Link></div>
        : <>
          <div className="booking-tabs" role="tablist" aria-label="Filter tutor bookings">{bookingCategories.map(([status, label]) => <button className="booking-tab" id={`tutor-booking-tab-${status}`} type="button" role="tab" aria-selected={activeStatus === status} aria-controls="tutor-booking-panel" key={status} onClick={() => setActiveStatus(status)}>{label}<span className="booking-tab-count">{bookings.filter((booking) => booking.status === status).length}</span></button>)}</div>
          <div id="tutor-booking-panel" role="tabpanel" aria-labelledby={`tutor-booking-tab-${activeStatus}`}>
          {visibleBookings.length === 0 ? <div className="booking-empty"><h2>No {bookingCategories.find(([status]) => status === activeStatus)?.[1].toLocaleLowerCase()}.</h2><p>Bookings with this status will appear here.</p></div>
            : <div className="booking-list">{visibleBookings.map((booking) => <article className="booking-card" key={booking.id}>
          <div className="booking-card-heading"><div><span className="card-label">STUDENT</span><h2>{booking.student?.name || [booking.student?.first_name, booking.student?.last_name].filter(Boolean).join(' ') || 'Student'}</h2></div><BookingStatus status={booking.status} /></div>
          <dl className="booking-times"><div><dt>Starts</dt><dd>{formatLocalDateTime(booking.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatLocalDateTime(booking.ends_at)}</dd></div></dl>
          <p className="booking-subject"><strong>Subject:</strong> {booking.subject?.name || 'Subject not recorded'}</p>
          <Link className="text-link" to={`/tutor-bookings/${booking.id}`}>Booking details <span aria-hidden="true">↗</span></Link>
          {booking.status === 'pending' && <div className="booking-actions"><button className="button" type="button" disabled={busyId === booking.id} onClick={() => review(booking, 'accept')}>{busyId === booking.id ? 'Saving…' : 'Accept request'}</button><button className="button button-danger" type="button" disabled={busyId === booking.id} onClick={() => review(booking, 'reject')}>Reject request</button></div>}
          {canComplete(booking) && <div className="booking-actions"><button className="button" type="button" disabled={busyId === booking.id} onClick={() => complete(booking)}>{busyId === booking.id ? 'Saving…' : 'Mark as Completed'}</button></div>}
        </article>)}</div>}
          </div>
        </>}
  </section>;
}
