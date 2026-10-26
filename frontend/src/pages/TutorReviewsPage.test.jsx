import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client.js';
import TutorReviewsPage from './TutorReviewsPage.jsx';

const auth = vi.hoisted(() => ({ user: { roles: ['student', 'tutor'], is_approved_tutor: true } }));
vi.mock('../api/client.js', () => ({ api: { tutorReviews: vi.fn() } }));
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: auth.user }) }));

describe('tutor reviews page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { roles: ['student', 'tutor'], is_approved_tutor: true };
  });

  it('renders the tutor aggregate and reviews returned by the API', async () => {
    api.tutorReviews.mockResolvedValue({ data: [{ id: 1, rating: 4, comment: 'Useful session.', created_at: '2099-06-01T10:00:00.000Z', reviewer: { name: 'Sam T.' } }], meta: { average_rating: 4, review_count: 1 } });
    render(<MemoryRouter><TutorReviewsPage /></MemoryRouter>);

    expect(await screen.findByText('★ 4.00')).not.toBeNull();
    expect(screen.getByText('Useful session.')).not.toBeNull();
    expect(screen.getByText('Sam T.')).not.toBeNull();
    expect(api.tutorReviews).toHaveBeenCalledOnce();
  });

  it('shows an empty state and prevents non-tutors from accessing the page', async () => {
    api.tutorReviews.mockResolvedValue({ data: [], meta: { average_rating: null, review_count: 0 } });
    const view = render(<MemoryRouter><TutorReviewsPage /></MemoryRouter>);
    expect(await screen.findByText('No reviews yet')).not.toBeNull();
    view.unmount();

    auth.user = { roles: ['student'] };
    render(<MemoryRouter><TutorReviewsPage /></MemoryRouter>);
    expect(screen.queryByRole('heading', { name: /reviews about you/i })).toBeNull();
    expect(api.tutorReviews).toHaveBeenCalledOnce();
  });
});
