import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import { formatLocalDateTime } from '../utils/dateTime.js';
import StudentBookingsPage from './StudentBookingsPage.jsx';

const auth = vi.hoisted(() => ({ user: { roles: ['student'] } }));
vi.mock('../api/client.js', () => ({ api: { studentBookings: vi.fn(), cancelBooking: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));

const booking = { id: 41, status: 'pending', starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z', created_at: '2099-05-01T10:00:00.000Z', tutor: { id: 7, name: 'Ada Lovelace' }, subject: { id: 2, name: 'Statistics' } };

function renderPage() {
  return render(<MemoryRouter><StudentBookingsPage /></MemoryRouter>);
}

describe('student bookings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { roles: ['student'] };
    api.studentBookings.mockResolvedValue({ data: [] });
  });

  it('shows loading, empty, and error states', async () => {
    api.studentBookings.mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(screen.getByRole('status').textContent).toContain('Loading your bookings');
    unmount();

    const emptyView = renderPage();
    expect(await screen.findByText('No bookings yet')).not.toBeNull();
    emptyView.unmount();
    api.studentBookings.mockRejectedValueOnce({ message: 'The request could not be completed.', errors: {} });
    renderPage();
    expect(await screen.findByText('The request could not be completed.')).not.toBeNull();
  });

  it('lists the actual booking, links to details, and cancels when requested', async () => {
    const user = userEvent.setup();
    api.studentBookings.mockResolvedValue({ data: [booking] });
    api.cancelBooking.mockResolvedValue({ data: { ...booking, status: 'cancelled' } });
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /pending/i }));
    expect(await screen.findByText('Ada Lovelace')).not.toBeNull();
    expect(screen.getByText('Pending', { selector: 'span.booking-status' })).not.toBeNull();
    expect(screen.getByText('Statistics')).not.toBeNull();
    expect(screen.getByText(formatLocalDateTime(booking.starts_at))).not.toBeNull();
    expect(screen.getByText(formatLocalDateTime(booking.ends_at))).not.toBeNull();
    expect(screen.getByRole('link', { name: /booking details/i }).getAttribute('href')).toBe('/bookings/41');
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(api.cancelBooking).toHaveBeenCalledWith(41);
    expect(await screen.findByText('Your booking was cancelled.')).not.toBeNull();
    await user.click(screen.getByRole('tab', { name: /cancelled/i }));
    expect(screen.getByText('Cancelled', { selector: 'span.booking-status' })).not.toBeNull();
  });

  it('keeps the booking visible and shows the backend cancellation error', async () => {
    const user = userEvent.setup();
    api.studentBookings.mockResolvedValue({ data: [booking] });
    api.cancelBooking.mockRejectedValue({ status: 409, message: 'Bookings can only be cancelled at least 12 hours before they start.', errors: {} });
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /pending/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Bookings can only be cancelled at least 12 hours before they start.');
    expect(screen.getByText('Pending', { selector: 'span.booking-status' })).not.toBeNull();
  });

  it('does not offer cancellation inside the 12-hour window or for completed bookings', async () => {
    api.studentBookings.mockResolvedValue({ data: [
      { ...booking, starts_at: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString() },
      { ...booking, id: 42, status: 'completed', starts_at: '2099-06-01T09:00:00.000Z' },
    ] });
    renderPage();

    await userEvent.setup().click(await screen.findByRole('tab', { name: /pending/i }));
    expect(await screen.findAllByText('Ada Lovelace')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
    expect(screen.getByText(/at least 12 hours before the start time/i)).not.toBeNull();
  });

  it('makes a completed booking without a review discoverable from the booking list', async () => {
    api.studentBookings.mockResolvedValue({ data: [{ ...booking, status: 'completed', review: null }] });
    renderPage();

    await userEvent.setup().click(await screen.findByRole('tab', { name: /completed/i }));
    expect(await screen.findByRole('link', { name: /leave a review/i })).not.toBeNull();
  });

  it('does not expose the student booking screen to an admin', () => {
    auth.user = { roles: ['admin'] };
    renderPage();
    expect(screen.queryByRole('heading', { name: /my bookings/i })).toBeNull();
    expect(api.studentBookings).not.toHaveBeenCalled();
  });
});
