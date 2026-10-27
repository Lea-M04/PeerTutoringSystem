import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorDirectoryPage from './TutorDirectoryPage.jsx';
import TutorDirectoryProfilePage from './TutorDirectoryProfilePage.jsx';

const authState = vi.hoisted(() => ({ user: { roles: ['student'] } }));

vi.mock('../api/client.js', () => ({ api: { tutorDirectory: vi.fn(), tutorDirectoryProfile: vi.fn(), tutorDirectoryAvailability: vi.fn(), createBooking: vi.fn(), createConversation: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: authState.user }) }));

const tutors = [
  {
    id: 31,
    biography: 'I explain complex ideas with examples.',
    average_rating: 4.5,
    review_count: 2,
    reviews: [{ id: 55, rating: 5, comment: 'Very helpful.', created_at: '2099-05-01T10:00:00.000Z', reviewer: { name: 'Sam T.' } }],
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
    authState.user = { roles: ['student'] };
    api.tutorDirectory.mockResolvedValue({ data: tutors });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [] });
    api.createBooking.mockResolvedValue({ data: { id: 56, status: 'pending' } });
  });

  it('loads actual tutor results and combines name search with the subject filter', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TutorDirectoryPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).not.toBeNull();
    expect(screen.getByText('Grace Hopper')).not.toBeNull();
    expect(screen.getByText('★ 4.5 · 2 reviews')).not.toBeNull();
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
    expect(screen.getAllByText('Statistics')).toHaveLength(2);
    expect(screen.getByText('Probability and data.')).not.toBeNull();
    expect(screen.getByText('★ 4.5 · 2 reviews')).not.toBeNull();
    expect(screen.getByText('Very helpful.')).not.toBeNull();
    expect(screen.getByText('Sam T.')).not.toBeNull();
    expect(api.tutorDirectoryProfile).toHaveBeenCalledWith('31');
    expect(screen.queryByText('ada@example.test')).toBeNull();
  });

  it('lets an approved tutor with the student role start a conversation without a booking', async () => {
    const user = userEvent.setup();
    authState.user = { roles: ['student', 'tutor'] };
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.createConversation.mockResolvedValue({ data: { id: 88 } });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes>
      <Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} />
      <Route path="/messages/:conversationId" element={<p>Conversation opened</p>} />
    </Routes></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Message this tutor' }));

    expect(api.createConversation).toHaveBeenCalledWith('31');
    expect(await screen.findByText('Conversation opened')).not.toBeNull();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('renders real future availability on the tutor detail page', async () => {
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [{ id: 90, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' }] });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Availability' })).not.toBeNull();
    expect(screen.getByText(/available from/i)).not.toBeNull();
    expect(api.tutorDirectoryAvailability).toHaveBeenCalledWith('31');
    expect(screen.getByRole('button', { name: 'Request booking' }).disabled).toBe(true);
  });

  it('renders all three future slots in chronological order and removes a requested slot', async () => {
    const user = userEvent.setup();
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [
      { id: 92, starts_at: '2099-06-01T15:00:00.000Z', ends_at: '2099-06-01T16:00:00.000Z' },
      { id: 90, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' },
      { id: 91, starts_at: '2099-06-01T12:00:00.000Z', ends_at: '2099-06-01T13:00:00.000Z' },
    ] });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    await user.selectOptions(await screen.findByLabelText('Choose a subject for your booking'), '10');
    const bookingButtons = await screen.findAllByRole('button', { name: 'Request booking' });
    expect(bookingButtons).toHaveLength(3);
    await user.click(bookingButtons[0]);
    expect(api.createBooking).toHaveBeenCalledWith(90, 10);
    expect(await screen.findAllByRole('button', { name: 'Request booking' })).toHaveLength(2);
  });

  it('keeps tutor-level availability unchanged when the student switches subjects', async () => {
    const user = userEvent.setup();
    api.tutorDirectoryProfile.mockResolvedValue({ data: {
      ...tutors[0],
      offerings: [...tutors[0].offerings, {
        id: 12,
        description: 'Discrete mathematics.',
        subject: { id: 5, name: 'Discrete Mathematics' },
      }],
    } });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [
      { id: 90, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' },
      { id: 91, starts_at: '2099-06-01T12:00:00.000Z', ends_at: '2099-06-01T13:00:00.000Z' },
      { id: 92, starts_at: '2099-06-01T15:00:00.000Z', ends_at: '2099-06-01T16:00:00.000Z' },
    ] });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    const subjectSelector = await screen.findByLabelText('Choose a subject for your booking');
    await user.selectOptions(subjectSelector, '10');
    expect(await screen.findAllByRole('button', { name: 'Request booking' })).toHaveLength(3);

    await user.selectOptions(subjectSelector, '12');
    expect(screen.getAllByRole('button', { name: 'Request booking' })).toHaveLength(3);
    expect(api.tutorDirectoryAvailability).toHaveBeenCalledOnce();
    expect(api.tutorDirectoryAvailability).toHaveBeenCalledWith('31');
  });

  it('refreshes bookable availability and hides intervals after they start without a page reload', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-06-01T08:00:00.000Z'));
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.tutorDirectoryAvailability
      .mockResolvedValueOnce({ data: [{ id: 90, starts_at: '2099-06-01T08:00:05.000Z', ends_at: '2099-06-01T09:00:00.000Z' }] })
      .mockResolvedValue({ data: [] });

    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('button', { name: 'Request booking' })).not.toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText('This tutor has no future availability listed yet.')).not.toBeNull();
    expect(api.tutorDirectoryAvailability).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('requests a booking with the selected offering and availability and links to the booking list', async () => {
    const user = userEvent.setup();
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [{ id: 90, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' }] });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    await user.selectOptions(await screen.findByLabelText('Choose a subject for your booking'), '10');
    await user.click(await screen.findByRole('button', { name: 'Request booking' }));
    expect(api.createBooking).toHaveBeenCalledWith(90, 10);
    expect((await screen.findByRole('status')).textContent).toContain('Booking request submitted. Current status: pending.');
    expect(screen.getByRole('link', { name: /view my bookings/i }).getAttribute('href')).toBe('/bookings');
  });

  it('prevents a second booking request while the first request is still pending', async () => {
    const user = userEvent.setup();
    let resolveBooking;
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [{ id: 90, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' }] });
    api.createBooking.mockReturnValue(new Promise((resolve) => { resolveBooking = resolve; }));
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    await user.selectOptions(await screen.findByLabelText('Choose a subject for your booking'), '10');
    const requestButton = await screen.findByRole('button', { name: 'Request booking' });
    await user.click(requestButton);
    const pendingButton = screen.getByRole('button', { name: 'Requesting…' });
    expect(pendingButton.disabled).toBe(true);
    await user.click(pendingButton);
    expect(api.createBooking).toHaveBeenCalledOnce();

    resolveBooking({ data: { id: 56, status: 'pending' } });
    expect(await screen.findByRole('status')).not.toBeNull();
  });

  it('shows the API conflict when an availability interval was already reserved', async () => {
    const user = userEvent.setup();
    api.tutorDirectoryProfile.mockResolvedValue({ data: tutors[0] });
    api.tutorDirectoryAvailability.mockResolvedValue({ data: [{ id: 90, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' }] });
    api.createBooking.mockRejectedValue({ status: 409, message: 'This availability interval has already been requested.', errors: {} });
    render(<MemoryRouter initialEntries={['/tutors/31']}><Routes><Route path="/tutors/:tutorProfileId" element={<TutorDirectoryProfilePage />} /></Routes></MemoryRouter>);

    await user.selectOptions(await screen.findByLabelText('Choose a subject for your booking'), '10');
    await user.click(await screen.findByRole('button', { name: 'Request booking' }));
    expect((await screen.findByRole('alert')).textContent).toContain('This availability interval has already been requested.');
    expect(screen.queryByText(/Booking request submitted/)).toBeNull();
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
