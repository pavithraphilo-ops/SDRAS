// src/services/api.js
// Central API service — all calls to Django backend

const BASE_URL = `http://${window.location.hostname}:8000/api`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export const getDashboardStats = () => request('/stats/');

// ── Zones ──────────────────────────────────────────────────────────────────────
export const getZones = () => request('/zones/');
export const getZone = (id) => request(`/zones/${id}/`);
export const createZone = (data) => request('/zones/', { method: 'POST', body: data });
export const updateZone = (id, data) => request(`/zones/${id}/`, { method: 'PATCH', body: data });

// ── Resources ─────────────────────────────────────────────────────────────────
export const getResources = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/resources/${qs ? '?' + qs : ''}`);
};
export const updateResource = (id, data) => request(`/resources/${id}/`, { method: 'PATCH', body: data });
export const createResource = (data) => request('/resources/', { method: 'POST', body: data });

// ── Emergency Reports ─────────────────────────────────────────────────────────
export const getReports = () => request('/reports/');
export const createReport = (data) => request('/reports/', { method: 'POST', body: data });
export const updateReport = (id, data) => request(`/reports/${id}/`, { method: 'PATCH', body: data });

// ── Allocations ───────────────────────────────────────────────────────────────
export const getAllocations = () => request('/allocations/');
export const createAllocation = (data) => request('/allocations/', { method: 'POST', body: data });
export const updateAllocation = (id, data) => request(`/allocations/${id}/`, { method: 'PATCH', body: data });

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(`/alerts/${qs ? '?' + qs : ''}`);
};
export const createAlert = (data) => request('/alerts/', { method: 'POST', body: data });
export const acknowledgeAlert = (id) => request(`/alerts/${id}/acknowledge/`, { method: 'POST' });
export const acknowledgeAllAlerts = () => request('/alerts/acknowledge-all/', { method: 'POST' });

// ── AI Engine ─────────────────────────────────────────────────────────────────
export const runAIAnalysis = () => request('/ai/analyze/', { method: 'POST' });
export const getPriorityScores = () => request('/ai/priority-scores/');

// ── VoiceBot ──────────────────────────────────────────────────────────────────
export const voicebotReport = (transcript) =>
  request('/voicebot/report/', { method: 'POST', body: { transcript } });
export const voicebotCommand = (transcript) =>
  request('/voicebot/command/', { method: 'POST', body: { transcript } });
