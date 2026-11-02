const SCOPE = 'https://www.googleapis.com/auth/calendar';
const BASE  = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null;
let _token      = null;
let _expiry     = 0;

function loadScript(src) {
  return new Promise(resolve => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

export async function loadGoogleAuth(clientId) {
  await loadScript('https://accounts.google.com/gsi/client');
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {}, // overridden per request
  });
}

export function isAuthenticated() {
  return !!_token && Date.now() < _expiry;
}

export function requestToken() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = resp => {
      if (resp.error) { reject(resp); return; }
      _token  = resp.access_token;
      _expiry = Date.now() + (resp.expires_in - 60) * 1000;
      resolve();
    };
    // skip consent screen on silent refresh
    tokenClient.requestAccessToken({ prompt: isAuthenticated() ? '' : 'consent' });
  });
}

async function ensureToken() {
  if (!isAuthenticated()) await requestToken();
}

export async function fetchCalendarList() {
  await ensureToken();
  const res = await fetch(`${BASE}/users/me/calendarList?maxResults=250`, {
    headers: { Authorization: `Bearer ${_token}` },
  });
  if (!res.ok) throw new Error(`CalendarList API ${res.status}`);
  return (await res.json()).items ?? [];
}

export async function updateCalendarEvent(calendarId, eventId, event) {
  await ensureToken();
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error(`Update event API ${res.status}`);
  return res.json();
}

export async function createCalendarEvent(calendarId, event) {
  await ensureToken();
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error(`Create event API ${res.status}`);
  return res.json();
}

export async function deleteCalendarEvent(calendarId, eventId) {
  await ensureToken();
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${_token}` } }
  );
  if (!res.ok && res.status !== 204) throw new Error(`Delete event API ${res.status}`);
}

export async function fetchCalendarEvents(calendarId, start, end) {
  await ensureToken();
  const params = new URLSearchParams({
    timeMin:       start.toISOString(),
    timeMax:       end.toISOString(),
    singleEvents:  'true',
    orderBy:       'startTime',
    maxResults:    '500',
  });
  const res = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${_token}` } }
  );
  if (!res.ok) throw new Error(`Calendar API ${res.status}`);
  return (await res.json()).items ?? [];
}
