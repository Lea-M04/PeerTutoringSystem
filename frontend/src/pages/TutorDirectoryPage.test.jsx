import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorDirectoryPage from './TutorDirectoryPage.jsx';
import TutorDirectoryProfilePage from './TutorDirectoryProfilePage.jsx';

vi.mock('../api/client.js', () => ({ api: { tutorDirectory: vi.fn(), tutorDirectoryProfile: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { roles: ['student'] } }) }));

const tutors = [
  {
    id: 31,
    biography: 'I explain complex ideas with examples.',
    user: { first_name: 'Ada', last_name: 'Lovelace', name: 'Ada Lovelace', faculty_or_university: 'Science Faculty', study_program: 'Computing', year_of_study: 2 },
    offerings: [{ id: 10, description: 'Probability and data.', subject: { id: 2, name: 'Statistics' } }],
  },
  {
    id: 32,
    biography: 'I help with writing.',
    user: { first_name: 'Grace', last_name: 'Hopper', name: 'Grace Hopper', faculty_or_university: 'Engineering', study_program: 'Computer Science', year_of_study: 3 },
    offerings: [{ id: 11, description: 'Essay structure.', subject: { id: 4, name: 'Academic Writing' } }],
  },
];

describe('student tutor directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.tutorDirectory.mockResolvedValue({ data: tutors });
  });

  it('loads actual tutor results and combines name search with the subject filter', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TutorDirectoryPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).not.toBeNull();
    expect(screen.getByText('Grace Hopper')).not.toBeNull();
    await user.type(screen.getByLabelText('Search by tutor or subject'), 'ada');
    await user.selectOptions(screen.getByLabelText('Filter by subject'), '2');

    expect(screen.getByText('Ada Lovelace')).not.toBeNull();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    expect(screen.getByText('Science Faculty')).not.toBeNull();
    expect(screen.getByText('I explain complex ideas with examples.')).not.toBeNull();
    expect(screen.getByRole('link', { name: /view tutor profile/i }).getAttribute('href')).toBe('/tutors/31');

    await user.clear(screen.getByLabelText('Search by tutor or subject'));
    expect(screen.getByText('Ada Lovelace')).not.toBeNull();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Grace Hopper')).not.toBeNull();
  });

  it('opens a complete student-facing profile from the directory API', async () => {
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ada Lovelace profile.' })).not.toBeNull();
    expect(screen.getByText('Computing')).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText('Statistics')).not.toBeNull();
    expect(screen.getByText('Probability and data.')).not.toBeNull();
    expect(api.tutorDirectoryProfile).toHaveBeenCalledWith('31');
    expect(screen.queryByText('ada@example.test')).toBeNull();
  });

  it('explains when a tutor profile is not discoverable and links back to the directory', async () => {
    api.tutorDirectoryProfile.mockRejectedValue({ status: 404, message: 'No query results for model.' });
    render(<MemoryRouter initialEntries={['/tutors/99']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    expect((await screen.findByRole('alert')).textContent).toContain('This tutor profile is not available in the directory.');
    expect(screen.getByRole('link', { name: 'Return to tutor directory' }).getAttribute('href')).toBe('/tutors');
  });

  it('shows a helpful empty state when there are no matching tutors', async () => {
    api.tutorDirectory.mockResolvedValue({ data: [] });
    render(<MemoryRouter><TutorDirectoryPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('No tutors are listed yet')).not.toBeNull());
  });
});
