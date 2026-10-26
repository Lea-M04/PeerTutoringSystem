import Echo from 'laravel-echo';

let echo = null;

function xsrfToken() {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : '';
}

export function getEcho() {
  const key = import.meta.env.VITE_REVERB_APP_KEY;
  const host = import.meta.env.VITE_REVERB_HOST;
  if (!key || !host) return null;
  if (echo) return echo;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
  const authEndpoint = `${apiBaseUrl}/broadcasting/auth`;
  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http';
  const port = Number(import.meta.env.VITE_REVERB_PORT || (scheme === 'https' ? 443 : 8080));

  echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    authEndpoint,
    authorizer: (channel) => ({
      authorize(socketId, callback) {
        fetch(authEndpoint, {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(xsrfToken() ? { 'X-XSRF-TOKEN': xsrfToken() } : {}),
          },
          body: new URLSearchParams({ socket_id: socketId, channel_name: channel.name }),
        })
          .then(async (response) => {
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'The chat channel could not be authorized.');
            callback(null, result);
          })
          .catch((error) => callback(error, null));
      },
    }),
  });

  return echo;
}

export function disconnectEcho() {
  echo?.disconnect();
  echo = null;
}
