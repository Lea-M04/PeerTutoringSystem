import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import ForgotPasswordPage from './ForgotPasswordPage.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';

vi.mock('../api/client.js', () => ({ api: { requestPasswordReset: vi.fn(), resetPassword: vi.fn() } }));

describe('password recovery pages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the forgotten email and displays the neutral API response', async () => {
    const user = userEvent.setup();
    api.requestPasswordReset.mockResolvedValue({ message: 'Your request was received, but this page cannot confirm delivery. If this address matches an account and the mail provider accepts the message, reset instructions should arrive shortly.' });
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email address'), 'person@example.test');
    await user.click(screen.getByRole('button', { name: /request reset link/i }));

    expect((await screen.findByRole('status')).textContent).toContain('cannot confirm delivery');
    expect(api.requestPasswordReset).toHaveBeenCalledWith('person@example.test');
  });

  it('shows the actual mail configuration error returned by the API', async () => {
    const user = userEvent.setup();
    api.requestPasswordReset.mockRejectedValue({
      message: 'Password reset email delivery is not configured. Please ask the project administrator.',
      errors: {},
    });
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

    await user.type(screen.getByLabelText('Email address'), 'person@example.test');
    await user.click(screen.getByRole('button', { name: /request reset link/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('email delivery is not configured');
    expect(screen.queryByText(/request was received/i)).toBeNull();
  });

  it('uses the link token/email and confirms a successful password reset', async () => {
    const user = userEvent.setup();
    api.resetPassword.mockResolvedValue({ message: 'Your password has been reset. You can now sign in.' });
    render(<MemoryRouter initialEntries={['/reset-password?token=reset-token&email=person%40example.test']}>
      <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/login" element={<p>Sign in page</p>} /></Routes>
    </MemoryRouter>);

    expect(screen.queryByText('reset-token')).toBeNull();
    expect(screen.queryByLabelText(/token/i)).toBeNull();
    expect(screen.queryByDisplayValue('reset-token')).toBeNull();

    await user.type(screen.getByLabelText(/^New password/), 'A-new-secure-password-123');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'A-new-secure-password-123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect((await screen.findByRole('status')).textContent).toContain('Your password has been reset');
    expect(api.resetPassword).toHaveBeenCalledWith({
      email: 'person@example.test', token: 'reset-token',
      password: 'A-new-secure-password-123', password_confirmation: 'A-new-secure-password-123',
    });
    await user.click(screen.getByRole('link', { name: 'Sign in', exact: true }));
    expect(screen.getByText('Sign in page')).not.toBeNull();
  });

  it('supports reset tokens in the path and never renders the token', async () => {
    const user = userEvent.setup();
    api.resetPassword.mockResolvedValue({ message: 'Your password has been reset.' });
    render(<MemoryRouter initialEntries={['/reset-password/path-secret?email=person%40example.test']}>
      <Routes><Route path="/reset-password/:token" element={<ResetPasswordPage />} /></Routes>
    </MemoryRouter>);

    expect(screen.queryByText('path-secret')).toBeNull();
    expect(screen.queryByDisplayValue('path-secret')).toBeNull();
    await user.type(screen.getByLabelText(/^New password/), 'A-new-secure-password-123');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'A-new-secure-password-123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(api.resetPassword).toHaveBeenCalledWith(expect.objectContaining({ token: 'path-secret' }));
  });

  it('shows a friendly recovery path when the reset token is missing', () => {
    render(<MemoryRouter initialEntries={['/reset-password']}>
      <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/forgot-password" element={<p>Forgot page</p>} /></Routes>
    </MemoryRouter>);

    expect(screen.getByRole('alert').textContent).toContain('missing its security information');
    expect(screen.getByRole('link', { name: /request a new link/i }).getAttribute('href')).toBe('/forgot-password');
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
  });

  it('shows a friendly message when the backend rejects an invalid or expired token', async () => {
    const user = userEvent.setup();
    api.resetPassword.mockRejectedValue({ status: 422, message: 'The password reset token is invalid.', errors: { email: ['The password reset token is invalid.'] } });
    render(<MemoryRouter initialEntries={['/reset-password?token=secret-value&email=person%40example.test']}>
      <Routes><Route path="/reset-password" element={<ResetPasswordPage />} /></Routes>
    </MemoryRouter>);

    await user.type(screen.getByLabelText(/^New password/), 'A-new-secure-password-123');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'A-new-secure-password-123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect((await screen.findByRole('alert')).textContent).toContain('invalid or has expired');
    expect(screen.queryByText('secret-value')).toBeNull();
  });
});
