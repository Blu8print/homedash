// ─── Google OAuth 2.0 ────────────────────────────────────────────────────────
// Create credentials at https://console.cloud.google.com
//   APIs & Services → Credentials → Create OAuth client ID (Web application)
//   Add your dev URL (http://localhost:3000) and prod URL to Authorised origins
export const GOOGLE_CLIENT_ID = '940168686852-tnj879u8m94eosmsecn1cfitm3p8su0o.apps.googleusercontent.com';

// ─── Family calendars ────────────────────────────────────────────────────────
// id: 'primary' uses the authenticated user's main calendar.
//     For shared/extra calendars, find the ID in Google Calendar settings
//     under "Integrate calendar" (looks like xxx@group.calendar.google.com).
export const CALENDARS = [
  { id: 'primary',  name: 'Wes',      color: 'var(--color-wes)' },
  // { id: 'xxxxxxxx@group.calendar.google.com', name: 'Claudia',  color: 'var(--color-claudia)' },
  // { id: 'xxxxxxxx@group.calendar.google.com', name: 'Buzzsaw',  color: 'var(--color-buzzsaw)' },
  // { id: 'xxxxxxxx@group.calendar.google.com', name: 'Skidmark', color: 'var(--color-skidmark)' },
];
