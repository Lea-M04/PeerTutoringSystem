import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import BookingStatus from '../components/BookingStatus.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

export default function StudentBookingDetailPage() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') && !user?.roles?.includes('admin');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(isStudent));
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState('');

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    api.studentBooking(bookingId)
      .then((result) => { if (active) setBooking(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, isStudent]);

  if (!isStudent) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading booking details…" />;

  async function submitReview(event) {
    event.preventDefault();
    if (rating < 1 || rating > 5) {
      setReviewError({ message: 'Choose a rating from 1 to 5 stars.', errors: { rating: ['Choose a rating from 1 to 5 stars.'] } });
      return;
    }
    setSaving(true);
    setReviewError(null);
    setReviewSuccess('');
    try {
      const result = await api.submitBookingReview(bookingId, { rating, comment: comment.trim() || null });
      setBooking(result.data);
      setReviewSuccess('Your review was submitted.');
    } catch (caught) {
      setReviewError(caught);
    } finally {
      setSaving(false);
    }
  }
  return <section className="booking-page section-wrap">
    <Link className="text-link back-link" to="/bookings">← Back to my bookings</Link>
    <span className="eyebrow">BOOKING DETAILS</span><h1>Your <em>session.</em></h1>
    {error ? <FormErrors error={error} /> : booking && <article className="booking-card booking-detail-card">
      <div className="booking-card-heading"><div><span className="card-label">TUTOR</span><h2>{booking.tutor?.name || [booking.tutor?.first_name, booking.tutor?.last_name].filter(Boolean).join(' ') || 'Tutor'}</h2></div><BookingStatus status={booking.status} /></div>
      <dl className="booking-times"><div><dt>Starts</dt><dd>{formatLocalDateTime(booking.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatLocalDateTime(booking.ends_at)}</dd></div><div><dt>Requested</dt><dd>{formatLocalDateTime(booking.created_at)}</dd></div></dl>
      <p className="booking-subject"><strong>Subject:</strong> {booking.subject?.name || 'Subject not recorded'}</p>
      <section className="booking-review-section" aria-labelledby="booking-review-heading">
        <h2 id="booking-review-heading">Your review</h2>
        {reviewSuccess && <p className="success-box" role="status">{reviewSuccess}</p>}
        {booking.review ? <div className="review-card"><p className="review-stars" aria-label={`${booking.review.rating} out of 5 stars`}>{'★'.repeat(booking.review.rating)}{'☆'.repeat(5 - booking.review.rating)}</p><p>{booking.review.comment || 'No written comment provided.'}</p><time>{formatLocalDateTime(booking.review.created_at)}</time></div>
          : booking.status === 'completed' ? <form className="review-form" onSubmit={submitReview}>
            <FormErrors error={reviewError} />
            <fieldset className="rating-picker"><legend>Rate this tutoring session</legend><div role="radiogroup" aria-label="Rating from 1 to 5 stars">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={rating >= value ? 'selected' : ''}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} />{rating >= value ? '★' : '☆'}</label>)}</div></fieldset>
            <label className="field-label" htmlFor="review-comment">Written review (optional)</label><textarea id="review-comment" maxLength="1000" rows="4" value={comment} onChange={(event) => setComment(event.target.value)} /><span className="field-help">{comment.length}/1000 characters</span>
            <p className="field-help">Each completed session can be reviewed once. Submitted reviews cannot be edited.</p>
            <button className="button" type="submit" disabled={saving || rating === 0}>{saving ? 'Submitting…' : 'Submit review'}</button>
          </form> : <p className="empty-state">A review can be submitted after the tutor marks this session completed.</p>}
      </section>
    </article>}
  </section>;
}
