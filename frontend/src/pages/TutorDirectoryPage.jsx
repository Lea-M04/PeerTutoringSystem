import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

function tutorName(tutor) {
  return [tutor.user?.first_name, tutor.user?.last_name].filter(Boolean).join(' ') || tutor.user?.name || 'Tutor';
}

export default function TutorDirectoryPage() {
  const { user } = useAuth();
  const isStudent = user?.roles?.includes('student') || false;
  const [tutors, setTutors] = useState([]);
  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(isStudent);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isStudent) return undefined;
    let active = true;
    api.tutorDirectory()
      .then((result) => { if (active) setTutors(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isStudent]);

  const subjects = useMemo(() => {
    const uniqueSubjects = new Map();
    tutors.forEach((tutor) => tutor.offerings.forEach((offering) => uniqueSubjects.set(String(offering.subject.id), offering.subject.name)));
    return [...uniqueSubjects.entries()].map(([id, name]) => ({ id, name })).sort((left, right) => left.name.localeCompare(right.name));
  }, [tutors]);

  const filteredTutors = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return tutors.filter((tutor) => {
      const offerings = tutor.offerings || [];
      const matchesSubject = !subjectId || offerings.some((offering) => String(offering.subject.id) === subjectId);
      const searchableText = [
        tutorName(tutor),
        tutor.user?.faculty_or_university,
        tutor.user?.study_program,
        ...offerings.flatMap((offering) => [offering.subject?.name, offering.description]),
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return matchesSubject && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [tutors, query, subjectId]);

  if (!isStudent) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Finding tutors…" />;

  function clearFilters() {
    setQuery('');
    setSubjectId('');
  }

  return <section className="directory-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">LEARN TOGETHER</span><h1>Find a <em>tutor.</em></h1>
    <p className="profile-intro">Explore approved peer tutors and the subjects they currently offer.</p>
    <FormErrors error={error} />
    {!error && <>
      <section className="directory-filters" aria-label="Tutor search and filters">
        <div className="directory-search"><label className="field-label" htmlFor="tutor-search">Search by tutor or subject</label><input id="tutor-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, subject, or teaching focus" /></div>
        <div className="directory-filter"><label className="field-label" htmlFor="tutor-subject-filter">Filter by subject</label><select id="tutor-subject-filter" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
        <button className="button button-outline directory-clear" type="button" onClick={clearFilters} disabled={!query && !subjectId}>Clear filters</button>
      </section>
      {tutors.length === 0 ? <div className="directory-empty"><span className="directory-empty-icon" aria-hidden="true">✳</span><h2>No tutors are listed yet</h2><p>Approved tutors with active subject offerings will appear here.</p></div> : filteredTutors.length === 0 ? <div className="directory-empty"><h2>No tutors match these filters</h2><p>Try another name or subject, or clear your current filters.</p><button className="button button-outline" type="button" onClick={clearFilters}>Clear search and filters</button></div> : <>
        <p className="directory-result-count" role="status">{filteredTutors.length} {filteredTutors.length === 1 ? 'tutor' : 'tutors'} found</p>
        <div className="tutor-directory-grid">{filteredTutors.map((tutor) => <article className="tutor-directory-card" key={tutor.id}>
          <div className="tutor-card-top"><span className="tutor-avatar" aria-hidden="true">{tutorName(tutor).charAt(0).toUpperCase()}</span><div><h2>{tutorName(tutor)}</h2><p>{tutor.user?.faculty_or_university || 'University or faculty not provided'}</p></div></div>
          <dl className="tutor-academic-details"><div><dt>Study program</dt><dd>{tutor.user?.study_program || 'Not provided'}</dd></div><div><dt>Year of study</dt><dd>{tutor.user?.year_of_study ?? 'Not provided'}</dd></div></dl>
          <p className="tutor-bio-preview">{tutor.biography || 'This tutor has not added a biography yet.'}</p>
          <div className="tutor-subject-list"><span className="card-label">SUBJECTS OFFERED</span><div>{tutor.offerings.map((offering) => <span className="subject-chip" key={offering.id}>{offering.subject.name}</span>)}</div></div>
          {tutor.offerings.some((offering) => offering.description) && <div className="tutor-focus-list"><span className="card-label">TEACHING FOCUS</span>{tutor.offerings.filter((offering) => offering.description).map((offering) => <p key={offering.id}><strong>{offering.subject.name}:</strong> {offering.description}</p>)}</div>}
          <Link className="button tutor-card-link" to={`/tutors/${tutor.id}`}>View tutor profile <span aria-hidden="true">↗</span></Link>
        </article>)}</div>
      </>}
    </>}
  </section>;
}
