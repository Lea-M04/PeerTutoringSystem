import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorOfferingsPage from './TutorOfferingsPage.jsx';

vi.mock('../api/client.js', () => ({
  api: {
    subjects: vi.fn(),
    tutorOfferings: vi.fn(),
    createTutorOffering: vi.fn(),
    updateTutorOffering: vi.fn(),
    deleteTutorOffering: vi.fn(),
  },
}));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { roles: ['student', 'tutor'] } }) }));

describe('TutorOfferingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.subjects.mockResolvedValue({ data: [{ id: 4, name: 'Statistics', is_active: true }] });
    api.tutorOfferings.mockResolvedValue({ data: [] });
  });

  it('loads catalogue subjects and submits a new tutor offering through the API', async () => {
    const user = userEvent.setup();
    api.createTutorOffering.mockResolvedValue({ data: { id: 8 } });
    render(<MemoryRouter><TutorOfferingsPage /></MemoryRouter>);

    await screen.findByRole('option', { name: 'Statistics' });
    await user.selectOptions(screen.getByLabelText('Active subject'), '4');
    await user.type(screen.getByLabelText(/Teaching focus/), 'Probability and data analysis');
    await user.click(screen.getByRole('button', { name: 'Add offering' }));

    await waitFor(() => expect(api.createTutorOffering).toHaveBeenCalledWith({
      subject_id: 4, description: 'Probability and data analysis',
    }));
    expect(await screen.findByRole('status')).not.toBeNull();
  });

  it('edits and removes the authenticated tutor offering and refreshes persisted values', async () => {
    const user = userEvent.setup();
    const original = { id: 8, description: 'Introductory statistics.', subject: { id: 4, name: 'Statistics' } };
    const updated = { ...original, description: 'Probability and data analysis.' };
    api.tutorOfferings.mockResolvedValueOnce({ data: [original] }).mockResolvedValue({ data: [updated] });
    api.updateTutorOffering.mockResolvedValue({ data: updated });
    api.deleteTutorOffering.mockResolvedValue(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<MemoryRouter><TutorOfferingsPage /></MemoryRouter>);

    const offeringCard = await screen.findByRole('article');
    await user.click(within(offeringCard).getByRole('button', { name: 'Edit' }));
    const focus = within(offeringCard).getByLabelText('Teaching focus');
    await user.clear(focus);
    await user.type(focus, 'Probability and data analysis.');
    await user.click(within(offeringCard).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.updateTutorOffering).toHaveBeenCalledWith(8, {
      subject_id: 4, description: 'Probability and data analysis.',
    }));
    expect(await screen.findByText('Probability and data analysis.')).not.toBeNull();

    await user.click(within(screen.getByRole('article')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.deleteTutorOffering).toHaveBeenCalledWith(8));
    expect(screen.queryByRole('article')).toBeNull();
    vi.restoreAllMocks();
  });
});
