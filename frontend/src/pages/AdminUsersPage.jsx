import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, PageLoader } from '../components/SiteLayout.jsx';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    api.adminUsers()
      .then((result) => { if (active) setUsers(result.data); })
      .catch((caught) => { if (active) setError(caught); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return users.filter((profile) => {
      const matchesSearch = !normalizedSearch || [profile.name, profile.first_name, profile.last_name]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      const matchesRole = roleFilter === 'all' || profile.roles.includes(roleFilter);

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageLoader label="Loading users…" />;

  return <section className="admin-users-page section-wrap">
    <Link className="text-link back-link" to="/dashboard"><span aria-hidden="true">←</span> Back to dashboard</Link>
    <span className="eyebrow">ADMINISTRATION</span><h1>Student and tutor <em>profiles.</em></h1>
    <p className="profile-intro">View account and academic profile information. Tutor entries include their current teaching offerings and future availability.</p>
    <FormErrors error={error} />
    <div className="admin-users-heading"><h2>Users</h2><span className="subject-count">{filteredUsers.length} of {users.length} {users.length === 1 ? 'user' : 'users'}</span></div>
    <div className="admin-user-filters">
      <label htmlFor="admin-user-search">Search by name</label>
      <input id="admin-user-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Enter a first or last name" />
      <label htmlFor="admin-user-role">Role</label>
      <select id="admin-user-role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
        <option value="all">All students and tutors</option><option value="student">Student</option><option value="tutor">Tutor</option>
      </select>
      {(search || roleFilter !== 'all') && <button className="button button-outline" type="button" onClick={() => { setSearch(''); setRoleFilter('all'); }}>Clear filters</button>}
    </div>
    {error && users.length === 0 ? <div className="profile-panel empty-state" role="status">User profiles could not be loaded. {error.status === 403 ? 'You do not have permission to view this page.' : 'Refresh this page to try again.'}</div>
      : users.length === 0 ? <div className="profile-panel empty-state" role="status">No student or tutor profiles are available.</div>
        : filteredUsers.length === 0 ? <div className="profile-panel empty-state" role="status">No users match these filters. Clear the search or choose another role.</div>
          : <div className="admin-users-list">{filteredUsers.map((profile) => <article className="admin-user-card" key={profile.id}>
            <div className="admin-user-card-main"><h2>{profile.name || 'Unnamed user'}</h2><p>{profile.faculty_or_university || 'University or faculty not provided'}{profile.study_program ? ` · ${profile.study_program}` : ''}</p><div className="admin-user-roles">{profile.roles.map((role) => <span className="role-pill" key={role}>{role}</span>)}{profile.is_approved_tutor && <span className="application-status status-approved">Approved tutor</span>}<span className={`application-status ${profile.is_active ? 'status-approved' : 'status-rejected'}`}>{profile.is_active ? 'Active account' : 'Deactivated'}</span></div></div>
            <Link className="button button-outline" to={`/admin/users/${profile.id}`}>View profile</Link>
          </article>)}</div>}
  </section>;
}
