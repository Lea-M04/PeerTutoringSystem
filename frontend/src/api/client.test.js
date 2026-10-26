import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client.js';

describe('booking API client contract', () => {
  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  });

  it('posts the selected availability and tutor offering with Sanctum credentials and CSRF protection', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=booking-test-token; path=/';
        return { ok: true, status: 204 };
      }

      return { ok: true, status: 201, json: async () => ({ data: { id: 56, status: 'pending' } }) };
    });

    await expect(api.createBooking(90, 10)).resolves.toEqual({ data: { id: 56, status: 'pending' } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [requestUrl, requestOptions] = fetchMock.mock.calls[1];
    expect(requestUrl).toMatch(/\/api\/bookings$/);
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.credentials).toBe('include');
    expect(JSON.parse(requestOptions.body)).toEqual({ availability_id: 90, tutor_subject_id: 10 });
    expect(requestOptions.headers['X-XSRF-TOKEN']).toBe('booking-test-token');
  });

  it('reuses an existing Sanctum CSRF cookie instead of fetching it before every write', async () => {
    document.cookie = 'XSRF-TOKEN=existing-test-token; path=/';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 56 } }),
    });

    await api.createBooking(90, 10);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/bookings$/);
    expect(fetchMock.mock.calls[0][1].headers['X-XSRF-TOKEN']).toBe('existing-test-token');
  });

  it('posts only rating and optional comment for a booking review with Sanctum credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=review-test-token; path=/';
        return { ok: true, status: 204 };
      }

      return { ok: true, status: 201, json: async () => ({ data: { id: 56, review: { rating: 5 } } }) };
    });

    await api.submitBookingReview(56, { rating: 5, comment: 'Helpful.' });

    const [requestUrl, requestOptions] = fetchMock.mock.calls[1];
    expect(requestUrl).toMatch(/\/api\/bookings\/56\/review$/);
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.credentials).toBe('include');
    expect(JSON.parse(requestOptions.body)).toEqual({ rating: 5, comment: 'Helpful.' });
    expect(requestOptions.headers['X-XSRF-TOKEN']).toBe('review-test-token');
  });

  it('posts a completion action to the tutor-owned booking endpoint without client-supplied status', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=completion-test-token; path=/';
        return { ok: true, status: 204 };
      }

      return { ok: true, status: 200, json: async () => ({ data: { id: 52, status: 'completed' } }) };
    });

    await api.completeBooking(52);

    const [requestUrl, requestOptions] = fetchMock.mock.calls[1];
    expect(requestUrl).toMatch(/\/api\/tutor-profile\/bookings\/52\/complete$/);
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.credentials).toBe('include');
    expect(requestOptions.body).toBe('{}');
    expect(requestOptions.headers['X-XSRF-TOKEN']).toBe('completion-test-token');
  });

  it('uses the authenticated notification endpoints and Sanctum CSRF protection for read actions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/sanctum/csrf-cookie')) {
        document.cookie = 'XSRF-TOKEN=notification-test-token; path=/';
        return { ok: true, status: 204 };
      }

      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });

    await api.notifications(2);
    await api.unreadNotificationCount();
    await api.markNotificationRead(25);
    await api.markAllNotificationsRead();

    const requestCalls = fetchMock.mock.calls.filter(([url]) => !String(url).endsWith('/sanctum/csrf-cookie'));
    expect(requestCalls.map(([url, options]) => [String(url).split('8000')[1], options.method, options.credentials])).toEqual([
      ['/api/notifications?page=2', 'GET', 'include'],
      ['/api/notifications/unread-count', 'GET', 'include'],
      ['/api/notifications/25/read', 'POST', 'include'],
      ['/api/notifications/read-all', 'POST', 'include'],
    ]);
    expect(requestCalls[2][1].headers['X-XSRF-TOKEN']).toBe('notification-test-token');
    expect(requestCalls[3][1].headers['X-XSRF-TOKEN']).toBe('notification-test-token');
  });
});
