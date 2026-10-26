import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import NotificationBell from './NotificationBell.jsx';

vi.mock('../api/client.js', () => ({ api: {
  notifications: vi.fn(), unreadNotificationCount: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
} }));

const student = { roles: ['student'] };
const bookingNotification = {
  id: 18,
  type: 'booking_accepted',
  title: 'Booking accepted',
  message: 'Your tutor accepted the tutoring session request.',
  resource_type: 'booking',
  resource_id: 72,
  read_at: null,
  created_at: '2026-10-26T10:00:00.000Z',
};

function renderBell(user = student) {
  return render(<MemoryRouter initialEntries={['/']}><Routes>
    <Route path="/" element={<><NotificationBell user={user} /><p>Navigation remains available</p></>} />
    <Route path="/bookings/:bookingId" element={<p>Student booking details</p>} />
    <Route path="/tutor-bookings/:bookingId" element={<p>Tutor booking details</p>} />
    <Route path="/tutor-application" element={<p>Tutor application history</p>} />
  </Routes></MemoryRouter>);
}

async function openNotifications(user) {
  await user.click(await screen.findByLabelText('Notifications, 2 unread'));
}

describe('notification bell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 2 } });
    api.notifications.mockResolvedValue({ data: [bookingNotification], links: { next: null } });
    api.markNotificationRead.mockImplementation(async (id) => ({ data: { ...bookingNotification, id, read_at: '2026-10-26T10:01:00.000Z' } }));
    api.markAllNotificationsRead.mockResolvedValue({ data: { marked_read: 1 } });
  });

  it('shows the API unread count and loads the persisted notification list when opened', async () => {
    const user = userEvent.setup();
    renderBell();

    expect(await screen.findByLabelText('2 unread notifications')).not.toBeNull();
    await openNotifications(user);

    expect(await screen.findByText('Your tutor accepted the tutoring session request.')).not.toBeNull();
    expect(screen.getByText('Booking accepted').closest('li').className).toContain('is-unread');
    expect(api.notifications).toHaveBeenCalledWith(1);
    expect(api.unreadNotificationCount).toHaveBeenCalledTimes(2);
  });

  it('marks one notification as read and navigates to its valid Student booking page', async () => {
    const user = userEvent.setup();
    renderBell();
    await openNotifications(user);
    await user.click(await screen.findByRole('button', { name: 'Open notification: Booking accepted, unread' }));

    expect(api.markNotificationRead).toHaveBeenCalledWith(18);
    expect(await screen.findByText('Student booking details')).not.toBeNull();
  });

  it('marks all loaded notifications read and refreshes the unread badge', async () => {
    const user = userEvent.setup();
    api.unreadNotificationCount
      .mockResolvedValueOnce({ data: { unread_count: 2 } })
      .mockResolvedValueOnce({ data: { unread_count: 2 } })
      .mockResolvedValueOnce({ data: { unread_count: 0 } });
    renderBell();
    await openNotifications(user);
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));

    expect(api.markAllNotificationsRead).toHaveBeenCalledOnce();
    expect(await screen.findByText('0 unread')).not.toBeNull();
    expect(screen.getByText('Booking accepted').closest('li').className).toContain('is-read');
  });

  it('shows a loading state while the opened notification list is pending', async () => {
    const user = userEvent.setup();
    let resolveList;
    api.notifications.mockReturnValueOnce(new Promise((resolve) => { resolveList = resolve; }));
    renderBell();
    await openNotifications(user);

    expect(await screen.findByRole('status')).not.toBeNull();
    resolveList({ data: [], links: { next: null } });
    expect(await screen.findByText(/you’re all caught up/i)).not.toBeNull();
  });

  it('loads the next notification page without losing the first page', async () => {
    const user = userEvent.setup();
    api.notifications.mockResolvedValueOnce({ data: [bookingNotification], links: { next: '/api/notifications?page=2' } })
      .mockResolvedValueOnce({ data: [{ ...bookingNotification, id: 19, title: 'Older update', read_at: '2026-10-25T10:00:00.000Z' }], links: { next: null } });
    renderBell();
    await openNotifications(user);
    await screen.findByText('Booking accepted');
    await user.click(screen.getByRole('button', { name: 'Load older notifications' }));

    expect(await screen.findByText('Older update')).not.toBeNull();
    expect(screen.getByText('Booking accepted')).not.toBeNull();
    expect(api.notifications).toHaveBeenNthCalledWith(2, 2);
  });

  it('shows an empty state and keeps other navigation usable when the list request fails', async () => {
    const user = userEvent.setup();
    api.notifications.mockRejectedValueOnce({ message: 'Notification service unavailable.' });
    renderBell();
    expect(screen.getByText('Navigation remains available')).not.toBeNull();
    await openNotifications(user);
    expect(await screen.findByRole('alert')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
    expect(screen.getByText('Navigation remains available')).not.toBeNull();
  });

  it('marks an unsupported destination as read without navigating to an invented route', async () => {
    const user = userEvent.setup();
    api.notifications.mockResolvedValueOnce({
      data: [{ ...bookingNotification, id: 19, type: 'unknown_event', resource_id: 999 }],
      links: { next: null },
    });
    renderBell();
    await openNotifications(user);
    const item = (await screen.findByRole('button', { name: 'Open notification: Booking accepted, unread' })).closest('li');
    await user.click(screen.getByRole('button', { name: 'Open notification: Booking accepted, unread' }));

    expect(api.markNotificationRead).toHaveBeenCalledWith(19);
    expect(item.className).toContain('is-read');
    expect(screen.getByText('Navigation remains available')).not.toBeNull();
  });
});
