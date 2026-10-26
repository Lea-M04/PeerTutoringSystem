import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

export default function TutorDirectoryProfilePage() {
  const { tutorProfileId } = useParams();
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') || false;
  const [tutor, setTutor] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState(null);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(isStudent);
  const [loading, setLoading] = useState(isStudent);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingBusyId, setBookingBusyId] = useState(null);
  const [requestedAvailabilityIds, setRequestedAvailabilityIds] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    const loadAvailability = async () => {
      try {
        const result = await api.tutorDirectoryAvailability(tutorProfileId);
        if (active) {
          setAvailability(result.data);
          setAvailabilityError(null);
        }
      } catch (caught) {
        if (active) setAvailabilityError(caught);
      } finally {
        if (active) setAvailabilityLoading(false);
      }
    };

    api.tutorDirectoryProfile(tutorProfileId)
      .then((result) => { if (active) setTutor(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    void loadAvailability();
    const availabilityTimer = window.setInterval(() => { void loadAvailability(); }, 15_000);
    const clockTimer = window.setInterval(() => setCurrentTime(Date.now()), 15_000);
    const refreshOnFocus = () => { void loadAvailability(); };
    window.addEventListener('focus', refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(availabilityTimer);
      window.clearInterval(clockTimer);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [isStudent, tutorProfileId]);

  if (!isStudent) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading tutor profile…" />;

  const fullName = [tutor?.user?.first_name, tutor?.user?.last_name].filter(Boolean).join(' ') || tutor?.user?.name || 'Tutor';
  const futureAvailability = availability.filter((item) => new Date(item.starts_at).getTime() > currentTime
    && new Date(item.ends_at).getTime() > currentTime
    && !requestedAvailabilityIds.includes(item.id))
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());

  async function requestBooking(availabilityId) {
    if (!selectedOfferingId) {
      setBookingError({ message: 'Choose a subject before requesting a booking.', errors: {} });
      return;
    }
    setBookingBusyId(availabilityId);
    setBookingError(null);
    setBookingSuccess('');
    try {
      const result = await api.createBooking(availabilityId, Number(selectedOfferingId));
      setRequestedAvailabilityIds((current) => [...current, availabilityId]);
      setAvailability((current) => current.filter((item) => item.id !== availabilityId));
      setBookingSuccess(`Booking request submitted. Current status: ${result.data.status}.`);
    } catch (caught) {
      setBookingError(caught);
    } finally {
      setBookingBusyId(null);
    }
  }

  return <section className="directory-page section-wrap">
    <Link className="text-link back-link" to="/tutors"><span aria-hidden="true">←</span> Back to tutors</Link>
    {error ? <div className="directory-empty">{error.status === 404
      ? <p className="error-box" role="alert">This tutor profile is not available in the directory.</p>
      : <FormErrors error={error} />}<Link className="button button-outline" to="/tutors">Return to tutor directory</Link></div> : tutor && <>
      <span className="eyebrow">APPROVED PEER TUTOR</span><h1>{fullName} <em>profile.</em></h1>
      <p className="rating-summary" aria-label={tutor.review_count ? `Average rating ${tutor.average_rating} out of 5 from ${tutor.review_count} reviews` : 'No reviews yet'}>{tutor.review_count ? `★ ${Number(tutor.average_rating).toFixed(1)} · ${tutor.review_count} ${tutor.review_count === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</p>
      <section className="tutor-profile-overview"><div><span className="card-label">UNIVERSITY OR FACULTY</span><p>{tutor.user?.faculty_or_university || 'Not provided'}</p></div><div><span className="card-label">STUDY PROGRAM</span><p>{tutor.user?.study_program || 'Not provided'}</p></div><div><span className="card-label">YEAR OF STUDY</span><p>{tutor.user?.year_of_study ?? 'Not provided'}</p></div></section>
      <section className="profile-panel directory-profile-section"><h2>About this tutor</h2><p className="profile-biography">{tutor.biography || 'This tutor has not added a biography yet.'}</p></section>
      <section className="directory-profile-section"><span className="eyebrow">CURRENTLY AVAILABLE SUBJECTS</span><h2>Teaching subjects</h2><div className="directory-offerings">{tutor.offerings.map((offering) => <article className="directory-offering-card" key={offering.id}><h3>{offering.subject.name}</h3><p>{offering.description || 'Teaching focus not provided.'}</p></article>)}</div></section>
      <section className="directory-profile-section" aria-labelledby="tutor-reviews-heading"><span className="eyebrow">STUDENT FEEDBACK</span><h2 id="tutor-reviews-heading">Reviews</h2>{tutor.reviews?.length ? <div className="review-list">{tutor.reviews.map((review) => <article className="review-card" key={review.id}><div className="review-card-heading"><strong>{review.reviewer?.name || 'Student'}</strong><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><p>{review.comment || 'No written comment provided.'}</p><time>{formatLocalDateTime(review.created_at)}</time></article>)}</div> : <p className="empty-state">No reviews yet.</p>}</section>
      <section className="directory-profile-section" aria-labelledby="tutor-availability-heading"><span className="eyebrow">FUTURE OPEN TIMES</span><h2 id="tutor-availability-heading">Availability</h2>
        {tutor.offerings.length > 0 && <div className="field-group"><label className="field-label" htmlFor="booking-subject">Choose a subject for your booking</label><select id="booking-subject" value={selectedOfferingId} onChange={(event) => setSelectedOfferingId(event.target.value)}><option value="">Select an offered subject</option>{tutor.offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.subject.name}</option>)}</select>{selectedOfferingId && <p className="field-help">Selected subject: {tutor.offerings.find((offering) => String(offering.id) === selectedOfferingId)?.subject.name}</p>}</div>}
        {bookingSuccess && <p className="success-box" role="status">{bookingSuccess} <Link to="/bookings">View my bookings</Link></p>}
        <FormErrors error={bookingError} />
        {availabilityLoading ? <p className="notice-box" role="status">Loading future availability…</p>
          : availabilityError ? <p className="error-box" role="alert">Future availability could not be loaded right now.</p>
            : futureAvailability.length === 0 ? <p className="empty-state">This tutor has no future availability listed yet.</p>
              : <div className="directory-availability-list">{futureAvailability.map((item) => <article className="directory-availability-card" key={item.id}><div><span className="card-label">AVAILABLE FROM</span><p>{formatLocalDateTime(item.starts_at)}</p></div><div><span className="card-label">UNTIL</span><p>{formatLocalDateTime(item.ends_at)}</p></div><button className="button button-small" type="button" disabled={!selectedOfferingId || bookingBusyId === item.id || requestedAvailabilityIds.includes(item.id)} onClick={() => requestBooking(item.id)}>{bookingBusyId === item.id ? 'Requesting…' : requestedAvailabilityIds.includes(item.id) ? 'Request sent' : 'Request booking'}</button></article>)}</div>}
      </section>
    </>}
  </section>;
}
