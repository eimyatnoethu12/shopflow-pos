const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function getToken() {
  return localStorage.getItem('shopflow_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('shopflow_token', token);
  } else {
    localStorage.removeItem('shopflow_token');
  }
}

export function getActiveTenantId() {
  return localStorage.getItem('shopflow_tenant_id');
}

export function setActiveTenantId(id) {
  if (id) {
    localStorage.setItem('shopflow_tenant_id', id);
  } else {
    localStorage.removeItem('shopflow_tenant_id');
  }
}

export async function api(path, options = {}) {
  const token = getToken();
  const tenantId = getActiveTenantId();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...options.headers
  };

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    error.code = data.code;
    error.subscriptionRequired = data.subscriptionRequired;
    error.subscription = data.subscription;
    throw error;
  }

  return data;
}
