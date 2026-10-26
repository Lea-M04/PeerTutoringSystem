import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { api } from './api/client.js';

const auth = vi.hoisted(() => ({ value: { user: null, loading: false, logout: vi.fn() } }));
vi.mock('./auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));
vi.mock('./api/client.js', () => ({ api: {
  tutorDirectory: vi.fn(), tutorApplications: vi.fn(), currentUser: vi.fn(), notifications: vi.fn(),
  unreadNotificationCount: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
} }));

function renderApp(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('homepage route and profile navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.value = { user: null, loading: false, logout: vi.fn() };
    api.tutorDirectory.mockResolvedValue({ data: [] });
    api.tutorApplications.mockResolvedValue({ data: [] });
    api.currentUser.mockResolvedValue({ data: { name: 'Alex Student', roles: ['student'] } });
    api.notifications.mockResolvedValue({ data: [], links: { next: null } });
    api.unreadNotificationCount.mockResolvedValue({ data: { unread_count: 0 } });
  });

  it.each([
    ['Student', { id: 1, name: 'Alex Student', roles: ['student'] }],
    ['Tutor', { id: 2, name: 'Alex Tutor', roles: ['student', 'tutor'], is_approved_tutor: true }],
    ['Admin', { id: 3, name: 'Alex Admin', roles: ['admin'] }],
  ])('%s lands on the platform Homepage at /', async (_role, user) => {
    auth.value = { user, loading: false, logout: vi.fn() };
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /a stronger campus starts with each other/i })).not.toBeNull();
    expect(screen.queryByText(/profile at a glance/i)).toBeNull();
  });

  it('opens Profile only through its separate profile-menu link and Home returns to the Homepage', async () => {
    const user = userEvent.setup();
    auth.value = { user: { id: 1, name: 'Alex Student', roles: ['student'] }, loading: false, logout: vi.fn() };
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: /a stronger campus starts with each other/i })).not.toBeNull();
    await user.click(screen.getByLabelText('Open profile menu for Alex Student'));
    await user.click(screen.getByRole('link', { name: 'My Profile' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My profile.' })).not.toBeNull();
    expect(api.currentUser).toHaveBeenCalledOnce();

    await user.click(screen.getAllByRole('link', { name: 'Peerwise home' })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: /a stronger campus starts with each other/i })).not.toBeNull();
  });
});
