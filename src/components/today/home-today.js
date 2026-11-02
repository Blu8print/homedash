import { LitElement, html, css } from 'lit';
import { loadGoogleAuth, requestToken, isAuthenticated, fetchCalendarEvents } from '../../lib/google-calendar.js';
import { GOOGLE_CLIENT_ID, CALENDARS } from '../../config/calendars.js';
import { supabase } from '../../lib/supabase.js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WEATHER_KEY    = import.meta.env.VITE_WEATHER_API_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OpenRouter_Key;

// ─── Chore add modal ─────────────────────────────────────────────────────────
const EMOJI_OPTIONS = [
  '📝','🧺','🛒','💊','♻️','🔧','🚗','🪴','🍽️','🐕',
  '🧹','🧴','📦','🛁','🪟','💡','🔑','🧊','🌿','📅',
  '🏋️','📞','✉️','🎁','🍕','☕','🧽','🪣','🛏️','🚿',
  '🐇','🌾','🔨','🪜','🪚','🍳','🥘','🪞','🪠','🫧',
];

// ─── Weather ──────────────────────────────────────────────────────────────────
function wapiEmoji(code) {
  if (code === 1000)                                                   return '☀';
  if (code === 1003)                                                   return '⛅';
  if (code === 1006 || code === 1009)                                  return '☁';
  if (code === 1030 || code === 1135 || code === 1147)                 return '🌫';
  if ([1087,1273,1276,1279,1282].includes(code))                       return '⛈';
  if ([1222,1225,1258].includes(code))                                 return '❄';
  if ([1204,1207,1210,1213,1216,1219,1249,1252,1255].includes(code))  return '🌨';
  if ([1237,1261,1264].includes(code))                                 return '🌩';
  if ([1063,1150,1153,1168,1180,1240].includes(code))                  return '🌦';
  return '🌧';
}

function weatherNarrative(condText, temp, hi, lo) {
  const t     = condText.toLowerCase();
  const rain  = t.includes('rain') || t.includes('drizzle') || t.includes('shower');
  const snow  = t.includes('snow') || t.includes('blizzard') || t.includes('sleet');
  const storm = t.includes('thunder');
  const fog   = t.includes('fog') || t.includes('mist');
  const clear = t.includes('sunny') || t.includes('clear');
  const range = hi - lo;

  let mood = '';
  if (temp <= 2)       mood = 'Freezing out.';
  else if (temp <= 8)  mood = 'Bundle up.';
  else if (temp <= 14) mood = 'Jacket weather.';
  else if (temp <= 20) mood = 'Comfortable day.';
  else if (temp <= 26) mood = 'Warm and pleasant.';
  else                 mood = 'Stay cool.';

  let desc = '';
  if (storm)       desc = 'Thunderstorms expected.';
  else if (snow)   desc = 'Snow on the ground.';
  else if (rain)   desc = 'Bring an umbrella.';
  else if (fog)    desc = 'Watch out for fog.';
  else if (clear && temp > 14) desc = 'Lovely day ahead.';
  else if (clear)  desc = 'Clear skies all day.';
  else if (range > 10) desc = 'Big temperature swing today.';
  else             desc = temp <= 10 ? 'Cool and grey.' : 'Mild and cloudy.';

  return `${desc} ${mood}`;
}

function fmtHourLabel(hour, curHour) {
  if (hour === curHour) return 'Now';
  return String(hour);
}

