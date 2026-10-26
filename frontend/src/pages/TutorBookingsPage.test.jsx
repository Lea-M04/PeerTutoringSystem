import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorBookingsPage from './TutorBookingsPage.jsx';

const auth = vi.hoisted(() => ({ user: { roles: ['student', 'tutor'], is_approved_tutor: true } }));
vi.mock('../api/client.js', () => ({ api: { tutorBookings: vi.fn(), acceptBooking: vi.fn(), rejectBooking: vi.fn(), completeBooking: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));

const booking = { id: 52, status: 'pending', starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z', student: { id: 8, name: 'Grace Hopper' }, subject: { id: 2, name: 'Statistics' } };

function renderPage() {
  return render(<MemoryRouter initialEntries={['/tutor-bookings']}><Routes><Route path="/tutor-bookings" element={<TutorBookingsPage />} /><Route path="/dashboard" element={<p>Dashboard</p>} /></Routes></MemoryRouter>);
}

describe('tutor booking requests page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { roles: ['student', 'tutor'], is_approved_tutor: true };
    api.tutorBookings.mockResolvedValue({ data: [] });
  });

  it('loads incoming requests and shows an empty state', async () => {
    renderPage();
    expect(await screen.findByText('No booking requests yet')).not.toBeNull();
    expect(api.tutorBookings).toHaveBeenCalledOnce();
  });

  it('shows a loading state until incoming requests have been retrieved', () => {
    api.tutorBookings.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status').textContent).toContain('Loading booking requests');
  });

  it('accepts and rejects only pending requests and reflects the returned statuses', async () => {
    const user = userEvent.setup();
    api.tutorBookings.mockResolvedValue({ data: [booking, { ...booking, id: 53 }] });
    api.acceptBooking.mockResolvedValue({ data: { ...booking, status: 'accepted' } });
    api.rejectBooking.mockResolvedValue({ data: { ...booking, id: 53, status: 'rejected' } });
    renderPage();

    expect(await screen.findAllByText('Grace Hopper')).toHaveLength(2);
    expect(screen.getAllByText('Statistics')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Booking details' })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'Accept request' })[0]);
    expect(api.acceptBooking).toHaveBeenCalledWith(52);
    expect(await screen.findByText('Booking request accepted.')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Reject request' }));
    expect(api.rejectBooking).toHaveBeenCalledWith(53);
    expect(await screen.findByText('Booking request rejected.')).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: /accepted/i }));
    expect(screen.getByText('Accepted', { selector: 'span.booking-status' })).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: /rejected/i }));
    expect(screen.getByText('Rejected', { selector: 'span.booking-status' })).not.toBeNull();
  });

  it('filters real booking records into separate status categories', async () => {
    const user = userEvent.setup();
    api.tutorBookings.mockResolvedValue({ data: [
      booking,
      { ...booking, id: 53, status: 'accepted' },
      { ...booking, id: 54, status: 'rejected' },
      { ...booking, id: 55, status: 'completed' },
      { ...booking, id: 56, status: 'cancelled' },
    ] });
    renderPage();

    expect(await screen.findByText('Grace Hopper')).not.toBeNull();
    expect(screen.getAllByText('Statistics')).toHaveLength(1);
    for (const [status, label] of [['accepted', 'Accepted'], ['rejected', 'Rejected'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]) {
      await user.click(screen.getByRole('tab', { name: new RegExp(label, 'i') }));
      expect(screen.getByText(status[0].toUpperCase() + status.slice(1), { selector: 'span.booking-status' })).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Accept request' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Reject request' })).toBeNull();
    }
  });

  it('shows completion only for an accepted session that has ended and refreshes its status', async () => {
    const user = userEvent.setup();
    const endedBooking = { ...booking, status: 'accepted', ends_at: '2000-06-01T10:00:00.000Z' };
    api.tutorBookings.mockResolvedValue({ data: [endedBooking] });
    api.completeBooking.mockResolvedValue({ data: { ...endedBooking, status: 'completed' } });
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /accepted/i }));
    await user.click(await screen.findByRole('button', { name: 'Mark as Completed' }));
    expect(api.completeBooking).toHaveBeenCalledWith(52);
    expect(await screen.findByText('Tutoring session marked as completed.')).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: /completed/i }));
    expect(screen.getByText('Completed', { selector: 'span.booking-status' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as Completed' })).toBeNull();
  });

  it('does not offer completion for pending or future accepted sessions', async () => {
    const user = userEvent.setup();
    api.tutorBookings.mockResolvedValue({ data: [
      { ...booking, id: 61, status: 'accepted', ends_at: '2999-06-01T10:00:00.000Z' },
      { ...booking, id: 62, status: 'pending', ends_at: '2000-06-01T10:00:00.000Z' },
    ] });
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /accepted/i }));
    expect(await screen.findByText('Grace Hopper')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as Completed' })).toBeNull();
    expect(api.completeBooking).not.toHaveBeenCalled();
  });

  it('keeps an accepted booking unchanged and shows the backend error when completion fails', async () => {
    const user = userEvent.setup();
    api.tutorBookings.mockResolvedValue({ data: [{ ...booking, status: 'accepted', ends_at: '2000-06-01T10:00:00.000Z' }] });
    api.completeBooking.mockRejectedValue({ message: 'The session end time has not passed.', errors: {} });
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /accepted/i }));
    await user.click(await screen.findByRole('button', { name: 'Mark as Completed' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The session end time has not passed.');
    expect(screen.getByText('Accepted', { selector: 'span.booking-status' })).not.toBeNull();
  });

  it('hides request management from a student without the Tutor role', async () => {
    auth.user = { roles: ['student'] };
    renderPage();
    expect(await screen.findByText('Dashboard')).not.toBeNull();
    expect(api.tutorBookings).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /booking requests/i })).toBeNull();
  });

  it('hides request management from Admin users', async () => {
    auth.user = { roles: ['admin'] };
    renderPage();
    expect(await screen.findByText('Dashboard')).not.toBeNull();
    expect(api.tutorBookings).not.toHaveBeenCalled();
  });
});
