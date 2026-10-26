import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import DashboardPage from './DashboardPage.jsx';

vi.mock('../api/client.js', () => ({ api: { currentUser: vi.fn(), tutorApplications: vi.fn(), studentBookings: vi.fn(), tutorBookings: vi.fn(), adminOverview: vi.fn() } }));
const auth = vi.hoisted(() => ({ value: { user: { id: 8, name: 'Ada Lovelace', roles: ['student'] } } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));

describe('student dashboard profile and discovery links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.value = { user: { id: 8, name: 'Ada Lovelace', roles: ['student'] } };
    api.currentUser.mockResolvedValue({ data: {
      id: 8, name: 'Ada Lovelace', email: 'ada@example.test', first_name: 'Ada', last_name: 'Lovelace',
      faculty_or_university: 'Science Faculty', study_program: 'Computing', year_of_study: 2,
      biography: 'I enjoy collaborative learning.', roles: ['student'],
    } });
    api.tutorApplications.mockResolvedValue({ data: [] });
    api.studentBookings.mockResolvedValue({ data: [] });
    api.tutorBookings.mockResolvedValue({ data: [] });
    api.adminOverview.mockResolvedValue({ data: {
      users: { total: 3, active: 3 }, tutors: 1, pending_tutor_applications: 0, active_subjects: 2,
      bookings: { pending: 1, accepted: 1, rejected: 0, cancelled: 0, completed: 2 },
    } });
  });

  it('loads the current persisted profile fields and makes tutor discovery easy to find', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText('Science Faculty')).not.toBeNull();
    expect(screen.getByText('Computing')).not.toBeNull();
    expect(screen.getByText('I enjoy collaborative learning.')).not.toBeNull();
    expect(screen.getByRole('link', { name: /find tutors/i }).getAttribute('href')).toBe('/tutors');
    expect(api.currentUser).toHaveBeenCalledOnce();
  });

  it('shows real system overview values and management links to an Admin', async () => {
    auth.value = { user: { id: 9, name: 'Admin User', roles: ['admin'] } };
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect((await screen.findByRole('link', { name: /user management/i })).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: /tutor offering management/i }).getAttribute('href')).toBe('/admin/tutor-offerings');
    expect(screen.getByRole('link', { name: /booking management/i }).getAttribute('href')).toBe('/admin/bookings');
    expect(await screen.findByText('Pending tutor applications')).not.toBeNull();
    expect(screen.getByText('Total users').parentElement.textContent).toContain('3');
    expect(api.adminOverview).toHaveBeenCalledOnce();
  });

  it('shows separate Student and Tutor sections for an approved dual-role account', async () => {
    const bookings = [{ id: 30, status: 'accepted', starts_at: '2099-02-01T10:00:00.000Z', ends_at: '2099-02-01T11:00:00.000Z', tutor: { name: 'Tutor Peer' }, subject: { name: 'Biology' } }];
    auth.value = { user: { id: 10, name: 'Dual Role', roles: ['student', 'tutor'], is_approved_tutor: true } };
    api.studentBookings.mockResolvedValue({ data: bookings });
    api.tutorBookings.mockResolvedValue({ data: [{ id: 31, status: 'pending' }] });
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Learn with a peer' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Support your peers' })).not.toBeNull();
    expect(screen.getByRole('link', { name: /find tutors/i }).getAttribute('href')).toBe('/tutors');
    expect(screen.getByRole('link', { name: /booking requests/i }).getAttribute('href')).toBe('/tutor-bookings');
    expect(await screen.findByText(/Tutor Peer · Biology/)).not.toBeNull();
    expect(screen.getAllByText('Pending requests').at(-1).parentElement.textContent).toContain('1');
  });
});
