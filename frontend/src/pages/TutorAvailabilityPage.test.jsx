import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import { formatLocalDateTime, localDateTimeToUtcIso, utcIsoToLocalDateTime } from '../utils/dateTime.js';
import TutorAvailabilityPage from './TutorAvailabilityPage.jsx';

vi.mock('../api/client.js', () => ({ api: {
  tutorAvailability: vi.fn(),
  createTutorAvailability: vi.fn(),
  updateTutorAvailability: vi.fn(),
  deleteTutorAvailability: vi.fn(),
} }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { roles: ['student', 'tutor'], is_approved_tutor: true } }) }));

const availability = { id: 17, starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z' };

function renderPage() {
  return render(<MemoryRouter><TutorAvailabilityPage /></MemoryRouter>);
}

function setIntervalValues(start = '2099-06-01T09:00', end = '2099-06-01T10:00') {
  fireEvent.change(screen.getByLabelText('Start date and time'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('End date and time'), { target: { value: end } });
}

describe('tutor availability page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.tutorAvailability.mockResolvedValue({ data: [] });
  });

  it('shows a loading state while availability is being fetched', () => {
    api.tutorAvailability.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('status').textContent).toContain('Loading your availability');
  });

  it('shows the empty state when no intervals exist', async () => {
    renderPage();

    expect(await screen.findByText(/No availability intervals yet/)).not.toBeNull();
  });

  it('shows an error state when the availability list cannot load', async () => {
    api.tutorAvailability.mockRejectedValue({ message: 'Unavailable', errors: {} });
    renderPage();

    expect(await screen.findByText(/Availability could not be loaded/)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeNull();
  });

  it('creates, edits, and deletes an availability interval', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.createTutorAvailability.mockResolvedValue({ data: availability });
    api.updateTutorAvailability.mockResolvedValue({ data: { ...availability, starts_at: '2099-06-01T11:00:00.000Z', ends_at: '2099-06-01T12:00:00.000Z' } });
    api.deleteTutorAvailability.mockResolvedValue(null);
    renderPage();

    await screen.findByText(/No availability intervals yet/);
    setIntervalValues();
    await user.click(screen.getByRole('button', { name: 'Add availability' }));
    expect(api.createTutorAvailability).toHaveBeenCalledWith({ starts_at: new Date('2099-06-01T09:00').toISOString(), ends_at: new Date('2099-06-01T10:00').toISOString() });
    expect(await screen.findByText('Availability added.')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    setIntervalValues('2099-06-01T11:00', '2099-06-01T12:00');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(api.updateTutorAvailability).toHaveBeenCalledWith(17, { starts_at: new Date('2099-06-01T11:00').toISOString(), ends_at: new Date('2099-06-01T12:00').toISOString() });
    expect(await screen.findByText('Availability updated.')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteTutorAvailability).toHaveBeenCalledWith(17);
    expect(await screen.findByText('Availability removed.')).not.toBeNull();
  });

  it('preserves an unchanged end instant while editing, then reloads the saved local times', async () => {
    const user = userEvent.setup();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const original = {
      id: 22,
      starts_at: localDateTimeToUtcIso('2030-07-15T21:00', zone),
      ends_at: localDateTimeToUtcIso('2030-07-15T22:00', zone),
    };
    api.tutorAvailability.mockResolvedValue({ data: [original] });
    const editedStart = localDateTimeToUtcIso('2030-07-15T21:01', zone);
    const updated = { ...original, starts_at: editedStart };
    api.updateTutorAvailability.mockResolvedValue({ data: updated });
    const view = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Start date and time').value).toBe('2030-07-15T21:00');
    expect(screen.getByLabelText('End date and time').value).toBe('2030-07-15T22:00');
    fireEvent.change(screen.getByLabelText('Start date and time'), { target: { value: '2030-07-15T21:01' } });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateTutorAvailability).toHaveBeenCalledWith(22, { starts_at: editedStart, ends_at: original.ends_at });
    expect(await screen.findByText('Availability updated.')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Start date and time').value).toBe('2030-07-15T21:01');
    expect(screen.getByLabelText('End date and time').value).toBe('2030-07-15T22:00');

    view.unmount();
    api.tutorAvailability.mockResolvedValue({ data: [updated] });
    renderPage();
    expect(await screen.findByText(formatLocalDateTime(updated.starts_at, zone))).not.toBeNull();
    expect(screen.getByText(formatLocalDateTime(updated.ends_at, zone))).not.toBeNull();
    expect(utcIsoToLocalDateTime(updated.ends_at, zone)).toBe('2030-07-15T22:00');
  });

  it('shows validation errors and preserves entered values when saving fails', async () => {
    const user = userEvent.setup();
    api.createTutorAvailability.mockRejectedValue({ message: 'Please correct the highlighted fields.', errors: { starts_at: ['Choose a future start time.'] } });
    renderPage();

    await screen.findByText(/No availability intervals yet/);
    setIntervalValues('2099-08-11T08:30', '2099-08-11T09:30');
    await user.click(screen.getByRole('button', { name: 'Add availability' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Choose a future start time.');
    expect(screen.getByLabelText('Start date and time').value).toBe('2099-08-11T08:30');
    expect(screen.getByLabelText('End date and time').value).toBe('2099-08-11T09:30');
  });
});
