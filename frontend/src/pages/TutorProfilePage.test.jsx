import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorProfilePage from './TutorProfilePage.jsx';

vi.mock('../api/client.js', () => ({
  api: { currentUser: vi.fn(), tutorProfile: vi.fn(), tutorOfferings: vi.fn(), updateTutorProfile: vi.fn() },
}));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { roles: ['student', 'tutor'], is_approved_tutor: true }, updateProfile: vi.fn() }) }));

describe('tutor profile presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.currentUser.mockResolvedValue({ data: {
      id: 12, name: 'Grace Hopper', email: 'grace@example.test', first_name: 'Grace', last_name: 'Hopper',
      faculty_or_university: 'Engineering', study_program: 'Computer Science', year_of_study: 3,
      biography: 'Student biography.', roles: ['student', 'tutor'],
    } });
    api.tutorProfile.mockResolvedValue({ data: { biography: 'I help students understand systems.' } });
    api.tutorOfferings.mockResolvedValue({ data: [{ id: 40, description: 'Algorithms and debugging.', subject: { id: 3, name: 'Programming' } }] });
  });

  it('shows persisted academic details, tutor biography and real subject offerings', async () => {
    render(<MemoryRouter><TutorProfilePage /></MemoryRouter>);

    expect(await screen.findByText('Engineering')).not.toBeNull();
    expect(screen.getByText('Computer Science')).not.toBeNull();
    expect(screen.getByText('3')).not.toBeNull();
    expect(screen.getByText('I help students understand systems.')).not.toBeNull();
    expect(screen.getByText('Programming')).not.toBeNull();
    expect(screen.getByText('Algorithms and debugging.')).not.toBeNull();
    expect(screen.getByRole('link', { name: /manage my teaching subjects/i }).getAttribute('href')).toBe('/tutor-offerings');
  });
});
