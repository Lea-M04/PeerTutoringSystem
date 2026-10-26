import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import BookingStatus from '../components/BookingStatus.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

const statuses = ['pending', 'accepted', 'rejected', 'cancelled', 'completed'];

export default function AdminBookingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);

  async function loadBookings(filters = {}) {
    const result = await api.adminBookings(filters);
    setBookings(result.data);
  }

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.adminBookings()
      .then((result) => { if (active) setBookings(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;
  if (loading) return <PageLoader label="Loading system bookings…" />;

  async function applyFilters(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loadBookings({ status, search });
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }

  return <section className="booking-page section-wrap">
    <Link className="text-link back-link" to="/">← Back to Home</Link>
    <span className="eyebrow">ADMINISTRATION</span><h1>Booking <em>management.</em></h1>
    <p className="profile-intro">Inspect bookings across the system. Booking lifecycle changes remain with the Student and Tutor workflows.</p>
    <form className="admin-booking-filters" onSubmit={applyFilters}>
      <label htmlFor="admin-booking-search">Search by Student, Tutor, or subject<input id="admin-booking-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label htmlFor="admin-booking-status">Booking status<select id="admin-booking-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      <button className="button" type="submit" disabled={loading}>Apply filters</button>
    </form>
    <FormErrors error={error} />
    {loading ? <p className="notice-box" role="status">Updating booking list…</p>
      : error && bookings.length === 0 ? <div className="booking-empty"><p>Bookings could not be loaded. Retry the request.</p><button className="button button-outline" type="button" onClick={() => { setLoading(true); loadBookings().catch(setError).finally(() => setLoading(false)); }}>Retry</button></div>
        : bookings.length === 0 ? <div className="booking-empty"><h2>No matching bookings</h2><p>Try another status or search term.</p></div>
          : <div className="booking-list">{bookings.map((booking) => <article className="booking-card" key={booking.id}>
            <div className="booking-card-heading"><div><span className="card-label">STUDENT</span><h2>{booking.student?.name || 'Student'}</h2></div><BookingStatus status={booking.status} /></div>
            <p className="profile-intro">Tutor: {booking.tutor?.name || 'Tutor'} · Subject: {booking.subject?.name || 'Subject not recorded'}</p>
            <dl className="booking-times"><div><dt>Starts</dt><dd>{formatLocalDateTime(booking.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatLocalDateTime(booking.ends_at)}</dd></div></dl>
            <Link className="text-link" to={`/admin/bookings/${booking.id}`}>Booking details ↗</Link>
          </article>)}</div>}
  </section>;
}
