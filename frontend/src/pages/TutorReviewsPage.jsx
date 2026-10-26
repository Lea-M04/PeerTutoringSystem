import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isApprovedTutor } from '../auth/roles.js';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import { formatLocalDateTime } from '../utils/dateTime.js';

export default function TutorReviewsPage() {
  const { user } = useAuth();
  const isTutor = isApprovedTutor(user);
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ average_rating: null, review_count: 0 });
  const [loading, setLoading] = useState(Boolean(isTutor));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isTutor) return undefined;
    let active = true;
    api.tutorReviews()
      .then((result) => {
        if (active) {
          setReviews(result.data);
          setMeta(result.meta || { average_rating: null, review_count: result.data.length });
        }
      })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isTutor]);

  if (!isTutor) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading your reviews…" />;

  return <section className="booking-page section-wrap tutor-reviews-page">
    <Link className="text-link back-link" to="/dashboard">← Back to dashboard</Link>
    <span className="eyebrow">STUDENT FEEDBACK</span><h1>Reviews <em>about you.</em></h1>
    {error ? <FormErrors error={error} /> : <>
      <section className="rating-overview" aria-label="Your review summary"><span>Average rating</span><strong>{meta.average_rating === null ? '—' : `★ ${Number(meta.average_rating).toFixed(2)}`}</strong><span>{meta.review_count} {meta.review_count === 1 ? 'review' : 'reviews'}</span></section>
      {reviews.length === 0 ? <div className="booking-empty"><h2>No reviews yet</h2><p>Feedback from students will appear here after completed sessions.</p></div>
        : <div className="review-list">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-card-heading"><strong>{review.reviewer?.name || 'Student'}</strong><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><p>{review.comment || 'No written comment provided.'}</p><time>{formatLocalDateTime(review.created_at)}</time></article>)}</div>}
    </>}
  </section>;
}
