import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorBookingDetailPage from './TutorBookingDetailPage.jsx';

vi.mock('../api/client.js', () => ({ api: { tutorBooking: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { roles: ['student', 'tutor'], is_approved_tutor: true } }) }));

describe('tutor booking details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.tutorBooking.mockResolvedValue({ data: {
      id: 52,
      status: 'accepted',
      starts_at: '2099-06-01T09:00:00.000Z',
      ends_at: '2099-06-01T10:00:00.000Z',
      created_at: '2099-05-01T10:00:00.000Z',
      student: { name: 'Grace Hopper' },
      subject: { id: 2, name: 'Statistics' },
    } });
  });

  it('loads the tutor-owned booking details and displays its booked subject', async () => {
    render(<MemoryRouter initialEntries={['/tutor-bookings/52']}><Routes><Route path="/tutor-bookings/:bookingId" element={<TutorBookingDetailPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Session request.' })).not.toBeNull();
    expect(screen.getByText('Grace Hopper')).not.toBeNull();
    expect(screen.getByText('Statistics')).not.toBeNull();
    expect(api.tutorBooking).toHaveBeenCalledWith('52');
  });

  it('shows a safe placeholder for historical bookings without a recorded subject', async () => {
    api.tutorBooking.mockResolvedValueOnce({ data: { id: 52, status: 'completed', student: { name: 'Grace Hopper' }, subject: null } });
    render(<MemoryRouter initialEntries={['/tutor-bookings/52']}><Routes><Route path="/tutor-bookings/:bookingId" element={<TutorBookingDetailPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Subject not recorded')).not.toBeNull();
  });
});
