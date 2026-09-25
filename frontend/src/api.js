export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('sx_token');
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the CRM server. Start the stack with docker compose up --build.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/api/auth')) {
    localStorage.removeItem('sx_token');
    localStorage.removeItem('sx_user');
    window.location.assign('/login');
  }
  if (!response.ok) throw new ApiError(data.message || 'Request failed', response.status, data);
  return data;
}
