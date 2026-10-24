import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import UserProfileCard from './UserProfileCard.jsx';

const savedProfile = {
  id: 7,
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.test',
  faculty_or_university: 'Science Faculty',
  study_program: 'Computer Science',
  year_of_study: 2,
  biography: 'Curious about algorithms.',
  roles: ['student'],
};

describe('UserProfileCard', () => {
  it('shows saved backend fields and readable placeholders', () => {
    render(<UserProfileCard profile={savedProfile} onSave={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText('ada@example.test')).not.toBeNull();
    expect(screen.getByText('Ada Lovelace')).not.toBeNull();
    expect(screen.getByText('Science Faculty')).not.toBeNull();
    expect(screen.getByText('Computer Science')).not.toBeNull();
    expect(screen.getByText('2')).not.toBeNull();
    expect(screen.getByText('Curious about algorithms.')).not.toBeNull();
    expect(screen.queryAllByText('Not provided')).toHaveLength(0);
    expect(screen.queryByRole('textbox', { name: 'Email' })).toBeNull();
  });

  it('closes the form after saving and displays canonical returned values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ...savedProfile, first_name: 'Augusta' });
    const onSaved = vi.fn();
    render(<UserProfileCard profile={savedProfile} onSave={onSave} onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    const firstName = screen.getByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Augusta');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Your profile has been saved.'));
    expect(screen.queryByLabelText('First name')).toBeNull();
    expect(screen.getByText('Augusta')).not.toBeNull();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Augusta' }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Augusta' }));
  });

  it('keeps entered values and the form open when saving fails', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue({ message: 'Please check your details.', errors: { first_name: ['The first name is invalid.'] } });
    render(<UserProfileCard profile={savedProfile} onSave={onSave} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    const firstName = screen.getByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Changed');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('The first name is invalid.');
    expect(screen.getByLabelText('First name').value).toBe('Changed');
    expect(screen.getByRole('button', { name: /save profile/i })).not.toBeNull();
    expect(screen.queryByText('Your profile has been saved.')).toBeNull();
  });

  it('uses the browser validity rules before making a request', async () => {
    const onSave = vi.fn();
    render(<UserProfileCard profile={savedProfile} onSave={onSave} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: /save profile/i }).closest('form'));

    expect(onSave).not.toHaveBeenCalled();
  });
});
