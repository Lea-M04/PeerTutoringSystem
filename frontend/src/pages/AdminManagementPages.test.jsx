import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import AdminBookingDetailPage from './AdminBookingDetailPage.jsx';
import AdminBookingsPage from './AdminBookingsPage.jsx';
import AdminTutorOfferingsPage from './AdminTutorOfferingsPage.jsx';

const auth = vi.hoisted(() => ({ user: { roles: ['admin'] } }));
vi.mock('../api/client.js', () => ({ api: {
  adminTutors: vi.fn(), adminSubjects: vi.fn(), adminTutorOfferings: vi.fn(),
  createAdminTutorOffering: vi.fn(), updateAdminTutorOffering: vi.fn(), deleteAdminTutorOffering: vi.fn(),
  adminBookings: vi.fn(), adminBooking: vi.fn(),
} }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));

const tutor = { id: 7, name: 'Ada Lovelace' };
const subject = { id: 3, name: 'Statistics', is_active: true };
const offering = { id: 19, tutor: tutor, subject, description: 'Probability.', is_active: true };
const booking = {
  id: 44, status: 'completed', starts_at: '2099-06-01T09:00:00.000Z', ends_at: '2099-06-01T10:00:00.000Z',
  created_at: '2099-05-01T10:00:00.000Z', student: { name: 'Grace Hopper' }, tutor, subject,
};

function renderOfferings() {
  return render(<MemoryRouter><AdminTutorOfferingsPage /></MemoryRouter>);
}

describe('Admin management pages', () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { roles: ['admin'] };
    api.adminTutors.mockResolvedValue({ data: [tutor] });
    api.adminSubjects.mockResolvedValue({ data: [subject, { id: 4, name: 'Inactive Subject', is_active: false }] });
    api.adminTutorOfferings.mockResolvedValue({ data: [offering] });
    api.adminBookings.mockResolvedValue({ data: [booking] });
    api.adminBooking.mockResolvedValue({ data: booking });
  });

  it('lets Admin create offerings linked to a real approved Tutor and catalogue subject', async () => {
    const user = userEvent.setup();
    const createdOffering = { ...offering, id: 20, description: 'Linear algebra.' };
    api.createAdminTutorOffering.mockResolvedValue({ data: createdOffering });
    renderOfferings();

    expect(await screen.findByText('Ada Lovelace → Statistics')).not.toBeNull();
    await user.selectOptions(screen.getByLabelText('Approved tutor'), '7');
    await user.selectOptions(screen.getByLabelText('Catalogue subject'), '3');
    await user.type(screen.getByLabelText('Teaching focus (optional)'), 'Linear algebra.');
    await user.click(screen.getByRole('button', { name: 'Add offering' }));

    expect(api.createAdminTutorOffering).toHaveBeenCalledWith({ tutor_profile_id: 7, subject_id: 3, description: 'Linear algebra.' });
    expect(await screen.findByText('Tutor offering created.')).not.toBeNull();
  });

  it('keeps offering removal errors visible and never deletes on its own', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteAdminTutorOffering.mockRejectedValue({ status: 409, message: 'This offering is linked to booking history and cannot be removed.', errors: {} });
    renderOfferings();

    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(api.deleteAdminTutorOffering).toHaveBeenCalledWith(19);
    expect((await screen.findByRole('alert')).textContent).toContain('booking history');
    expect(screen.getByText('Ada Lovelace → Statistics')).not.toBeNull();
  });

  it('hides tutor offering management from a Student and avoids its Admin API calls', async () => {
    auth.user = { roles: ['student'] };
    render(<MemoryRouter initialEntries={['/admin/tutor-offerings']}><Routes><Route path="/admin/tutor-offerings" element={<AdminTutorOfferingsPage />} /><Route path="/" element={<p>Home</p>} /></Routes></MemoryRouter>);

    expect(await screen.findByText('Home')).not.toBeNull();
    expect(api.adminTutors).not.toHaveBeenCalled();
  });

  it('filters system bookings and opens read-only booking details', async () => {
    const user = userEvent.setup();
    const listView = render(<MemoryRouter><AdminBookingsPage /></MemoryRouter>);

    expect(await screen.findByText('Grace Hopper')).not.toBeNull();
    await user.selectOptions(screen.getByLabelText('Booking status'), 'completed');
    await user.type(screen.getByLabelText('Search by Student, Tutor, or subject'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(api.adminBookings).toHaveBeenLastCalledWith({ status: 'completed', search: 'Ada' });
    expect(await screen.findByRole('link', { name: /booking details/i })).not.toBeNull();

    listView.unmount();
    api.adminBooking.mockResolvedValue({ data: booking });
    render(<MemoryRouter initialEntries={['/admin/bookings/44']}><Routes><Route path="/admin/bookings/:bookingId" element={<AdminBookingDetailPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Subject', { selector: 'dt' })).not.toBeNull();
    expect(screen.getByText('Completed', { selector: 'span.booking-status' })).not.toBeNull();
    expect(api.adminBooking).toHaveBeenCalledWith('44');
  });
});
