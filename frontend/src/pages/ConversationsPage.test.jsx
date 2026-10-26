import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationsPage, { mergeMessages } from './ConversationsPage.jsx';
import { api } from '../api/client.js';

const realtime = vi.hoisted(() => {
  const channel = { listen: vi.fn() };
  return { channel, echo: { private: vi.fn(), leave: vi.fn() }, getEcho: vi.fn() };
});

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 7, name: 'Student One', roles: ['student'] } }),
}));

vi.mock('../api/client.js', () => ({
  api: {
    conversations: vi.fn(),
    conversationMessages: vi.fn(),
    markConversationRead: vi.fn(),
    sendConversationMessage: vi.fn(),
    privateMessageImage: vi.fn(),
  },
}));

vi.mock('../realtime/echo.js', () => ({ getEcho: realtime.getEcho }));

const conversation = {
  id: 11,
  student: { id: 7, name: 'Student One' },
  tutor: { profile_id: 4, user_id: 9, name: 'Tutor Two' },
  latest_message: null,
  unread_count: 0,
};

function renderMessages(path = '/messages/11') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/messages" element={<ConversationsPage />} />
    <Route path="/messages/:conversationId" element={<ConversationsPage />} />
  </Routes></MemoryRouter>);
}

function savedMessage(overrides = {}) {
  return {
    id: 21,
    client_message_id: `saved-${overrides.id || 21}`,
    body: 'Welcome to the chat.',
    read_at: null,
    created_at: '2026-10-26T10:00:00.000Z',
    sender: { id: 9, name: 'Tutor Two' },
    attachments: [],
    ...overrides,
  };
}

