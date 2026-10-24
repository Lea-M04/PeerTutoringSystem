import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';
import UserProfileCard from '../components/UserProfileCard.jsx';

export default function ProfilePage() {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.currentUser()
      .then((result) => { if (active) setProfile(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section className="profile-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">YOUR ACCOUNT</span><h1>My <em>profile.</em></h1>
    <p className="profile-intro">Your saved details and study information.</p>
    {loading ? <PageLoader label="Loading your profile…" /> : error ? <FormErrors error={error} /> : <UserProfileCard profile={profile} onSave={updateProfile} onSaved={setProfile} />}
  </section>;
}
