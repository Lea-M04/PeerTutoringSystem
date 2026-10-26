import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { isAdminUser, isApprovedTutor, isStudentUser } from '../auth/roles.js';
import { FormErrors } from '../components/SiteLayout.jsx';

const steps = [
  { number: '01', title: 'Find a tutor and subject', text: 'Explore approved peer tutors and choose a subject they currently offer.' },
  { number: '02', title: 'Choose a time', text: 'Review the tutor’s future availability and select an open interval.' },
  { number: '03', title: 'Request a session', text: 'Send a booking request and follow its status from My Bookings.' },
  { number: '04', title: 'Learn, then reflect', text: 'After the session, a tutor can mark it completed. Eligible students can then leave a review.' },
];

function tutorName(tutor) {
  return [tutor.user?.first_name, tutor.user?.last_name].filter(Boolean).join(' ') || tutor.user?.name || 'Peer tutor';
}

export default function LandingPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isStudent = isStudentUser(user);
  const isTutor = isApprovedTutor(user);
  const isAdmin = isAdminUser(user);
  const [tutors, setTutors] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(Boolean(user));
  const [discoveryError, setDiscoveryError] = useState(null);
  const [application, setApplication] = useState(null);
  const [applicationLoading, setApplicationLoading] = useState(isStudent && !isTutor);
  const [applicationError, setApplicationError] = useState(null);

  useEffect(() => {
    if (!user) {
      setDiscoveryLoading(false);
      return undefined;
    }

    let active = true;
    setDiscoveryLoading(true);
    api.tutorDirectory()
      .then((result) => { if (active) setTutors(result.data || []); })
      .catch((error) => { if (active) setDiscoveryError(error); })
      .finally(() => { if (active) setDiscoveryLoading(false); });

    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!isStudent || isTutor) {
      setApplicationLoading(false);
      return undefined;
    }

    let active = true;
    api.tutorApplications()
      .then((result) => { if (active) setApplication(result.data?.[0] || null); })
      .catch((error) => { if (active) setApplicationError(error); })
      .finally(() => { if (active) setApplicationLoading(false); });

    return () => { active = false; };
  }, [isStudent, isTutor]);

  const subjects = useMemo(() => {
    const catalogue = new Map();
    tutors.forEach((tutor) => (tutor.offerings || []).forEach((offering) => {
      if (offering.subject?.id && offering.subject?.name) {
        catalogue.set(String(offering.subject.id), offering.subject.name);
      }
    }));

    return [...catalogue.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [tutors]);

  const discoveryHref = isStudent ? '/tutors' : user ? null : '/login';
  const primaryHref = isAdmin ? '/admin/users' : discoveryHref || '/tutor-bookings';
  const primaryLabel = isAdmin ? 'Open User Management' : isStudent ? 'Find Tutors' : 'View Booking Requests';

  async function retryDiscovery() {
    setDiscoveryError(null);
    setDiscoveryLoading(true);
    try {
      const result = await api.tutorDirectory();
      setTutors(result.data || []);
    } catch (error) {
      setDiscoveryError(error);
    } finally {
      setDiscoveryLoading(false);
    }
  }

  return <div className="homepage">
    {location.state?.notice && <p className="success-box homepage-notice" role="status">{location.state.notice}</p>}

    <section className="hero section-wrap homepage-hero" aria-labelledby="homepage-title">
      <div className="hero-copy">
        <span className="eyebrow"><span className="eyebrow-line" /> PEER LEARNING FOR HIGHER EDUCATION</span>
        <h1 id="homepage-title" aria-label="A stronger campus starts with each other">A stronger campus<br />starts with <em>each other.</em></h1>
        <p className="hero-lede">Peerwise helps university students find approved peer tutors, choose a subject and an available time, and request a focused learning session.</p>
        <div className="hero-actions">
          <Link className="button" to={user ? primaryHref : '/register'}>{user ? primaryLabel : 'Join the learning community'} <span aria-hidden="true">↗</span></Link>
          {user && isStudent && <Link className="text-link" to="/bookings">View My Bookings <span aria-hidden="true">↗</span></Link>}
          {!user && <Link className="text-link" to="/login">Sign in <span aria-hidden="true">↗</span></Link>}
        </div>
        <p className="hero-note"><span className="note-dot" /> Find support, share knowledge, keep learning.</p>
      </div>
      <div className="hero-art" aria-label="Illustration of two students studying together" role="img">
        <div className="art-sun" /><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <div className="book book-back" /><div className="book book-front"><span /><span /><span /></div>
        <div className="art-person person-left"><div className="person-head" /><div className="person-body" /></div><div className="art-person person-right"><div className="person-head" /><div className="person-body" /></div>
        <div className="floating-card card-note"><span className="card-icon">✳</span><span>Ask, practice,<br />understand.</span></div><div className="floating-card card-check"><span aria-hidden="true">✓</span> Progress, together</div>
        <div className="art-caption">Knowledge grows when it is shared.</div>
      </div>
    </section>

    <section className="homepage-discovery" aria-labelledby="homepage-discovery-title">
      <div className="section-wrap homepage-discovery-inner">
        <div className="homepage-section-intro">
          <span className="eyebrow">FIND THE RIGHT SUPPORT</span>
          <h2 id="homepage-discovery-title">Start with a subject.<br /><em>Meet a peer.</em></h2>
          <p>Browse approved tutors and the active subjects they offer. Check their teaching focus, read student feedback, and view future availability before requesting a session.</p>
          {isStudent ? <Link className="text-link" to="/tutors">Explore the Tutor Directory <span aria-hidden="true">↗</span></Link>
            : !user ? <Link className="text-link" to="/login">Sign in to find tutors <span aria-hidden="true">↗</span></Link>
              : <p className="homepage-access-note">Tutor discovery is available to student accounts.</p>}
        </div>
        <div className="homepage-discovery-content">
          <div className="homepage-subjects-block">
            <span className="card-label">SUBJECTS OFFERED BY APPROVED TUTORS</span>
            {!user ? <p className="homepage-state">Sign in with a student account to view live subjects and tutor listings.</p>
              : discoveryLoading ? <p className="homepage-state" role="status">Loading current tutor and subject listings…</p>
              : discoveryError ? <div className="homepage-state"><FormErrors error={discoveryError} /><button className="button button-outline" type="button" onClick={retryDiscovery}>Try again</button></div>
                : subjects.length ? <div className="homepage-subject-chips">{subjects.slice(0, 8).map((subject) => <span className="subject-chip" key={subject.id}>{subject.name}</span>)}</div>
                  : <p className="homepage-state">No active tutor subjects are listed yet. Check back as tutors publish their offerings.</p>}
          </div>
          <div className="homepage-tutor-preview" aria-label="Featured approved tutors">
            {!user ? null : discoveryLoading ? null : !discoveryError && tutors.length > 0
              ? tutors.slice(0, 3).map((tutor) => <article className="homepage-tutor-card" key={tutor.id}>
                <span className="homepage-tutor-avatar" aria-hidden="true">{tutorName(tutor).charAt(0).toUpperCase()}</span>
                <div className="homepage-tutor-copy"><h3>{tutorName(tutor)}</h3><p>{tutor.offerings?.map((offering) => offering.subject?.name).filter(Boolean).join(' · ') || 'Approved peer tutor'}</p></div>
                {isStudent && <Link className="homepage-tutor-link" to={`/tutors/${tutor.id}`} aria-label={`View ${tutorName(tutor)} profile`}>View <span aria-hidden="true">↗</span></Link>}
              </article>)
              : !discoveryError && <p className="homepage-state">There are no approved tutor listings to preview yet. Students can still explore the directory for updates.</p>}
          </div>
        </div>
      </div>
    </section>

    <section className="how-section homepage-how" id="how-it-works" aria-labelledby="homepage-how-title">
      <div className="section-wrap">
        <div className="section-heading"><span className="eyebrow">A CLEAR PATH TO PEER SUPPORT</span><h2 id="homepage-how-title">From a question to a<br /><em>shared breakthrough.</em></h2><p>The platform supports each step, while tutors and students decide how to make the learning time count.</p></div>
        <div className="steps-grid homepage-steps">{steps.map((step) => <article className="step-card" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
      </div>
    </section>

    <section className="homepage-tutor-invitation section-wrap" aria-labelledby="homepage-tutor-title">
      <div className="homepage-invitation-mark" aria-hidden="true">↗</div>
      <div className="homepage-invitation-copy"><span className="eyebrow">SHARE WHAT YOU KNOW</span><h2 id="homepage-tutor-title">Make your learning<br />someone else’s <em>starting point.</em></h2><p>Students with strong subject knowledge can apply to become peer tutors. An administrator reviews each application before tutor tools become available.</p>
        {isTutor ? <div className="homepage-invitation-actions"><Link className="button" to="/tutor-offerings">Manage My Teaching Subjects <span aria-hidden="true">↗</span></Link><Link className="text-link" to="/tutor-availability">Manage availability</Link></div>
          : isStudent ? <div className="homepage-invitation-actions">{applicationLoading ? <p className="homepage-state" role="status">Checking tutor application status…</p>
            : applicationError ? <div className="homepage-state"><FormErrors error={applicationError} /><Link className="text-link" to="/tutor-application">Open tutor applications</Link></div>
              : application?.status === 'pending' ? <p className="notice-box" role="status"><strong>Your tutor application is being reviewed.</strong> Tutor tools will appear after approval.</p>
                : <><Link className="button" to="/tutor-application">{application?.status === 'rejected' ? 'Apply again' : 'Become a Tutor'} <span aria-hidden="true">↗</span></Link><span className="homepage-small-note">Tutor access is added after administrator approval.</span></>}</div>
            : isAdmin ? <div className="homepage-invitation-actions"><p className="homepage-small-note">Tutor applications are reviewed in the administration area.</p><Link className="button button-outline" to="/admin/tutor-applications">Review Tutor Applications <span aria-hidden="true">↗</span></Link></div>
              : <div className="homepage-invitation-actions"><p className="homepage-small-note">Create a student account to apply after joining the platform.</p><Link className="button" to="/register">Create an account <span aria-hidden="true">↗</span></Link></div>}
      </div>
    </section>

    <section className="closing-cta section-wrap homepage-closing-cta">
      <div><span className="eyebrow">YOUR NEXT STEP</span><h2>{isAdmin ? 'Keep the learning community supported.' : isTutor ? 'Keep learning and helping others.' : 'Find support for what you are learning.'}</h2><p>{isAdmin ? 'Review applications and maintain the platform through dedicated admin pages.' : isStudent ? 'Explore tutors, choose a subject, and request a time that works.' : 'Sign in to explore current tutors, subjects, and available sessions.'}</p></div>
      <div className="homepage-closing-actions">{user ? <>
        {isStudent && <><Link className="button button-light" to="/tutors">Find Tutors <span aria-hidden="true">↗</span></Link><Link className="button button-light" to="/bookings">My Bookings <span aria-hidden="true">↗</span></Link></>}
        {isTutor && <Link className="button button-light" to="/tutor-bookings">Booking Requests <span aria-hidden="true">↗</span></Link>}
        {isAdmin && <><Link className="button button-light" to="/admin/tutor-applications">Tutor Applications <span aria-hidden="true">↗</span></Link><Link className="button button-light" to="/admin/users">User Management <span aria-hidden="true">↗</span></Link></>}
      </> : <><Link className="button button-light" to="/register">Create an account <span aria-hidden="true">↗</span></Link><Link className="homepage-cta-secondary" to="/login">Sign in</Link></>}</div>
    </section>
  </div>;
}
