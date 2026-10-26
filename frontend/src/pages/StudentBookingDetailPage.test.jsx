import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import { formatLocalDateTime } from '../utils/dateTime.js';
import StudentBookingDetailPage from './StudentBookingDetailPage.jsx';

vi.mock('../api/client.js', () => ({ api: { studentBooking: vi.fn(), submitBookingReview: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { roles: ['student'] } }) }));

describe('student booking details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays the booking resource returned by the API', async () => {
    api.studentBooking.mockResolvedValue({ data: {
      id: 71,
      status: 'accepted',
      starts_at: '2099-06-01T09:00:00.000Z',
      ends_at: '2099-06-01T10:00:00.000Z',
      created_at: '2099-05-01T10:00:00.000Z',
      tutor: { id: 12, name: 'Ada Lovelace' },
      subject: { id: 2, name: 'Statistics' },
    } });
    render(<MemoryRouter initialEntries={['/bookings/71']}><Routes><Route path="/bookings/:bookingId" element={<StudentBookingDetailPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Your session.' })).not.toBeNull();
    expect(screen.getByText('Ada Lovelace')).not.toBeNull();
    expect(screen.getByText('Accepted', { selector: 'span.booking-status' })).not.toBeNull();
    expect(screen.getByText('Statistics')).not.toBeNull();
    expect(screen.getByText(formatLocalDateTime('2099-06-01T09:00:00.000Z'))).not.toBeNull();
    expect(screen.getByText(formatLocalDateTime('2099-06-01T10:00:00.000Z'))).not.toBeNull();
    expect(screen.getByText(formatLocalDateTime('2099-05-01T10:00:00.000Z'))).not.toBeNull();
    expect(screen.queryByText('2099-06-01T09:00:00.000Z')).toBeNull();
    expect(api.studentBooking).toHaveBeenCalledWith('71');
  });

  it('shows the review form only for completed bookings and submits the selected rating and optional comment', async () => {
    const user = userEvent.setup();
    api.studentBooking.mockResolvedValue({ data: { id: 71, status: 'completed', tutor: { name: 'Ada Lovelace' } } });
    api.submitBookingReview.mockResolvedValue({ data: { id: 71, status: 'completed', review: { id: 4, rating: 5, comment: 'Excellent help.', created_at: '2099-06-01T10:00:00.000Z' } } });
    render(<MemoryRouter initialEntries={['/bookings/71']}><Routes><Route path="/bookings/:bookingId" element={<StudentBookingDetailPage />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText('Written review (optional)'), 'Excellent help.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(api.submitBookingReview).toHaveBeenCalledWith('71', { rating: 5, comment: 'Excellent help.' });
    expect(await screen.findByText('Your review was submitted.')).not.toBeNull();
    expect(screen.getByText(/★★★★★/)).not.toBeNull();
  });

  it('shows an existing review and does not offer another submission', async () => {
    api.studentBooking.mockResolvedValue({ data: { id: 71, status: 'completed', review: { id: 4, rating: 4, comment: 'Clear explanation.', created_at: '2099-06-01T10:00:00.000Z' } } });
    render(<MemoryRouter initialEntries={['/bookings/71']}><Routes><Route path="/bookings/:bookingId" element={<StudentBookingDetailPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Clear explanation.')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit review' })).toBeNull();
  });

  it('does not offer reviews for a non-completed booking', async () => {
    api.studentBooking.mockResolvedValue({ data: { id: 71, status: 'pending', tutor: { name: 'Ada Lovelace' } } });
    render(<MemoryRouter initialEntries={['/bookings/71']}><Routes><Route path="/bookings/:bookingId" element={<StudentBookingDetailPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByText(/after the tutor marks this session completed/i)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit review' })).toBeNull();
  });

  it('keeps the form values and displays backend errors when submission fails', async () => {
    const user = userEvent.setup();
    api.studentBooking.mockResolvedValue({ data: { id: 71, status: 'completed' } });
    api.submitBookingReview.mockRejectedValue({ message: 'The booking already has a review.', errors: {} });
    render(<MemoryRouter initialEntries={['/bookings/71']}><Routes><Route path="/bookings/:bookingId" element={<StudentBookingDetailPage />} /></Routes></MemoryRouter>);

    await user.click(await screen.findByRole('radio', { name: '4 stars' }));
    await user.type(screen.getByLabelText('Written review (optional)'), 'Please keep this text.');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The booking already has a review.');
    expect(screen.getByLabelText('Written review (optional)').value).toBe('Please keep this text.');
    expect(screen.getByRole('radio', { name: '4 stars' }).checked).toBe(true);
    expect(screen.queryByText('Your review was submitted.')).toBeNull();
  });
});
