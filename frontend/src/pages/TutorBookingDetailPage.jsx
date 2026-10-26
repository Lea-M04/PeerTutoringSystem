import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isApprovedTutor } from '../auth/roles.js';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import BookingStatus from '../components/BookingStatus.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

export default function TutorBookingDetailPage() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const isTutor = isApprovedTutor(user);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(isTutor));

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    api.tutorBooking(bookingId)
      .then((result) => { if (active) setBooking(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, isTutor]);

  if (!isTutor) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading booking details…" />;

  return <section className="booking-page section-wrap">
    <Link className="text-link back-link" to="/tutor-bookings">← Back to booking requests</Link>
    <span className="eyebrow">TUTOR BOOKING DETAILS</span><h1>Session <em>request.</em></h1>
    {error ? <div className="booking-empty"><FormErrors error={error} /></div> : booking && <article className="booking-card booking-detail-card">
      <div className="booking-card-heading"><div><span className="card-label">STUDENT</span><h2>{booking.student?.name || [booking.student?.first_name, booking.student?.last_name].filter(Boolean).join(' ') || 'Student'}</h2></div><BookingStatus status={booking.status} /></div>
      <dl className="booking-times"><div><dt>Starts</dt><dd>{formatLocalDateTime(booking.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatLocalDateTime(booking.ends_at)}</dd></div><div><dt>Requested</dt><dd>{formatLocalDateTime(booking.created_at)}</dd></div></dl>
      <p className="booking-subject"><strong>Subject:</strong> {booking.subject?.name || 'Subject not recorded'}</p>
    </article>}
  </section>;
}
