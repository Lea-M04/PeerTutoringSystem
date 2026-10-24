import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SiteLayout } from './SiteLayout.jsx';

const auth = vi.hoisted(() => ({ value: { user: null, logout: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));

describe('authenticated navigation', () => {
  it('shows student discovery and tutor offering management to a dual-role tutor', () => {
    auth.value = { user: { roles: ['student', 'tutor'] }, logout: vi.fn() };
    render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Find Tutors' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Manage My Teaching Subjects' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Manage Subjects' })).toBeNull();
  });

  it('keeps administrator subject catalogue navigation separate from tutor offerings', () => {
    auth.value = { user: { roles: ['admin'] }, logout: vi.fn() };
    render(<MemoryRouter><SiteLayout><p>page</p></SiteLayout></MemoryRouter>);

    expect(screen.getByRole('link', { name: 'Manage Subjects' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Manage My Teaching Subjects' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Find Tutors' })).toBeNull();
  });
});
