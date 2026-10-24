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
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

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
      ...(body === undefined ? {} : { body: isFormData ? body : JSON.stringify(body) }),
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

async function download(path) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/pdf, application/json' },
    });
  } catch {
    throw new ApiError('Unable to reach the API. Check that the Laravel server is running.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.message || 'The transcript could not be downloaded.', {
      status: response.status,
      errors: payload.errors || {},
    });
  }

  return response.blob();
}

export const api = {
  currentUser: () => request('/api/user'),
  updateProfile: (values) => request('/api/user', { method: 'PATCH', body: values }),
  tutorProfile: () => request('/api/tutor-profile'),
  updateTutorProfile: (values) => request('/api/tutor-profile', { method: 'PATCH', body: values }),
  subjects: () => request('/api/subjects'),
  tutorApplications: () => request('/api/tutor-applications'),
  submitTutorApplication: (values) => {
    const body = new FormData();
    body.append('motivation', values.motivation);
    body.append('faculty_or_university', values.faculty_or_university);
    body.append('study_program', values.study_program);
    body.append('year_of_study', values.year_of_study);
    values.subject_ids.forEach((id) => body.append('subject_ids[]', id));
    body.append('transcript', values.transcript);
    return request('/api/tutor-applications', { method: 'POST', body });
  },
  pendingTutorApplications: () => request('/api/admin/tutor-applications'),
  downloadTutorApplicationTranscript: (id) => download(`/api/admin/tutor-applications/${id}/transcript`),
  approveTutorApplication: (id) => request(`/api/admin/tutor-applications/${id}/approve`, { method: 'POST', body: {} }),
  rejectTutorApplication: (id, reason) => request(`/api/admin/tutor-applications/${id}/reject`, { method: 'POST', body: { reason } }),
  adminSubjects: () => request('/api/admin/subjects'),
  createSubject: (values) => request('/api/admin/subjects', { method: 'POST', body: values }),
  updateSubject: (id, values) => request(`/api/admin/subjects/${id}`, { method: 'PATCH', body: values }),
  updateSubjectStatus: (id, isActive) => request(`/api/admin/subjects/${id}/status`, { method: 'PATCH', body: { is_active: isActive } }),
  register: (values) => request('/register', { method: 'POST', body: values }),
  login: (values) => request('/login', { method: 'POST', body: values }),
  logout: () => request('/logout', { method: 'POST' }),
};
