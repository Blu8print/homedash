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
  // ISO week: Monday-based; returns "YYYY-WNN"
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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

export class HomeTodo extends LitElement {
  static properties = {
    _tasks:       { state: true },
    _loading:     { state: true },
    _dragOver:    { state: true },
    _dragId:      { state: true },
    _modal:            { state: true },
    _modalEmoji:       { state: true },
    _modalStars:       { state: true },
    _modalRecurrence:  { state: true },
    _editTask:         { state: true },
    _editName:         { state: true },
    _editEmoji:        { state: true },
    _editStars:        { state: true },
    _editRecurrence:   { state: true },
    _colors:      { state: true },
    _dropTarget:  { state: true },
    _weekScores:  { state: true },
    _today:       { state: true },
  };

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 1.75rem 2.5rem;
      gap: 1.25rem;
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
      margin-bottom: 12px;
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

    .color-dot:hover {
      transform: scale(1.2);
      border-color: white;
    }

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

    /* ── Task list ── */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      overflow-y: auto;
      padding-right: 2px;
    }

    .task-list::-webkit-scrollbar { width: 4px; }
    .task-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }

    /* incomplete card */
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
      opacity: 0.8;
      cursor: grab;
    }

    .task-card.overdue {
      border-color: #ef4444;
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

    .task-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #1f2937;
      line-height: 1.3;
    }

    .task-name.done { text-decoration: line-through; color: #9ca3af; }

    .task-hearts {
      font-size: 0.68rem;
      font-weight: 600;
      color: #e11d48;
      margin-top: 3px;
    }

    .task-hearts.done { text-decoration: line-through; color: #f9a8d4; }

    .overdue-label {
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #ef4444;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .done-label {
      font-size: 0.72rem;
      font-weight: 500;
      color: #9ca3af;
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

    /* ── Add task row ── */
    .add-btn {
      width: 100%;
      margin-top: 10px;
      padding: 11px 16px;
      border-radius: 16px;
      border: 2px dashed #d6d3ce;
      background: none;
      color: #78716c;
      font-family: var(--font-sans);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s;
      flex-shrink: 0;
    }

    .add-btn:hover { border-color: #a8a29e; background: rgba(214,211,206,0.25); }

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
      width: 380px;
      max-width: calc(100vw - 2rem);
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

    .recur-badge {
      font-size: 0.75rem;
      color: #6366f1;
      margin-left: 4px;
      vertical-align: middle;
    }

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
      transition: border-color 0.1s, background 0.1s, color 0.1s;
    }

    .recur-btn.selected {
      border-color: #6366f1;
      background: #eef2ff;
      color: #4338ca;
    }

    .loading {
      text-align: center;
      padding: 3rem;
      color: #9ca3af;
      font-size: 0.85rem;
    }
  `;

  constructor() {
    super();
    this._tasks      = [];
    this._loading    = true;
    this._dragOver   = null;
    this._dragId     = null;
    this._modal      = null;
    this._modalEmoji = '📝';
    this._modalStars       = 0;
    this._modalRecurrence  = 'none';
    this._editTask         = null;
    this._editName         = '';
    this._editEmoji        = '📝';
    this._editStars        = 0;
    this._editRecurrence   = 'none';
    this._dropTarget   = null;
    this._weekScores   = {};
    this._today        = formatToday();
    this._colors = {
      mariaelena: localStorage.getItem('lane-color-mariaelena') || '#EB337F',
      sebastiaan:  localStorage.getItem('lane-color-sebastiaan')  || '#3A7CF8',
    };
  }

  _setColor(personKey, color) {
    this._colors = { ...this._colors, [personKey]: color };
    localStorage.setItem(`lane-color-${personKey}`, color);
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
    this._loadWeekScores();
    this._subscribe();
    this._scheduleMidnight();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._channel?.unsubscribe();
    this._scoresChannel?.unsubscribe();
    clearTimeout(this._midnightTimer);
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

  _scheduleMidnight() {
    this._midnightTimer = setTimeout(() => {
      this._midnightCleanup();
      this._today = formatToday();
      this._scheduleMidnight(); // reschedule for next midnight
    }, msUntilMidnight());
  }

  async _midnightCleanup() {
    const now = new Date();
    const doneTasks = this._tasks.filter(t => t.done);
    if (!doneTasks.length) return;

    const toDelete  = [];
    const toReset   = [];

    for (const task of doneTasks) {
      const r = task.recurrence ?? 'none';
      if (r === 'none') {
        toDelete.push(task);
      } else if (r === 'daily') {
        toReset.push(task);
      } else if (r === 'weekly' && now.getDay() === 1) { // Monday
        toReset.push(task);
      } else if (r === 'monthly' && now.getDate() === 1) {
        toReset.push(task);
      } else if (r === 'yearly' && now.getMonth() === 0 && now.getDate() === 1) {
        toReset.push(task);
      }
      // else: recurring but not reset night — leave as done
    }

    if (toDelete.length) {
      this._tasks = this._tasks.filter(t => !toDelete.find(d => d.id === t.id));
      await supabase.from('todos').delete().in('id', toDelete.map(t => t.id));
    }
    if (toReset.length) {
      this._tasks = this._tasks.map(t =>
        toReset.find(r => r.id === t.id) ? { ...t, done: false, completed_at: null } : t
      );
      await Promise.all(toReset.map(t =>
        supabase.from('todos').update({ done: false, completed_at: null }).eq('id', t.id)
      ));
    }
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

  async _toggle(task) {
    const done = !task.done;
    const completed_at = done ? new Date().toISOString() : null;
    this._tasks = this._tasks.map(t => t.id === task.id ? { ...t, done, completed_at } : t);
    await supabase.from('todos').update({ done, completed_at }).eq('id', task.id);

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

  // ── Edit modal ──

  _openEdit(task) {
    this._editTask       = task;
    this._editName       = task.name;
    this._editEmoji      = task.emoji ?? '📝';
    this._editStars      = task.stars ?? 0;
    this._editRecurrence = task.recurrence ?? 'none';
  }

  async _saveEdit() {
    const task = this._editTask;
    this._editTask = null;
    const patch = { name: this._editName, emoji: this._editEmoji, stars: this._editStars || null, recurrence: this._editRecurrence };
    this._tasks = this._tasks.map(t => t.id === task.id ? { ...t, ...patch } : t);
    await supabase.from('todos').update(patch).eq('id', task.id);
  }

  async _deleteEdit() {
    const task = this._editTask;
    this._editTask = null;
    this._tasks = this._tasks.filter(t => t.id !== task.id);
    await supabase.from('todos').delete().eq('id', task.id);
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
    e.stopPropagation(); // don't bubble to lane dragover
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    this._dropTarget  = { taskId: task.id, before };
    this._dragOver    = null; // suppress lane highlight during card-level drag
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

    // Build reordered target lane (without drag task)
    const laneTasks = this._tasks
      .filter(t => t.person === newPerson && t.id !== dragId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const insertIdx = laneTasks.findIndex(t => t.id === targetTask.id);
    const at = before ? insertIdx : insertIdx + 1;
    laneTasks.splice(at, 0, { ...dragTask, person: newPerson });

    // Optimistic update: tasks not involved + reordered lane
    const unchanged = this._tasks.filter(t => t.person !== newPerson && t.id !== dragId);
    this._tasks = [
      ...unchanged,
      ...laneTasks.map((t, i) => ({ ...t, sort_order: i, person: newPerson })),
    ];

    // DB writes
    this._ignoreNext = true;
    await Promise.all(laneTasks.map((t, i) =>
      supabase.from('todos').update({ sort_order: i, person: newPerson }).eq('id', t.id)
    ));
  }

  // ── Add task modal ──

  _openAddModal(person, name) {
    if (!name.trim()) return;
    this._modal           = { person, name: name.trim() };
    this._modalEmoji      = '📝';
    this._modalStars      = 0;
    this._modalRecurrence = 'none';
  }

  async _confirmModal() {
    const { person, name } = this._modal;
    this._modal = null;
    const maxOrder = this._tasks
      .filter(t => t.person === person)
      .reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
    const { data } = await supabase
      .from('todos')
      .insert({ person, name, emoji: this._modalEmoji, stars: this._modalStars || null, recurrence: this._modalRecurrence, sort_order: maxOrder + 1 })
      .select().single();
    if (data) this._tasks = [...this._tasks, data];
  }

  _onAddKey(e, person) {
    if (e.key === 'Enter') {
      this._openAddModal(person, e.target.value);
      e.target.value = '';
    }
    if (e.key === 'Escape') this._expandedAdd = null;
  }

  // ── Render modals ──

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
          ${this._renderRecurrencePicker(this._editRecurrence, v => { this._editRecurrence = v; })}
          <div class="modal-actions">
            <button class="btn-delete" @click=${this._deleteEdit}>Delete</button>
            <button class="btn-cancel" @click=${() => { this._editTask = null; }}>Cancel</button>
            <button class="btn-save" @click=${this._saveEdit}>Save</button>
          </div>
        </div>
      </div>
    `;
  }

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
          ${this._renderRecurrencePicker(this._modalRecurrence, v => { this._modalRecurrence = v; })}
          <div class="modal-actions">
            <button class="btn-cancel" @click=${() => { this._modal = null; }}>Cancel</button>
            <button class="btn-save" @click=${this._confirmModal}>Add task</button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this._loading) return html`<div class="loading">Loading…</div>`;

    const total = this._tasks.length;
    const done  = this._tasks.filter(t => t.done).length;
    const pct   = total === 0 ? 0 : (done / total) * 100;

    return html`
      ${this._renderAddModal()}
      ${this._renderEditModal()}

      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">To Do</h1>
          <span class="page-subtitle">${this._today}</span>
        </div>
        <div class="score-pill">
          <div class="score-nums">
            <span class="score-done">${done}</span>
            <span class="score-total">/ ${total}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="score-label">Done</span>
        </div>
      </div>

      <div class="lanes">
        ${PEOPLE.map(person => {
          const tasks       = this._tasks.filter(t => t.person === person.key)
                              .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
          const laneDone    = tasks.filter(t => t.done).length;
          const totalHearts = this._weekHeartsFor(person.key);
          const color       = this._colors[person.key] ?? person.defaultColor;

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
                  <div class="lane-sub">
                    ${person.subtitle ?? `${laneDone} of ${tasks.length} completed`}
                  </div>
                </div>
                ${person.key !== 'anyone' ? html`
                  <div class="color-pick-wrap" title="Change color">
                    <div class="color-dot" style="background:${color}"></div>
                    <input class="color-input" type="color" .value=${color}
                      @input=${e => this._setColor(person.key, e.target.value)}
                    />
                  </div>
                ` : ''}
                <div class="ratio-pill">${laneDone}/${tasks.length}</div>
              </div>

              <!-- Tasks -->
              <div class="task-list">
                ${tasks.map(task => {
                  const isOverdue = !task.done && task.created_at &&
                    (Date.now() - new Date(task.created_at).getTime()) > 7 * 24 * 60 * 60 * 1000;
                  return html`
                  <div
                    class="task-card
                      ${task.done ? 'done-card' : ''}
                      ${isOverdue ? 'overdue' : ''}
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
                      <div class="task-name ${task.done ? 'done' : ''}">
                        ${task.name}
                        ${task.recurrence && task.recurrence !== 'none' ? html`<span class="recur-badge">↻</span>` : ''}
                      </div>
                      ${isOverdue ? html`<div class="overdue-label">Overdue</div>` : ''}
                      ${task.stars
                        ? html`<div class="task-hearts ${task.done ? 'done' : ''}">${'♥'.repeat(task.stars)} ${task.stars}</div>` : ''}
                    </div>
                    <button class="check-box ${task.done ? 'checked' : ''}"
                      @click=${e => { e.stopPropagation(); this._toggle(task); }}
                    >${task.done ? html`<svg width="12" height="12" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                    </button>
                  </div>`;
                })}
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
        })}
      </div>
    `;
  }
}

customElements.define('home-todo', HomeTodo);
