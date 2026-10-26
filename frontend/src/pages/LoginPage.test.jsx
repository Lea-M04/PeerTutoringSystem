import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage.jsx';

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ login: auth.login }) }));

function renderLogin() {
  return render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/profile' } } }]}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Platform Homepage</p>} />
      <Route path="/profile" element={<p>Profile page</p>} />
    </Routes>
  </MemoryRouter>);
}

describe('login redirect', () => {
  it.each([
    ['Student', ['student']],
    ['Tutor', ['student', 'tutor']],
    ['Admin', ['admin']],
  ])('sends a successful %s login to Home instead of Profile', async (_role, roles) => {
    const user = userEvent.setup();
    auth.login.mockResolvedValue({ roles });
    renderLogin();

    await user.type(screen.getByLabelText('Email address'), 'learner@example.test');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Platform Homepage')).not.toBeNull();
    expect(screen.queryByText('Profile page')).toBeNull();
    expect(auth.login).toHaveBeenCalledWith({ email: 'learner@example.test', password: 'not-a-real-password' });
  });
});
