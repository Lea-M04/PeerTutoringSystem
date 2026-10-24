import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import DashboardPage from './DashboardPage.jsx';

vi.mock('../api/client.js', () => ({ api: { currentUser: vi.fn(), tutorApplications: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 8, name: 'Ada Lovelace', roles: ['student'] } }) }));

describe('student dashboard profile and discovery links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.currentUser.mockResolvedValue({ data: {
      id: 8, name: 'Ada Lovelace', email: 'ada@example.test', first_name: 'Ada', last_name: 'Lovelace',
      faculty_or_university: 'Science Faculty', study_program: 'Computing', year_of_study: 2,
      biography: 'I enjoy collaborative learning.', roles: ['student'],
    } });
    api.tutorApplications.mockResolvedValue({ data: [] });
  });

  it('loads the current persisted profile fields and makes tutor discovery easy to find', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(await screen.findByText('Science Faculty')).not.toBeNull();
    expect(screen.getByText('Computing')).not.toBeNull();
    expect(screen.getByText('I enjoy collaborative learning.')).not.toBeNull();
    expect(screen.getByRole('link', { name: /find tutors/i }).getAttribute('href')).toBe('/tutors');
    expect(api.currentUser).toHaveBeenCalledOnce();
  });
});
