import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute.jsx';

const auth = vi.hoisted(() => ({ value: { user: null, loading: false } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => auth.value }));

describe('protected booking routes', () => {
  it('redirects unauthenticated users to login instead of rendering protected content', async () => {
    auth.value = { user: null, loading: false };
    render(<MemoryRouter initialEntries={['/bookings']}><Routes>
      <Route path="/bookings" element={<ProtectedRoute><p>My bookings</p></ProtectedRoute>} />
      <Route path="/login" element={<p>Login page</p>} />
    </Routes></MemoryRouter>);

    expect(await screen.findByText('Login page')).not.toBeNull();
    expect(screen.queryByText('My bookings')).toBeNull();
  });
});
