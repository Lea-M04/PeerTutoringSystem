import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { FormErrors, useChatUnreadCount } from '../components/SiteLayout.jsx';
import { getEcho } from '../realtime/echo.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function createClientMessageId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure message identifiers are unavailable in this browser.');
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mergeMessages(current, incoming) {
  const byId = new Map();
  const byClientMessageId = new Map();
  const merged = [];

  [...current, ...incoming].forEach((message) => {
    const idIndex = message.id !== undefined && message.id !== null
      ? byId.get(String(message.id))
      : undefined;
    const clientMessageIndex = message.client_message_id
      ? byClientMessageId.get(String(message.client_message_id))
      : undefined;
    const canReconcilePendingMessage = clientMessageIndex !== undefined
      && (message.id === undefined || message.id === null || merged[clientMessageIndex].id === null);
    const existingIndex = idIndex ?? (canReconcilePendingMessage ? clientMessageIndex : undefined);
    const index = existingIndex ?? merged.length;
    const existingMessage = existingIndex === undefined ? null : merged[index];
    const incomingIsPending = message.id === undefined || message.id === null;
    const combined = existingMessage === null
      ? message
      : incomingIsPending && existingMessage.id !== null
        ? existingMessage
        : { ...existingMessage, ...message };

    if (combined.id !== undefined && combined.id !== null) {
      byId.set(String(combined.id), index);
      delete combined.delivery_status;
    }
    if (combined.client_message_id) {
      byClientMessageId.set(String(combined.client_message_id), index);
    }

    merged[index] = combined;
  });

  return merged.sort((left, right) => {
    const timeOrder = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    return timeOrder || Number(left.id) - Number(right.id);
  });
}

function mergeConversationPages(results) {
  const byId = new Map();
  results.forEach((result) => (result.data || []).forEach((conversation) => {
    byId.set(String(conversation.id), conversation);
  }));

  return [...byId.values()];
}

function isNearBottom(element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 80;
}

function personName(person) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.name || 'Participant';
}

function otherParticipant(conversation, userId) {
  return String(conversation.student?.id) === String(userId) ? conversation.tutor : conversation.student;
}

function PrivateMessageImage({ attachment, alt, onOpen }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    api.privateMessageImage(attachment.url)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        }
      })
      .catch(() => { if (active) setError(true); });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.url]);

  if (error) return <p className="chat-image-error" role="alert">This image could not be loaded.</p>;
  if (!source) return <p className="chat-image-loading" role="status">Loading image…</p>;

  return <button
    className="chat-message-image-button"
    type="button"
    aria-label={`View image: ${alt}`}
    onClick={(event) => onOpen({ source, alt, returnFocus: event.currentTarget })}
  ><img className="chat-message-image" src={source} alt={alt} /></button>;
}

function ImageLightbox({ image, onClose }) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (image.returnFocus?.isConnected) image.returnFocus.focus();
    };
  }, [image]);

  return createPortal(<div
    className="chat-lightbox-backdrop"
    role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section className="chat-lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
      <button ref={closeButtonRef} className="chat-lightbox-close" type="button" aria-label="Close image preview" onClick={onClose}>×</button>
      <img src={image.source} alt={image.alt} />
    </section>
  </div>, document.body);
}

