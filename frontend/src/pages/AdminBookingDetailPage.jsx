import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import BookingStatus from '../components/BookingStatus.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

export default function AdminBookingDetailPage() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.adminBooking(bookingId)
      .then((result) => { if (active) setBooking(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, bookingId]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (loading) return <PageLoader label="Loading booking details…" />;

  return <section className="booking-page section-wrap">
    <Link className="text-link back-link" to="/admin/bookings">← Back to Booking Management</Link>
    {error ? <div className="booking-empty"><FormErrors error={error} /><Link className="button button-outline" to="/admin/bookings">Return to bookings</Link></div>
      : booking && <>
        <span className="eyebrow">ADMIN BOOKING DETAILS</span><h1>Session <em>record.</em></h1>
        <article className="booking-card booking-detail-card">
          <div className="booking-card-heading"><h2>Booking #{booking.id}</h2><BookingStatus status={booking.status} /></div>
          <dl className="booking-times"><div><dt>Student</dt><dd>{booking.student?.name || 'Student'}</dd></div><div><dt>Tutor</dt><dd>{booking.tutor?.name || 'Tutor'}</dd></div><div><dt>Subject</dt><dd>{booking.subject?.name || 'Subject not recorded'}</dd></div><div><dt>Starts</dt><dd>{formatLocalDateTime(booking.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatLocalDateTime(booking.ends_at)}</dd></div><div><dt>Created</dt><dd>{booking.created_at ? formatLocalDateTime(booking.created_at) : 'Not available'}</dd></div></dl>
        </article>
        <p className="field-help">This page is read-only. The existing Student/Tutor workflow owns booking status transitions.</p>
      </>}
  </section>;
}
