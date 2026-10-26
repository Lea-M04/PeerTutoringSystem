import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './SiteLayout.jsx';

const auth = vi.hoisted(() => ({ value: { user: null, logout: vi.fn() } }));
const notificationApi = vi.hoisted(() => ({ unreadNotificationCount: vi.fn(), unreadMessageCount: vi.fn(), notifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
const realtime = vi.hoisted(() => {
  const channel = { listen: vi.fn() };
  return { channel, echo: { private: vi.fn(), leave: vi.fn() }, getEcho: vi.fn() };
});
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('../api/client.js', () => ({ api: notificationApi }));
vi.mock('../realtime/echo.js', () => ({ getEcho: realtime.getEcho }));

describe('authenticated navigation', () => {
  it('refreshes the aggregate unread count from the authenticated private user channel and cleans up', async () => {
    auth.value = { user: { id: 7, name: 'Alex Student', roles: ['student'] }, logout: vi.fn() };
    notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.unreadMessageCount.mockResolvedValue({ data: { unread_count: 3 } });
    realtime.getEcho.mockReturnValue(realtime.echo);
    realtime.echo.private.mockReturnValue(realtime.channel);
    realtime.channel.listen.mockReturnValue(realtime.channel);
    const view = render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(await screen.findByRole('link', { name: 'Messages, 3 unread messages' })).toBeTruthy();
    expect(realtime.echo.private).toHaveBeenCalledWith('users.7.chat');
    const unreadListener = realtime.channel.listen.mock.calls.find(([eventName]) => eventName === '.chat.unread-count.updated')?.[1];
    expect(unreadListener).toBeTypeOf('function');
    act(() => unreadListener({ conversation_id: 12 }));
    await screen.findByRole('link', { name: 'Messages, 3 unread messages' });

    view.unmount();
    expect(realtime.echo.leave).toHaveBeenCalledWith('users.7.chat');
  });

  it('opens role dropdowns independently and exposes profile and sign out', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    auth.value = { user: { name: 'Alex Student', roles: ['student', 'tutor'], is_approved_tutor: true }, logout };
    notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.unreadMessageCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.notifications.mockResolvedValue({ data: [], links: { next: null } });
    render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/');
    await user.click(screen.getByText('Student', { selector: 'summary' }));
    expect(screen.getByRole('link', { name: 'Find Tutors' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'My Bookings' })).not.toBeNull();
    expect(screen.getByText('Find Tutors').closest('details')).not.toBe(screen.getByText('Booking Requests').closest('details'));

    await user.click(screen.getByText('Tutor', { selector: 'summary' }));
    expect(screen.getByRole('link', { name: 'Booking Requests' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'My Subjects / Offerings' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'My Availability' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Reviews About Me' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Find Tutors' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Manage Subjects' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Manage Users' })).toBeNull();

    await user.click(screen.getByLabelText('Open profile menu for Alex Student'));
    expect(screen.getByRole('link', { name: 'My Profile' }).getAttribute('href')).toBe('/profile');
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('hides Tutor navigation from a user without approved tutor status', async () => {
    const user = userEvent.setup();
    auth.value = { user: { roles: ['student', 'tutor'], is_approved_tutor: false }, logout: vi.fn() };
    notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.unreadMessageCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.notifications.mockResolvedValue({ data: [], links: { next: null } });
    render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(screen.getByText('Student', { selector: 'summary' })).not.toBeNull();
    expect(screen.queryByText('Tutor', { selector: 'summary' })).toBeNull();
    await user.click(screen.getByText('Student', { selector: 'summary' }));
    expect(screen.getByRole('link', { name: 'Tutor application' })).not.toBeNull();
  });

  it('keeps administrator navigation separate from Student and Tutor menus', async () => {
    const user = userEvent.setup();
    auth.value = { user: { roles: ['admin'] }, logout: vi.fn() };
    notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.unreadMessageCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.notifications.mockResolvedValue({ data: [], links: { next: null } });
    render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(screen.getByText('Admin', { selector: 'summary' })).not.toBeNull();
    expect(screen.queryByText('Student', { selector: 'summary' })).toBeNull();
    expect(screen.queryByText('Tutor', { selector: 'summary' })).toBeNull();
    await user.click(screen.getByText('Admin', { selector: 'summary' }));
    expect(screen.getByRole('link', { name: 'Subject Management' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'User Management' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Tutor Applications' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Tutor Offering Management' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Booking Management' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Manage My Teaching Subjects' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'My Availability' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'My Bookings' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Booking Requests' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Reviews About Me' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Find Tutors' })).toBeNull();
  });

  it('shows the aggregate unread message count and hides the badge at zero', async () => {
    auth.value = { user: { id: 7, name: 'Alex Student', roles: ['student'] }, logout: vi.fn() };
    notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
    notificationApi.unreadMessageCount.mockResolvedValueOnce({ data: { unread_count: 125 } })
      .mockResolvedValueOnce({ data: { unread_count: 0 } });
    notificationApi.notifications.mockResolvedValue({ data: [], links: { next: null } });
    const view = render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(await screen.findByRole('link', { name: 'Messages, 125 unread messages' })).toBeTruthy();
    expect(screen.getByText('99+')).toBeTruthy();
    view.unmount();
    render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Messages' })).toBeTruthy();
    expect(screen.queryByText('99+')).toBeNull();
  });

  it('refreshes the aggregate count periodically and clears its timer on unmount', async () => {
    vi.useFakeTimers();
    let view;
    try {
      auth.value = { user: { id: 8, name: 'Student', roles: ['student'] }, logout: vi.fn() };
      notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
      notificationApi.unreadMessageCount.mockResolvedValue({ data: { unread_count: 2 } });
      notificationApi.notifications.mockResolvedValue({ data: [], links: { next: null } });
      view = render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(screen.getByRole('link', { name: 'Messages, 2 unread messages' })).toBeTruthy();
      expect(notificationApi.unreadMessageCount).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(notificationApi.unreadMessageCount).toHaveBeenCalledTimes(2);
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      view?.unmount();
      vi.useRealTimers();
    }
  });
});
