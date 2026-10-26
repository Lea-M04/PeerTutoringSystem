import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import LandingPage from './LandingPage.jsx';

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../api/client.js', () => ({ api: { tutorDirectory: vi.fn(), tutorApplications: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));

const tutors = [
  { id: 31, user: { name: 'Ada Lovelace', faculty_or_university: 'Science Faculty' }, offerings: [{ id: 8, subject: { id: 2, name: 'Statistics' } }, { id: 9, subject: { id: 3, name: 'Mathematics' } }] },
  { id: 32, user: { name: 'Grace Hopper' }, offerings: [{ id: 10, subject: { id: 2, name: 'Statistics' } }] },
];

function renderHome() {
  return render(<MemoryRouter><LandingPage /></MemoryRouter>);
}

describe('platform homepage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
    api.tutorDirectory.mockResolvedValue({ data: tutors });
    api.tutorApplications.mockResolvedValue({ data: [] });
  });

  it('provides a rich guest landing page without account or profile details', () => {
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: /a stronger campus starts with each other/i })).not.toBeNull();
    expect(screen.getByRole('heading', { name: /find a tutor and subject/i })).not.toBeNull();
    expect(screen.getByRole('heading', { name: /make your learning/i })).not.toBeNull();
    expect(screen.getByRole('link', { name: /join the learning community/i }).getAttribute('href')).toBe('/register');
    expect(screen.getAllByRole('link', { name: /sign in/i })[0].getAttribute('href')).toBe('/login');
    expect(screen.queryByText(/profile at a glance/i)).toBeNull();
    expect(api.tutorDirectory).not.toHaveBeenCalled();
  });

  it('loads real tutor offerings and subjects for a Student', async () => {
    auth.user = { id: 8, roles: ['student'] };
    renderHome();

    expect((await screen.findAllByText('Statistics')).length).toBeGreaterThan(0);
    expect(screen.getByText('Mathematics')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'View Ada Lovelace profile' }).getAttribute('href')).toBe('/tutors/31');
    expect(screen.getAllByRole('link', { name: /find tutors/i })[0].getAttribute('href')).toBe('/tutors');
    expect(screen.getByRole('link', { name: /view my bookings/i }).getAttribute('href')).toBe('/bookings');
    expect(api.tutorDirectory).toHaveBeenCalledOnce();
  });

  it('shows loading, API error, retry, and empty tutor states', async () => {
    auth.user = { id: 8, roles: ['student'] };
    api.tutorDirectory.mockReturnValueOnce(new Promise(() => {}));
    const { unmount: unmountLoading } = renderHome();
    expect(screen.getAllByRole('status').some((status) => status.textContent.includes('Loading current tutor and subject listings'))).toBe(true);
    unmountLoading();

    api.tutorDirectory.mockRejectedValueOnce({ message: 'Tutor listings are unavailable.', errors: {} });
    const { unmount: unmountError } = renderHome();
    expect(await screen.findByText('Tutor listings are unavailable.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeNull();
    unmountError();

    api.tutorDirectory.mockResolvedValueOnce({ data: [] });
    renderHome();
    expect(await screen.findByText(/no active tutor subjects are listed yet/i)).not.toBeNull();
  });

  it('shows application status to an unapproved applicant without exposing Tutor tools', async () => {
    auth.user = { id: 8, roles: ['student'], is_approved_tutor: false };
    api.tutorApplications.mockResolvedValue({ data: [{ id: 5, status: 'pending' }] });
    renderHome();

    expect(await screen.findByText(/your tutor application is being reviewed/i)).not.toBeNull();
    expect(screen.queryByRole('link', { name: /manage my teaching subjects/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /booking requests/i })).toBeNull();
    expect(api.tutorApplications).toHaveBeenCalledOnce();
  });

  it('shows Student and Tutor actions together for an approved dual-role account', () => {
    auth.user = { id: 9, roles: ['student', 'tutor'], is_approved_tutor: true };
    renderHome();

    expect(screen.getAllByRole('link', { name: /find tutors/i })[0].getAttribute('href')).toBe('/tutors');
    expect(screen.getByRole('link', { name: /manage my teaching subjects/i }).getAttribute('href')).toBe('/tutor-offerings');
    expect(screen.getByRole('link', { name: /manage availability/i }).getAttribute('href')).toBe('/tutor-availability');
    expect(screen.getByRole('link', { name: /booking requests/i }).getAttribute('href')).toBe('/tutor-bookings');
    expect(api.tutorApplications).not.toHaveBeenCalled();
  });

  it('shows dedicated administration links without Student or profile content', () => {
    auth.user = { id: 10, roles: ['admin'] };
    renderHome();

    expect(screen.getByRole('link', { name: /open user management/i }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: /review tutor applications/i }).getAttribute('href')).toBe('/admin/tutor-applications');
    expect(screen.queryByRole('link', { name: /my bookings/i })).toBeNull();
    expect(screen.queryByText(/profile at a glance/i)).toBeNull();
  });
});
