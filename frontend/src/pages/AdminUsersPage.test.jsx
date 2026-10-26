import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import AdminUsersPage from './AdminUsersPage.jsx';
import AdminUserProfilePage from './AdminUserProfilePage.jsx';

vi.mock('../api/client.js', () => ({ api: { adminUsers: vi.fn(), adminUser: vi.fn(), updateAdminUser: vi.fn(), updateAdminUserStatus: vi.fn() } }));
const authState = vi.hoisted(() => ({ user: { roles: ['admin'] } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => authState }));
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useParams: () => ({ userId: '12' }) };
});

describe('admin user profile pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { roles: ['admin'] };
  });

  it('redirects a Student from the Admin user page without requesting Admin data', () => {
    authState.user = { roles: ['student'] };
    render(<MemoryRouter initialEntries={['/admin/users']}><Routes>
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/dashboard" element={<p>Student dashboard</p>} />
    </Routes></MemoryRouter>);

    expect(screen.getByText('Student dashboard')).not.toBeNull();
    expect(api.adminUsers).not.toHaveBeenCalled();
  });

  it('lists student and tutor profiles from the API with a profile link', async () => {
    api.adminUsers.mockResolvedValue({ data: [
      { id: 12, name: 'Student Example', roles: ['student'], is_approved_tutor: false },
      { id: 13, name: 'Tutor Example', roles: ['student', 'tutor'], is_approved_tutor: true },
    ] });
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);

    expect(await screen.findByText('Student Example')).not.toBeNull();
    expect(screen.getByText('Tutor Example')).not.toBeNull();
    expect(screen.getAllByRole('link', { name: 'View profile' })[0].getAttribute('href')).toBe('/admin/users/12');
  });

  it('filters the user list by name and role', async () => {
    api.adminUsers.mockResolvedValue({ data: [
      { id: 12, name: 'Student Example', roles: ['student'], is_active: true, is_approved_tutor: false },
      { id: 13, name: 'Tutor Example', roles: ['student', 'tutor'], is_active: true, is_approved_tutor: true },
    ] });
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);

    expect(await screen.findByText('Student Example')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'tutor' } });
    expect(screen.getByText('Tutor Example')).not.toBeNull();
    expect(screen.queryByText('Student Example')).toBeNull();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'student' } });
    expect(screen.getByText('Tutor Example')).not.toBeNull();
  });

  it('shows academic information, tutor offerings, and future availability in a read-only detail view', async () => {
    api.adminUser.mockResolvedValue({ data: {
      id: 12,
      name: 'Tutor Example',
      first_name: 'Tutor',
      last_name: 'Example',
      faculty_or_university: 'Science Faculty',
      study_program: 'Physics',
      year_of_study: 3,
      biography: 'Student biography.',
      roles: ['student', 'tutor'],
      is_active: true,
      is_approved_tutor: true,
      tutor_profile: {
        biography: 'Tutor biography.',
        offerings: [{ id: 8, description: 'Mechanics', subject: { id: 4, name: 'Physics' } }],
        availability: [{ id: 9, starts_at: '2030-02-01T09:00:00.000Z', ends_at: '2030-02-01T10:00:00.000Z' }],
      },
    } });
    render(<MemoryRouter><AdminUserProfilePage /></MemoryRouter>);

    expect(await screen.findByText('Science Faculty')).not.toBeNull();
    expect(screen.getByText('Student biography.')).not.toBeNull();
    expect(screen.getByText('Tutor biography.')).not.toBeNull();
    expect(screen.getByText('Mechanics')).not.toBeNull();
    expect(screen.getAllByText('Physics')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Back to users' })).not.toBeNull();
    expect(document.body.textContent).not.toContain('tutor@example.test');
  });

  it('saves permitted profile fields and displays the canonical profile response', async () => {
    const original = {
      id: 12, name: 'Tutor Example', first_name: 'Tutor', last_name: 'Example', roles: ['student', 'tutor'],
      is_active: true, is_approved_tutor: true, tutor_profile: { offerings: [], availability: [] },
    };
    api.adminUser.mockResolvedValue({ data: original });
    api.updateAdminUser.mockResolvedValue({ data: { ...original, name: 'New Tutor', first_name: 'New', faculty_or_university: 'Science Faculty' } });
    render(<MemoryRouter><AdminUserProfilePage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'New' } });
    fireEvent.change(screen.getByLabelText('University or faculty'), { target: { value: 'Science Faculty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect((await screen.findByRole('status')).textContent).toContain('Profile changes saved.');
    await waitFor(() => expect(screen.queryByLabelText('First name')).toBeNull());
    expect(screen.getByText('Science Faculty')).not.toBeNull();
    expect(api.updateAdminUser).toHaveBeenCalledWith('12', expect.objectContaining({ first_name: 'New', faculty_or_university: 'Science Faculty' }));
  });

  it('activates and deactivates accounts through the dedicated action', async () => {
    const profile = { id: 12, name: 'Student Example', roles: ['student'], is_active: true, tutor_profile: null };
    api.adminUser.mockResolvedValue({ data: profile });
    api.updateAdminUserStatus.mockResolvedValue({ data: { ...profile, is_active: false } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter><AdminUserProfilePage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate account' }));

    expect(api.updateAdminUserStatus).toHaveBeenCalledWith('12', false);
    expect(await screen.findByText('Account deactivated. Historical records are preserved.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Reactivate account' })).not.toBeNull();
  });
});
