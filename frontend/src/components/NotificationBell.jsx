import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api/client.js';
import { isApprovedTutor, isStudentUser } from '../auth/roles.js';

function formatTimestamp(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function notificationDestination(notification, user) {
  const resourceId = notification.resource_id;
  if (!resourceId) return null;

  if (notification.resource_type === 'booking') {
    if (isApprovedTutor(user) && ['booking_requested', 'booking_cancelled'].includes(notification.type)) {
      return `/tutor-bookings/${resourceId}`;
    }

    if (isStudentUser(user) && ['booking_accepted', 'booking_rejected', 'booking_completed'].includes(notification.type)) {
      return `/bookings/${resourceId}`;
    }
  }

  if (notification.resource_type === 'tutor_application' && isStudentUser(user)
    && ['tutor_application_approved', 'tutor_application_rejected'].includes(notification.type)) {
    return '/tutor-application';
  }

  return null;
}

export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const detailsRef = useRef(null);
  const requestId = useRef(0);
  const initialCountRequest = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function refreshUnreadCount() {
    const result = await api.unreadNotificationCount();
    setUnreadCount(Number(result.data?.unread_count) || 0);
  }

  async function loadNotifications(page = 1) {
    const currentRequestId = ++requestId.current;
    const append = page > 1;
    setError('');
    if (append) setLoadingMore(true);
    else setLoading(true);

    const [listResult, countResult] = await Promise.allSettled([
      api.notifications(page),
      api.unreadNotificationCount(),
    ]);

    if (currentRequestId !== requestId.current) return;
    if (countResult.status === 'fulfilled') {
      setUnreadCount(Number(countResult.value.data?.unread_count) || 0);
    }
    if (listResult.status === 'rejected') {
      setError(listResult.reason?.message || 'Notifications could not be loaded. Please try again.');
    } else {
      const result = listResult.value;
      setNotifications((current) => append ? [...current, ...(result.data || [])] : (result.data || []));
      setNextPage(result.links?.next ? page + 1 : null);
      if (countResult.status === 'rejected') {
        setError(countResult.reason?.message || 'The unread count could not be refreshed.');
      }
    }
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    let active = true;
    initialCountRequest.current ??= api.unreadNotificationCount();
    initialCountRequest.current
      .then((result) => { if (active) setUnreadCount(Number(result.data?.unread_count) || 0); })
      .catch(() => { if (active) setError('The unread notification count could not be loaded.'); });

    function closeOnOutsideClick(event) {
      if (detailsRef.current && !detailsRef.current.contains(event.target)) detailsRef.current.open = false;
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector('summary')?.focus();
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      active = false;
      requestId.current += 1;
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function handleToggle(event) {
    if (event.currentTarget.open) void loadNotifications();
  }

  async function openNotification(notification) {
    setActionId(notification.id);
    setError('');
    try {
      let savedNotification = notification;
      if (!notification.read_at) savedNotification = (await api.markNotificationRead(notification.id)).data;
      setNotifications((current) => current.map((item) => item.id === notification.id ? savedNotification : item));
      await refreshUnreadCount();
      const destination = notificationDestination(notification, user);
      if (destination) {
        if (detailsRef.current) detailsRef.current.open = false;
        navigate(destination);
      }
    } catch (caught) {
      setError(caught?.message || 'This notification could not be opened. Please try again.');
    } finally {
      setActionId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError('');
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, read_at: notification.read_at || new Date().toISOString() })));
      await refreshUnreadCount();
    } catch (caught) {
      setError(caught?.message || 'Notifications could not be marked as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  }

  return <details className="notification-menu" ref={detailsRef} onToggle={handleToggle}>
    <summary aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
      <svg aria-hidden="true" className="notification-bell-icon" viewBox="0 0 24 24" focusable="false"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      <span className="notification-summary-text">Notifications</span>
      {unreadCount > 0 && <span className="notification-count" aria-label={`${unreadCount} unread notifications`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </summary>
    <section className="notification-panel" aria-label="Notifications">
      <header className="notification-panel-header">
        <div><h2>Notifications</h2><p>{unreadCount} unread</p></div>
        {unreadCount > 0 && <button type="button" className="notification-mark-all" disabled={markingAll} onClick={markAllRead}>{markingAll ? 'Marking…' : 'Mark all read'}</button>}
      </header>
      {error && <div className="notification-error" role="alert"><span>{error}</span><button type="button" onClick={() => void loadNotifications()}>Retry</button></div>}
      {loading ? <p className="notification-state" role="status">Loading notifications…</p>
        : notifications.length === 0 && !error ? <p className="notification-state">You’re all caught up. New booking and application updates will appear here.</p>
          : <>
            <ul className="notification-list">
              {notifications.map((notification) => <li className={`notification-item${notification.read_at ? ' is-read' : ' is-unread'}`} key={notification.id}>
                <button type="button" className="notification-open" aria-label={`Open notification: ${notification.title}, ${notification.read_at ? 'read' : 'unread'}`} disabled={actionId === notification.id} onClick={() => void openNotification(notification)}>
                  <span className="notification-unread-dot" aria-hidden="true" />
                  <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.message}</span><time dateTime={notification.created_at || undefined}>{formatTimestamp(notification.created_at)}</time></span>
                </button>
              </li>)}
            </ul>
            {nextPage && <button className="notification-load-more" type="button" disabled={loadingMore} onClick={() => void loadNotifications(nextPage)}>{loadingMore ? 'Loading…' : 'Load older notifications'}</button>}
          </>}
    </section>
  </details>;
}