export default function ConversationsPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshUnreadMessageCount } = useChatUnreadCount();
  const [conversations, setConversations] = useState([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [conversationPage, setConversationPage] = useState(1);
  const [conversationLastPage, setConversationLastPage] = useState(1);
  const [conversationPageLoading, setConversationPageLoading] = useState(false);
  const [conversationPageError, setConversationPageError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(Boolean(conversationId));
  const [historyError, setHistoryError] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [formError, setFormError] = useState(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageViewer, setImageViewer] = useState(null);
  const pendingSend = useRef(null);
  const sendLock = useRef(false);
  const messageScroll = useRef(null);
  const messagesRef = useRef(messages);
  const shouldStickToBottom = useRef(false);
  const pendingOlderScroll = useRef(null);
  const polling = useRef(false);
  const pollNow = useRef(null);
  const readRequest = useRef(null);
  const readConversation = useRef(conversationId);
  readConversation.current = conversationId;
  messagesRef.current = messages;
  const currentConversation = conversations.find((item) => String(item.id) === String(conversationId));

  useEffect(() => {
    let active = true;
    api.conversations(1)
      .then((result) => {
        if (!active) return;
        setConversations(result.data || []);
        setConversationTotal(result.meta?.total || result.data?.length || 0);
        setConversationPage(result.meta?.current_page || 1);
        setConversationLastPage(result.meta?.last_page || 1);
      })
      .catch((caught) => { if (active) setListError(caught); })
      .finally(() => { if (active) setListLoading(false); });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!attachment) {
      setPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(attachment);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHistoryLoading(false);
      setHistoryError(null);
      setNextCursor(null);
      shouldStickToBottom.current = false;
      return undefined;
    }

    let active = true;
    setMessages([]);
    shouldStickToBottom.current = false;
    setHistoryLoading(true);
    setHistoryError(null);
    api.conversationMessages(conversationId)
      .then((result) => {
        if (!active) return;
        shouldStickToBottom.current = true;
        setMessages(mergeMessages([], [...(result.data || [])].reverse()));
        setNextCursor(result.meta?.next_cursor || null);
      })
      .catch((caught) => { if (active) setHistoryError(caught); })
      .finally(() => { if (active) setHistoryLoading(false); });

    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const latestUnread = [...messages].reverse().find((message) => (
      String(message.sender?.id) !== String(user.id) && !message.read_at
    ));
    if (!latestUnread) return;
    const requestKey = `${conversationId}:${latestUnread.id}`;
    if (readRequest.current === requestKey) return;
    readRequest.current = requestKey;
    api.markConversationRead(conversationId, latestUnread.id)
      .then((result) => {
        if (String(conversationId) !== String(readConversation.current)) return;
        const readAt = result.data?.read_at || new Date().toISOString();
        const readThroughMessage = messages.find((message) => String(message.id) === String(result.data?.read_through_message_id || latestUnread.id)) || latestUnread;
        setMessages((current) => current.map((message) => (
          String(message.sender?.id) !== String(user.id)
            && !message.read_at
            && (new Date(message.created_at).getTime() < new Date(readThroughMessage.created_at).getTime()
              || (new Date(message.created_at).getTime() === new Date(readThroughMessage.created_at).getTime()
                && Number(message.id) <= Number(readThroughMessage.id)))
            ? { ...message, read_at: readAt }
            : message
        )));
        setConversations((current) => current.map((item) => (
          String(item.id) === String(conversationId)
            ? { ...item, unread_count: Math.max(0, Number(item.unread_count || 0) - Number(result.data?.marked_read || 0)) }
            : item
        )));
      })
      .catch(() => { if (String(conversationId) === String(readConversation.current)) setPollError(new Error('Read status could not be updated. Please retry.')); })
      .finally(() => {
        if (readRequest.current === requestKey) readRequest.current = null;
        void refreshUnreadMessageCount();
      });
  }, [conversationId, messages, refreshUnreadMessageCount, user?.id]);

  useEffect(() => {
    const element = messageScroll.current;
    if (!element) return;

    if (pendingOlderScroll.current) {
      element.scrollTop = pendingOlderScroll.current.scrollTop + element.scrollHeight - pendingOlderScroll.current.scrollHeight;
      pendingOlderScroll.current = null;
      return;
    }

    if (shouldStickToBottom.current) {
      element.scrollTop = element.scrollHeight;
      shouldStickToBottom.current = false;
    }
  }, [messages, historyLoading]);

  useEffect(() => {
    let active = true;

    async function refreshChatData() {
      if (!active || document.hidden || polling.current) return;
      polling.current = true;

      const requests = Array.from({ length: conversationPage }, (_, index) => api.conversations(index + 1));
      if (conversationId) requests.push(api.conversationMessages(conversationId));
      const results = await Promise.allSettled(requests);
      if (!active) {
        polling.current = false;
        return;
      }

      const failures = [];
      const conversationResults = results.slice(0, conversationPage);
      const successfulConversationResults = conversationResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
      if (conversationResults.every((result) => result.status === 'fulfilled')) {
        setConversations(mergeConversationPages(successfulConversationResults));
        setConversationTotal(successfulConversationResults[0]?.meta?.total || successfulConversationResults[0]?.data?.length || 0);
        setConversationLastPage(successfulConversationResults[0]?.meta?.last_page || 1);
      } else {
        conversationResults.filter((result) => result.status === 'rejected').forEach((result) => failures.push(result.reason));
      }

      if (conversationId) {
        const messagesResult = results[conversationPage];
        if (messagesResult.status === 'fulfilled') {
          const incoming = [...(messagesResult.value.data || [])].reverse();
          const existingIds = new Set(messagesRef.current.map((message) => String(message.id)));
          if (incoming.some((message) => !existingIds.has(String(message.id))) && isNearBottom(messageScroll.current)) {
            shouldStickToBottom.current = true;
          }
          setMessages((current) => mergeMessages(current, incoming));
        } else {
          failures.push(messagesResult.reason);
        }
      }

      setPollError(failures.length > 0
        ? new Error('Automatic updates could not be checked. Your loaded messages are still available.')
        : null);
      void refreshUnreadMessageCount();
      polling.current = false;
    }

    pollNow.current = refreshChatData;
    const interval = window.setInterval(() => { void refreshChatData(); }, 4000);
    function refreshWhenVisible() {
      if (!document.hidden) void refreshChatData();
    }
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      pollNow.current = null;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [conversationId, conversationPage, refreshUnreadMessageCount]);

  useEffect(() => {
    if (!conversationId) return undefined;

    const echo = getEcho();
    if (!echo) return undefined;
    const channelName = `conversations.${conversationId}`;
    echo.private(channelName)
      .listen('.chat.message.created', (event) => {
        const message = event.message;
        const isNew = !messagesRef.current.some((item) => String(item.id) === String(message.id));
        if (isNew && String(message.sender?.id) !== String(user?.id) && isNearBottom(messageScroll.current)) {
          shouldStickToBottom.current = true;
        }
        setMessages((current) => mergeMessages(current, [message]));
        setConversations((current) => current.map((item) => (
          String(item.id) === String(conversationId)
            ? {
                ...item,
                latest_message: message,
                updated_at: message.created_at,
                unread_count: isNew && String(message.sender?.id) !== String(user?.id)
                  ? Number(item.unread_count || 0) + 1
                  : item.unread_count,
              }
            : item
        )));
        void refreshUnreadMessageCount();
      })
      .listen('.chat.read-receipt.updated', (event) => {
        const throughMessage = messagesRef.current.find((message) => String(message.id) === String(event.read_through_message_id));
        if (!throughMessage) return;
        setMessages((current) => current.map((message) => (
          String(message.sender?.id) !== String(event.reader_id)
            && !message.read_at
            && (new Date(message.created_at).getTime() < new Date(throughMessage.created_at).getTime()
              || (new Date(message.created_at).getTime() === new Date(throughMessage.created_at).getTime()
                && Number(message.id) <= Number(throughMessage.id)))
            ? { ...message, read_at: event.read_at }
            : message
        )));
        void refreshUnreadMessageCount();
      });

    function refreshConversationList(event) {
      if (String(event.detail?.conversation_id) !== String(conversationId)) {
        void pollNow.current?.();
      }
    }
    window.addEventListener('chat:unread-count-updated', refreshConversationList);

    return () => {
      window.removeEventListener('chat:unread-count-updated', refreshConversationList);
      echo.leave(channelName);
    };
  }, [conversationId, refreshUnreadMessageCount, user?.id]);

  async function loadOlderMessages() {
    if (!nextCursor || olderLoading) return;
    setOlderLoading(true);
    try {
      const result = await api.conversationMessages(conversationId, nextCursor);
      const element = messageScroll.current;
      if (element) pendingOlderScroll.current = { scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
      setMessages((current) => mergeMessages(current, [...(result.data || [])].reverse()));
      setNextCursor(result.meta?.next_cursor || null);
    } catch (caught) {
      setHistoryError(caught);
    } finally {
      setOlderLoading(false);
    }
  }

  async function retryConversationList() {
    setListError(null);
    setListLoading(true);
    try {
      const result = await api.conversations(1);
      setConversations(result.data || []);
      setConversationTotal(result.meta?.total || result.data?.length || 0);
      setConversationPage(result.meta?.current_page || 1);
      setConversationLastPage(result.meta?.last_page || 1);
    } catch (caught) {
      setListError(caught);
    } finally {
      setListLoading(false);
    }
  }

  async function retryHistory() {
    if (!conversationId) return;
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const result = await api.conversationMessages(conversationId);
      shouldStickToBottom.current = true;
      setMessages((current) => mergeMessages(current, [...(result.data || [])].reverse()));
      setNextCursor(result.meta?.next_cursor || null);
    } catch (caught) {
      setHistoryError(caught);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadMoreConversations() {
    if (conversationPageLoading || conversationPage >= conversationLastPage) return;
    setConversationPageLoading(true);
    setConversationPageError(null);
    try {
      const nextPage = conversationPage + 1;
      const result = await api.conversations(nextPage);
      setConversations((current) => {
        const byId = new Map(current.map((item) => [String(item.id), item]));
        (result.data || []).forEach((item) => byId.set(String(item.id), item));
        return [...byId.values()];
      });
      setConversationPage(result.meta?.current_page || nextPage);
      setConversationLastPage(result.meta?.last_page || nextPage);
    } catch (caught) {
      setConversationPageError(caught);
    } finally {
      setConversationPageLoading(false);
    }
  }

  function chooseImage(event) {
    const file = event.target.files?.[0] || null;
    setFormError(null);
    if (file && file.size > MAX_IMAGE_BYTES) {
      setFormError({ message: 'Images must be no larger than 5 MiB.', errors: { attachment: ['Choose a smaller image.'] } });
      event.target.value = '';
      setAttachment(null);
      return;
    }
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError({ message: 'Choose a JPEG, PNG, or WebP image.', errors: { attachment: ['This image format is not supported.'] } });
      event.target.value = '';
      setAttachment(null);
      return;
    }
    setAttachment(file);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!conversationId || (!body.trim() && !attachment) || sending || sendLock.current) return;

    sendLock.current = true;
    setSending(true);
    setFormError(null);
    const sendBody = body.trim();
    let operation = pendingSend.current;
    if (!operation
      || operation.conversationId !== conversationId
      || operation.body !== sendBody
      || operation.attachment !== attachment) {
      try {
        operation = {
          conversationId,
          body: sendBody,
          attachment,
          clientMessageId: createClientMessageId(),
          createdAt: new Date().toISOString(),
        };
        pendingSend.current = operation;
      } catch (caught) {
        setFormError({ message: caught.message, errors: {} });
        sendLock.current = false;
        setSending(false);
        return;
      }
    }
    const optimisticMessage = {
      id: null,
      client_message_id: operation.clientMessageId,
      body: operation.body || null,
      read_at: null,
      created_at: operation.createdAt,
      sender: user,
      attachments: operation.attachment ? [{
        id: `pending-${operation.clientMessageId}`,
        preview_url: previewUrl,
        mime_type: operation.attachment.type,
      }] : [],
      delivery_status: 'pending',
    };
    if (isNearBottom(messageScroll.current)) shouldStickToBottom.current = true;
    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    setConversations((current) => current.map((item) => (
      String(item.id) === String(conversationId)
        ? { ...item, latest_message: optimisticMessage, updated_at: optimisticMessage.created_at }
        : item
    )));

    try {
      const result = await api.sendConversationMessage(conversationId, {
        clientMessageId: operation.clientMessageId,
        body: operation.body,
        attachment: operation.attachment,
      });
      pendingSend.current = null;
      if (isNearBottom(messageScroll.current)) shouldStickToBottom.current = true;
      setMessages((current) => mergeMessages(current, [result.data]));
      setConversations((current) => current.map((item) => (
        String(item.id) === String(conversationId)
          ? { ...item, latest_message: result.data, updated_at: result.data.created_at }
          : item
      )));
      setBody('');
      setAttachment(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (caught) {
      setMessages((current) => mergeMessages(current, [{
        ...optimisticMessage,
        delivery_status: current.some((message) => (
          message.client_message_id === operation.clientMessageId && message.id !== null
        )) ? undefined : 'failed',
      }]));
      setFormError(caught);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  function closeImageViewer() {
    setImageViewer(null);
  }

  return <section className={`chat-page section-wrap${conversationId ? ' has-active-conversation' : ''}`}>
    <header className="chat-page-heading">
      <div><span className="eyebrow">PRIVATE STUDENT–TUTOR CHAT</span><h1>Your <em>messages.</em></h1></div>
      <p>Messages are saved automatically. Updates are checked about every 4 seconds while this page is open.</p>
    </header>
    <div className="chat-layout">
      <aside className="chat-sidebar" aria-label="Conversations">
        <div className="chat-sidebar-heading"><h2>Conversations</h2><span aria-label={`${conversationTotal} total conversations`}>{conversationTotal}</span></div>
        {listLoading ? <p className="chat-state" role="status">Loading conversations…</p>
          : listError ? <div className="chat-state"><p role="alert">Conversations could not be loaded.</p><button type="button" className="text-button" onClick={() => void retryConversationList()}>Retry</button></div>
            : conversations.length === 0 ? <div className="chat-empty-list"><p>No conversations yet.</p><Link className="text-link" to="/tutors">Find an approved tutor</Link></div>
              : <ul className="chat-conversation-list">
                {conversations.map((item) => {
                  const participant = otherParticipant(item, user?.id);
                  const unreadCount = Number(item.unread_count) || 0;
                  return <li key={item.id}>
                    <Link className={`chat-conversation-link${String(item.id) === String(conversationId) ? ' is-selected' : ''}`} to={`/messages/${item.id}`}>
                      <span className="chat-person-avatar" aria-hidden="true">{personName(participant).slice(0, 1).toUpperCase()}</span>
                      <span className="chat-conversation-copy"><strong>{personName(participant)}</strong><span>{item.latest_message?.body || (item.latest_message?.attachments?.length ? 'Image' : 'Start a conversation')}</span></span>
                      {unreadCount > 0 && <span className="chat-unread-count" aria-label={`${unreadCount} unread messages`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
                    </Link>
                  </li>;
                })}
              </ul>}
        {pollError && !conversationId && <div className="chat-state chat-poll-error"><p role="alert">{pollError.message}</p><button type="button" className="text-button" onClick={() => void pollNow.current?.()}>Retry updates</button></div>}
        {conversationPageError && <div className="chat-state"><p role="alert">More conversations could not be loaded.</p><button type="button" className="text-button" disabled={conversationPageLoading} onClick={() => void loadMoreConversations()}>Retry</button></div>}
        {conversationPage < conversationLastPage && !conversationPageError && !listLoading && !listError && <button
          className="chat-load-older"
          type="button"
          disabled={conversationPageLoading}
          onClick={() => void loadMoreConversations()}
        >{conversationPageLoading ? 'Loading conversations…' : 'Load more conversations'}</button>}
      </aside>

      <section className="chat-thread" aria-label="Message thread">
        {!conversationId ? <div className="chat-thread-empty"><span aria-hidden="true">✉</span><h2>Select a conversation</h2><p>Choose a conversation or open an approved tutor profile to start chatting.</p></div>
          : <>
            <header className="chat-thread-header">
              <Link className="chat-mobile-back" to="/messages" aria-label="Back to conversations">← Back to conversations</Link>
              <div><span className="eyebrow">CONVERSATION</span><h2>{currentConversation ? personName(otherParticipant(currentConversation, user?.id)) : 'Messages'}</h2></div>
            </header>
            {historyError && <div className="chat-thread-error"><FormErrors error={historyError} /><button type="button" className="text-button" onClick={() => void retryHistory()}>Retry history</button></div>}
            {pollError && <div className="chat-thread-error chat-poll-error"><p role="alert">{pollError.message}</p><button type="button" className="text-button" onClick={() => void pollNow.current?.()}>Retry updates</button></div>}
            <div className="chat-message-scroll" ref={messageScroll} aria-live="polite" aria-relevant="additions text">
              {nextCursor && <button className="chat-load-older" type="button" disabled={olderLoading} onClick={loadOlderMessages}>{olderLoading ? 'Loading older messages…' : 'Load older messages'}</button>}
              {historyLoading && messages.length === 0 ? <p className="chat-state" role="status">Loading messages…</p>
                : historyError && messages.length === 0 ? <p className="chat-state">Message history could not be loaded.</p>
                : messages.length === 0 ? <p className="chat-state">No messages yet. Send the first message.</p>
                  : <ol className="chat-message-list">
                    {messages.map((message) => {
                      const ownMessage = String(message.sender?.id) === String(user?.id);
                      const imageAlt = message.body
                        ? `Image attached to message: ${message.body}`
                        : `Image attachment sent by ${personName(message.sender)}`;
                      return <li className={`chat-message${ownMessage ? ' is-own-message' : ''}`} key={message.id || message.client_message_id}>
                        <span className="chat-message-sender">{ownMessage ? 'You' : personName(message.sender)}</span>
                        <article className="chat-message-bubble">
                          {message.body && <p>{message.body}</p>}
                          {message.attachments?.map((item) => item.preview_url
                            ? <img key={item.id} className="chat-message-image" src={item.preview_url} alt={imageAlt} />
                            : <PrivateMessageImage key={item.id} attachment={item} alt={imageAlt} onOpen={setImageViewer} />)}
                          <footer><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>{ownMessage && <span>{message.delivery_status === 'pending' ? 'Sending…' : message.delivery_status === 'failed' ? 'Failed to send · retry' : message.read_at ? 'Read' : 'Sent'}</span>}</footer>
                        </article>
                      </li>;
                    })}
                  </ol>}
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <FormErrors error={formError} />
              {attachment && <div className="chat-image-preview"><img src={previewUrl || undefined} alt="Selected image preview" /><div><strong>{attachment.name}</strong><span>{Math.ceil(attachment.size / 1024)} KiB</span></div><button type="button" className="text-button" onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove image</button></div>}
              <label className="chat-composer-label" htmlFor="chat-message-body">Message</label>
              <textarea
                id="chat-message-body"
                value={body}
                maxLength={5000}
                rows={3}
                placeholder="Write a message…"
                disabled={sending}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void sendMessage(event);
                  }
                }}
              />
              <div className="chat-composer-actions">
                <label className="button button-outline chat-attach-button" htmlFor="chat-image-upload">Add image</label>
                <input ref={fileInput} id="chat-image-upload" className="chat-file-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={sending} onChange={chooseImage} />
                <span className="chat-size-note">JPEG, PNG, or WebP · up to 5 MiB</span>
                <button className="button" type="submit" disabled={sending || (!body.trim() && !attachment)}>{sending ? 'Sending…' : 'Send message'}</button>
              </div>
            </form>
          </>}
      </section>
    </div>
    {imageViewer && <ImageLightbox image={imageViewer} onClose={closeImageViewer} />}
  </section>;
}

export { mergeMessages };
