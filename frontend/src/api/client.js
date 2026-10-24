const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, errors = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

function xsrfCookie() {
  const value = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='));
  return value ? decodeURIComponent(value.slice('XSRF-TOKEN='.length)) : null;
}

async function csrfCookie() {
  const response = await fetch(`${API_BASE_URL}/sanctum/csrf-cookie`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError('Could not start a secure session. Please try again.', { status: response.status });
}

async function request(path, { method = 'GET', body } = {}) {
  const upperMethod = method.toUpperCase();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
    await csrfCookie();
    const token = xsrfCookie();
    if (token) headers['X-XSRF-TOKEN'] = token;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: upperMethod,
      credentials: 'include',
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError('Unable to reach the API. Check that the Laravel server is running.');
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.message || 'The request could not be completed.', {
      status: response.status,
      errors: payload.errors || {},
    });
  }
  return payload;
}

export const api = {
  currentUser: () => request('/api/user'),
  updateProfile: (values) => request('/api/user', { method: 'PATCH', body: values }),
  tutorProfile: () => request('/api/tutor-profile'),
  updateTutorProfile: (values) => request('/api/tutor-profile', { method: 'PATCH', body: values }),
  subjects: () => request('/api/subjects'),
  tutorApplications: () => request('/api/tutor-applications'),
  submitTutorApplication: (values) => request('/api/tutor-applications', { method: 'POST', body: values }),
  pendingTutorApplications: () => request('/api/admin/tutor-applications'),
  approveTutorApplication: (id) => request(`/api/admin/tutor-applications/${id}/approve`, { method: 'POST', body: {} }),
  rejectTutorApplication: (id, reason) => request(`/api/admin/tutor-applications/${id}/reject`, { method: 'POST', body: { reason } }),
  register: (values) => request('/register', { method: 'POST', body: values }),
  login: (values) => request('/login', { method: 'POST', body: values }),
  logout: () => request('/logout', { method: 'POST' }),
};
