import { LitElement, html, css } from 'lit';
import { supabase } from '../../lib/supabase.js';

const PEOPLE = [
  { key: 'mariaelena', name: 'Mariaelena', initial: 'M', defaultColor: '#EB337F', subtitle: null },
  { key: 'sebastiaan', name: 'Sebastiaan', initial: 'S', defaultColor: '#3A7CF8', subtitle: null },
  { key: 'anyone',     name: 'Anyone',     initial: '★', defaultColor: '#1C1E22', subtitle: 'Up for grabs' },
];

const EMOJI_OPTIONS = [
  '📝','🧺','🛒','💊','♻️','🔧','🚗','🪴','🍽️','🐕',
  '🧹','🧴','📦','🛁','🪟','💡','🔑','🧊','🌿','📅',
  '🏋️','📞','✉️','🎁','🍕','☕','🧽','🪣','🛏️','🚿',
  '🐇','🌾','🔨','🪜','🪚','🍳','🥘','🪞','🪠','🫧',
  '🐈','🌻','🧯','🪤','🫙','🥦','🚪','🪑','🛋️','🧸',
];

const ICON_BGSICONS = [
  '#fffbeb','#fdf2f8','#eff6ff','#f0fdf4','#fff7ed',
  '#faf5ff','#ecfdf5','#fefce8','#f0f9ff','#fff1f2',
];

function iconBg(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ICON_BGSICONS[h % ICON_BGSICONS.length];
}

function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getMondayISO() {
  const now = new Date();
  const day = now.getDay() || 7; // Mon=1 … Sun=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

function formatToday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function daysAgo(isoString) {
  if (!isoString) return Infinity;
  return Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24));
}

