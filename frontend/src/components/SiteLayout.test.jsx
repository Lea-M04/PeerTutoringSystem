import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './SiteLayout.jsx';

const auth = vi.hoisted(() => ({ value: { user: null, logout: vi.fn() } }));
const notificationApi = vi.hoisted(() => ({ unreadNotificationCount: vi.fn(), notifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn() }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('../api/client.js', () => ({ api: notificationApi }));

describe('authenticated navigation', () => {
  it('opens role dropdowns independently and exposes profile and sign out', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    auth.value = { user: { name: 'Alex Student', roles: ['student', 'tutor'], is_approved_tutor: true }, logout };
    notificationApi.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
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
});
