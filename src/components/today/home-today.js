import { LitElement, html, css } from 'lit';
import { fetchCalendarEvents } from '../../lib/google-calendar.js';
import { CALENDARS } from '../../config/calendars.js';
import { supabase } from '../../lib/supabase.js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;
const WEATHER_KEY   = import.meta.env.VITE_WEATHER_API_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OpenRouter_Key;
const API_NINJAS_KEY = import.meta.env.VITE_API_NINJAS_KEY;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

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
  const t = condText.toLowerCase();
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
  if (storm)                        desc = 'Thunderstorms expected.';
  else if (snow)                    desc = 'Snow on the ground.';
  else if (rain)                    desc = 'Bring an umbrella.';
  else if (fog)                     desc = 'Watch out for fog.';
  else if (clear && temp > 14)      desc = 'Lovely day ahead.';
  else if (clear)                   desc = 'Clear skies all day.';
  else if (range > 10)              desc = 'Big temperature swing today.';
  else                              desc = temp <= 10 ? 'Cool and grey.' : 'Mild and cloudy.';

  return `${desc} ${mood}`;
}

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

function evTime(ev) {
  if (!ev.start?.dateTime) return 'All day';
  const d = new Date(ev.start.dateTime);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// ─── Constants ───────────────────────────────────────────────────────────────
const WASTE_META = {
  GFT:        { label: 'GFT',    icon: '♻',  chipBg: '#D4EDDA', chipColor: '#2A6E3B', chipBorder: '#80C98E' },
  PMD:        { label: 'PMD',    icon: '♳',  chipBg: '#FFF3CD', chipColor: '#7A6000', chipBorder: '#F0D060' },
  Restafval:  { label: 'Rest',   icon: '🗑', chipBg: '#E8E8E8', chipColor: '#444444', chipBorder: '#CCCCCC' },
  Papier:     { label: 'Paper',  icon: '📄', chipBg: '#DBEAFE', chipColor: '#1D4ED8', chipBorder: '#93C5FD' },
  Kerstbomen: { label: 'Kerst',  icon: '🎄', chipBg: '#D1FAE5', chipColor: '#065F46', chipBorder: '#6EE7B7' },
};

const TODO_PEOPLE = [
  { key: 'mariaelena', name: 'Maria',      lsKey: 'lane-color-mariaelena', defaultColor: '#851869' },
  { key: 'sebastiaan', name: 'Sebastiaan', lsKey: 'lane-color-sebastiaan', defaultColor: '#137c15' },
  { key: 'anyone',     name: 'Anyone',     lsKey: 'lane-color-anyone',     defaultColor: '#f59e0b' },
];

// ─── Component ───────────────────────────────────────────────────────────────
export class HomeToday extends LitElement {
  static properties = {
    _time:        { state: true },
    _weather:     { state: true },
    _weatherErr:  { state: true },
    _trash:       { state: true },
    _trashTooltip: { state: true },
    _events:      { state: true },
    _eventsErr:   { state: true },
    _authed:      { state: true },
    _allTodos:    { state: true },
    _todoColors:  { state: true },
    _quote:       { state: true },
    _narrative:   { state: true },
    _weekOffset:  { state: true },
  };

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      gap: 12px;
      padding: 12px;
      font-family: var(--font-sans);
      box-sizing: border-box;
    }

    /* ── Layout ── */
    .col-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      min-height: 0;
    }

    .top-row {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .clock-card {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .weather-card {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .col-right {
      width: 288px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: hidden;
    }

    .col-right .card {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .col-right .card.compact {
      flex: 0 0 auto;
    }

    /* ── Card base ── */
    .card {
      background: var(--color-card);
      border-radius: 14px;
      border: 1px solid var(--color-border);
      padding: 14px 16px;
      overflow: hidden;
      box-sizing: border-box;
    }

    .card-label {
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      flex-shrink: 0;
    }

    .muted {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      padding: 4px 0;
    }

    /* ── Clock ── */
    .clock-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .clock-time {
      font-family: var(--font-serif);
      font-size: 3.8rem;
      font-weight: 700;
      line-height: 1;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }

    .clock-date {
      font-size: 0.85rem;
      color: var(--color-text-muted);
      margin-top: 6px;
    }

    .clock-moon {
      font-size: 2.8rem;
      line-height: 1;
      flex-shrink: 0;
    }

    .clock-quote {
      margin-top: auto;
      padding-top: 12px;
      font-family: var(--font-serif);
      font-style: italic;
      font-size: 0.82rem;
      color: var(--color-text-muted);
      line-height: 1.55;
    }

    .clock-quote-source {
      font-style: normal;
      font-size: 0.72rem;
    }

    /* ── Weather ── */
    .weather-top {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 8px;
    }

    .weather-icon { font-size: 3rem; line-height: 1; }

    .weather-temp {
      font-family: var(--font-serif);
      font-size: 3.2rem;
      font-weight: 700;
      line-height: 1;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }

    .weather-right { flex: 1; }

    .weather-cond {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .weather-hl {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-top: 3px;
    }

    .weather-narrative {
      font-size: 0.72rem;
      font-style: italic;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      line-height: 1.35;
    }

    .weather-body {
      display: flex;
      gap: 14px;
      flex: 1;
      min-height: 0;
    }

    .weather-current {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .weather-forecast {
      display: flex;
      flex-direction: column;
      gap: 10px;
      justify-content: flex-start;
      padding-top: 4px;
      padding-left: 14px;
      flex-shrink: 0;
    }

    .forecast-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .forecast-day {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      width: 26px;
    }

    .forecast-icon { font-size: 1rem; line-height: 1; }

    .forecast-hi {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .forecast-lo {
      font-size: 0.65rem;
      color: var(--color-text-muted);
    }

    .hourly-row {
      display: flex;
      gap: 10px;
    }

    .hour-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .hour-label { font-size: 0.58rem; color: var(--color-text-muted); font-weight: 600; }
    .hour-icon  { font-size: 0.95rem; line-height: 1; }
    .hour-temp  { font-size: 0.68rem; font-weight: 600; color: var(--color-text); }

    /* ── Calendar ── */
    .cal-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .cal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      flex-shrink: 0;
    }

    .cal-nav {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--color-card-alt);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      color: var(--color-text-muted);
      cursor: pointer;
      flex-shrink: 0;
      pointer-events: auto;
    }

    .cal-title {
      font-family: var(--font-serif);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .cal-week-badge {
      background: var(--color-text);
      color: #fff;
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.07em;
    }

    .cal-grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      min-height: 0;
      overflow: hidden;
    }

    .cal-day-col {
      background: var(--color-card-alt);
      border-radius: 12px;
      border: 1px solid var(--color-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .cal-day-col.today {
      border-color: var(--color-text);
    }

    .cal-day-header {
      padding: 7px 8px 6px;
      text-align: center;
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .cal-day-col.today .cal-day-header {
      background: var(--color-text);
    }

    .cal-day-name {
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .cal-day-col.today .cal-day-name { color: rgba(255,255,255,0.65); }

    .cal-day-num {
      font-family: var(--font-serif);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.1;
      margin-top: 2px;
    }

    .cal-day-col.today .cal-day-num { color: #fff; }

    .cal-ev-badge {
      display: inline-block;
      font-size: 0.55rem;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    .cal-day-col.today .cal-ev-badge { color: rgba(255,255,255,0.55); }

    .cal-day-body {
      flex: 1;
      padding: 7px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      overflow: hidden;
      min-height: 0;
    }

    .cal-event-chip {
      background: var(--color-card);
      border-radius: 8px;
      padding: 6px 8px;
      border-left: 3px solid var(--color-accent);
      line-height: 1.3;
      flex-shrink: 0;
    }

    .cal-ev-time {
      font-size: 0.58rem;
      color: var(--color-text-muted);
      margin-bottom: 2px;
    }

    .cal-ev-title {
      font-size: 0.72rem;
      font-weight: 500;
      color: var(--color-text);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .cal-day-free {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .cal-free-label {
      font-size: 0.6rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
      opacity: 0.45;
    }

    /* ── Baby ── */
    .baby-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .baby-emoji { font-size: 2rem; line-height: 1; }

    .baby-info { flex: 1; }

    .baby-week {
      font-family: var(--font-serif);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1;
    }

    .baby-sub {
      font-size: 0.72rem;
      color: var(--color-text-muted);
      margin-top: 3px;
    }

    .baby-due {
      font-size: 0.68rem;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    .baby-bar {
      height: 4px;
      background: var(--color-border);
      border-radius: 999px;
      margin-top: 10px;
      overflow: hidden;
    }

    .baby-bar-fill {
      height: 100%;
      background: #d4559a;
      border-radius: 999px;
    }

    /* ── Trash ── */
    .trash-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3px;
    }

    .trash-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .trash-badge {
      font-size: 0.65rem;
      background: var(--color-card-alt);
      border: 1px solid var(--color-border);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--color-text-muted);
    }

    .trash-date {
      font-size: 0.72rem;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }

    .trash-chips { display: flex; gap: 6px; flex-wrap: wrap; }

    .trash-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 0.72rem;
      font-weight: 600;
      border: 1px solid;
      cursor: pointer;
    }

    .trash-card { position: relative; }
    .trash-tap { cursor: pointer; }

    .trash-tooltip-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.4);
    }
    .trash-tooltip {
      background: var(--color-card);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      padding: 0.6rem 1.25rem;
      text-align: center;
      min-width: 150px;
    }
    .trash-tooltip-icon { font-size: 1.5rem; line-height: 1; margin-bottom: 0.25rem; }
    .trash-tooltip-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .trash-tooltip-days {
      font-family: var(--font-serif);
      font-size: 1.3rem;
      color: var(--color-text);
      margin-top: 0.2rem;
      line-height: 1;
    }
    .trash-tooltip-date {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }

    /* ── Upcoming ── */
    .upcoming-card {
      flex: 0 0 210px;
      overflow: hidden;
    }

    .upcoming-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .upcoming-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      background: var(--color-card-alt);
      border-radius: 10px;
    }

    .upcoming-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .upcoming-info { flex: 1; min-width: 0; }

    .upcoming-name {
      font-size: 0.88rem;
      font-weight: 500;
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .upcoming-time { font-size: 0.72rem; color: var(--color-text-muted); margin-top: 1px; }

    .upcoming-when {
      font-size: 0.7rem;
      color: var(--color-text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Task rings ── */
    .chores-row {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
      margin-top: 4px;
      flex: 1;
    }

    .chore-person {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .chore-ring {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: conic-gradient(var(--clr) var(--pct), var(--color-border) var(--pct));
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chore-inner {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: var(--color-card);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--color-text);
    }

    .chore-name {
      font-size: 0.58rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }
  `;

  constructor() {
    super();
    this._time       = this._nowTime();
    this._weather    = null;
    this._weatherErr = null;
    this._trash      = [];
    this._trashTooltip = null;
    this._events     = [];
    this._eventsErr  = null;
    this._authed     = false;
    this._allTodos   = [];
    this._todoColors = {
      mariaelena: localStorage.getItem('lane-color-mariaelena') || '#851869',
      sebastiaan:  localStorage.getItem('lane-color-sebastiaan')  || '#137c15',
      anyone:      localStorage.getItem('lane-color-anyone')      || '#f59e0b',
    };
    this._quote     = null;
    this._narrative = null;
    this._weekOffset = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    this._clockTimer = setInterval(() => { this._time = this._nowTime(); }, 1000);
    this._loadWeather();
    this._loadTrash();
    this._loadEvents();
    this._loadTodos();
    this._subscribeTodos();
    this._loadQuote();
    this._eventsTimer = setInterval(() => this._loadEvents(), 5 * 60 * 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockTimer);
    clearInterval(this._weatherTimer);
    clearInterval(this._eventsTimer);
    this._todosChannel?.unsubscribe();
  }

  // ── Clock ──────────────────────────────────────────────────────────────────
  _nowTime() {
    const now = new Date();
    return {
      display: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  }

  // ── Weather ────────────────────────────────────────────────────────────────
  _parseWeatherData(data) {
    const now     = new Date();
    const curHour = now.getHours();
    const fd      = data.forecast.forecastday[0];
    const todayHours = fd.hour
      .map(h => ({ hour: new Date(h.time).getHours(), temp: Math.round(h.temp_c), code: h.condition.code }))
      .filter(h => h.hour >= curHour);
    const needed = 12 - todayHours.length;
    const tomorrowHours = needed > 0 && data.forecast.forecastday[1]
      ? data.forecast.forecastday[1].hour
          .slice(0, needed)
          .map(h => ({ hour: new Date(h.time).getHours(), temp: Math.round(h.temp_c), code: h.condition.code }))
      : [];
    const forecastDays = data.forecast.forecastday.slice(1).map(ffd => {
      const d = new Date(ffd.date + 'T00:00:00');
      return {
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        hi:  Math.round(ffd.day.maxtemp_c),
        lo:  Math.round(ffd.day.mintemp_c),
        code: ffd.day.condition.code,
      };
    });
    return {
      temp:     Math.round(data.current.temp_c),
      condText: data.current.condition.text,
      code:     data.current.condition.code,
      hi:       Math.round(fd.day.maxtemp_c),
      lo:       Math.round(fd.day.mintemp_c),
      hours:    [...todayHours, ...tomorrowHours],
      forecastDays,
      curHour,
    };
  }

  async _loadWeather() {
    const CACHE_KEY = 'weather_cache';
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached?.data) this._weather = this._parseWeatherData(cached.data);
    } catch {}

    const fetchFresh = async () => {
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_KEY}&q=51.7741,5.5850&days=3&aqi=no&alerts=no`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        this._weather = this._parseWeatherData(data);
        this._weatherErr = null;
        this._loadNarrative(this._weather.condText, this._weather.temp, this._weather.hi, this._weather.lo);
      } catch (e) {
        if (!this._weather) this._weatherErr = e.message;
      }
    };

    await fetchFresh();
    this._weatherTimer = setInterval(fetchFresh, 60 * 60 * 1000);
  }

  async _loadNarrative(condText, temp, hi, lo) {
    const CACHE_KEY = 'weather-narrative-cache';
    const TTL = 60 * 60 * 1000;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.ts < TTL) { this._narrative = cached.text; return; }
    } catch {}
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          max_tokens: 40,
          messages: [{ role: 'user', content: `Weather in Herpen, Netherlands: ${condText}, ${temp}°C, high ${hi}°C, low ${lo}°C. Write ONE practical sentence of weather advice. Maximum 55 characters. No preamble, no quotes.` }],
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content?.trim() ?? null;
      if (text) {
        this._narrative = text;
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), text }));
      }
    } catch {}
  }

  // ── Trash ──────────────────────────────────────────────────────────────────
  async _loadTrash() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/trash_collection?date=gte.${today}&order=date.asc&limit=5`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._trash = await res.json();
    } catch {}
  }

  // ── Todos ──────────────────────────────────────────────────────────────────
  async _loadTodos() {
    const { data } = await supabase.from('todos').select('person,done');
    this._allTodos = data ?? [];
  }

  _subscribeTodos() {
    this._todosChannel = supabase
      .channel('today-todos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => this._loadTodos())
      .subscribe();
  }

  // ── Quote ──────────────────────────────────────────────────────────────────
  async _loadQuote() {
    if (!API_NINJAS_KEY) return;
    try {
      const res = await fetch('https://api.api-ninjas.com/v2/quoteoftheday', {
        headers: { 'X-Api-Key': API_NINJAS_KEY },
      });
      if (!res.ok) return;
      const json = await res.json();
      const item = Array.isArray(json) ? json[0] : json;
      if (!item?.quote) return;
      this._quote = { quote: item.quote, source: item.author ?? item.source ?? '' };
    } catch {}
  }

  // ── Calendar ───────────────────────────────────────────────────────────────
  _getWeekDays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i + this._weekOffset * 7);
      return d;
    });
  }

  async _loadEvents() {
    try {
      const days = this._getWeekDays();
      const weekStart = days[0];
      const now = new Date();
      const start = weekStart > now ? weekStart : now;
      const end = new Date(days[6]);
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);

      const all = [];
      for (const cal of CALENDARS) {
        const evs = await fetchCalendarEvents(cal.id, start, end);
        evs.forEach(e => all.push({ ...e, _calColor: cal.color, _calName: cal.name }));
      }
      all.sort((a, b) => {
        const ta = a.start?.dateTime ?? a.start?.date ?? '';
        const tb = b.start?.dateTime ?? b.start?.date ?? '';
        return ta.localeCompare(tb);
      });
      this._events = all;
      this._authed = true;
      try {
        localStorage.setItem('calendar_events_cache', JSON.stringify({ ts: Date.now(), events: all.slice(0, 30) }));
      } catch {}
    } catch (e) {
      this._eventsErr = e.message;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  _renderClock() {
    const { display, date } = this._time;
    const moon = moonPhaseEmoji();
    return html`
      <div class="card clock-card">
        <div class="card-label">Now</div>
        <div class="clock-row">
          <div>
            <div class="clock-time">${display}</div>
            <div class="clock-date">${date}</div>
          </div>
          <div class="clock-moon">${moon}</div>
        </div>
        ${this._quote ? html`
          <div class="clock-quote">
            "${this._quote.quote}"<br>
            <span class="clock-quote-source">— ${this._quote.source}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderWeather() {
    if (!this._weather && this._weatherErr) return html`
      <div class="card weather-card">
        <div class="card-label">Weather · Koolwijk</div>
        <div class="muted">Unavailable</div>
      </div>
    `;
    if (!this._weather) return html`
      <div class="card weather-card">
        <div class="card-label">Weather · Koolwijk</div>
        <div class="muted">Loading…</div>
      </div>
    `;
    const { temp, condText, code, hi, lo, hours, forecastDays, curHour } = this._weather;
    const narrative = this._narrative ?? weatherNarrative(condText, temp, hi, lo);
    return html`
      <div class="card weather-card">
        <div class="card-label">Weather · Koolwijk</div>
        <div class="weather-body">
          <div class="weather-current">
            <div class="weather-top">
              <div class="weather-icon">${wapiEmoji(code)}</div>
              <div class="weather-temp">${temp}°</div>
              <div class="weather-right">
                <div class="weather-cond">${condText}</div>
                <div class="weather-hl">H ${hi}° · L ${lo}°</div>
              </div>
            </div>
            <div class="weather-narrative">${narrative}</div>
            <div class="hourly-row">
              ${hours.slice(0, 12).map(h => html`
                <div class="hour-item">
                  <div class="hour-label">${h.hour === curHour ? 'Now' : String(h.hour)}</div>
                  <div class="hour-icon">${wapiEmoji(h.code)}</div>
                  <div class="hour-temp">${h.temp}°</div>
                </div>
              `)}
            </div>
          </div>
          ${forecastDays?.length ? html`
            <div class="weather-forecast">
              ${forecastDays.map(d => html`
                <div class="forecast-row">
                  <div class="forecast-day">${d.dayName}</div>
                  <div class="forecast-icon">${wapiEmoji(d.code)}</div>
                  <div class="forecast-hi">${d.hi}°</div>
                  <div class="forecast-lo">/ ${d.lo}°</div>
                </div>
              `)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderCalendar() {
    const days = this._getWeekDays();
    const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

    const eventsForDay = (day) => {
      const dateStr = day.toISOString().slice(0, 10);
      return this._events.filter(ev => {
        const evDate = ev.start?.dateTime?.slice(0, 10) ?? ev.start?.date;
        return evDate === dateStr;
      });
    };

    const firstDay = days[0];
    const lastDay  = days[6];
    const sameMonth = firstDay.getMonth() === lastDay.getMonth();
    const monthStr = sameMonth
      ? firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : `${firstDay.toLocaleDateString('en-GB', { month: 'short' })} – ${lastDay.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    const weekStart = getISOWeek(firstDay);
    const weekEnd   = getISOWeek(lastDay);
    const weekNum   = weekStart === weekEnd ? String(weekStart) : `${weekStart} – ${weekEnd}`;

    return html`
      <div class="card cal-card">
        <div class="cal-header">
          <button class="cal-nav" @click=${() => { this._weekOffset -= 1; this._loadEvents(); }}>‹</button>
          <button class="cal-nav" @click=${() => { this._weekOffset += 1; this._loadEvents(); }}>›</button>
          <div class="cal-title">${monthStr}</div>
          <div class="cal-week-badge">WEEK ${weekNum}</div>
        </div>
        <div class="cal-grid">
          ${days.map(day => {
            const isToday = day.getTime() === todayMs;
            const dayEvents = eventsForDay(day);
            const dayName = day.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayNum  = day.getDate();
            return html`
              <div class="cal-day-col ${isToday ? 'today' : ''}">
                <div class="cal-day-header">
                  <div class="cal-day-name">${dayName}</div>
                  <div class="cal-day-num">${dayNum}</div>
                  ${dayEvents.length ? html`<div class="cal-ev-badge">${dayEvents.length} ev</div>` : ''}
                </div>
                <div class="cal-day-body">
                  ${dayEvents.length
                    ? dayEvents.map(ev => html`
                        <div class="cal-event-chip" style="border-left-color:${ev._calColor ?? 'var(--color-accent)'}">
                          <div class="cal-ev-time">${evTime(ev)}</div>
                          <div class="cal-ev-title">${ev.summary ?? '(no title)'}</div>
                        </div>
                      `)
                    : html`<div class="cal-day-free"><div class="cal-free-label">Free</div></div>`
                  }
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  _renderBaby() {
    const DUE = new Date('2027-03-19T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((DUE - today) / 86400000);
    const daysPregnant = 280 - daysLeft;
    const weeks = Math.floor(daysPregnant / 7);
    const dayOfWeek = daysPregnant % 7;
    const pct = Math.min(100, Math.round(daysPregnant / 280 * 100));
    return html`
      <div class="card compact">
        <div class="card-label">Baby</div>
        <div class="baby-row">
          <div class="baby-emoji">🫄</div>
          <div class="baby-info">
            <div class="baby-week">Week ${weeks}</div>
            <div class="baby-sub">Day ${dayOfWeek} · ${daysLeft} days to go</div>
            <div class="baby-due">Due Thu 19 Mar 2027</div>
          </div>
        </div>
        <div class="baby-bar"><div class="baby-bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  _renderTrash() {
    // Today's pickup only shown until noon; skip past dates
    const pastNoon = new Date().getHours() >= 12;
    const items = this._trash.filter(t => {
      const d = daysUntil(t.date);
      return d > 0 || (d === 0 && !pastNoon);
    });
    if (!items.length) return html`
      <div class="card compact">
        <div class="card-label">Trash</div>
        <div class="muted">No upcoming pickups</div>
      </div>
    `;
    const metaOf = type => WASTE_META[type] ?? { label: type, icon: '?', chipBg: '#eee', chipColor: '#444', chipBorder: '#ccc' };
    const fmt = (d, opts) => new Date(d).toLocaleDateString('en-GB', opts);
    const [next, ...rest] = items;
    const meta = metaOf(next.waste_type);
    const days = daysUntil(next.date);
    const badge = days === 0 ? 'Today' : days === 1 ? 'Out tonight' : `in ${days}d`;
    const open = (r) => { this._trashTooltip = { waste_type: r.waste_type, date: r.date }; };

    const tt = this._trashTooltip;
    const ttDays = tt ? daysUntil(tt.date) : 0;
    const ttLabel = ttDays === 0 ? 'Today' : ttDays === 1 ? 'Out tonight' : `in ${ttDays} days`;

    return html`
      <div class="card compact trash-card">
        <div class="card-label">Trash</div>
        <div class="trash-top trash-tap" @click=${() => open(next)}>
          <div class="trash-title">${meta.label}</div>
          <div class="trash-badge">${badge}</div>
        </div>
        <div class="trash-date">${fmt(next.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        <div class="trash-chips">
          ${rest.slice(0, 3).map(r => {
            const m = metaOf(r.waste_type);
            return html`
              <div class="trash-chip" style="background:${m.chipBg};color:${m.chipColor};border-color:${m.chipBorder}"
                   @click=${() => open(r)}>
                ${m.icon} ${m.label}
              </div>
            `;
          })}
        </div>
        ${tt ? html`
          <div class="trash-tooltip-overlay" @click=${() => { this._trashTooltip = null; }}>
            <div class="trash-tooltip">
              <div class="trash-tooltip-icon">${metaOf(tt.waste_type).icon}</div>
              <div class="trash-tooltip-label">${metaOf(tt.waste_type).label}</div>
              <div class="trash-tooltip-days">${ttLabel}</div>
              <div class="trash-tooltip-date">${fmt(tt.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderUpcoming() {
    const upcoming = this._events
      .filter(ev => ev.start?.dateTime)
      .slice(0, 4);

    if (!upcoming.length) return html`
      <div class="card upcoming-card">
        <div class="card-label">Upcoming</div>
        <div class="muted">No upcoming events</div>
      </div>
    `;
    return html`
      <div class="card upcoming-card">
        <div class="card-label">Upcoming</div>
        <div class="upcoming-list">
          ${upcoming.map(ev => {
            const d = new Date(ev.start.dateTime);
            const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            return html`
              <div class="upcoming-row">
                <div class="upcoming-dot" style="background:${ev._calColor ?? '#6b7280'}"></div>
                <div class="upcoming-info">
                  <div class="upcoming-name">${ev.summary ?? '(no title)'}</div>
                  <div class="upcoming-time">${timeStr}</div>
                </div>
                <div class="upcoming-when">${dateStr}</div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  _renderTodoRings() {
    return html`
      <div class="card">
        <div class="card-label">To Do</div>
        <div class="chores-row">
          ${TODO_PEOPLE.map(p => {
            const color = localStorage.getItem(p.lsKey) || this._todoColors[p.key] || p.defaultColor;
            const all   = this._allTodos.filter(t => t.person === p.key);
            const total = all.length;
            const done  = all.filter(t => t.done).length;
            const pct   = total > 0 ? Math.round(done / total * 100) : 0;
            return html`
              <div class="chore-person">
                <div class="chore-ring" style="--clr:${color};--pct:${pct}%">
                  <div class="chore-inner">${done}/${total}</div>
                </div>
                <div class="chore-name">${p.name}</div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="col-main">
        <div class="top-row">
          ${this._renderClock()}
          ${this._renderWeather()}
        </div>
        ${this._renderCalendar()}
      </div>
      <div class="col-right">
        ${this._renderBaby()}
        ${this._renderTrash()}
        ${this._renderUpcoming()}
        ${this._renderTodoRings()}
      </div>
    `;
  }
}

customElements.define('home-today', HomeToday);
