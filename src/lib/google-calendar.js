const WEBHOOK_URL  = 'https://automation.whiterabbit.earth/webhook/7aadb08c-cef4-4c57-9ce5-bb0bfa651d53';
const HEADER_NAME  = import.meta.env.VITE_BUDGET_API_KEY;
const HEADER_VALUE = import.meta.env.VITE_BUDGET_API_HEADER;

async function post(body) {
  const headers = { 'Content-Type': 'application/json' };
  if (HEADER_NAME && HEADER_VALUE) headers[HEADER_NAME] = HEADER_VALUE;
  console.log('[calendar] POST', WEBHOOK_URL, body);
  console.log('[calendar] headers', { ...headers, [HEADER_NAME]: HEADER_VALUE ? '***' : undefined });
  let res;
  try {
    res = await fetch(WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (err) {
    console.error('[calendar] fetch threw (likely CORS/network):', err.message, err);
    throw err;
  }
  console.log('[calendar] status', res.status, res.statusText);
  console.log('[calendar] response headers', Object.fromEntries(res.headers.entries()));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[calendar] error body:', text);
    throw new Error(`Calendar webhook ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchCalendarEvents(calendarId, start, end) {
  const items = await post({
    action:     'get_calendar',
    calendarId,
    start:      start.toISOString(),
    end:        end.toISOString(),
  });
  return Array.isArray(items) ? items : [];
}

export async function createCalendarEvent(calendarId, event) {
  return post({ action: 'create_event', calendarId, event });
}

export async function updateCalendarEvent(calendarId, eventId, event) {
  return post({ action: 'update_event', calendarId, eventId, event });
}

export async function deleteCalendarEvent(calendarId, eventId) {
  return post({ action: 'delete_event', calendarId, eventId });
}

// Kept for API compatibility — no longer needed with n8n
export async function fetchCalendarList() { return []; }
export async function loadGoogleAuth()    {}
export function  isAuthenticated()        { return true; }
export function  requestToken()           { return Promise.resolve(); }
