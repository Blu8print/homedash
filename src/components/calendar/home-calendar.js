import { LitElement, html, css } from 'lit';
import { loadGoogleAuth, requestToken, isAuthenticated, fetchCalendarEvents, fetchCalendarList, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../../lib/google-calendar.js';
import { GOOGLE_CLIENT_ID, CALENDARS } from '../../config/calendars.js';

// ─── Google Calendar event color palette ──────────────────────────────────────
const GC_COLORS = {
  '1': '#7986CB', '2': '#33B679', '3':  '#8E24AA', '4':  '#E67C73',
  '5': '#F6C026', '6': '#F5511D', '7':  '#039BE5', '8':  '#3F51B5',
  '9': '#0F9D58', '10': '#D50000', '11': '#F4511E',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_H = 60; // px per hour in time grid

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(d) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function isToday(date) { return sameDay(date, new Date()); }
function isAllDay(ev)  { return !ev.start?.dateTime; }
function evStart(ev)   { return ev.start?.dateTime ? new Date(ev.start.dateTime) : null; }
function evEnd(ev)     { return ev.end?.dateTime   ? new Date(ev.end.dateTime)   : null; }

function evOnDay(ev, date) {
  if (isAllDay(ev)) {
    const s = new Date(ev.start.date + 'T00:00:00');
    const e = new Date(ev.end.date + 'T00:00:00'); // exclusive
    return date >= s && date < e;
  }
  const s = evStart(ev);
  const e = evEnd(ev);
  if (!s || !e) return false;
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  return s <= dayEnd && e > dayStart;
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatHourLabel(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// ─── Component ────────────────────────────────────────────────────────────────
export class HomeCalendar extends LitElement {
  static properties = {
    _view:        { state: true },
    _startDate:   { state: true },
    _events:      { state: true },
    _loading:     { state: true },
    _authed:      { state: true },
    _error:       { state: true },
    _calColors:   { state: true },
    _detail:      { state: true },
    _detailMenu:  { state: true },
    _modal:       { state: true },
    _modalSaving: { state: true },
    _modalError:  { state: true },
  };

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      font-family: var(--font-sans);
      background: #F4F2EB;
    }

    /* ── Toolbar ── */
    .toolbar {
      height: 72px;
      padding: 0 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.75);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #E9E6DC;
      flex-shrink: 0;
      z-index: 20;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .nav-pair {
      display: flex;
      background: #fff;
      border: 1px solid #E9E6DC;
      border-radius: 12px;
      padding: 4px;
      gap: 2px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .nav-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #57534E;
      transition: background 0.15s, color 0.15s;
    }
    .nav-btn:hover { background: #F4F2EB; color: #191817; }
    .nav-btn svg { width: 16px; height: 16px; }
    .today-btn {
      padding: 7px 16px;
      border: 2px solid #191817;
      border-radius: 999px;
      background: none;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #191817;
      font-family: var(--font-sans);
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .today-btn:hover { background: #191817; color: #F4F2EB; }

    .range-label {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 26px;
      font-weight: 400;
      color: #191817;
      letter-spacing: -0.01em;
      line-height: 1;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .range-label em {
      font-style: italic;
      color: #78756F;
    }
    .range-label .range-sub {
      font-family: var(--font-sans);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #78756F;
      font-style: normal;
      align-self: center;
    }
    .week-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      background: #191817;
      color: #F4F2EB;
      padding: 3px 10px;
      border-radius: 999px;
      font-family: var(--font-sans);
      align-self: center;
    }

    .view-tabs {
      display: flex;
      gap: 3px;
      background: rgba(233,230,220,0.8);
      padding: 4px;
      border-radius: 12px;
      border: 1px solid rgba(219,214,199,0.7);
    }
    .view-tab {
      padding: 6px 16px;
      border: none;
      background: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #78756F;
      font-family: var(--font-sans);
      transition: all 0.15s;
    }
    .view-tab:not(.active):hover { color: #191817; }
    .view-tab.active {
      background: #191817;
      color: #F4F2EB;
      box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    }

    /* ── Loading bar ── */
    .loading-bar {
      height: 2px;
      flex-shrink: 0;
      background: linear-gradient(90deg, transparent, #F59E0B, transparent);
      background-size: 200% 100%;
      animation: slide 1.2s infinite;
    }
    @keyframes slide { from { background-position: 200% 0; } to { background-position: -200% 0; } }

    /* ── Week grid (week view only) ── */
    .week-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      overflow-y: auto;
      align-items: start;
      background: #F7F5F0;
    }

    /* ── Day column (week view) ── */
    .day-col {
      display: flex;
      flex-direction: column;
      border-right: 1px solid #E9E6DC;
      min-width: 0;
      min-height: 100%;
      background: rgba(255,255,255,0.4);
      transition: background 0.18s;
    }
    .day-col:hover { background: rgba(255,255,255,0.8); }
    .day-col:last-child { border-right: none; }

    .day-col.weekend { background: rgba(254,243,199,0.15); }
    .day-col.weekend:hover { background: rgba(254,243,199,0.38); }
    .day-col.today { background: rgba(255,255,255,0.4); }
    .day-col.today:hover { background: rgba(255,255,255,0.8); }

    .day-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 14px;
      border-bottom: 1px solid #E9E6DC;
      background: rgba(255,255,255,0.6);
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .day-col.today .day-header { background: rgba(255,255,255,0.6); border-bottom-color: #E9E6DC; }
    .day-col.weekend .day-header { background: rgba(251,191,36,0.08); }

    .day-header-left { display: flex; align-items: center; gap: 10px; }
    .day-num-badge {
      width: 40px; height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 700;
      font-family: var(--font-sans);
      background: #F0EDE6;
      border: 1px solid #E9E6DC;
      color: #191817;
      flex-shrink: 0;
      line-height: 1;
    }
    .day-col.weekend .day-num-badge { background: #fff; border-color: rgba(251,191,36,0.45); color: #92400E; }
    .day-col.today .day-num-badge { background: #FBBF24; border-color: #FBBF24; color: #1C1917; box-shadow: 0 2px 8px rgba(251,191,36,0.45); }

    .day-header-meta { display: flex; flex-direction: column; gap: 2px; }
    .day-name { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #3C3A37; line-height: 1.2; }
    .day-col.today .day-name { color: #3C3A37; }
    .day-col.weekend .day-name { color: #92400E; }

    .day-month { font-size: 9.5px; font-weight: 500; color: #78756F; letter-spacing: 0.02em; line-height: 1.2; display: flex; align-items: center; gap: 5px; }
    .day-col.today .day-month { color: #78756F; }

    .new-month-tag {
      font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
      background: rgba(251,191,36,0.18); color: #B45309;
      padding: 1px 5px; border-radius: 999px; font-family: var(--font-sans);
    }

    .day-count-badge {
      font-size: 10px; font-weight: 700; font-family: var(--font-sans);
      color: #78756F; background: rgba(233,230,220,0.6);
      padding: 2px 8px; border-radius: 6px; flex-shrink: 0;
    }
    .day-count-badge.free { background: none; font-weight: 500; font-size: 9.5px; }
    .day-col.weekend .day-count-badge { background: rgba(251,191,36,0.12); color: #92400E; }

    .day-events { padding: 10px; display: flex; flex-direction: column; gap: 7px; }

    .ev-allday {
      border-radius: 8px; padding: 5px 10px;
      font-size: 12px; font-weight: 700; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      cursor: pointer; line-height: 1.3; transition: opacity 0.15s;
    }
    .ev-allday:hover { opacity: 0.85; }

    .ev-timed {
      background: #fff; border: 1px solid rgba(229,226,218,0.9);
      border-left: 4px solid var(--ev-color); border-radius: 14px;
      padding: 11px 12px 10px; cursor: pointer;
      transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s cubic-bezier(0.16,1,0.3,1);
    }
    .ev-timed:hover { transform: translateY(-2px); box-shadow: 0 8px 20px -4px rgba(25,24,23,0.12), 0 2px 6px -2px rgba(25,24,23,0.05); }

    .ev-time-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10.5px; font-weight: 700; font-family: var(--font-sans);
      color: color-mix(in srgb, var(--ev-color) 80%, #191817);
      background: color-mix(in srgb, var(--ev-color) 12%, white);
      border: 1px solid color-mix(in srgb, var(--ev-color) 22%, #E9E6DC);
      padding: 2px 7px 2px 5px; border-radius: 6px; margin-bottom: 6px; line-height: 1;
    }
    .ev-time-badge svg { width: 10px; height: 10px; opacity: 0.7; flex-shrink: 0; }

    .ev-title {
      font-size: 13px; font-weight: 700; color: #191817;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      display: block; line-height: 1.3; letter-spacing: -0.01em;
    }

    .day-empty-wrap { padding: 10px; padding-top: 18px; }
    .day-empty {
      text-align: center; padding: 22px 12px;
      border: 1px dashed #D6D0C4; border-radius: 16px;
      background: rgba(255,255,255,0.4);
    }
    .day-empty-icon {
      width: 28px; height: 28px; border-radius: 50%;
      background: #F0EDE6; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 8px; color: #78756F;
    }
    .day-empty-icon svg { width: 14px; height: 14px; }
    .day-empty-title { font-size: 11.5px; font-weight: 700; color: #3C3A37; display: block; }
    .day-empty-sub { font-size: 10.5px; color: #78756F; display: block; margin-top: 2px; }
    .day-empty-btn {
      margin-top: 10px; font-size: 10.5px; font-weight: 700; color: #191817;
      background: #fff; border: 1px solid #E9E6DC; padding: 4px 12px;
      border-radius: 8px; cursor: pointer; font-family: var(--font-sans);
      transition: background 0.15s; display: inline-block; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .day-empty-btn:hover { background: #F4F2EB; }

    /* ── States ── */
    .center-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 14px; padding: 2rem; text-align: center;
    }
    .center-state p { color: var(--color-text-muted); font-size: 14px; max-width: 380px; }
    .center-state code { font-size: 12px; background: var(--color-card-alt); padding: 2px 6px; border-radius: 4px; }
    .connect-btn {
      padding: 11px 22px; background: #1a1a1a; color: #fff;
      border: none; border-radius: 10px; cursor: pointer;
      font-size: 14px; font-weight: 600; font-family: var(--font-sans);
      transition: background 0.15s;
    }
    .connect-btn:hover { background: #333; }

    /* ── Detail modal ── */
    .detail-header { display: flex; align-items: center; gap: 4px; padding: 12px 12px 0; justify-content: flex-end; }
    .detail-icon-btn {
      width: 36px; height: 36px; border: none; background: none; border-radius: 50%;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 17px; color: #555; position: relative;
    }
    .detail-icon-btn:hover { background: #f3f3f3; }
    .detail-title-row { display: flex; align-items: center; gap: 14px; padding: 6px 20px 14px; border-bottom: 1px solid #f3f3f3; }
    .detail-color-square { width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0; }
    .detail-title { font-family: var(--font-serif); font-size: 20px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
    .detail-body { padding: 4px 20px 16px; }
    .detail-row { display: flex; align-items: flex-start; gap: 14px; padding: 10px 0; border-bottom: 1px solid #f8f8f8; font-size: 14px; color: #333; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row-icon { width: 20px; flex-shrink: 0; padding-top: 2px; color: #78756F; display: flex; align-items: flex-start; justify-content: center; }
    .detail-row-icon svg { width: 16px; height: 16px; flex-shrink: 0; }
    .detail-row-text { flex: 1; line-height: 1.45; }

    .dot-menu {
      position: absolute; top: 40px; right: 0;
      background: #fff; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.18);
      overflow: hidden; z-index: 10; min-width: 140px;
    }
    .dot-menu-item {
      display: block; width: 100%; padding: 11px 18px; border: none;
      background: none; text-align: left; font-size: 14px;
      font-family: var(--font-sans); cursor: pointer; color: #1a1a1a;
    }
    .dot-menu-item:hover { background: #f5f5f5; }
    .dot-menu-item.danger { color: #ef4444; }

    /* ── FAB ── */
    .fab {
      position: fixed; bottom: 28px; right: 28px;
      width: 56px; height: 56px; border-radius: 16px;
      background: #11100F; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px -4px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2);
      z-index: 100;
      transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1), background 0.15s;
      outline: 1px solid rgba(255,255,255,0.07);
    }
    .fab:hover { background: #000; transform: scale(1.06); box-shadow: 0 12px 32px -4px rgba(0,0,0,0.55); }
    .fab svg { width: 24px; height: 24px; stroke: #FBBF24; transition: transform 0.2s; }
    .fab:hover svg { transform: rotate(90deg); }

    /* ── Modal overlay ── */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal {
      background: #fff; border-radius: 16px; width: 100%; max-width: 500px;
      max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3); animation: modal-in 0.18s ease;
    }
    @keyframes modal-in { from { transform: scale(0.95); opacity: 0; } to { transform: none; opacity: 1; } }

    .modal-header { padding: 20px 20px 0; }
    .modal-title-input {
      border: none; outline: none; font-size: 22px;
      font-family: var(--font-serif); font-weight: 700; color: #1a1a1a;
      width: 100%; padding: 0 0 14px; background: transparent;
      border-bottom: 2px solid #1a1a1a;
    }
    .modal-title-input::placeholder { color: #ccc; }

    .modal-body { padding: 8px 20px; display: flex; flex-direction: column; }
    .modal-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid #f3f3f3; }
    .modal-row:last-child { border-bottom: none; }
    .modal-icon { width: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #78756F; }
    .modal-icon svg { width: 16px; height: 16px; }
    .modal-row input[type="date"],
    .modal-row input[type="time"],
    .modal-row select,
    .modal-row input[type="text"] { border: none; outline: none; font-size: 14px; font-family: var(--font-sans); color: #1a1a1a; background: transparent; cursor: pointer; flex: 1; }
    .modal-row input[type="text"]::placeholder { color: #bbb; }
    .modal-row .time-range { display: flex; align-items: center; gap: 8px; flex: 1; }
    .modal-row .time-sep { color: #ccc; font-size: 13px; }

    .modal-desc { border: none; outline: none; font-size: 14px; font-family: var(--font-sans); color: #1a1a1a; background: transparent; resize: none; flex: 1; min-height: 56px; padding: 0; }
    .modal-desc::placeholder { color: #bbb; }

    .allday-row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid #f3f3f3; }
    .toggle-track { width: 38px; height: 20px; border-radius: 10px; background: #ddd; position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0; border: none; padding: 0; }
    .toggle-track.on { background: #1a1a1a; }
    .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left 0.2s; pointer-events: none; }
    .toggle-track.on .toggle-thumb { left: 20px; }
    .allday-label { font-size: 14px; color: #1a1a1a; }

    .color-swatches { display: flex; gap: 7px; flex-wrap: wrap; flex: 1; }
    .color-swatch { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 0.1s; }
    .color-swatch:hover { transform: scale(1.15); }
    .color-swatch.selected { border-color: #1a1a1a; }

    .modal-error { color: #ef4444; font-size: 12px; padding: 6px 20px 0; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 16px 20px 20px; border-top: 1px solid #f3f3f3; }
    .btn-cancel { padding: 9px 18px; border: 1px solid #e0e0e0; border-radius: 8px; background: none; font-size: 13px; font-weight: 600; cursor: pointer; color: #555; font-family: var(--font-sans); }
    .btn-cancel:hover { background: #f5f5f5; }
    .btn-save { padding: 9px 22px; border: none; border-radius: 8px; background: #1a1a1a; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: var(--font-sans); }
    .btn-save:hover { background: #333; }
    .btn-save:disabled { opacity: 0.45; cursor: default; }

    /* ── Time grid (today + 3-day views) ── */
    .tg-outer {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #F7F5F0;
    }
    .tg-header-row {
      display: flex;
      flex-shrink: 0;
      border-bottom: 1px solid #E9E6DC;
      background: rgba(255,255,255,0.75);
      backdrop-filter: blur(12px);
    }
    .tg-gutter-head { width: 56px; flex-shrink: 0; }
    .tg-col-head {
      flex: 1;
      border-left: 1px solid #E9E6DC;
      padding: 10px 14px 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tg-col-head.tg-today { background: #1a1a1a; }
    .tg-day-num {
      width: 36px; height: 36px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700;
      background: #F0EDE6; border: 1px solid #E9E6DC; color: #191817;
      flex-shrink: 0; font-family: var(--font-sans);
    }
    .tg-today .tg-day-num {
      background: #FBBF24; border-color: #FBBF24; color: #1C1917;
      box-shadow: 0 2px 8px rgba(251,191,36,0.45);
    }
    .tg-col-meta { display: flex; flex-direction: column; gap: 2px; }
    .tg-col-name {
      font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: #3C3A37; line-height: 1.2;
    }
    .tg-today .tg-col-name { color: #fff; }
    .tg-col-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #78756F; line-height: 1.2;
    }
    .tg-today .tg-col-label { color: rgba(255,255,255,0.55); }

    /* All-day strip */
    .tg-allday-row {
      display: flex;
      flex-shrink: 0;
      border-bottom: 2px solid #E9E6DC;
      min-height: 28px;
      background: #F0EDE6;
    }
    .tg-allday-label {
      width: 56px; flex-shrink: 0;
      display: flex; align-items: flex-start; justify-content: flex-end;
      padding: 5px 8px 4px 0;
      font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
      color: #78756F; text-transform: uppercase;
    }
    .tg-allday-col {
      flex: 1;
      border-left: 1px solid #E9E6DC;
      padding: 4px 5px;
      display: flex; flex-direction: column; gap: 2px;
    }
    .tg-allday-ev {
      border-radius: 5px; padding: 3px 8px;
      font-size: 11px; font-weight: 700; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      cursor: pointer; line-height: 1.4; transition: opacity 0.15s;
    }
    .tg-allday-ev:hover { opacity: 0.85; }

    /* Scrollable body */
    .tg-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      background: #F7F5F0;
    }
    .tg-body {
      display: flex;
      height: 1440px; /* 24h × 60px */
      position: relative;
    }
    .tg-time-gutter {
      width: 56px;
      flex-shrink: 0;
      position: relative;
      background: #F7F5F0;
    }
    .tg-hour-label {
      position: absolute;
      right: 8px;
      font-size: 10px;
      font-weight: 600;
      color: #78756F;
      line-height: 1;
      transform: translateY(-50%);
      white-space: nowrap;
      font-family: var(--font-sans);
    }
    .tg-cols {
      flex: 1;
      display: flex;
      position: relative;
    }
    .tg-day {
      flex: 1;
      border-left: 1px solid #E9E6DC;
      position: relative;
      min-width: 0;
      background: rgba(255,255,255,0.5);
    }
    .tg-hour-line {
      position: absolute;
      left: 0; right: 0;
      height: 1px;
      background: #E9E6DC;
      pointer-events: none;
    }
    .tg-half-line {
      position: absolute;
      left: 0; right: 0;
      height: 1px;
      background: rgba(233,230,220,0.5);
      pointer-events: none;
    }
    .tg-event {
      position: absolute;
      left: 4px; right: 4px;
      border-radius: 8px;
      padding: 5px 8px 4px;
      cursor: pointer;
      overflow: hidden;
      transition: opacity 0.15s, box-shadow 0.15s;
      z-index: 2;
      min-height: 20px;
    }
    .tg-event:hover { opacity: 0.9; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
    .tg-event-title {
      font-size: 12px; font-weight: 700; color: #fff;
      line-height: 1.3; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      font-family: var(--font-sans);
    }
    .tg-event-time {
      font-size: 10px; color: rgba(255,255,255,0.85);
      line-height: 1.3; margin-top: 1px; font-family: var(--font-sans);
    }
    .tg-now-line {
      position: absolute;
      left: 0; right: 0;
      height: 2px;
      background: #ef4444;
      z-index: 5;
      pointer-events: none;
    }
    .tg-now-dot {
      position: absolute;
      left: -4px; top: -4px;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #ef4444;
    }

    /* ── Month view ── */
    .month-outer {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #F7F5F0;
    }
    .month-dow-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      border-bottom: 1px solid #E9E6DC;
      background: rgba(255,255,255,0.6);
      flex-shrink: 0;
    }
    .month-dow {
      padding: 10px 0 8px;
      text-align: center;
      font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: #78756F;
      font-family: var(--font-sans);
    }
    .month-grid {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-template-rows: repeat(6, 1fr);
    }
    .month-cell {
      border-right: 1px solid #E9E6DC;
      border-bottom: 1px solid #E9E6DC;
      padding: 8px 10px 6px;
      cursor: pointer;
      transition: background 0.15s;
      background: rgba(255,255,255,0.45);
      min-height: 80px;
    }
    .month-cell:nth-child(7n) { border-right: none; }
    .month-cell:hover { background: rgba(255,255,255,0.85); }
    .month-cell.other-month { background: rgba(255,255,255,0.15); }
    .month-cell.other-month:hover { background: rgba(255,255,255,0.45); }
    .month-cell.other-month .month-cell-num { color: #C8C4BB; }
    .month-cell-num {
      font-size: 14px; font-weight: 700; color: #191817;
      margin-bottom: 5px; font-family: var(--font-sans); line-height: 1;
      display: flex;
    }
    .month-cell.is-today .month-cell-num {
      width: 24px; height: 24px;
      background: #191817; color: #F4F2EB;
      border-radius: 6px;
      align-items: center; justify-content: center;
      font-size: 12px;
    }
    .month-dots {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
      align-items: center;
    }
    .month-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .month-dot-more {
      font-size: 9px; font-weight: 700; color: #78756F;
      line-height: 1; font-family: var(--font-sans);
    }
  `;

  constructor() {
    super();
    this._view        = 'week';
    this._startDate   = getMonday(new Date());
    this._events      = [];
    this._loading     = false;
    this._authed      = false;
    this._error       = null;
    this._calColors   = {};
    this._detail      = null;
    this._detailMenu  = false;
    this._modal       = null;
    this._modalSaving = false;
    this._modalError  = null;
    this._cacheStart  = null;
    this._cacheEnd    = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    this._authed = true;
    this._loadEvents();
    this._pollTimer = setInterval(() => this._loadEvents(), 5 * 60_000);
    this._syncHandler = () => this._loadEvents();
    window.addEventListener('calendar-sync', this._syncHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._pollTimer);
    window.removeEventListener('calendar-sync', this._syncHandler);
  }

  async _connect() {
    this._error = null;
    try {
      await requestToken();
      this._authed = true;
      await Promise.all([this._loadEvents(), this._fetchCalColors()]);
    } catch (e) { this._error = e.message ?? 'Authentication failed'; }
  }

  // ── Date range for loading events ────────────────────────────────────────
  get _gridStart() {
    if (this._view === 'month') return getMonday(this._startDate);
    return this._startDate;
  }

  get _gridEnd() {
    if (this._view === 'month') return addDays(this._gridStart, 43);
    return addDays(this._startDate, this._numDays + 1);
  }

  async _loadEvents() {
    this._loading = true;
    this._error   = null;
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    const start = new Date(Math.min(addDays(today, -7), this._gridStart));
    const end   = new Date(Math.max(addDays(today, 61), this._gridEnd));
    this._cacheStart = start;
    this._cacheEnd   = end;
    try {
      const results = await Promise.all(
        CALENDARS.map(cal =>
          fetchCalendarEvents(cal.id, start, end)
            .then(items => items.map(ev => ({
              ...ev,
              _color:   cal.color,
              _calName: cal.name,
              _calId:   cal.id,
            })))
            .catch(err => { console.warn('fetch error', cal.id, err); return []; })
        )
      );
      this._events = results.flat();
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
    }
  }

  async _fetchCalColors() {
    try {
      const list = await fetchCalendarList();
      const map  = Object.fromEntries(list.map(c => [c.id, c.backgroundColor]));
      const primary = list.find(c => c.primary);
      if (primary) map['primary'] = primary.backgroundColor;
      this._calColors = map;
    } catch (e) { console.warn('Could not fetch calendar colors', e); }
  }

  get _numDays() {
    if (this._view === 'today')  return 1;
    if (this._view === '3day')   return 3;
    if (this._view === 'month')  return 42;
    return 7;
  }

  get _days() {
    if (this._view === 'month') {
      return Array.from({ length: 42 }, (_, i) => addDays(this._gridStart, i));
    }
    return Array.from({ length: this._numDays }, (_, i) => addDays(this._startDate, i));
  }

  _needsFetch() {
    if (!this._cacheStart || !this._cacheEnd) return true;
    return this._gridStart < this._cacheStart || this._gridEnd > this._cacheEnd;
  }

  _navigate(dir) {
    if (this._view === 'month') {
      const d = new Date(this._startDate);
      d.setMonth(d.getMonth() + dir);
      d.setDate(1);
      this._startDate = d;
    } else {
      this._startDate = addDays(this._startDate, dir * this._numDays);
    }
    if (this._needsFetch()) this._loadEvents();
  }

  _onTouchStart(e) {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  _onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const dy = e.changedTouches[0].clientY - this._touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      this._navigate(dx < 0 ? 1 : -1);
    }
  }

  _goToday() {
    const now = new Date();
    if (this._view === 'month') {
      this._startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (this._view === 'week') {
      this._startDate = getMonday(now);
    } else if (this._view === '3day') {
      const t = new Date(now); t.setHours(0, 0, 0, 0);
      this._startDate = addDays(t, -1);
    } else {
      this._startDate = new Date(now.setHours(0, 0, 0, 0));
    }
    if (this._needsFetch()) this._loadEvents();
  }

  _setView(view) {
    this._view      = view;
    const now = new Date();
    if (view === 'month') {
      this._startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (view === 'week') {
      this._startDate = getMonday(now);
    } else if (view === '3day') {
      const t = new Date(now); t.setHours(0, 0, 0, 0);
      this._startDate = addDays(t, -1);
    } else {
      this._startDate = new Date(now.setHours(0, 0, 0, 0));
    }
    if (this._needsFetch()) this._loadEvents();
  }

  updated(changedProps) {
    if (changedProps.has('_view') && (this._view === 'today' || this._view === '3day')) {
      this._doScrollToNow();
    }
  }

  _doScrollToNow() {
    requestAnimationFrame(() => {
      const el = this.renderRoot?.querySelector('.tg-scroll');
      if (el) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        el.scrollTop = Math.max(0, nowMin - 120);
      }
    });
  }

  get _isViewingNow() {
    const now = new Date();
    if (this._view === 'month') {
      return this._startDate.getFullYear() === now.getFullYear()
          && this._startDate.getMonth()    === now.getMonth();
    }
    if (this._view === 'week') {
      return sameDay(this._startDate, getMonday(now));
    }
    // today / 3day: check if any day in the view is today
    return this._days.some(d => isToday(d));
  }

  _resolveColor(ev) {
    return GC_COLORS[ev.colorId]
      ?? this._calColors[ev._calId]
      ?? ev._color
      ?? '#3b82f6';
  }

  _openDetail(ev) { this._detail = ev; this._detailMenu = false; }
  _closeDetail() { this._detail = null; this._detailMenu = false; }

  _editFromDetail() {
    const ev = this._detail;
    this._closeDetail();
    this._openEditModal(ev);
  }

  async _deleteFromDetail() {
    const ev = this._detail;
    this._closeDetail();
    try {
      await deleteCalendarEvent(ev._calId, ev.id);
      await this._loadEvents();
    } catch (e) { this._error = e.message; }
  }

  _duplicateFromDetail() {
    const ev = this._detail;
    this._closeDetail();
    const allDay = !ev.start?.dateTime;
    let date = '', startTime = '09:00', endTime = '10:00', endDate = '';
    if (allDay) {
      date = ev.start.date;
      const excl = new Date(ev.end.date + 'T00:00:00');
      excl.setDate(excl.getDate() - 1);
      endDate = excl.toISOString().slice(0, 10);
    } else {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      date      = s.toISOString().slice(0, 10);
      endDate   = e.toISOString().slice(0, 10);
      startTime = `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`;
      endTime   = `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`;
    }
    const overrides = ev.reminders?.overrides ?? [];
    const alarm     = overrides.length ? String(overrides[0].minutes) : '30';
    const rrule     = (ev.recurrence ?? []).find(r => r.startsWith('RRULE:'));
    const repeat    = rrule ? rrule.replace('RRULE:FREQ=', '').toLowerCase() : 'none';
    this._modal = {
      title: ev.summary ?? '',
      date, startTime, endTime, endDate, allDay,
      location:    ev.location    ?? '',
      description: ev.description ?? '',
      colorId:     ev.colorId     ?? '',
      alarm, repeat,
      calId: ev._calId ?? CALENDARS[0].id,
    };
    this._modalError = null;
  }

  _openModal() {
    const now  = new Date();
    const date = now.toISOString().slice(0, 10);
    const hh   = String(now.getHours()).padStart(2, '0');
    const rawM = Math.ceil(now.getMinutes() / 15) * 15;
    const mm   = String(rawM % 60).padStart(2, '0');
    const endH = String((now.getHours() + (rawM >= 60 ? 2 : 1)) % 24).padStart(2, '0');
    this._modal = {
      title: '', date, endDate: date,
      startTime: `${hh}:${mm}`, endTime: `${endH}:${mm}`,
      allDay: false,
      calId: CALENDARS[0].id,
      repeat: 'none',
      location: '',
      alarm: '30',
      colorId: '',
      description: '',
    };
    this._modalError = null;
  }

  _openEditModal(ev) {
    const allDay = !ev.start?.dateTime;
    let date = '', startTime = '09:00', endTime = '10:00', endDate = '';
    if (allDay) {
      date = ev.start.date;
      const excl = new Date(ev.end.date + 'T00:00:00');
      excl.setDate(excl.getDate() - 1);
      endDate = excl.toISOString().slice(0, 10);
    } else {
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      date      = s.toISOString().slice(0, 10);
      endDate   = e.toISOString().slice(0, 10);
      startTime = `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`;
      endTime   = `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`;
    }
    const overrides = ev.reminders?.overrides ?? [];
    const alarm = overrides.length ? String(overrides[0].minutes) : '30';
    const rrule  = (ev.recurrence ?? []).find(r => r.startsWith('RRULE:'));
    const repeat = rrule ? rrule.replace('RRULE:FREQ=', '').toLowerCase() : 'none';
    this._modal = {
      title: ev.summary ?? '',
      date, startTime, endTime, endDate, allDay,
      location:    ev.location    ?? '',
      description: ev.description ?? '',
      colorId:     ev.colorId     ?? '',
      alarm, repeat,
      calId:   ev._calId ?? CALENDARS[0].id,
      eventId: ev.id,
    };
    this._modalError = null;
  }

  _closeModal() { this._modal = null; }

  _modalField(field, value) {
    this._modal = { ...this._modal, [field]: value };
  }

  async _saveEvent() {
    if (!this._modal.title.trim()) { this._modalError = 'Please add a title.'; return; }
    this._modalSaving = true;
    this._modalError  = null;
    try {
      const { title, date, startTime, endTime, endDate, allDay, calId, repeat, location, alarm, colorId, description } = this._modal;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const body = {
        summary: title,
        ...(description && { description }),
        ...(location    && { location }),
        ...(colorId     && { colorId }),
        allDay: allDay ? 'yes' : 'no',
        ...(repeat !== 'none' && { rrule: `FREQ=${repeat.toUpperCase()}` }),
      };
      if (allDay) {
        body.start = { date };
        const inclusiveEnd = endDate || date;
        body.end = { date: addDays(new Date(inclusiveEnd + 'T00:00:00'), 1).toISOString().slice(0, 10) };
      } else {
        const eDate = endDate || date;
        body.start = { dateTime: `${date}T${startTime}:00`,  timeZone: tz };
        body.end   = { dateTime: `${eDate}T${endTime}:00`,   timeZone: tz };
      }
      if (this._modal.eventId) {
        await updateCalendarEvent(calId, this._modal.eventId, body);
      } else {
        await createCalendarEvent(calId, body);
      }
      this._closeModal();
      await this._loadEvents();
    } catch (e) {
      this._modalError = e.message ?? 'Failed to save event.';
    } finally {
      this._modalSaving = false;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    let mainContent;
    if (this._view === 'month') {
      mainContent = this._renderMonthView();
    } else if (this._view === 'today' || this._view === '3day') {
      mainContent = this._renderTimeGrid();
    } else {
      mainContent = this._renderWeekGrid();
    }

    return html`
      ${this._renderToolbar()}
      ${this._loading ? html`<div class="loading-bar"></div>` : ''}
      ${mainContent}
      ${this._authed ? html`
        <button class="fab" @click=${this._openModal} title="New event" aria-label="Add new event">
          <svg fill="none" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      ` : ''}
      ${this._detail ? this._renderDetailModal() : ''}
      ${this._modal  ? this._renderModal()       : ''}
    `;
  }

  _renderDetailModal() {
    const ev    = this._detail;
    const color = this._resolveColor(ev);
    const allDay = !ev.start?.dateTime;
    const s = evStart(ev);
    const e = evEnd(ev);

    let timeStr = '';
    if (allDay) {
      timeStr = new Date(ev.start.date + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
    } else {
      const dateStr = s.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
      timeStr = `${dateStr} · ${formatTime(s)}${e ? ` – ${formatTime(e)}` : ''}`;
    }

    const calName = CALENDARS.find(c => c.id === ev._calId)?.name ?? ev._calName ?? '';
    const overrides = ev.reminders?.overrides ?? [];
    const alarmMin  = overrides.length ? overrides[0].minutes : null;
    const alarmStr  = alarmMin == null ? null
      : alarmMin >= 1440 ? `${alarmMin / 1440} day before`
      : alarmMin >= 60   ? `${alarmMin / 60} hour before`
      : `${alarmMin} minutes before`;

    return html`
      <div class="modal-overlay" @click=${e => e.target === e.currentTarget && this._closeDetail()}>
        <div class="modal">
          <div class="detail-header">
            <button class="detail-icon-btn" title="Edit" @click=${this._editFromDetail}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg>
            </button>
            <div style="position:relative">
              <button class="detail-icon-btn" title="More options"
                @click=${() => { this._detailMenu = !this._detailMenu; }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/></svg>
              </button>
              ${this._detailMenu ? html`
                <div class="dot-menu">
                  <button class="dot-menu-item danger" @click=${this._deleteFromDetail}>Delete</button>
                  <button class="dot-menu-item" @click=${this._duplicateFromDetail}>Duplicate</button>
                </div>
              ` : ''}
            </div>
            <button class="detail-icon-btn" title="Close" @click=${this._closeDetail}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="detail-title-row">
            <div class="detail-color-square" style="background:${color}"></div>
            <div class="detail-title">${ev.summary || '(No title)'}</div>
          </div>
          <div class="detail-body">
            <div class="detail-row">
              <span class="detail-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></svg></span>
              <span class="detail-row-text">${timeStr}</span>
            </div>
            ${ev.location ? html`
              <div class="detail-row">
                <span class="detail-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg></span>
                <span class="detail-row-text">${ev.location}</span>
              </div>
            ` : ''}
            ${alarmStr ? html`
              <div class="detail-row">
                <span class="detail-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg></span>
                <span class="detail-row-text">${alarmStr}</span>
              </div>
            ` : ''}
            ${ev.description ? html`
              <div class="detail-row">
                <span class="detail-row-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg></span>
                <span class="detail-row-text">${ev.description}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderModal() {
    const m = this._modal;
    const COLOR_SWATCHES = [
      { id: '1', hex: '#7986CB' }, { id: '2', hex: '#33B679' }, { id: '3', hex: '#8E24AA' },
      { id: '4', hex: '#E67C73' }, { id: '5', hex: '#F6C026' }, { id: '6', hex: '#F5511D' },
      { id: '7', hex: '#039BE5' }, { id: '8', hex: '#3F51B5' }, { id: '9', hex: '#0F9D58' },
      { id: '10', hex: '#D50000' }, { id: '11', hex: '#F4511E' },
    ];
    return html`
      <div class="modal-overlay" @click=${e => e.target === e.currentTarget && this._closeModal()}>
        <div class="modal">
          <div class="modal-header">
            <input
              class="modal-title-input"
              type="text"
              placeholder="Add title"
              .value=${m.title}
              @input=${e => this._modalField('title', e.target.value)}
              autofocus
            />
          </div>
          <div class="modal-body">
            <div class="modal-row">
              <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></svg></span>
              <div class="time-range">
                <input type="date" .value=${m.date}
                  @change=${e => {
                    this._modalField('date', e.target.value);
                    if (this._modal.endDate < e.target.value) this._modalField('endDate', e.target.value);
                  }} />
                <span class="time-sep">→</span>
                <input type="date" .value=${m.endDate} min=${m.date}
                  @change=${e => this._modalField('endDate', e.target.value)} />
              </div>
            </div>
            <div class="allday-row">
              <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg></span>
              <button class="toggle-track ${m.allDay ? 'on' : ''}" @click=${() => this._modalField('allDay', !m.allDay)}>
                <div class="toggle-thumb"></div>
              </button>
              <span class="allday-label">All day</span>
            </div>
            ${!m.allDay ? html`
              <div class="modal-row">
                <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg></span>
                <div class="time-range">
                  <input type="time" .value=${m.startTime} @change=${e => {
                    this._modalField('startTime', e.target.value);
                    if (this._modal.endTime <= e.target.value && this._modal.endDate === this._modal.date) {
                      const next = new Date(this._modal.date + 'T00:00:00');
                      next.setDate(next.getDate() + 1);
                      this._modalField('endDate', next.toISOString().slice(0, 10));
                    }
                  }} />
                  <span class="time-sep">→</span>
                  <input type="time" .value=${m.endTime} @change=${e => {
                    this._modalField('endTime', e.target.value);
                    if (e.target.value <= this._modal.startTime && this._modal.endDate === this._modal.date) {
                      const next = new Date(this._modal.date + 'T00:00:00');
                      next.setDate(next.getDate() + 1);
                      this._modalField('endDate', next.toISOString().slice(0, 10));
                    } else if (e.target.value > this._modal.startTime && this._modal.endDate !== this._modal.date) {
                      this._modalField('endDate', this._modal.date);
                    }
                  }} />
                </div>
              </div>
            ` : ''}
            <div class="modal-row">
              <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg></span>
              <select .value=${m.repeat} @change=${e => this._modalField('repeat', e.target.value)}>
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
                <option value="yearly">Every year</option>
              </select>
            </div>
            <div class="modal-row">
              <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg></span>
              <input type="text" placeholder="Add location"
                .value=${m.location}
                @input=${e => this._modalField('location', e.target.value)} />
            </div>
            <div class="modal-row">
              <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg></span>
              <select .value=${m.alarm} @change=${e => this._modalField('alarm', e.target.value)}>
                <option value="none">No notification</option>
                <option value="5">5 minutes before</option>
                <option value="10">10 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>
            <div class="modal-row">
              <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"/></svg></span>
              <div class="color-swatches">
                <button class="color-swatch ${m.colorId === '' ? 'selected' : ''}"
                  style="background:#aaa" title="Calendar default"
                  @click=${() => this._modalField('colorId', '')}></button>
                ${COLOR_SWATCHES.map(c => html`
                  <button class="color-swatch ${m.colorId === c.id ? 'selected' : ''}"
                    style="background:${c.hex}"
                    @click=${() => this._modalField('colorId', c.id)}></button>
                `)}
              </div>
            </div>
            ${CALENDARS.length > 1 ? html`
              <div class="modal-row">
                <span class="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg></span>
                <select .value=${m.calId} @change=${e => this._modalField('calId', e.target.value)}>
                  ${CALENDARS.map(c => html`<option value=${c.id}>${c.name}</option>`)}
                </select>
              </div>
            ` : ''}
            <div class="modal-row" style="align-items:flex-start">
              <span class="modal-icon" style="align-self:flex-start;padding-top:2px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg></span>
              <textarea class="modal-desc" placeholder="Add description"
                .value=${m.description}
                @input=${e => this._modalField('description', e.target.value)}></textarea>
            </div>
          </div>
          ${this._modalError ? html`<p class="modal-error">${this._modalError}</p>` : ''}
          <div class="modal-footer">
            <button class="btn-cancel" @click=${this._closeModal}>Cancel</button>
            <button class="btn-save" ?disabled=${this._modalSaving} @click=${this._saveEvent}>
              ${this._modalSaving ? 'Saving…' : m.eventId ? 'Update event' : 'Save event'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderToolbar() {
    const days  = this._days;
    const first = this._startDate;
    const weekNum = getWeekNumber(first);

    let mainLabel, subLabel;
    const showWeekBadge = this._view === 'week';

    if (this._view === 'today') {
      const weekday = first.toLocaleDateString('en-CA', { weekday: 'long' });
      const dayNum  = first.getDate();
      mainLabel = `${weekday} ${dayNum}`;
      const todayMid = new Date(); todayMid.setHours(0,0,0,0);
      const diff = Math.round((first.getTime() - todayMid.getTime()) / 86400000);
      const monthYear = first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      const rel = diff === 0 ? ' · Today' : diff === -1 ? ' · Yesterday' : diff === 1 ? ' · Tomorrow' : '';
      subLabel = monthYear + rel;
    } else if (this._view === '3day') {
      const last = addDays(first, 2);
      const d1 = `${DAY_NAMES[first.getDay()]} ${first.getDate()}`;
      const d2 = `${DAY_NAMES[last.getDay()]} ${last.getDate()}`;
      mainLabel = `${d1} – ${d2}`;
      subLabel  = last.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
    } else if (this._view === 'month') {
      mainLabel = first.toLocaleDateString('en-CA', { month: 'long' });
      subLabel  = String(first.getFullYear());
    } else {
      // week view
      const last = days[days.length - 1];
      const m1 = first.toLocaleDateString('en-CA', { month: 'long' });
      if (first.getMonth() === last.getMonth()) {
        mainLabel = m1;
      } else {
        const m2 = last.toLocaleDateString('en-CA', { month: 'short' });
        mainLabel = `${m1} – ${m2}`;
      }
      subLabel = String(last.getFullYear());
    }

    return html`
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="nav-pair">
            <button class="nav-btn" @click=${() => this._navigate(-1)} title="Previous">
              <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="nav-btn" @click=${() => this._navigate(1)} title="Next">
              <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <span class="range-label">
            ${mainLabel}
            <span class="range-sub">${subLabel}</span>
          </span>
          ${showWeekBadge ? html`<span class="week-badge">Week ${weekNum}</span>` : ''}
          ${!this._isViewingNow ? html`
            <button class="today-btn" @click=${this._goToday}>Today</button>
          ` : ''}
        </div>
        <div class="view-tabs">
          ${['today', '3day', 'week', 'month'].map(v => html`
            <button class="view-tab ${this._view === v ? 'active' : ''}" @click=${() => this._setView(v)}>
              ${{ today: 'Day', '3day': '3 Day', week: 'Week', month: 'Month' }[v]}
            </button>
          `)}
        </div>
      </div>
    `;
  }

  // ── Time grid (today + 3-day) ─────────────────────────────────────────────

  _renderTimeGrid() {
    const days = this._days;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const allDayEvs = days.map(d =>
      this._events.filter(ev => evOnDay(ev, d) && isAllDay(ev))
    );
    const timedEvs = days.map(d =>
      this._events.filter(ev => evOnDay(ev, d) && !isAllDay(ev))
    );
    const hasAnyAllDay = allDayEvs.some(evs => evs.length > 0);

    return html`
      <div class="tg-outer" @touchstart=${this._onTouchStart} @touchend=${this._onTouchEnd}>
        <!-- column headers -->
        <div class="tg-header-row">
          <div class="tg-gutter-head"></div>
          ${days.map(d => {
            const tod = isToday(d);
            const todayMid = new Date(); todayMid.setHours(0,0,0,0);
            const diff = Math.round((new Date(d).setHours(0,0,0,0) - todayMid.getTime()) / 86400000);
            const label = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-CA', { month: 'short' });
            return html`
              <div class="tg-col-head ${tod ? 'tg-today' : ''}">
                <div class="tg-day-num">${d.getDate()}</div>
                <div class="tg-col-meta">
                  <span class="tg-col-name">${DAY_NAMES[d.getDay()]}</span>
                  <span class="tg-col-label">${label}</span>
                </div>
              </div>
            `;
          })}
        </div>

        <!-- all-day events -->
        ${hasAnyAllDay ? html`
          <div class="tg-allday-row">
            <div class="tg-allday-label">All day</div>
            ${days.map((d, i) => html`
              <div class="tg-allday-col">
                ${allDayEvs[i].map(ev => {
                  const color = this._resolveColor(ev);
                  return html`
                    <div class="tg-allday-ev" style="background:${color}"
                         @click=${() => this._openDetail(ev)}>
                      ${ev.summary || '(No title)'}
                    </div>
                  `;
                })}
              </div>
            `)}
          </div>
        ` : ''}

        <!-- scrollable time grid -->
        <div class="tg-scroll">
          <div class="tg-body">
            <div class="tg-time-gutter">
              ${hours.map(h => h === 0 ? '' : html`
                <div class="tg-hour-label" style="top:${h * HOUR_H}px">${formatHourLabel(h)}</div>
              `)}
            </div>
            <div class="tg-cols">
              ${days.map((d, i) => {
                const tod = isToday(d);
                return html`
                  <div class="tg-day">
                    ${hours.map(h => html`
                      <div class="tg-hour-line" style="top:${h * HOUR_H}px"></div>
                      <div class="tg-half-line" style="top:${h * HOUR_H + 30}px"></div>
                    `)}
                    ${tod ? html`
                      <div class="tg-now-line" style="top:${nowMin}px">
                        <div class="tg-now-dot"></div>
                      </div>
                    ` : ''}
                    ${timedEvs[i].map(ev => this._renderTgEvent(ev, d))}
                  </div>
                `;
              })}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderTgEvent(ev, date) {
    const s = evStart(ev);
    const e = evEnd(ev);
    if (!s) return '';

    const color    = this._resolveColor(ev);
    const startMin = s.getHours() * 60 + s.getMinutes();
    let endMin;
    if (e) {
      if (sameDay(s, e)) {
        endMin = e.getHours() * 60 + e.getMinutes();
      } else {
        // event spans midnight — cap at end of day
        endMin = 24 * 60;
      }
    } else {
      endMin = startMin + 60;
    }
    if (endMin <= startMin) endMin = startMin + 30;

    const durationMin = Math.max(endMin - startMin, 20);
    const showTime    = durationMin >= 30;

    return html`
      <div class="tg-event"
           style="top:${startMin}px;height:${durationMin}px;background:${color}"
           @click=${() => this._openDetail(ev)}>
        <div class="tg-event-title">${ev.summary || '(No title)'}</div>
        ${showTime ? html`<div class="tg-event-time">${formatTime(s)}${e ? ` – ${formatTime(e)}` : ''}</div>` : ''}
      </div>
    `;
  }

  // ── Month view ────────────────────────────────────────────────────────────

  _renderMonthView() {
    const currentMonth = this._startDate.getMonth();
    const days = this._days; // 42 days from Monday before first of month
    const DOW  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return html`
      <div class="month-outer" @touchstart=${this._onTouchStart} @touchend=${this._onTouchEnd}>
        <div class="month-dow-row">
          ${DOW.map(d => html`<div class="month-dow">${d}</div>`)}
        </div>
        <div class="month-grid">
          ${days.map(d => this._renderMonthCell(d, currentMonth))}
        </div>
      </div>
    `;
  }

  _renderMonthCell(date, currentMonth) {
    const inMonth = date.getMonth() === currentMonth;
    const today   = isToday(date);

    const dayEvs = this._events
      .filter(ev => evOnDay(ev, date))
      .sort((a, b) => {
        if (isAllDay(a) && !isAllDay(b)) return -1;
        if (!isAllDay(a) && isAllDay(b)) return 1;
        return (evStart(a)?.getTime() ?? 0) - (evStart(b)?.getTime() ?? 0);
      });

    const MAX_DOTS  = 6;
    const visible   = dayEvs.slice(0, MAX_DOTS);
    const extra     = dayEvs.length - MAX_DOTS;

    return html`
      <div class="month-cell ${!inMonth ? 'other-month' : ''} ${today ? 'is-today' : ''}"
           @click=${() => this._jumpToDay(date)}>
        <div class="month-cell-num">${date.getDate()}</div>
        <div class="month-dots">
          ${visible.map(ev => {
            const color = this._resolveColor(ev);
            return html`<div class="month-dot" style="background:${color}"></div>`;
          })}
          ${extra > 0 ? html`<span class="month-dot-more">+${extra}</span>` : ''}
        </div>
      </div>
    `;
  }

  _jumpToDay(date) {
    this._view      = 'today';
    this._startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (this._needsFetch()) this._loadEvents();
    this._doScrollToNow();
  }

  // ── Week grid (unchanged) ─────────────────────────────────────────────────

  _renderWeekGrid() {
    const days = this._days;
    return html`
      <div class="week-grid" style="grid-template-columns:repeat(${days.length},1fr)"
           @touchstart=${this._onTouchStart} @touchend=${this._onTouchEnd}>
        ${days.map(d => this._renderDayCol(d))}
      </div>
    `;
  }

  _renderDayCol(date) {
    const today      = isToday(date);
    const isWeekend  = date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6;
    const isNewMonth = date.getDate() === 1;

    const dayEvs = this._events
      .filter(ev => evOnDay(ev, date))
      .sort((a, b) => {
        if (isAllDay(a) && !isAllDay(b)) return -1;
        if (!isAllDay(a) && isAllDay(b)) return 1;
        const aT = evStart(a)?.getTime() ?? 0;
        const bT = evStart(b)?.getTime() ?? 0;
        return aT - bT;
      });

    const colClass = [
      'day-col',
      today ? 'today' : '',
      isWeekend && !today ? 'weekend' : '',
    ].filter(Boolean).join(' ');

    const monthName = date.toLocaleDateString('en-CA', { month: 'long' });

    return html`
      <div class="${colClass}">
        <div class="day-header">
          <div class="day-header-left">
            <div class="day-num-badge">${date.getDate()}</div>
            <div class="day-header-meta">
              <span class="day-name">${DAY_NAMES[date.getDay()].toUpperCase()}</span>
              <span class="day-month">
                ${monthName}
                ${isNewMonth ? html`<span class="new-month-tag">New Month</span>` : ''}
              </span>
            </div>
          </div>
          ${dayEvs.length > 0
            ? html`<span class="day-count-badge">${dayEvs.length} ev</span>`
            : html`<span class="day-count-badge free">Free</span>`
          }
        </div>
        <div class="day-events">
          ${dayEvs.length === 0
            ? this._renderEmptyDay()
            : dayEvs.map(ev => this._renderEventCard(ev, date))
          }
        </div>
      </div>
    `;
  }

  _renderEmptyDay() {
    return html`
      <div class="day-empty-wrap">
        <div class="day-empty">
          <div class="day-empty-icon">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="day-empty-title">No events</span>
          <span class="day-empty-sub">Nothing scheduled</span>
          <button class="day-empty-btn" @click=${() => this._openModal()}>+ Plan Day</button>
        </div>
      </div>
    `;
  }

  _renderEventCard(ev, date) {
    const color = this._resolveColor(ev);
    const s     = evStart(ev);

    if (isAllDay(ev) || (s && !sameDay(s, date))) {
      return html`
        <div class="ev-allday" style="background:${color}" title="${ev.summary || ''}"
             @click=${() => this._openDetail(ev)}>
          ${ev.summary || '(No title)'}
        </div>
      `;
    }

    return html`
      <div class="ev-timed" style="--ev-color:${color}" title="${ev.summary || ''}"
           @click=${() => this._openDetail(ev)}>
        <div class="ev-time-badge">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          ${formatTime(s)}
        </div>
        <span class="ev-title">${ev.summary || '(No title)'}</span>
      </div>
    `;
  }
}

customElements.define('home-calendar', HomeCalendar);