export class HomeTodo extends LitElement {
  static properties = {
    _tasks:            { state: true },
    _loading:          { state: true },
    _dragOver:         { state: true },
    _dragId:           { state: true },
    _modal:            { state: true },
    _modalEmoji:       { state: true },
    _modalStars:       { state: true },
    _modalRecurrence:  { state: true },
    _modalEffort:      { state: true },
    _modalWhenWhere:   { state: true },
    _editTask:         { state: true },
    _editName:         { state: true },
    _editEmoji:        { state: true },
    _editStars:        { state: true },
    _editRecurrence:   { state: true },
    _editBucket:       { state: true },
    _editEffort:       { state: true },
    _editWhenWhere:    { state: true },
    _colors:           { state: true },
    _dropTarget:       { state: true },
    _weekScores:       { state: true },
    _today:            { state: true },
    _activeTab:        { state: true },
    _reviewMode:       { state: true },
    _reviewQueue:      { state: true },
    _reviewIdx:        { state: true },
    _reviewDone:       { state: true },
    _sessionDone:      { state: true },
    _expandedDone:         { state: true },
    _expandedDoneGroups:   { state: true },
  };

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 1.75rem 2.5rem;
      gap: 1rem;
      background: #F5F2EB;
      box-sizing: border-box;
      font-family: var(--font-sans);
    }

    /* ── Page header ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .header-left { display: flex; align-items: baseline; gap: 12px; }

    .page-title {
      font-family: var(--font-serif);
      font-size: 1.85rem;
      font-weight: 500;
      letter-spacing: -0.02em;
      color: #111827;
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #9ca3af;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .score-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.7);
      backdrop-filter: blur(8px);
      padding: 8px 16px;
      border-radius: 16px;
      border: 1px solid rgba(214,211,206,0.8);
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }

    .score-nums {
      display: flex;
      align-items: baseline;
      gap: 2px;
    }

    .score-done {
      font-size: 1.15rem;
      font-weight: 700;
      color: #111827;
      line-height: 1;
    }

    .score-total {
      font-size: 0.75rem;
      font-weight: 600;
      color: #9ca3af;
    }

    .progress-track {
      width: 96px;
      height: 8px;
      background: #d6d3ce;
      border-radius: 99px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #111827;
      border-radius: 99px;
      transition: width 0.4s ease;
    }

    .score-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #9ca3af;
    }

    .review-trigger-btn {
      padding: 7px 14px;
      border-radius: 10px;
      border: 1.5px solid #f59e0b;
      background: #fffbeb;
      color: #92400e;
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s;
    }

    .review-trigger-btn:hover { background: #fef3c7; }

    /* ── Tab bar ── */
    .tab-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .tab-btn {
      padding: 7px 18px;
      border-radius: 10px;
      border: 1.5px solid #d6d3ce;
      background: none;
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ca3af;
      cursor: pointer;
      transition: all 0.15s;
    }

    .tab-btn.active {
      background: #111827;
      color: white;
      border-color: #111827;
    }

    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      font-size: 0.6rem;
      font-weight: 800;
      margin-left: 4px;
      vertical-align: middle;
    }

    .tab-btn:not(.active) .tab-count {
      background: #d6d3ce;
      color: #78716c;
    }

    /* ── Lanes grid ── */
    .lanes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
      flex: 1;
      min-height: 0;
    }

    .lane {
      display: flex;
      flex-direction: column;
      background: rgba(239,236,228,0.6);
      border-radius: 24px;
      padding: 12px;
      border: 1px solid rgba(214,211,206,0.4);
      min-height: 0;
    }

    .lane.drag-over {
      outline: 2px dashed #f59e0b;
      outline-offset: -2px;
    }

    /* ── Lane header banner ── */
    .lane-header {
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .lane-info { flex: 1; min-width: 0; }

    .lane-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .lane-name {
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: white;
    }

    .hearts-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 7px;
      border-radius: 99px;
      background: rgba(255,255,255,0.25);
      font-size: 0.62rem;
      font-weight: 700;
      color: white;
    }

    .lane-sub {
      font-size: 0.65rem;
      color: rgba(255,255,255,0.75);
      font-weight: 500;
      margin-top: 2px;
    }

    .color-pick-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .color-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.5);
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s;
      display: block;
    }

    .color-dot:hover { transform: scale(1.2); border-color: white; }

    .color-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
      border: none;
      padding: 0;
    }

    .ratio-pill {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      flex-shrink: 0;
    }

    /* ── Capacity bar (Today tab) ── */
    .capacity-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 4px 4px;
      flex-shrink: 0;
    }

    .cap-group {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .cap-label {
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-right: 2px;
    }

    .cap-slot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background: #d6d3ce;
    }

    .cap-slot.filled.big    { background: #ef4444; }
    .cap-slot.filled.medium { background: #f59e0b; }
    .cap-slot.filled.small  { background: #10b981; }
    .cap-slot.over          { background: #6b7280; }

    /* ── Task list ── */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      overflow-y: auto;
      padding-right: 2px;
      padding-top: 10px;
    }

    .task-list::-webkit-scrollbar { width: 4px; }
    .task-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }

    /* ── Task card ── */
    .task-card {
      background: white;
      border-radius: 16px;
      padding: 12px 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
      border: 1px solid rgba(214,211,206,0.7);
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: grab;
      user-select: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .task-card:active { cursor: grabbing; opacity: 0.6; }
    .task-card.drop-before { box-shadow: 0 -3px 0 #3b82f6; }
    .task-card.drop-after  { box-shadow: 0  3px 0 #3b82f6; }

    .task-card.done-card {
      background: rgba(245,244,241,0.9);
      border-color: rgba(214,211,206,0.6);
      opacity: 0.75;
    }

    .task-card.stale {
      border-left: 3px solid #f59e0b;
    }

    .task-card.someday-card {
      background: rgba(249,248,246,0.8);
      border-style: dashed;
    }

    .task-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .task-icon.done-icon {
      background: #111827 !important;
      color: white;
    }

    .task-body { flex: 1; min-width: 0; }

    .task-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .task-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #1f2937;
      line-height: 1.3;
      flex: 1;
    }

    .task-name.done { text-decoration: line-through; color: #9ca3af; }
    .task-name.someday { font-style: italic; color: #6b7280; }

    .effort-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .effort-dot.big    { background: #ef4444; }
    .effort-dot.medium { background: #f59e0b; }
    .effort-dot.small  { background: #10b981; }

    .recur-badge {
      font-size: 0.75rem;
      color: #6366f1;
      flex-shrink: 0;
    }

    .task-when {
      font-size: 0.68rem;
      color: #9ca3af;
      font-weight: 500;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .task-hearts {
      font-size: 0.68rem;
      font-weight: 600;
      color: #e11d48;
      margin-top: 3px;
    }

    .task-hearts.done { text-decoration: line-through; color: #f9a8d4; }

    .stale-nudge {
      font-size: 0.62rem;
      font-weight: 700;
      color: #d97706;
      margin-top: 3px;
    }

    .migrate-badge {
      font-size: 0.6rem;
      font-weight: 700;
      color: #9ca3af;
      background: #f3f4f6;
      border-radius: 4px;
      padding: 1px 5px;
      flex-shrink: 0;
    }

    .check-box {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 2px solid #d6d3ce;
      background: none;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s;
      padding: 0;
    }

    .check-box.checked {
      background: #111827;
      border-color: #111827;
    }

    /* ── Done section (Today tab) ── */
    .done-section { flex-shrink: 0; margin-top: 4px; }

    .done-date-group { flex-shrink: 0; margin-bottom: 2px; }

    .done-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: 10px;
      border: none;
      background: none;
      cursor: pointer;
      font-family: var(--font-sans);
      font-size: 0.68rem;
      font-weight: 700;
      color: #9ca3af;
      text-align: left;
      transition: background 0.1s;
    }

    .done-toggle:hover { background: rgba(0,0,0,0.04); }

    .done-toggle-icon {
      font-size: 0.7rem;
      transition: transform 0.2s;
      display: inline-block;
    }

    .done-toggle-icon.open { transform: rotate(90deg); }

    .done-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }

    .session-done-line {
      padding: 4px 10px 2px;
      font-size: 0.65rem;
      font-weight: 600;
      color: #10b981;
    }

    /* ── Add task row ── */
    .add-input-row {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      flex-shrink: 0;
    }

    .add-input {
      flex: 1;
      padding: 9px 12px;
      border-radius: 12px;
      border: 2px solid #d6d3ce;
      background: white;
      color: #1f2937;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 600;
      outline: none;
      transition: border-color 0.15s;
    }

    .add-input:focus { border-color: #a8a29e; }
    .add-input::placeholder { color: #9ca3af; }

    .add-go {
      padding: 9px 14px;
      border-radius: 12px;
      border: none;
      background: #111827;
      color: white;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }

    /* ── Modal shared ── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal {
      background: white;
      border-radius: 20px;
      padding: 1.5rem;
      width: 400px;
      max-width: calc(100vw - 2rem);
      max-height: calc(100vh - 4rem);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    }

    .modal-title {
      font-family: var(--font-serif);
      font-size: 1.1rem;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .modal-name-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1.5px solid #e7e5e4;
      background: #faf9f7;
      font-family: var(--font-sans);
      font-size: 0.9rem;
      font-weight: 600;
      color: #1f2937;
      outline: none;
      box-sizing: border-box;
    }

    .modal-name-input:focus { border-color: #a8a29e; }

    .modal-label {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 8px;
    }

    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 4px;
    }

    .emoji-btn {
      aspect-ratio: 1;
      border-radius: 8px;
      border: 1.5px solid transparent;
      background: #f5f0e8;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s, border-color 0.1s;
      padding: 0;
    }

    .emoji-btn:hover { background: #edeae2; }
    .emoji-btn.selected { border-color: #111827; background: #e8e5dd; }

    .star-row { display: flex; gap: 10px; }

    .star-btn {
      font-size: 1.6rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: transform 0.1s;
      filter: grayscale(1) opacity(0.25);
      color: #e11d48;
    }

    .star-btn.active { filter: none; transform: scale(1.1); }

    /* ── Effort picker ── */
    .effort-row { display: flex; gap: 6px; }

    .effort-btn {
      padding: 7px 14px;
      border-radius: 8px;
      border: 1.5px solid #e7e5e4;
      background: #faf9f7;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      color: #78716c;
      cursor: pointer;
      transition: all 0.1s;
    }

    .effort-btn.selected.big    { border-color: #ef4444; background: #fef2f2; color: #dc2626; }
    .effort-btn.selected.medium { border-color: #f59e0b; background: #fffbeb; color: #d97706; }
    .effort-btn.selected.small  { border-color: #10b981; background: #f0fdf4; color: #059669; }

    /* ── Bucket picker ── */
    .bucket-row { display: flex; gap: 6px; }

    .bucket-btn {
      flex: 1;
      padding: 7px 10px;
      border-radius: 8px;
      border: 1.5px solid #e7e5e4;
      background: #faf9f7;
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 700;
      color: #78716c;
      cursor: pointer;
      text-align: center;
      transition: all 0.1s;
    }

    .bucket-btn.selected {
      border-color: #111827;
      background: #111827;
      color: white;
    }

    /* ── When/where input ── */
    .when-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: 12px;
      border: 1.5px solid #e7e5e4;
      background: #faf9f7;
      font-family: var(--font-sans);
      font-size: 0.82rem;
      font-weight: 500;
      color: #1f2937;
      outline: none;
      box-sizing: border-box;
    }

    .when-input:focus { border-color: #a8a29e; }
    .when-input::placeholder { color: #c4bfbb; font-style: italic; }

    /* ── Recurrence picker ── */
    .recur-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .recur-btn {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1.5px solid #e7e5e4;
      background: #faf9f7;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      color: #78716c;
      cursor: pointer;
      transition: all 0.1s;
    }

    .recur-btn.selected {
      border-color: #6366f1;
      background: #eef2ff;
      color: #4338ca;
    }

    /* ── Modal actions ── */
    .modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-cancel {
      padding: 9px 16px;
      border-radius: 10px;
      border: 1.5px solid #e7e5e4;
      background: none;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 700;
      color: #78716c;
      cursor: pointer;
    }

    .btn-cancel:hover { border-color: #d6d3ce; }

    .btn-save {
      padding: 9px 18px;
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

    .btn-delete {
      padding: 9px 16px;
      border-radius: 10px;
      border: none;
      background: #ef4444;
      color: white;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      margin-right: auto;
    }

    .btn-delete:hover { background: #dc2626; }

    /* ── Review wizard ── */
    .review-modal {
      width: 440px;
    }

    .review-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .review-title {
      font-family: var(--font-serif);
      font-size: 1.1rem;
      font-weight: 600;
      color: #111827;
    }

    .review-counter {
      font-size: 0.7rem;
      font-weight: 700;
      color: #9ca3af;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .review-task {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      border-radius: 16px;
      background: #faf9f7;
      border: 1px solid #e7e5e4;
    }

    .review-task-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .review-task-body { flex: 1; min-width: 0; }

    .review-task-name {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
      line-height: 1.3;
    }

    .review-task-meta {
      font-size: 0.72rem;
      color: #9ca3af;
      font-weight: 500;
      margin-top: 4px;
    }

    .review-task-when {
      font-size: 0.72rem;
      color: #6b7280;
      font-weight: 500;
      margin-top: 2px;
    }

    .review-actions {
      display: flex;
      gap: 8px;
    }

    .btn-review-today {
      flex: 1;
      padding: 10px 8px;
      border-radius: 10px;
      border: 1.5px solid #111827;
      background: #111827;
      color: white;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }

    .btn-review-backlog {
      flex: 1;
      padding: 10px 8px;
      border-radius: 10px;
      border: 1.5px solid #d6d3ce;
      background: none;
      color: #374151;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }

    .btn-review-delete {
      flex: 1;
      padding: 10px 8px;
      border-radius: 10px;
      border: 1.5px solid #fecaca;
      background: #fef2f2;
      color: #dc2626;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }

    .btn-review-skip {
      width: 100%;
      padding: 8px;
      border-radius: 10px;
      border: none;
      background: none;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 600;
      color: #9ca3af;
      cursor: pointer;
      text-align: center;
    }

    .review-complete-card {
      text-align: center;
      padding: 2rem 1rem;
    }

    .review-complete-icon {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
    }

    .review-complete-text {
      font-family: var(--font-serif);
      font-size: 1.1rem;
      color: #111827;
      margin: 0;
    }

    .review-complete-sub {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 4px;
    }

    /* ── Loading ── */
    .loading {
      text-align: center;
      padding: 3rem;
      color: #9ca3af;
      font-size: 0.85rem;
    }

    .empty-lane {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      color: #c4bfbb;
      font-weight: 500;
      padding: 2rem;
      text-align: center;
    }
  `;

  static POLL_MS = 30_000;

  constructor() {
    super();
    this._tasks      = [];
    this._loading    = true;
    this._dragOver   = null;
    this._dragId     = null;
    this._modal      = null;
    this._modalEmoji       = '📝';
    this._modalStars       = 0;
    this._modalRecurrence  = 'none';
    this._modalEffort      = 'medium';
    this._modalWhenWhere   = '';
    this._editTask         = null;
    this._editName         = '';
    this._editEmoji        = '📝';
    this._editStars        = 0;
    this._editRecurrence   = 'none';
    this._editBucket       = 'someday';
    this._editEffort       = 'medium';
    this._editWhenWhere    = '';
    this._dropTarget       = null;
    this._weekScores       = {};
    this._today            = formatToday();
    this._activeTab        = 'someday';
    this._reviewMode       = false;
    this._reviewQueue      = [];
    this._reviewIdx        = 0;
    this._reviewDone       = false;
    this._sessionDone      = { mariaelena: 0, sebastiaan: 0, anyone: 0 };
    this._expandedDone     = { mariaelena: false, sebastiaan: false, anyone: false };
    this._expandedDoneGroups = {};
    this._colors = {
      mariaelena: localStorage.getItem('lane-color-mariaelena') || '#EB337F',
      sebastiaan:  localStorage.getItem('lane-color-sebastiaan')  || '#3A7CF8',
      anyone:      localStorage.getItem('lane-color-anyone')      || '#f59e0b',
    };
    this._deleteTimers = new Map();
  }

  _setColor(personKey, color) {
    this._colors = { ...this._colors, [personKey]: color };
    localStorage.setItem(`lane-color-${personKey}`, color);
  }

  connectedCallback() {
    super.connectedCallback();
    this._load().then(() => this._checkRecurrenceOnLoad());
    this._loadWeekScores();
    this._subscribe();
    // Update date label at midnight
    this._dayTimer = setTimeout(() => {
      this._today = formatToday();
    }, msUntilMidnight());
    this._pollTimer = setInterval(() => {
      this._load().then(() => this._checkRecurrenceOnLoad());
      this._loadWeekScores();
    }, HomeTodo.POLL_MS);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._channel?.unsubscribe();
    this._scoresChannel?.unsubscribe();
    clearTimeout(this._dayTimer);
    clearInterval(this._pollTimer);
    // _deleteTimers intentionally NOT cleared — pending deletes must complete
  }

  async _load() {
    const { data } = await supabase.from('todos').select('*').order('sort_order').order('created_at');
    this._tasks   = data ?? [];
    this._loading = false;
  }

  async _loadWeekScores() {
    const { data } = await supabase.from('week_scores').select('*');
    if (!data) return;
    const map = {};
    for (const row of data) map[`${row.person}__${row.week_key}`] = row.hearts;
    this._weekScores = map;
  }

  _weekHeartsFor(personKey) {
    return this._weekScores[`${personKey}__${getWeekKey()}`] ?? 0;
  }

  _subscribe() {
    this._channel = supabase
      .channel('todos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        if (this._ignoreNext) { this._ignoreNext = false; return; }
        this._load();
      })
      .subscribe();
    this._scoresChannel = supabase
      .channel('week-scores-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'week_scores' }, () => this._loadWeekScores())
      .subscribe();
  }

  // ── Recurrence: check on load instead of midnight timer ──

  async _checkRecurrenceOnLoad() {
    const today      = todayISO();
    const thisMonday = getMondayISO();
    const toReset    = [];

    for (const task of this._tasks) {
      if (!task.done || !task.completed_at) continue;
      const cd = task.completed_at.slice(0, 10);
      let reset = false;

      if (task.recurrence === 'daily')   reset = cd < today;
      if (task.recurrence === 'weekly')  reset = cd < thisMonday;
      if (task.recurrence === 'monthly') reset = cd < today.slice(0, 8) + '01';
      if (task.recurrence === 'yearly')  reset = cd < today.slice(0, 5) + '01-01';

      if (reset) toReset.push(task);
    }

    if (!toReset.length) return;
    const now = new Date().toISOString();
    this._tasks = this._tasks.map(t =>
      toReset.find(r => r.id === t.id)
        ? { ...t, done: false, completed_at: null, last_touched: now }
        : t
    );
    await Promise.all(toReset.map(t =>
      supabase.from('todos').update({ done: false, completed_at: null, last_touched: now }).eq('id', t.id)
    ));
  }

  // ── Stale detection ──

  _isStale(task) {
    const ref = task.last_touched || task.created_at;
    return daysAgo(ref) >= 7 || (task.migrate_count ?? 0) >= 3;
  }

  _hasStaleForReview() {
    const lastReview = localStorage.getItem('lastReview') ?? '2000-01-01';
    if (daysAgo(lastReview) >= 7) return true;
    return this._tasks.some(t => {
      const bucket = t.bucket ?? 'today';
      if (t.done) return false;
      if (bucket === 'backlog') return this._isStale(t);
      if (bucket === 'someday') return daysAgo(t.last_touched || t.created_at) >= 30;
      return false;
    });
  }

  // ── Toggle task done ──

  async _toggle(task) {
    const done = !task.done;
    const completed_at = done ? new Date().toISOString() : null;
    const last_touched = new Date().toISOString();
    this._tasks = this._tasks.map(t =>
      t.id === task.id ? { ...t, done, completed_at, last_touched } : t
    );
    await supabase.from('todos').update({ done, completed_at, last_touched }).eq('id', task.id);

    if (done) {
      const r = task.recurrence ?? 'none';
      if (r !== 'none') {
        // Recurring: reset to undone after 30s
        const timer = setTimeout(() => this._autoRemove(task), 30000);
        this._deleteTimers.set(task.id, timer);
      } else {
        // Non-recurring: track session wins, stay in DB as done
        this._sessionDone = {
          ...this._sessionDone,
          [task.person]: (this._sessionDone[task.person] ?? 0) + 1,
        };
      }
    } else {
      clearTimeout(this._deleteTimers.get(task.id));
      this._deleteTimers.delete(task.id);
    }

    // Update weekly hearts score
    if (task.stars) {
      const weekKey = getWeekKey();
      const key = `${task.person}__${weekKey}`;
      const current = this._weekScores[key] ?? 0;
      const next = Math.max(0, current + (done ? task.stars : -task.stars));
      this._weekScores = { ...this._weekScores, [key]: next };
      await supabase.from('week_scores')
        .upsert({ person: task.person, week_key: weekKey, hearts: next }, { onConflict: 'person,week_key' });
    }
  }

  async _autoRemove(task) {
    this._deleteTimers.delete(task.id);
    // Recurring: reset to undone
    this._tasks = this._tasks.map(t =>
      t.id === task.id ? { ...t, done: false, completed_at: null } : t
    );
    await supabase.from('todos').update({ done: false, completed_at: null }).eq('id', task.id);
  }

  // ── Edit modal ──

  _openEdit(task) {
    this._editTask       = task;
    this._editName       = task.name;
    this._editEmoji      = task.emoji ?? '📝';
    this._editStars      = task.stars ?? 0;
    this._editRecurrence = task.recurrence ?? 'none';
    this._editBucket     = task.bucket ?? 'today';
    this._editEffort     = task.effort ?? 'medium';
    this._editWhenWhere  = task.when_where ?? '';
  }

  async _saveEdit() {
    const task = this._editTask;
    this._editTask = null;
    const isMovingFromToday = (task.bucket ?? 'today') === 'today' && this._editBucket !== 'today';
    const migrate_count = isMovingFromToday
      ? (task.migrate_count ?? 0) + 1
      : (task.migrate_count ?? 0);
    const patch = {
      name:          this._editName,
      emoji:         this._editEmoji,
      stars:         this._editStars || null,
      recurrence:    this._editRecurrence,
      bucket:        this._editBucket,
      effort:        this._editEffort,
      when_where:    this._editWhenWhere || null,
      migrate_count,
      last_touched:  new Date().toISOString(),
    };
    this._tasks = this._tasks.map(t => t.id === task.id ? { ...t, ...patch } : t);
    await supabase.from('todos').update(patch).eq('id', task.id);
  }

  async _deleteEdit() {
    const task = this._editTask;
    this._editTask = null;
    this._tasks = this._tasks.filter(t => t.id !== task.id);
    await supabase.from('todos').delete().eq('id', task.id);
  }

  // ── Add task modal ──

  _openAddModal(person, name) {
    if (!name.trim()) return;
    this._modal           = { person, name: name.trim() };
    this._modalEmoji      = '📝';
    this._modalStars      = 0;
    this._modalRecurrence = 'none';
    this._modalEffort     = 'medium';
    this._modalWhenWhere  = '';
    // Bucket inherits from active tab
  }

  async _confirmModal() {
    const { person, name } = this._modal;
    this._modal = null;
    const maxOrder = this._tasks
      .filter(t => t.person === person)
      .reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
    const { data } = await supabase
      .from('todos')
      .insert({
        person,
        name,
        emoji:         this._modalEmoji,
        stars:         this._modalStars || null,
        recurrence:    this._modalRecurrence,
        sort_order:    maxOrder + 1,
        bucket:        this._activeTab,
        effort:        this._modalEffort,
        when_where:    this._modalWhenWhere || null,
        last_touched:  new Date().toISOString(),
      })
      .select().single();
    if (data) this._tasks = [...this._tasks, data];
  }

  // ── Bucket movement ──

  async _moveBucket(task, newBucket) {
    const isDowngrade = (task.bucket ?? 'today') === 'today' && newBucket !== 'today';
    const migrate_count = isDowngrade ? (task.migrate_count ?? 0) + 1 : (task.migrate_count ?? 0);
    const patch = { bucket: newBucket, migrate_count, last_touched: new Date().toISOString() };
    this._tasks = this._tasks.map(t => t.id === task.id ? { ...t, ...patch } : t);
    await supabase.from('todos').update(patch).eq('id', task.id);
  }

  // ── Weekly review wizard ──

  _openReview() {
    const queue = this._tasks.filter(t => {
      if (t.done) return false;
      const bucket = t.bucket ?? 'today';
      if (bucket === 'backlog') return this._isStale(t);
      if (bucket === 'someday') return daysAgo(t.last_touched || t.created_at) >= 30;
      return false;
    });
    this._reviewQueue = queue.map(t => t.id);
    this._reviewIdx   = 0;
    this._reviewMode  = true;
    this._reviewDone  = false;
  }

  async _reviewAction(action) {
    const taskId = this._reviewQueue[this._reviewIdx];
    const task   = this._tasks.find(t => t.id === taskId);

    if (task && action !== 'skip') {
      const now = new Date().toISOString();
      if (action === 'keep-today') {
        const patch = { bucket: 'today', migrate_count: 0, last_touched: now };
        this._tasks = this._tasks.map(t => t.id === taskId ? { ...t, ...patch } : t);
        await supabase.from('todos').update(patch).eq('id', taskId);
      } else if (action === 'move-backlog') {
        const patch = { bucket: 'backlog', last_touched: now };
        this._tasks = this._tasks.map(t => t.id === taskId ? { ...t, ...patch } : t);
        await supabase.from('todos').update(patch).eq('id', taskId);
      } else if (action === 'delete') {
        this._tasks = this._tasks.filter(t => t.id !== taskId);
        await supabase.from('todos').delete().eq('id', taskId);
      }
    }
    this._advanceReview();
  }

  _advanceReview() {
    const nextIdx = this._reviewIdx + 1;
    if (nextIdx >= this._reviewQueue.length) {
      this._reviewDone = true;
      localStorage.setItem('lastReview', todayISO());
      setTimeout(() => {
        this._reviewMode  = false;
        this._reviewDone  = false;
        this._reviewQueue = [];
      }, 2000);
    } else {
      this._reviewIdx = nextIdx;
    }
  }

  _toggleDoneExpanded(personKey) {
    this._expandedDone = {
      ...this._expandedDone,
      [personKey]: !this._expandedDone[personKey],
    };
  }

  _toggleDoneDateGroup(personKey, dateKey) {
    const key = `${personKey}__${dateKey}`;
    this._expandedDoneGroups = {
      ...this._expandedDoneGroups,
      [key]: !(this._expandedDoneGroups[key] ?? dateKey === todayISO()),
    };
  }

  async _restoreTask(task) {
    const patch = { done: false, completed_at: null, bucket: 'someday', last_touched: new Date().toISOString() };
    this._tasks = this._tasks.map(t => t.id === task.id ? { ...t, ...patch } : t);
    await supabase.from('todos').update(patch).eq('id', task.id);
  }

  _formatDateLabel(dateKey) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (dateKey === yesterday) return 'Yesterday';
    return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // ── Drag & drop ──

  _onDragStart(e, task) {
    this._dragId = task.id;
    e.dataTransfer.effectAllowed = 'move';
  }

  _onDragOver(e, personKey) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this._dragOver = personKey;
  }

  _onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) this._dragOver = null;
  }

  async _onDrop(e, personKey) {
    e.preventDefault();
    this._dragOver = null;
    const id = this._dragId;
    this._dragId = null;
    if (!id) return;
    const task = this._tasks.find(t => t.id === id);
    if (!task || task.person === personKey) return;
    this._tasks = this._tasks.map(t => t.id === id ? { ...t, person: personKey } : t);
    await supabase.from('todos').update({ person: personKey }).eq('id', id);
  }

  _onCardDragOver(e, task) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    this._dropTarget = { taskId: task.id, before };
    this._dragOver   = null;
  }

  _onCardDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) this._dropTarget = null;
  }

  async _onCardDrop(e, targetTask) {
    e.preventDefault();
    e.stopPropagation();
    const before = this._dropTarget?.before ?? false;
    this._dropTarget = null;
    const dragId = this._dragId;
    this._dragId = null;
    if (!dragId || dragId === targetTask.id) return;

    const dragTask = this._tasks.find(t => t.id === dragId);
    if (!dragTask) return;

    const newPerson = targetTask.person;
    const laneTasks = this._tasks
      .filter(t => t.person === newPerson && t.id !== dragId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const insertIdx = laneTasks.findIndex(t => t.id === targetTask.id);
    const at = before ? insertIdx : insertIdx + 1;
    laneTasks.splice(at, 0, { ...dragTask, person: newPerson });

    const unchanged = this._tasks.filter(t => t.person !== newPerson && t.id !== dragId);
    this._tasks = [
      ...unchanged,
      ...laneTasks.map((t, i) => ({ ...t, sort_order: i, person: newPerson })),
    ];

    this._ignoreNext = true;
    await Promise.all(laneTasks.map((t, i) =>
      supabase.from('todos').update({ sort_order: i, person: newPerson }).eq('id', t.id)
    ));
  }

  // ── Render: tab bar ──

  _renderTabBar() {
    const tabs = [
      { key: 'someday', label: 'Someday' },
      { key: 'backlog', label: 'Backlog' },
      { key: 'today',   label: 'Today' },
      { key: 'done',    label: 'Done' },
    ];
    const counts = {
      today:   this._tasks.filter(t => (t.bucket ?? 'today') === 'today'   && !t.done).length,
      backlog: this._tasks.filter(t => (t.bucket ?? 'today') === 'backlog' && !t.done).length,
      someday: this._tasks.filter(t => (t.bucket ?? 'today') === 'someday' && !t.done).length,
      done:    this._tasks.filter(t => t.done).length,
    };
    return html`
      <div class="tab-bar">
        ${tabs.map(tab => html`
          <button
            class="tab-btn ${this._activeTab === tab.key ? 'active' : ''}"
            @click=${() => { this._activeTab = tab.key; }}
          >${tab.label}<span class="tab-count">${counts[tab.key]}</span></button>
        `)}
      </div>
    `;
  }

  // ── Render: 1-3-5 capacity bar ──

  _renderCapacityBar(personKey, incompleteTasks) {
    const TARGETS = { big: 1, medium: 3, small: 5 };
    const counts  = { big: 0, medium: 0, small: 0 };
    for (const t of incompleteTasks) counts[t.effort ?? 'medium']++;

    const groups = ['big', 'medium', 'small'];
    return html`
      <div class="capacity-bar">
        ${groups.map(effort => {
          const target  = TARGETS[effort];
          const count   = counts[effort];
          const slots   = Math.max(target, count);
          return html`
            <div class="cap-group">
              <span class="cap-label">${effort === 'big' ? 'B' : effort === 'medium' ? 'M' : 'S'}</span>
              ${Array.from({ length: slots }, (_, i) => html`
                <div class="cap-slot ${i < count ? 'filled' : ''} ${i < count ? effort : ''} ${i >= target ? 'over' : ''}"></div>
              `)}
            </div>
          `;
        })}
      </div>
    `;
  }

  // ── Render: single task card ──

  _renderTaskCard(task, tab) {
    const isStale   = tab === 'backlog' && !task.done && this._isStale(task);
    const isSomeday = (task.bucket ?? 'today') === 'someday';
    const effort    = task.effort ?? 'medium';
    const migrated  = task.migrate_count ?? 0;

    return html`
      <div
        class="task-card
          ${task.done  ? 'done-card'    : ''}
          ${isStale    ? 'stale'        : ''}
          ${isSomeday && !task.done ? 'someday-card' : ''}
          ${this._dropTarget?.taskId === task.id && this._dropTarget.before  ? 'drop-before' : ''}
          ${this._dropTarget?.taskId === task.id && !this._dropTarget.before ? 'drop-after'  : ''}"
        draggable="true"
        @dragstart=${e => this._onDragStart(e, task)}
        @dragover=${e => this._onCardDragOver(e, task)}
        @dragleave=${this._onCardDragLeave}
        @drop=${e => this._onCardDrop(e, task)}
        @click=${() => this._openEdit(task)}
      >
        <div class="task-icon ${task.done ? 'done-icon' : ''}"
          style="${task.done ? '' : `background:${iconBg(task.id)}`}">
          ${task.done
            ? html`<svg width="18" height="18" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : task.emoji}
        </div>
        <div class="task-body">
          <div class="task-name-row">
            <span class="task-name ${task.done ? 'done' : ''} ${isSomeday && !task.done ? 'someday' : ''}">
              ${task.name}
            </span>
            ${!task.done ? html`<div class="effort-dot ${effort}"></div>` : ''}
            ${task.recurrence && task.recurrence !== 'none' ? html`<span class="recur-badge">↻</span>` : ''}
            ${tab === 'backlog' && migrated >= 2 ? html`<span class="migrate-badge">${migrated}×</span>` : ''}
          </div>
          ${task.when_where && !task.done ? html`<div class="task-when">⏱ ${task.when_where}</div>` : ''}
          ${isStale ? html`<div class="stale-nudge">Still relevant?</div>` : ''}
          ${task.stars && !task.done
            ? html`<div class="task-hearts">${'♥'.repeat(task.stars)} ${task.stars}</div>` : ''}
          ${task.stars && task.done
            ? html`<div class="task-hearts done">${'♥'.repeat(task.stars)} ${task.stars}</div>` : ''}
        </div>
        <button class="check-box ${task.done ? 'checked' : ''}"
          @click=${e => { e.stopPropagation(); this._toggle(task); }}
        >${task.done
            ? html`<svg width="12" height="12" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
            : ''}</button>
      </div>
    `;
  }

  // ── Render: done section (Today tab, collapsible) ──

  _renderDoneSection(doneTasks, personKey, sessionCount) {
    const total = doneTasks.length + sessionCount;
    if (total === 0) return '';
    const expanded = this._expandedDone[personKey];
    return html`
      <div class="done-section">
        ${sessionCount > 0 ? html`
          <div class="session-done-line">✓ ${sessionCount} completed today</div>
        ` : ''}
        ${doneTasks.length > 0 ? html`
          <button class="done-toggle" @click=${() => this._toggleDoneExpanded(personKey)}>
            <span class="done-toggle-icon ${expanded ? 'open' : ''}">▶</span>
            ${doneTasks.length} done — tap to undo
          </button>
          ${expanded ? html`
            <div class="done-list">
              ${doneTasks.map(t => this._renderTaskCard(t, 'today'))}
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  // ── Render: done history lane ──

  _renderDoneLane(person) {
    const color    = this._colors[person.key] ?? person.defaultColor;
    const allTime  = this._tasks.filter(t => t.person === person.key && t.done).length;
    const doneTasks = this._tasks
      .filter(t => t.person === person.key && t.done)
      .sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at));

    // Group by completed date
    const groups = new Map();
    for (const task of doneTasks) {
      const dateKey = (task.completed_at || task.created_at || '').slice(0, 10);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(task);
    }
    const today = todayISO();

    return html`
      <div class="lane">
        <div class="lane-header" style="background:${color}">
          <div class="avatar">${person.initial}</div>
          <div class="lane-info">
            <div class="lane-name-row">
              <span class="lane-name">${person.name}</span>
            </div>
            <div class="lane-sub">${allTime} completed all-time</div>
          </div>
          <div class="ratio-pill">${allTime}</div>
        </div>
        <div class="task-list">
          ${doneTasks.length === 0
            ? html`<div class="empty-lane">Nothing completed yet</div>`
            : ''
          }
          ${Array.from(groups.entries()).map(([dateKey, tasks]) => {
            const isToday    = dateKey === today;
            const label      = isToday ? 'Today' : this._formatDateLabel(dateKey);
            const groupKey   = `${person.key}__${dateKey}`;
            const expanded   = this._expandedDoneGroups[groupKey] ?? isToday;
            return html`
              <div class="done-date-group">
                <button class="done-toggle" @click=${() => this._toggleDoneDateGroup(person.key, dateKey)}>
                  <span class="done-toggle-icon ${expanded ? 'open' : ''}">▶</span>
                  ${label} · ${tasks.length}
                </button>
                ${expanded ? html`
                  <div class="done-list">
                    ${tasks.map(task => this._renderDoneHistoryCard(task))}
                  </div>
                ` : ''}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  _renderDoneHistoryCard(task) {
    const timeStr = task.completed_at
      ? new Date(task.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
    return html`
      <div class="task-card done-card" style="cursor:pointer" title="Tap to restore"
        @click=${() => this._restoreTask(task)}>
        <div class="task-icon done-icon">
          <svg width="18" height="18" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="task-body">
          <div class="task-name-row">
            <span class="task-name done">${task.name}</span>
          </div>
          ${timeStr ? html`<div class="task-when">✓ ${timeStr}</div>` : ''}
        </div>
        <span style="font-size:0.9rem;color:#9ca3af;flex-shrink:0">↩</span>
      </div>
    `;
  }

  // ── Render: lane ──

  _renderLane(person) {
    const tab    = this._activeTab;
    if (tab === 'done') return this._renderDoneLane(person);
    const color  = this._colors[person.key] ?? person.defaultColor;
    const totalHearts = this._weekHeartsFor(person.key);
    const sessionCount = this._sessionDone[person.key] ?? 0;

    // Filter to current tab's tasks for this person
    let tasks = this._tasks
      .filter(t => t.person === person.key && (t.bucket ?? 'today') === tab);

    // Sort based on tab
    if (tab === 'today') {
      const effortOrder = { big: 0, medium: 1, small: 2 };
      tasks = [...tasks].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (effortOrder[a.effort ?? 'medium'] ?? 1) - (effortOrder[b.effort ?? 'medium'] ?? 1);
      });
    } else {
      tasks = [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    const incompleteTasks = tasks.filter(t => !t.done);
    const doneTasks       = tasks.filter(t => t.done);

    // Lane subtitle based on tab
    let laneSub = person.subtitle;
    if (!laneSub) {
      if (tab === 'today')   laneSub = `${doneTasks.length} of ${tasks.length} done`;
      if (tab === 'backlog') laneSub = `${incompleteTasks.length} waiting`;
      if (tab === 'someday') laneSub = `${incompleteTasks.length} ideas`;
    }

    return html`
      <div
        class="lane ${this._dragOver === person.key ? 'drag-over' : ''}"
        @dragover=${e => this._onDragOver(e, person.key)}
        @dragleave=${this._onDragLeave}
        @drop=${e => this._onDrop(e, person.key)}
      >
        <!-- Header banner -->
        <div class="lane-header" style="background:${color}">
          <div class="avatar">${person.initial}</div>
          <div class="lane-info">
            <div class="lane-name-row">
              <span class="lane-name">${person.name}</span>
              ${totalHearts > 0 ? html`<span class="hearts-badge">♥ ${totalHearts}</span>` : ''}
            </div>
            <div class="lane-sub">${laneSub}</div>
          </div>
          <div class="color-pick-wrap" title="Change color">
            <div class="color-dot" style="background:${color}"></div>
            <input class="color-input" type="color" .value=${color}
              @input=${e => this._setColor(person.key, e.target.value)}
            />
          </div>
          <div class="ratio-pill">${doneTasks.length}/${tasks.length}</div>
        </div>

        ${tab === 'today' ? this._renderCapacityBar(person.key, incompleteTasks) : ''}

        <!-- Tasks -->
        <div class="task-list">
          ${incompleteTasks.length === 0 && doneTasks.length === 0 && sessionCount === 0
            ? html`<div class="empty-lane">${tab === 'today' ? 'Nothing here — add a task below' : tab === 'backlog' ? 'Backlog clear' : 'No ideas yet'}</div>`
            : ''
          }
          ${incompleteTasks.map(task => this._renderTaskCard(task, tab))}
          ${tab === 'today'
            ? this._renderDoneSection(doneTasks, person.key, sessionCount)
            : doneTasks.map(task => this._renderTaskCard(task, tab))
          }
        </div>

        <!-- Add task -->
        <div class="add-input-row">
          <input class="add-input" placeholder="+ Add task…"
            @keydown=${e => {
              if (e.key === 'Enter') {
                this._openAddModal(person.key, e.target.value);
                e.target.value = '';
              }
            }}
          />
          <button class="add-go"
            @click=${e => {
              const inp = e.target.previousElementSibling;
              this._openAddModal(person.key, inp.value);
              inp.value = '';
            }}>Add</button>
        </div>
      </div>
    `;
  }

  // ── Render: recurrence picker (shared) ──

  _renderRecurrencePicker(value, onChange) {
    const options = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
    const labels  = { none: 'None', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
    return html`
      <div>
        <div class="modal-label">Repeats</div>
        <div class="recur-row">
          ${options.map(opt => html`
            <button class="recur-btn ${value === opt ? 'selected' : ''}"
              @click=${() => onChange(opt)}>${labels[opt]}</button>
          `)}
        </div>
      </div>
    `;
  }

  // ── Render: effort picker (shared) ──

  _renderEffortPicker(value, onChange) {
    const efforts = [
      { key: 'big',    label: 'Big' },
      { key: 'medium', label: 'Medium' },
      { key: 'small',  label: 'Small' },
    ];
    return html`
      <div>
        <div class="modal-label">Effort</div>
        <div class="effort-row">
          ${efforts.map(e => html`
            <button class="effort-btn ${value === e.key ? `selected ${e.key}` : ''}"
              @click=${() => onChange(e.key)}>${e.label}</button>
          `)}
        </div>
      </div>
    `;
  }

  // ── Render: bucket picker (shared) ──

  _renderBucketPicker(value, onChange) {
    const buckets = [
      { key: 'someday', label: 'Someday' },
      { key: 'backlog', label: 'Backlog' },
      { key: 'today',   label: 'Today' },
    ];
    return html`
      <div>
        <div class="modal-label">List</div>
        <div class="bucket-row">
          ${buckets.map(b => html`
            <button class="bucket-btn ${value === b.key ? 'selected' : ''}"
              @click=${() => onChange(b.key)}>${b.label}</button>
          `)}
        </div>
      </div>
    `;
  }

  // ── Render: add modal ──

  _renderAddModal() {
    if (!this._modal) return '';
    const person = PEOPLE.find(p => p.key === this._modal.person);
    return html`
      <div class="modal-backdrop" @click=${e => e.target === e.currentTarget && (this._modal = null)}>
        <div class="modal">
          <p class="modal-title">New task for ${person.name}</p>
          <input class="modal-name-input"
            .value=${this._modal.name}
            @input=${e => { this._modal = { ...this._modal, name: e.target.value }; }}
            @keydown=${e => e.key === 'Enter' && this._confirmModal()}
            autofocus
          />
          <div>
            <div class="modal-label">Icon</div>
            <div class="emoji-grid">
              ${EMOJI_OPTIONS.map(em => html`
                <button class="emoji-btn ${this._modalEmoji === em ? 'selected' : ''}"
                  @click=${() => { this._modalEmoji = em; }}>${em}</button>
              `)}
            </div>
          </div>
          <div>
            <div class="modal-label">Hearts</div>
            <div class="star-row">
              ${[1,2,3].map(n => html`
                <button class="star-btn ${this._modalStars >= n ? 'active' : ''}"
                  @click=${() => { this._modalStars = this._modalStars === n ? 0 : n; }}>♥</button>
              `)}
            </div>
          </div>
          ${this._renderEffortPicker(this._modalEffort, v => { this._modalEffort = v; })}
          <div>
            <div class="modal-label">When or where?</div>
            <input class="when-input"
              .value=${this._modalWhenWhere}
              placeholder="e.g. After school, On the way to work…"
              @input=${e => { this._modalWhenWhere = e.target.value; }}
            />
          </div>
          ${this._renderRecurrencePicker(this._modalRecurrence, v => { this._modalRecurrence = v; })}
          <div class="modal-actions">
            <button class="btn-cancel" @click=${() => { this._modal = null; }}>Cancel</button>
            <button class="btn-save" @click=${this._confirmModal}>Add task</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Render: edit modal ──

  _renderEditModal() {
    if (!this._editTask) return '';
    return html`
      <div class="modal-backdrop" @click=${e => e.target === e.currentTarget && (this._editTask = null)}>
        <div class="modal">
          <p class="modal-title">Edit task</p>
          <input class="modal-name-input"
            .value=${this._editName}
            @input=${e => { this._editName = e.target.value; }}
            @keydown=${e => e.key === 'Enter' && this._saveEdit()}
          />
          <div>
            <div class="modal-label">Icon</div>
            <div class="emoji-grid">
              ${EMOJI_OPTIONS.map(em => html`
                <button class="emoji-btn ${this._editEmoji === em ? 'selected' : ''}"
                  @click=${() => { this._editEmoji = em; }}>${em}</button>
              `)}
            </div>
          </div>
          <div>
            <div class="modal-label">Hearts</div>
            <div class="star-row">
              ${[1,2,3].map(n => html`
                <button class="star-btn ${this._editStars >= n ? 'active' : ''}"
                  @click=${() => { this._editStars = this._editStars === n ? 0 : n; }}>♥</button>
              `)}
            </div>
          </div>
          ${this._renderEffortPicker(this._editEffort, v => { this._editEffort = v; })}
          <div>
            <div class="modal-label">When or where?</div>
            <input class="when-input"
              .value=${this._editWhenWhere}
              placeholder="e.g. After school, On the way to work…"
              @input=${e => { this._editWhenWhere = e.target.value; }}
            />
          </div>
          ${this._renderRecurrencePicker(this._editRecurrence, v => { this._editRecurrence = v; })}
          ${this._renderBucketPicker(this._editBucket, v => { this._editBucket = v; })}
          <div class="modal-actions">
            <button class="btn-delete" @click=${this._deleteEdit}>Delete</button>
            <button class="btn-cancel" @click=${() => { this._editTask = null; }}>Cancel</button>
            <button class="btn-save" @click=${this._saveEdit}>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Render: weekly review wizard ──

  _renderReviewWizard() {
    if (this._reviewDone) {
      return html`
        <div class="modal-backdrop">
          <div class="modal review-modal">
            <div class="review-complete-card">
              <div class="review-complete-icon">✓</div>
              <p class="review-complete-text">Review complete!</p>
              <p class="review-complete-sub">Your list is up to date.</p>
            </div>
          </div>
        </div>
      `;
    }

    const taskId = this._reviewQueue[this._reviewIdx];
    const task   = this._tasks.find(t => t.id === taskId);

    if (!task) {
      // Task was deleted externally, advance
      setTimeout(() => this._advanceReview(), 0);
      return '';
    }

    const added    = daysAgo(task.created_at);
    const migrated = task.migrate_count ?? 0;

    return html`
      <div class="modal-backdrop">
        <div class="modal review-modal">
          <div class="review-header">
            <span class="review-title">Weekly Review</span>
            <span class="review-counter">${this._reviewIdx + 1} of ${this._reviewQueue.length}</span>
          </div>
          <div class="review-task">
            <div class="review-task-icon" style="background:${iconBg(task.id)}">${task.emoji}</div>
            <div class="review-task-body">
              <div class="review-task-name">${task.name}</div>
              <div class="review-task-meta">
                Added ${added === Infinity ? '?' : added}d ago${migrated > 0 ? ` · moved ${migrated}×` : ''}
              </div>
              ${task.when_where ? html`<div class="review-task-when">⏱ ${task.when_where}</div>` : ''}
            </div>
          </div>
          <div class="review-actions">
            <button class="btn-review-today"   @click=${() => this._reviewAction('keep-today')}>Keep in Today</button>
            <button class="btn-review-backlog"  @click=${() => this._reviewAction('move-backlog')}>Move to Backlog</button>
            <button class="btn-review-delete"   @click=${() => this._reviewAction('delete')}>Delete</button>
          </div>
          <button class="btn-review-skip" @click=${() => this._reviewAction('skip')}>Skip</button>
        </div>
      </div>
    `;
  }

  // ── Main render ──

  render() {
    if (this._loading) return html`<div class="loading">Loading…</div>`;

    const todayTasks = this._tasks.filter(t => (t.bucket ?? 'today') === 'today');
    const todayDone  = todayTasks.filter(t => t.done).length;
    const todayTotal = todayTasks.length;
    const pct        = todayTotal === 0 ? 0 : (todayDone / todayTotal) * 100;
    const hasReview  = this._hasStaleForReview();

    return html`
      ${this._renderAddModal()}
      ${this._renderEditModal()}
      ${this._reviewMode ? this._renderReviewWizard() : ''}

      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">To Do</h1>
          <span class="page-subtitle">${this._today}</span>
        </div>
        <div class="header-right">
          ${hasReview ? html`
            <button class="review-trigger-btn" @click=${this._openReview}>Review</button>
          ` : ''}
          <div class="score-pill">
            <div class="score-nums">
              <span class="score-done">${todayDone}</span>
              <span class="score-total">/ ${todayTotal}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="score-label">Today</span>
          </div>
        </div>
      </div>

      ${this._renderTabBar()}

      <div class="lanes">
        ${PEOPLE.map(person => this._renderLane(person))}
      </div>
    `;
  }
}

customElements.define('home-todo', HomeTodo);
