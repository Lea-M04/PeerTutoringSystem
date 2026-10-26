import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reverbMock = vi.hoisted(() => ({ Echo: vi.fn(), instance: null }));
vi.mock('laravel-echo', () => ({ default: reverbMock.Echo }));

import { disconnectEcho, getEcho } from './echo.js';

describe('Echo session authorization', () => {
  beforeEach(() => {
    reverbMock.Echo.mockClear();
    vi.stubEnv('VITE_REVERB_APP_KEY', 'public-app-key');
    vi.stubEnv('VITE_REVERB_HOST', 'localhost');
    vi.stubEnv('VITE_REVERB_PORT', '8080');
    vi.stubEnv('VITE_REVERB_SCHEME', 'http');
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000');
    reverbMock.Echo.mockImplementation(function (options) {
      reverbMock.instance = { options, disconnect: vi.fn() };
      return reverbMock.instance;
    });
    document.cookie = 'XSRF-TOKEN=csrf-token';
  });

  afterEach(() => {
    disconnectEcho();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0';
  });

  it('creates one Reverb client and authorizes private channels with the Sanctum session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ auth: 'signed-channel-auth' }),
    });

    const echo = getEcho();
    expect(getEcho()).toBe(echo);
    expect(reverbMock.Echo).toHaveBeenCalledOnce();
    const options = reverbMock.Echo.mock.calls[0][0];
    expect(options.broadcaster).toBe('reverb');
    expect(options.key).toBe('public-app-key');

    const callback = vi.fn();
    options.authorizer({ name: 'private-conversations.11' }).authorize('123.456', callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(null, { auth: 'signed-channel-auth' }));
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/broadcasting/auth', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
      headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }),
      body: new URLSearchParams({ socket_id: '123.456', channel_name: 'private-conversations.11' }),
    }));

    disconnectEcho();
    expect(reverbMock.instance.disconnect).toHaveBeenCalledOnce();
  });
});
