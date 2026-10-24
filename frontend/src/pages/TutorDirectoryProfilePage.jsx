import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

export default function TutorDirectoryProfilePage() {
  const { tutorProfileId } = useParams();
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') || false;
  const [tutor, setTutor] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(isStudent);

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    api.tutorDirectoryProfile(tutorProfileId)
      .then((result) => { if (active) setTutor(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isStudent, tutorProfileId]);

  if (!isStudent) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading tutor profile…" />;

  const fullName = [tutor?.user?.first_name, tutor?.user?.last_name].filter(Boolean).join(' ') || tutor?.user?.name || 'Tutor';

  return <section className="directory-page section-wrap">
    <Link className="text-link back-link" to="/tutors"><span aria-hidden="true">←</span> Back to tutors</Link>
    {error ? <div className="directory-empty">{error.status === 404
      ? <p className="error-box" role="alert">This tutor profile is not available in the directory.</p>
      : <FormErrors error={error} />}<Link className="button button-outline" to="/tutors">Return to tutor directory</Link></div> : tutor && <>
      <span className="eyebrow">APPROVED PEER TUTOR</span><h1>{fullName} <em>profile.</em></h1>
      <section className="tutor-profile-overview"><div><span className="card-label">UNIVERSITY OR FACULTY</span><p>{tutor.user?.faculty_or_university || 'Not provided'}</p></div><div><span className="card-label">STUDY PROGRAM</span><p>{tutor.user?.study_program || 'Not provided'}</p></div><div><span className="card-label">YEAR OF STUDY</span><p>{tutor.user?.year_of_study ?? 'Not provided'}</p></div></section>
      <section className="profile-panel directory-profile-section"><h2>About this tutor</h2><p className="profile-biography">{tutor.biography || 'This tutor has not added a biography yet.'}</p></section>
      <section className="directory-profile-section"><span className="eyebrow">CURRENTLY AVAILABLE SUBJECTS</span><h2>Teaching subjects</h2><div className="directory-offerings">{tutor.offerings.map((offering) => <article className="directory-offering-card" key={offering.id}><h3>{offering.subject.name}</h3><p>{offering.description || 'Teaching focus not provided.'}</p></article>)}</div></section>
    </>}
  </section>;
}