describe('ConversationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtime.channel.listen.mockReturnValue(realtime.channel);
    realtime.echo.private.mockReturnValue(realtime.channel);
    realtime.getEcho.mockReturnValue(realtime.echo);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:chat-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    api.conversations.mockResolvedValue({ data: [conversation] });
    api.conversationMessages.mockResolvedValue({ data: [], meta: { next_cursor: null } });
    api.markConversationRead.mockResolvedValue({ data: { read_at: '2026-10-26T10:01:00.000Z' } });
  });

  it('shows a per-conversation unread count', async () => {
    api.conversations.mockResolvedValue({ data: [{ ...conversation, unread_count: 4 }] });
    renderMessages('/messages');

    expect(await screen.findByLabelText('4 unread messages')).toBeTruthy();
  });

  it('renders the conversation list and persisted message history with read state', async () => {
    api.conversationMessages.mockResolvedValue({
      data: [
        savedMessage({ id: 22, body: 'I can help.', sender: { id: 7, name: 'Student One' }, read_at: '2026-10-26T10:00:00.000Z' }),
        savedMessage(),
      ],
      meta: { next_cursor: null },
    });

    renderMessages();

    expect(await screen.findByRole('heading', { name: /tutor two/i })).toBeTruthy();
    expect(screen.getByText('Welcome to the chat.')).toBeTruthy();
    expect(screen.getByText('I can help.')).toBeTruthy();
    expect(screen.getByText('Read')).toBeTruthy();
    await waitFor(() => expect(api.markConversationRead).toHaveBeenCalledWith('11', 21));
  });

  it('shows an empty state and a network error for conversation loading failures', async () => {
    api.conversations.mockResolvedValueOnce({ data: [] });
    renderMessages('/messages');
    expect(await screen.findByText('No conversations yet.')).toBeTruthy();

    api.conversations.mockRejectedValueOnce(new Error('Network unavailable'));
    renderMessages('/messages');
    expect((await screen.findByRole('alert')).textContent).toContain('Conversations could not be loaded.');
  });

  it('shows history loading and request failure states', async () => {
    let resolveHistory;
    api.conversationMessages.mockReturnValueOnce(new Promise((resolve) => { resolveHistory = resolve; }));
    renderMessages();

    expect(await screen.findByText('Loading messages…')).toBeTruthy();
    resolveHistory({ data: [], meta: { next_cursor: null } });
    expect(await screen.findByText('No messages yet. Send the first message.')).toBeTruthy();

    api.conversationMessages.mockRejectedValueOnce(new Error('History unavailable'));
    renderMessages();
    expect((await screen.findByRole('alert')).textContent).toContain('History unavailable');
  });

  it('loads every conversation page without duplicating existing conversations', async () => {
    const secondConversation = {
      ...conversation,
      id: 12,
      tutor: { profile_id: 5, user_id: 10, name: 'Tutor Three' },
    };
    api.conversations.mockResolvedValueOnce({ data: [conversation], meta: { current_page: 1, last_page: 2 } })
      .mockResolvedValueOnce({ data: [conversation, secondConversation], meta: { current_page: 2, last_page: 2 } });
    const user = userEvent.setup();
    renderMessages('/messages');

    expect(await screen.findByRole('link', { name: /tutor two/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Load more conversations' }));

    expect(await screen.findByRole('link', { name: /tutor three/i })).toBeTruthy();
    expect(api.conversations).toHaveBeenNthCalledWith(2, 2);
    expect(screen.getAllByRole('link', { name: /tutor two/i })).toHaveLength(1);
  });

  it('provides a back-to-conversations control from a selected conversation', async () => {
    const user = userEvent.setup();
    renderMessages();
    const back = await screen.findByRole('link', { name: 'Back to conversations' });
    expect(back.getAttribute('href')).toBe('/messages');
    await user.click(back);
    expect(await screen.findByRole('heading', { name: 'Select a conversation' })).toBeTruthy();
  });

  it('keeps loaded conversations visible when a later page fails and can retry it', async () => {
    const secondConversation = {
      ...conversation,
      id: 12,
      tutor: { profile_id: 5, user_id: 10, name: 'Tutor Three' },
    };
    api.conversations.mockResolvedValueOnce({ data: [conversation], meta: { current_page: 1, last_page: 2 } })
      .mockRejectedValueOnce(new Error('Page unavailable'))
      .mockResolvedValueOnce({ data: [secondConversation], meta: { current_page: 2, last_page: 2 } });
    const user = userEvent.setup();
    renderMessages('/messages');

    await user.click(await screen.findByRole('button', { name: 'Load more conversations' }));
    expect((await screen.findByRole('alert')).textContent).toContain('More conversations could not be loaded.');
    expect(screen.getByRole('link', { name: /tutor two/i })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: /tutor three/i })).toBeTruthy();
  });

  it('sends text and avoids rendering the same persisted message twice', async () => {
    const user = userEvent.setup();
    api.sendConversationMessage.mockImplementation((_conversationId, operation) => Promise.resolve({
      data: savedMessage({ id: 25, client_message_id: operation.clientMessageId, body: 'Thanks!', sender: { id: 7, name: 'Student One' } }),
    }));
    renderMessages();

    await user.type(await screen.findByLabelText('Message'), 'Thanks!');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const messageThread = screen.getByRole('region', { name: 'Message thread' });
    expect(within(messageThread).getByText('Thanks!')).toBeTruthy();
    expect(api.sendConversationMessage).toHaveBeenCalledWith('11', expect.objectContaining({ body: 'Thanks!' }));
    expect(within(messageThread).getAllByText('Thanks!')).toHaveLength(1);
    expect(mergeMessages([savedMessage()], [savedMessage()])).toHaveLength(1);
  });

  it('renders an optimistic message immediately and reconciles its WebSocket and API copies', async () => {
    const user = userEvent.setup();
    let completeRequest;
    api.sendConversationMessage.mockReturnValue(new Promise((resolve) => { completeRequest = resolve; }));
    renderMessages();

    await user.type(await screen.findByLabelText('Message'), 'Visible immediately');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const messageThread = screen.getByRole('region', { name: 'Message thread' });
    expect(messageThread.querySelectorAll('.chat-message')).toHaveLength(1);
    expect(messageThread.querySelector('.chat-message-bubble p').textContent).toBe('Visible immediately');
    expect(messageThread.querySelector('.chat-message-bubble footer span').textContent).toBe('Sending…');

    const clientMessageId = api.sendConversationMessage.mock.calls[0][1].clientMessageId;
    const messageListener = realtime.channel.listen.mock.calls
      .find(([eventName]) => eventName === '.chat.message.created')[1];
    const persistedMessage = savedMessage({
      id: 82,
      client_message_id: clientMessageId,
      body: 'Visible immediately',
      sender: { id: 7, name: 'Student One' },
    });

    act(() => messageListener({ conversation_id: 11, message: persistedMessage }));
    expect(messageThread.querySelectorAll('.chat-message')).toHaveLength(1);
    expect(within(messageThread).getByText('Sent')).toBeTruthy();

    completeRequest({ data: persistedMessage });
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledOnce());
    expect(within(messageThread).getAllByText('Visible immediately')).toHaveLength(1);
  });

  it('keeps a failed optimistic message visible with retry feedback', async () => {
    const user = userEvent.setup();
    api.sendConversationMessage.mockRejectedValueOnce(new Error('Network unavailable'));
    renderMessages();

    await user.type(await screen.findByLabelText('Message'), 'Retry me');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const messageThread = screen.getByRole('region', { name: 'Message thread' });
    expect(messageThread.querySelectorAll('.chat-message')).toHaveLength(1);
    expect(messageThread.querySelector('.chat-message-bubble p').textContent).toBe('Retry me');
    expect(await within(messageThread).findByText('Failed to send · retry')).toBeTruthy();
    expect(api.sendConversationMessage).toHaveBeenCalledOnce();
  });

  it('sends with Enter, keeps Shift+Enter as a newline, and rejects whitespace', async () => {
    const user = userEvent.setup();
    api.sendConversationMessage.mockImplementation((_conversationId, operation) => Promise.resolve({
      data: savedMessage({ id: 40, client_message_id: operation.clientMessageId, body: 'First line\nSecond line', sender: { id: 7, name: 'Student One' } }),
    }));
    renderMessages();
    const textarea = await screen.findByLabelText('Message');

    await user.type(textarea, 'First line');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'Second line');
    expect(api.sendConversationMessage).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledOnce());
    expect(api.sendConversationMessage.mock.calls[0][1].body).toBe('First line\nSecond line');

    await user.type(textarea, '   ');
    expect(screen.getByRole('button', { name: 'Send message' }).disabled).toBe(true);
  });

  it('prevents a second submission while the first message request is pending', async () => {
    const user = userEvent.setup();
    let completeRequest;
    api.sendConversationMessage.mockReturnValue(new Promise((resolve) => { completeRequest = resolve; }));
    renderMessages();
    await user.type(await screen.findByLabelText('Message'), 'Only send once');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await user.click(screen.getByRole('button', { name: 'Sending…' }));

    expect(api.sendConversationMessage).toHaveBeenCalledOnce();
    completeRequest({ data: savedMessage({
      id: 41,
      client_message_id: api.sendConversationMessage.mock.calls[0][1].clientMessageId,
      body: 'Only send once',
      sender: { id: 7, name: 'Student One' },
    }) });
    const messageThread = screen.getByRole('region', { name: 'Message thread' });
    expect(messageThread.querySelectorAll('.chat-message')).toHaveLength(1);
    expect(messageThread.querySelector('.chat-message-bubble p').textContent).toBe('Only send once');
  });

  it('opens the protected image in a modal and closes with Escape while restoring focus and scrolling', async () => {
    const user = userEvent.setup();
    api.conversationMessages.mockResolvedValue({
      data: [savedMessage({ attachments: [{ id: 5, url: '/api/message-attachments/5' }] })],
      meta: { next_cursor: null },
    });
    api.privateMessageImage.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
    renderMessages();
    const imageButton = await screen.findByRole('button', { name: /view image/i });
    document.body.style.overflow = 'auto';
    await user.click(imageButton);

    expect(await screen.findByRole('dialog', { name: 'Image preview' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull());
    expect(document.body.style.overflow).toBe('auto');
    expect(imageButton).toBe(document.activeElement);

    await user.click(imageButton);
    await screen.findByRole('dialog', { name: 'Image preview' });
    await user.click(screen.getByRole('button', { name: 'Close image preview' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull());
    await user.click(imageButton);
    await screen.findByRole('dialog', { name: 'Image preview' });
    await user.click(document.querySelector('.chat-lightbox-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Image preview' })).toBeNull());
  });

  it('refreshes automatically, deduplicates persisted IDs, and keeps loaded messages after a refresh error', async () => {
    vi.useFakeTimers();
    let view;
    try {
      const existing = savedMessage({ id: 50 });
      api.conversationMessages.mockResolvedValueOnce({ data: [existing], meta: { next_cursor: null } });
      view = renderMessages();
      await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
      api.conversationMessages.mockResolvedValueOnce({ data: [existing], meta: { next_cursor: null } });

      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(api.conversationMessages).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText('Welcome to the chat.')).toHaveLength(1);

      api.conversations.mockRejectedValueOnce(new Error('Network unavailable'));
      api.conversationMessages.mockRejectedValueOnce(new Error('Network unavailable'));
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(screen.getByText('Welcome to the chat.')).toBeTruthy();
      expect(screen.getByText(/Your loaded messages are still available/)).toBeTruthy();
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      view?.unmount();
      vi.useRealTimers();
    }
  });

  it('subscribes to private conversation events, deduplicates delivered messages, and leaves on unmount', async () => {
    const view = renderMessages();
    await screen.findByText('No messages yet. Send the first message.');
    expect(realtime.echo.private).toHaveBeenCalledWith('conversations.11');
    const messageListener = realtime.channel.listen.mock.calls.find(([eventName]) => eventName === '.chat.message.created')?.[1];
    expect(messageListener).toBeTypeOf('function');

    const delivered = savedMessage({ id: 80, body: 'Delivered over Reverb.' });
    act(() => messageListener({ conversation_id: 11, message: delivered }));
    act(() => messageListener({ conversation_id: 11, message: delivered }));
    expect(within(screen.getByRole('region', { name: 'Message thread' })).getAllByText('Delivered over Reverb.')).toHaveLength(1);

    view.unmount();
    expect(realtime.echo.leave).toHaveBeenCalledWith('conversations.11');
  });

  it('keeps the polling fallback active when Reverb is not configured', async () => {
    vi.useFakeTimers();
    let view;
    realtime.getEcho.mockReturnValue(null);
    try {
      view = renderMessages();
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(api.conversationMessages).toHaveBeenCalledTimes(2);
      expect(realtime.echo.private).not.toHaveBeenCalled();
    } finally {
      view?.unmount();
      vi.useRealTimers();
    }
  });

  it('pauses automatic requests while hidden and preserves scroll position for older readers', async () => {
    vi.useFakeTimers();
    let view;
    const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
    try {
      api.conversationMessages
        .mockResolvedValueOnce({ data: [savedMessage({ id: 60 })], meta: { next_cursor: null } })
        .mockResolvedValueOnce({ data: [savedMessage({ id: 61, body: 'New while reading.' }), savedMessage({ id: 60 })], meta: { next_cursor: null } })
        .mockResolvedValueOnce({ data: [savedMessage({ id: 62, body: 'New at bottom.' }), savedMessage({ id: 61, body: 'New while reading.' }), savedMessage({ id: 60 })], meta: { next_cursor: null } });
      view = renderMessages();
      await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
      const scroll = document.querySelector('.chat-message-scroll');
      let scrollTop = 100;
      const assignments = [];
      Object.defineProperties(scroll, {
        scrollHeight: { configurable: true, get: () => 1000 },
        clientHeight: { configurable: true, get: () => 300 },
        scrollTop: { configurable: true, get: () => scrollTop, set: (value) => { assignments.push(value); scrollTop = value; } },
      });

      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(api.conversations).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      await act(async () => {
        fireEvent(document, new Event('visibilitychange'));
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      });
      expect(screen.getByText('New while reading.')).toBeTruthy();
      expect(assignments).toEqual([]);

      scrollTop = 690;
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
      expect(screen.getByText('New at bottom.')).toBeTruthy();
      expect(assignments).toContain(1000);
    } finally {
      view?.unmount();
      if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden);
      else delete document.hidden;
      vi.useRealTimers();
    }
  });

  it('reuses a UUID when a send is retried and generates a new UUID for the next message', async () => {
    const user = userEvent.setup();
    api.sendConversationMessage
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ data: savedMessage({ id: 31, body: 'Retry this message.' }) })
      .mockResolvedValueOnce({ data: savedMessage({ id: 32, body: 'A new message.' }) });
    renderMessages();

    await user.type(await screen.findByLabelText('Message'), 'Retry this message.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('alert');
    const firstClientMessageId = api.sendConversationMessage.mock.calls[0][1].clientMessageId;
    expect(firstClientMessageId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(2));
    expect(api.sendConversationMessage.mock.calls[1][1].clientMessageId).toBe(firstClientMessageId);

    await user.type(await screen.findByLabelText('Message'), 'A new message.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(3));
    expect(api.sendConversationMessage.mock.calls[2][1].clientMessageId).not.toBe(firstClientMessageId);
  });

  it('previews an image, sends it, and displays upload errors', async () => {
    const user = userEvent.setup({ applyAccept: false });
    api.sendConversationMessage.mockImplementationOnce((_conversationId, operation) => Promise.resolve({
      data: savedMessage({
        id: 27,
        client_message_id: operation.clientMessageId,
        body: 'See this image',
        sender: { id: 7, name: 'Student One' },
        attachments: [{ id: 5, url: '/api/message-attachments/5', mime_type: 'image/png' }],
      }),
    })).mockRejectedValueOnce({ status: 422, message: 'The image could not be processed.', errors: { attachment: ['Choose another image.'] } });
    api.privateMessageImage.mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
    renderMessages();

    const image = new File(['image-data'], 'diagram.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Add image'), image);
    expect(await screen.findByAltText('Selected image preview')).toBeTruthy();
    await user.type(screen.getByLabelText('Message'), 'See this image');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    const messageThread = screen.getByRole('region', { name: 'Message thread' });
    expect(within(messageThread).getAllByText('See this image')).toHaveLength(1);
    expect(api.sendConversationMessage).toHaveBeenCalledWith('11', expect.objectContaining({ attachment: image }));

    await user.upload(screen.getByLabelText('Add image'), new File(['x'], 'bad.txt', { type: 'text/plain' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Choose a JPEG, PNG, or WebP image.');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chat-preview');
  });

  it('revokes replaced image previews and revokes the active preview on unmount', async () => {
    URL.createObjectURL.mockReturnValueOnce('blob:first-preview').mockReturnValueOnce('blob:second-preview');
    const user = userEvent.setup();
    const view = renderMessages();
    const imageInput = await screen.findByLabelText('Add image');

    await user.upload(imageInput, new File(['one'], 'first.png', { type: 'image/png' }));
    await screen.findByAltText('Selected image preview');
    await user.upload(imageInput, new File(['two'], 'second.png', { type: 'image/png' }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-preview'));

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second-preview');
  });
});