// ─── Trash ───────────────────────────────────────────────────────────────────
const WASTE_META = {
  GFT:        { label: 'GFT',    color: '#10b981', bg: '#d1fae5', icon: '♻' },
  PMD:        { label: 'PMD',    color: '#f59e0b', bg: '#fef3c7', icon: '♳' },
  Restafval:  { label: 'Rest',   color: '#6b7280', bg: '#f3f4f6', icon: '🗑' },
  Papier:     { label: 'Papier', color: '#3b82f6', bg: '#dbeafe', icon: '📄' },
  Kerstbomen: { label: 'Kerst',  color: '#059669', bg: '#d1fae5', icon: '🎄' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

function moonPhaseEmoji() {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');
  const lunarCycle   = 29.53058867;
  const age = (((Date.now() - knownNewMoon) / 86400000) % lunarCycle + lunarCycle) % lunarCycle;
  if (age < 1.85)  return '🌑';
  if (age < 7.38)  return '🌒';
  if (age < 9.22)  return '🌓';
  if (age < 14.77) return '🌔';
  if (age < 16.61) return '🌕';
  if (age < 22.15) return '🌖';
  if (age < 23.99) return '🌗';
  return '🌘';
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr) - today) / 86400000);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function evTime(ev) {
  if (!ev.start?.dateTime) return 'All day';
  const d = new Date(ev.start.dateTime);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isToday(ev) {
  const today = new Date().toISOString().slice(0, 10);
  const start = ev.start?.dateTime?.slice(0, 10) ?? ev.start?.date;
  return start === today;
}

// ─── Component ───────────────────────────────────────────────────────────────
export class HomeToday extends LitElement {
  static properties = {
    _time:        { state: true },
    _weather:     { state: true },
    _weatherErr:  { state: true },
    _trash:       { state: true },
    _events:        { state: true },
    _eventsErr:     { state: true },
    _authed:        { state: true },
    _chores:        { state: true },
    _addModal:      { state: true },
    _addEmoji:      { state: true },
    _addStars:      { state: true },
    _addRecurrence: { state: true },
    _addName:       { state: true },
    _quote:         { state: true },
    _narrative:     { state: true },
  };

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: block;
      padding: 28px 32px;
      font-family: var(--font-sans);
      box-sizing: border-box;
    }

    /* ── Grid ── */
    .page-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
    }
    .left-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .top-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    /* ── Card base ── */
    .card {
      background: var(--color-card);
      border-radius: var(--radius);
      padding: 20px 22px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      box-sizing: border-box;
    }
    .card-label {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 10px;
    }

    /* ── Clock ── */
    .clock-time {
      font-family: var(--font-serif);
      font-size: 3.6rem;
      line-height: 1;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .clock-ampm {
      font-size: 1.1rem;
      color: var(--color-text-muted);
      margin-left: 4px;
      vertical-align: super;
      font-family: var(--font-sans);
    }
    .clock-date {
      margin-top: 6px;
      font-size: 0.85rem;
      color: var(--color-text-muted);
      text-transform: capitalize;
    }
    .clock-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .clock-moon {
      font-size: 2.8rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .clock-quote {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border, #e5e7eb);
    }
    .clock-quote-text {
      font-family: var(--font-serif);
      font-size: 0.82rem;
      font-style: italic;
      color: var(--color-text);
      line-height: 1.5;
    }
    .clock-quote-source {
      font-size: 0.65rem;
      color: var(--color-text-muted);
      margin-top: 4px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }

    /* ── Weather ── */
    .weather-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .weather-icon {
      font-size: 2.8rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .weather-right { display: flex; flex-direction: column; }
    .weather-top-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .weather-temp {
      font-family: var(--font-serif);
      font-size: 2.8rem;
      line-height: 1;
      font-weight: 700;
      color: var(--color-text);
    }
    .weather-meta { display: flex; flex-direction: column; justify-content: center; }
    .weather-condition {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      line-height: 1.3;
    }
    .weather-hl {
      font-size: 0.68rem;
      color: var(--color-text-muted);
      line-height: 1.3;
    }
    .weather-hl span { color: var(--color-text); font-weight: 600; }
    .weather-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .weather-forecast {
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: flex-end;
      flex-shrink: 0;
      padding-top: 2px;
    }
    .forecast-day {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .forecast-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      width: 16px;
    }
    .forecast-icon { font-size: 0.85rem; line-height: 1; }
    .forecast-temps {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
    }
    .forecast-lo { color: var(--color-text-muted); font-weight: 400; }

    .weather-narrative {
      font-size: 0.8rem;
      font-style: italic;
      color: var(--color-text-muted);
      margin-top: 8px;
      line-height: 1.4;
    }
    .hourly-row {
      display: flex;
      gap: 10px;
      margin-top: 10px;
      overflow-x: auto;
      padding-bottom: 2px;
      border-top: 1px solid var(--color-border, #e5e7eb);
      padding-top: 10px;
    }
    .hourly-row::-webkit-scrollbar { display: none; }
    .hour-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
      min-width: 28px;
    }
    .hour-label {
      font-size: 0.62rem;
      color: var(--color-text-muted);
      font-weight: 600;
    }
    .hour-label.now { color: var(--color-text); }
    .hour-icon { font-size: 1rem; line-height: 1; }
    .hour-temp {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--color-text);
    }

    /* ── Trash ── */
    .trash-next {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .trash-badge {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      flex-shrink: 0;
    }
    .trash-info { flex: 1; }
    .trash-type {
      font-family: var(--font-serif);
      font-size: 1.5rem;
      line-height: 1;
      color: var(--color-text);
    }
    .trash-date {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin-top: 3px;
      text-transform: capitalize;
    }
    .trash-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      white-space: nowrap;
      align-self: flex-start;
    }
    .trash-today    { background: #fef3c7; color: #92400e; }
    .trash-tomorrow { background: #dbeafe; color: #1e40af; }
    .trash-later    { background: var(--color-card-alt); color: var(--color-text-muted); }
    .trash-upcoming-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .trash-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 0.68rem;
      font-weight: 600;
    }
    .trash-chip-icon { font-size: 0.85rem; }

    /* ── Events ── */
    .events-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--color-card-alt);
    }
    .event-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }
    .event-body { flex: 1; min-width: 0; }
    .event-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .event-meta {
      font-size: 0.72rem;
      color: var(--color-text-muted);
      margin-top: 1px;
    }
    .event-day-badge {
      font-size: 0.62rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--color-accent-yellow-bg);
      color: #92400e;
      white-space: nowrap;
      align-self: center;
    }
    .event-day-badge.upcoming {
      background: #f3f4f6;
      color: var(--color-text-muted);
    }

    /* ── Auth ── */
    .auth-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 24px 0;
    }
    .auth-icon { font-size: 2rem; }
    .auth-label {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      text-align: center;
    }
    .auth-btn {
      padding: 8px 18px;
      border-radius: 999px;
      border: none;
      background: var(--color-text);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .auth-btn:hover { opacity: 0.8; }

    /* ── Chores ── */
    .chore-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .chore-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--color-card-alt);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .chore-item:hover { opacity: 0.75; }
    .chore-item.done {
      opacity: 0.45;
    }
    .chore-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: rgba(28,30,34,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .chore-name {
      flex: 1;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .chore-item.done .chore-name {
      text-decoration: line-through;
      color: var(--color-text-muted);
    }
    .chore-stars {
      font-size: 0.65rem;
      color: #e11d48;
      font-weight: 700;
      white-space: nowrap;
    }

    /* ── Add chore input ── */
    .chore-add-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--color-border);
    }
    .chore-add-input {
      flex: 1;
      border: none;
      background: var(--color-card-alt);
      border-radius: 8px;
      padding: 7px 10px;
      font-family: var(--font-sans);
      font-size: 0.82rem;
      color: var(--color-text);
      outline: none;
    }
    .chore-add-input::placeholder { color: var(--color-text-muted); }
    .chore-add-input:focus { box-shadow: 0 0 0 2px rgba(59,130,246,0.25); }
    .chore-add-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: none;
      background: var(--color-text);
      color: #fff;
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .chore-add-btn:hover { opacity: 0.75; }

    /* ── Modal ── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--color-card);
      border-radius: 20px;
      padding: 24px;
      width: 360px;
      max-width: 90vw;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    }
    .modal-title {
      font-family: var(--font-serif);
      font-size: 1.15rem;
      color: var(--color-text);
      margin: 0;
    }
    .modal-name-input {
      width: 100%;
      border: 1.5px solid var(--color-border);
      border-radius: 10px;
      padding: 10px 12px;
      font-family: var(--font-sans);
      font-size: 0.9rem;
      color: var(--color-text);
      background: var(--color-card);
      outline: none;
      box-sizing: border-box;
    }
    .modal-name-input:focus { border-color: #3b82f6; }
    .modal-label {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }
    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 4px;
    }
    .emoji-btn {
      background: var(--color-card-alt);
      border: 2px solid transparent;
      border-radius: 8px;
      padding: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: border-color 0.1s, background 0.1s;
      line-height: 1;
      text-align: center;
    }
    .emoji-btn.selected {
      border-color: #3b82f6;
      background: #dbeafe;
    }
    .star-row { display: flex; gap: 10px; }
    .star-btn {
      font-size: 1.5rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      filter: grayscale(1) opacity(0.25);
      color: #e11d48;
      transition: filter 0.1s, transform 0.1s;
    }
    .star-btn.active { filter: none; transform: scale(1.1); }
    .recur-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .recur-btn {
      padding: 5px 11px;
      border-radius: 8px;
      border: 1.5px solid var(--color-border);
      background: var(--color-card-alt);
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: border-color 0.1s, background 0.1s, color 0.1s;
    }
    .recur-btn.selected { border-color: #6366f1; background: #eef2ff; color: #4338ca; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-cancel {
      padding: 8px 16px;
      border-radius: 10px;
      border: 1.5px solid var(--color-border);
      background: none;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--color-text-muted);
      cursor: pointer;
    }
    .btn-save {
      padding: 8px 18px;
      border-radius: 10px;
      border: none;
      background: #111827;
      color: white;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-save:hover { background: #374151; }

    /* ── Baby ── */
    .baby-main {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .baby-badge {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      background: #fce7f3;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .baby-badge img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .baby-info { flex: 1; }
    .baby-week {
      font-family: var(--font-serif);
      font-size: 1.5rem;
      line-height: 1;
      color: var(--color-text);
    }
    .baby-sub {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin-top: 3px;
    }
    .baby-due {
      font-size: 0.72rem;
      color: var(--color-text-muted);
      margin-top: 2px;
    }
    .baby-progress {
      height: 4px;
      background: #fce7f3;
      border-radius: 2px;
      margin-top: 12px;
      overflow: hidden;
    }
    .baby-bar {
      height: 100%;
      background: #ec4899;
      border-radius: 2px;
    }

    /* ── Right column ── */
    .right-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Status ── */
    .muted {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      padding: 8px 0;
    }
  `;

  constructor() {
    super();
    this._time       = this._nowTime();
    this._weather    = null;
    this._weatherErr = null;
    this._trash      = [];
    this._events     = [];
    this._eventsErr  = null;
    this._authed     = false;
    this._chores        = [];
    this._addModal      = false;
    this._addName       = '';
    this._addEmoji      = '📝';
    this._addStars      = 0;
    this._addRecurrence = 'none';
    this._quote         = null;
    this._narrative     = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._tick();
    this._clockTimer = setInterval(() => { this._time = this._nowTime(); }, 1000);
    this._loadWeather();
    this._loadTrash();
    this._initCalendar();
    this._loadChores();
    this._subscribeChores();
    this._loadQuote();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockTimer);
    clearInterval(this._weatherTimer);
    this._choresChannel?.unsubscribe();
  }

  // ── Clock ──────────────────────────────────────────────────────────────────
  _nowTime() {
    const now = new Date();
    const h24 = now.getHours();
    const m   = now.getMinutes();
    const s   = now.getSeconds();
    const h12 = h24 % 12 || 12;
    const ampm = h24 < 12 ? 'AM' : 'PM';
    const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return { display: `${h12}:${pad(m)}`, ampm, date };
  }

  _tick() { this._time = this._nowTime(); }

  // ── Weather ────────────────────────────────────────────────────────────────
  _parseWeatherData(data) {
    const now     = new Date();
    const curHour = now.getHours();
    const fd      = data.forecast.forecastday[0];
    const hours   = fd.hour
      .map(h => ({ hour: new Date(h.time).getHours(), temp: Math.round(h.temp_c), code: h.condition.code }))
      .filter(h => h.hour >= curHour && h.hour <= curHour + 7);
    const upcoming = data.forecast.forecastday.slice(1).map(d => ({
      label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2),
      hi:    Math.round(d.day.maxtemp_c),
      lo:    Math.round(d.day.mintemp_c),
      code:  d.day.condition.code,
    }));
    return {
      temp:     Math.round(data.current.temp_c),
      condText: data.current.condition.text,
      code:     data.current.condition.code,
      hi:       Math.round(fd.day.maxtemp_c),
      lo:       Math.round(fd.day.mintemp_c),
      hours,
      curHour,
      upcoming,
    };
  }

  async _loadWeather() {
    const CACHE_KEY = 'weather_cache';
    const CACHE_TTL = 60 * 60 * 1000; // 1 hour

    // Load from cache immediately (any age — better than nothing)
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached?.data) {
        this._weather    = this._parseWeatherData(cached.data);
        this._weatherErr = null;
      }
    } catch (_) {}

    // Always fetch fresh in background; refresh every hour
    const fetchFresh = async () => {
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_KEY}&q=51.769,5.557&days=3&aqi=no&alerts=no`;
      const delays = [0, 10000, 30000]; // immediate, 10s, 30s
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
          const parsed = this._parseWeatherData(data);
          this._weather    = parsed;
          this._weatherErr = null;
          this._loadNarrative(parsed.condText, parsed.temp, parsed.hi, parsed.lo);
          return; // success — stop retrying
        } catch (e) {
          if (i === delays.length - 1 && !this._weather) this._weatherErr = e.message;
        }
      }
    };

    await fetchFresh();
    this._weatherTimer = setInterval(fetchFresh, 60 * 60 * 1000);
  }

  async _loadNarrative(condText, temp, hi, lo) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          max_tokens: 40,
          messages: [{ role: 'user', content: `Weather in Herpen, Netherlands: ${condText}, ${temp}°C, high ${hi}°C, low ${lo}°C. Write ONE practical sentence of weather advice. Maximum 55 characters including spaces. No preamble, no quotes.` }],
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      this._narrative = json.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (_) {}
  }

  // ── Trash ──────────────────────────────────────────────────────────────────
  async _loadTrash() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/trash_collection?date=gte.${today}&order=date.asc&limit=4`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._trash = await res.json();
    } catch (_) {}
  }

  // ── Chores ─────────────────────────────────────────────────────────────────
  async _loadChores() {
    const { data } = await supabase
      .from('todos')
      .select('id, name, emoji, done, stars')
      .eq('person', 'anyone')
      .order('sort_order')
      .order('created_at');
    this._chores = data ?? [];
  }

  async _loadQuote() {
    const { data } = await supabase.from('quotes_of_the_day').select('quote, source');
    if (!data?.length) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    this._quote = data[dayOfYear % data.length];
  }

  _subscribeChores() {
    this._choresChannel = supabase
      .channel('today-chores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => this._loadChores())
      .subscribe();
  }

  async _toggleChore(task) {
    const done = !task.done;
    const completed_at = done ? new Date().toISOString() : null;
    this._chores = this._chores.map(t => t.id === task.id ? { ...t, done } : t);
    await supabase.from('todos').update({ done, completed_at }).eq('id', task.id);
  }

  _openAddModal(name) {
    if (!name.trim()) return;
    this._addName  = name.trim();
    this._addEmoji = '📝';
    this._addStars = 0;
    this._addRecurrence = 'none';
    this._addModal = true;
  }

  async _confirmAdd() {
    this._addModal = false;
    const maxOrder = this._chores.reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
    const { data } = await supabase
      .from('todos')
      .insert({ person: 'anyone', name: this._addName, emoji: this._addEmoji, stars: this._addStars || null, recurrence: this._addRecurrence, sort_order: maxOrder + 1 })
      .select().single();
    if (data) this._chores = [...this._chores, data];
  }

  // ── Calendar ───────────────────────────────────────────────────────────────
  async _initCalendar() {
    await loadGoogleAuth(GOOGLE_CLIENT_ID);
    if (isAuthenticated()) {
      this._authed = true;
      await this._loadEvents();
    }
  }

  async _connectCalendar() {
    await requestToken();
    this._authed = true;
    await this._loadEvents();
  }

  async _loadEvents() {
    try {
      const now  = new Date();
      const end  = new Date(); end.setDate(end.getDate() + 7);
      const all  = [];
      for (const cal of CALENDARS) {
        const evs = await fetchCalendarEvents(cal.id, now, end);
        evs.forEach(e => all.push({ ...e, _calColor: cal.color, _calName: cal.name }));
      }
      all.sort((a, b) => {
        const ta = a.start?.dateTime ?? a.start?.date ?? '';
        const tb = b.start?.dateTime ?? b.start?.date ?? '';
        return ta.localeCompare(tb);
      });
      this._events = all.slice(0, 8);
    } catch (e) {
      this._eventsErr = e.message;
    }
  }

  // ── Baby ───────────────────────────────────────────────────────────────────
  _renderBaby() {
    const DUE = new Date('2027-03-19T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((DUE - today) / 86400000);
    const daysPregnant = 280 - daysLeft;
    const weeks = Math.floor(daysPregnant / 7);
    const dayOfWeek = daysPregnant % 7;
    const pct = Math.min(100, Math.round(daysPregnant / 280 * 100));
    return html`
      <div class="card">
        <div class="card-label">Baby</div>
        <div class="baby-main">
          <div class="baby-badge"><img src="/baby.svg" alt="Baby" /></div>
          <div class="baby-info">
            <div class="baby-week">Week ${weeks}</div>
            <div class="baby-sub">Day ${dayOfWeek} · ${daysLeft} days to go</div>
            <div class="baby-due">Due Thu 19 Mar 2027</div>
          </div>
        </div>
        <div class="baby-progress">
          <div class="baby-bar" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  _renderClock() {
    const { display, ampm, date } = this._time;
    const moon = moonPhaseEmoji();
    return html`
      <div class="card">
        <div class="card-label">Now</div>
        <div class="clock-body">
          <div>
            <div class="clock-time">${display}<span class="clock-ampm">${ampm}</span></div>
            <div class="clock-date">${date}</div>
          </div>
          <div class="clock-moon">${moon}</div>
        </div>
        ${this._quote ? html`
          <div class="clock-quote">
            <div class="clock-quote-text">"${this._quote.quote}"</div>
            <div class="clock-quote-source">— ${this._quote.source}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderWeather() {
    if (!this._weather && this._weatherErr) return html`<div class="card"><div class="card-label">Weather</div><div class="muted">Unavailable: ${this._weatherErr}</div></div>`;
    if (!this._weather)   return html`<div class="card"><div class="card-label">Weather</div><div class="muted">Loading…</div></div>`;
    const { temp, condText, code, hi, lo, hours, curHour, upcoming } = this._weather;
    const icon      = wapiEmoji(code);
    const narrative = this._narrative ?? weatherNarrative(condText, temp, hi, lo);
    return html`
      <div class="card">
        <div class="card-label">Weather · Koolwijk</div>
        <div class="weather-top">
          <div class="weather-main">
            <div class="weather-icon">${icon}</div>
            <div class="weather-right">
              <div class="weather-top-row">
                <div class="weather-temp">${temp}°</div>
                <div class="weather-meta">
                  <div class="weather-condition">${condText}</div>
                  <div class="weather-hl">H <span>${hi}°</span> · L <span>${lo}°</span></div>
                </div>
              </div>
            </div>
          </div>
          <div class="weather-forecast">
            ${upcoming.map(d => html`
              <div class="forecast-day">
                <span class="forecast-label">${d.label}</span>
                <span class="forecast-icon">${wapiEmoji(d.code)}</span>
                <span class="forecast-temps">${d.hi}° <span class="forecast-lo">${d.lo}°</span></span>
              </div>
            `)}
          </div>
        </div>
        <div class="weather-narrative">${narrative}</div>
        <div class="hourly-row">
          ${hours.map(h => {
            const hIcon = wapiEmoji(h.code);
            const lbl = fmtHourLabel(h.hour, curHour);
            return html`
              <div class="hour-item">
                <div class="hour-label ${h.hour === curHour ? 'now' : ''}">${lbl}</div>
                <div class="hour-icon">${hIcon}</div>
                <div class="hour-temp">${h.temp}°</div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  _renderTrash() {
    if (!this._trash.length) return html`<div class="card"><div class="card-label">Trash</div><div class="muted">No data</div></div>`;
    const [next, ...rest] = this._trash;
    const meta  = WASTE_META[next.waste_type] ?? { label: next.waste_type, color: '#6b7280', bg: '#f3f4f6', icon: '?' };
    const days  = daysUntil(next.date);
    const pill  = days === 0 ? ['Today',    'trash-pill trash-today']
                : days === 1 ? ['Tomorrow', 'trash-pill trash-tomorrow']
                :              [`${days}d`, 'trash-pill trash-later'];
    return html`
      <div class="card">
        <div class="card-label">Trash</div>
        <div class="trash-next">
          <div class="trash-badge" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
          <div class="trash-info">
            <div class="trash-type">${meta.label}</div>
            <div class="trash-date">${fmtDate(next.date)}</div>
          </div>
          <span class="${pill[1]}">${pill[0]}</span>
        </div>
        ${rest.length ? html`
          <div class="trash-upcoming-row">
            ${rest.map(r => {
              const m = WASTE_META[r.waste_type] ?? { label: r.waste_type, color: '#6b7280', bg: '#f3f4f6', icon: '?' };
              return html`
                <div class="trash-chip" style="background:${m.bg};color:${m.color}">
                  <span class="trash-chip-icon">${m.icon}</span>${m.label}
                </div>
              `;
            })}
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderEvents() {
    if (!this._authed) return html`
      <div class="card">
        <div class="card-label">Calendar</div>
        <div class="auth-prompt">
          <div class="auth-icon">📅</div>
          <div class="auth-label">Connect Google Calendar to<br>see upcoming events</div>
          <button class="auth-btn" @click=${() => this._connectCalendar()}>Connect</button>
        </div>
      </div>
    `;
    if (this._eventsErr) return html`<div class="card"><div class="card-label">Calendar</div><div class="muted">Error: ${this._eventsErr}</div></div>`;
    if (!this._events.length) return html`<div class="card"><div class="card-label">Calendar</div><div class="muted">No upcoming events</div></div>`;

    return html`
      <div class="card">
        <div class="card-label">Upcoming</div>
        <div class="events-list">
          ${this._events.map(ev => {
            const today = isToday(ev);
            const time  = evTime(ev);
            const dateLabel = today ? 'Today' : new Date(ev.start?.dateTime ?? ev.start?.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            return html`
              <div class="event-item">
                <div class="event-dot" style="background:${ev._calColor}"></div>
                <div class="event-body">
                  <div class="event-title">${ev.summary ?? '(no title)'}</div>
                  <div class="event-meta">${time}${ev.location ? ` · ${ev.location}` : ''}</div>
                </div>
                <div class="event-day-badge ${today ? '' : 'upcoming'}">${dateLabel}</div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  _renderAddModal() {
    if (!this._addModal) return '';
    const opts = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
    return html`
      <div class="modal-backdrop" @click=${e => e.target === e.currentTarget && (this._addModal = false)}>
        <div class="modal">
          <p class="modal-title">New task for Anyone</p>
          <input class="modal-name-input"
            .value=${this._addName}
            @input=${e => { this._addName = e.target.value; }}
            @keydown=${e => e.key === 'Enter' && this._confirmAdd()}
            autofocus
          />
          <div>
            <div class="modal-label">Icon</div>
            <div class="emoji-grid">
              ${EMOJI_OPTIONS.map(em => html`
                <button class="emoji-btn ${this._addEmoji === em ? 'selected' : ''}"
                  @click=${() => { this._addEmoji = em; }}>${em}</button>
              `)}
            </div>
          </div>
          <div>
            <div class="modal-label">Hearts</div>
            <div class="star-row">
              ${[1,2,3].map(n => html`
                <button class="star-btn ${this._addStars >= n ? 'active' : ''}"
                  @click=${() => { this._addStars = this._addStars === n ? 0 : n; }}>♥</button>
              `)}
            </div>
          </div>
          <div>
            <div class="modal-label">Repeats</div>
            <div class="recur-row">
              ${opts.map(o => html`
                <button class="recur-btn ${this._addRecurrence === o ? 'selected' : ''}"
                  @click=${() => { this._addRecurrence = o; }}>${o[0].toUpperCase() + o.slice(1)}</button>
              `)}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click=${() => { this._addModal = false; }}>Cancel</button>
            <button class="btn-save" @click=${() => this._confirmAdd()}>Add task</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderChores() {
    const items = this._chores.filter(t => !t.done);
    return html`
      ${this._renderAddModal()}
      <div class="card">
        <div class="card-label">Up for grabs · Anyone</div>
        ${!items.length
          ? html`<div class="muted">No open tasks</div>`
          : html`
            <div class="chore-list">
              ${items.map(task => html`
                <div class="chore-item" @click=${() => this._toggleChore(task)}>
                  <div class="chore-icon">${task.emoji ?? '📝'}</div>
                  <div class="chore-name">${task.name}</div>
                  ${task.stars ? html`<div class="chore-stars">${'♥'.repeat(task.stars)}</div>` : ''}
                </div>
              `)}
            </div>
          `
        }
        <div class="chore-add-row">
          <input
            class="chore-add-input"
            placeholder="Add a task..."
            @keydown=${e => { if (e.key === 'Enter') { this._openAddModal(e.target.value); e.target.value = ''; } }}
          />
          <button class="chore-add-btn"
            @click=${e => {
              const input = e.target.closest('.chore-add-row').querySelector('.chore-add-input');
              this._openAddModal(input.value);
              input.value = '';
            }}>+</button>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-grid">
        <div class="left-col">
          <div class="top-row">
            ${this._renderClock()}
            ${this._renderWeather()}
          </div>
          ${this._renderEvents()}
        </div>
        <div class="right-col">
          ${this._renderBaby()}
          ${this._renderTrash()}
          ${this._renderChores()}
        </div>
      </div>
    `;
  }
}

customElements.define('home-today', HomeToday);
