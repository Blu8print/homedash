import { LitElement, html, css } from 'lit';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const WASTE_META = {
  GFT:        { label: 'GFT',   color: '#10b981', bg: '#d1fae5', icon: '♻' },
  PMD:        { label: 'PMD',   color: '#f59e0b', bg: '#fef3c7', icon: '♳' },
  Restafval:  { label: 'Rest',  color: '#6b7280', bg: '#f3f4f6', icon: '🗑' },
  Papier:     { label: 'Paper', color: '#3b82f6', bg: '#dbeafe', icon: '📄' },
  Kerstbomen: { label: 'Kerst', color: '#059669', bg: '#d1fae5', icon: '🎄' },
};

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr) - today) / 86400000);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getMeta(wasteType) {
  const key = Object.keys(WASTE_META).find(k => k.toLowerCase() === wasteType?.toLowerCase());
  return key ? WASTE_META[key] : { label: wasteType, color: '#6b7280', bg: '#f3f4f6', icon: '?' };
}

function badgeText(days) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Out tonight';
  return `in ${days}d`;
}

function badgeClass(days) {
  if (days === 0) return 'pill pill-today';
  if (days === 1) return 'pill pill-soon';
  return 'pill pill-later';
}

export class HomeTrash extends LitElement {
  static properties = {
    _items: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _activeChip: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .card {
      background: var(--color-card);
      border-radius: var(--radius);
      padding: 1rem 1.25rem;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .title {
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .refresh {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      font-size: 0.85rem;
      padding: 0;
      line-height: 1;
    }
    .refresh:hover { color: var(--color-text); }

    /* Primary item */
    .primary {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .icon-badge {
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .info { flex: 1; min-width: 0; }
    .waste-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .date-label {
      font-size: 0.72rem;
      color: var(--color-text-muted);
    }
    .pill {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
      border: 1px solid transparent;
    }
    .pill-today { background: #fef3c7; color: #92400e; border-color: #f0d060; }
    .pill-soon  { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
    .pill-later { background: var(--color-card-alt); color: var(--color-text-muted); border-color: var(--color-border, #e5e7eb); }

    /* Chips row */
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 0.65rem;
      position: relative;
    }
    .chip {
      display: flex;
      align-items: center;
      gap: 4px;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      position: relative;
      user-select: none;
    }
    .chip:active { opacity: 0.75; }

    /* Chip detail row */
    .chip-detail {
      margin-top: 0.4rem;
      font-size: 0.72rem;
      color: var(--color-text-muted);
      padding: 4px 6px;
      background: var(--color-card-alt);
      border-radius: 6px;
    }

    .status {
      font-size: 0.8rem;
      color: var(--color-text-muted);
      text-align: center;
      padding: 0.5rem 0;
    }
  `;

  constructor() {
    super();
    this._items = [];
    this._loading = true;
    this._error = null;
    this._activeChip = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  async _load() {
    this._loading = true;
    this._error = null;
    this._activeChip = null;

    const today = new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/trash_collection?date=gte.${today}&order=date.asc&limit=5`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._items = await res.json();
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
    }
  }

  _getVisible() {
    const pastNoon = new Date().getHours() >= 12;
    // Drop today's item if it's past noon
    return this._items.filter(({ date }) => {
      const days = daysUntil(date);
      return !(days === 0 && pastNoon);
    });
  }

  _toggleChip(index) {
    this._activeChip = this._activeChip === index ? null : index;
  }

  _renderChipDetail(chips) {
    if (this._activeChip === null || this._activeChip >= chips.length) return '';
    const { date, waste_type } = chips[this._activeChip];
    const meta = getMeta(waste_type);
    const days = daysUntil(date);
    return html`<div class="chip-detail">${meta.icon} ${meta.label} — ${formatDate(date)} · ${badgeText(days)}</div>`;
  }

  render() {
    if (this._loading) return html`<div class="card"><div class="status">Loading...</div></div>`;
    if (this._error)   return html`<div class="card"><div class="status">Error: ${this._error}</div></div>`;

    const visible = this._getVisible();
    if (visible.length === 0) return html`<div class="card"><div class="status">No upcoming collections</div></div>`;

    const [primary, ...chips] = visible;
    const primaryMeta = getMeta(primary.waste_type);
    const primaryDays = daysUntil(primary.date);

    return html`
      <div class="card">
        <div class="header">
          <span class="title">Trash</span>
          <button class="refresh" @click=${() => this._load()} title="Refresh">↻</button>
        </div>

        <div class="primary">
          <div class="icon-badge" style="background:${primaryMeta.bg};color:${primaryMeta.color}">
            ${primaryMeta.icon}
          </div>
          <div class="info">
            <div class="waste-label">${primaryMeta.label}</div>
            <div class="date-label">${formatDate(primary.date)}</div>
          </div>
          <span class="${badgeClass(primaryDays)}">${badgeText(primaryDays)}</span>
        </div>

        ${chips.length > 0 ? html`
          <div class="chips">
            ${chips.map(({ date, waste_type }, i) => {
              const meta = getMeta(waste_type);
              return html`
                <div
                  class="chip"
                  style="background:${meta.bg};color:${meta.color};border-color:${meta.color}33"
                  @click=${() => this._toggleChip(i)}
                >
                  ${meta.icon} ${meta.label}
                </div>
              `;
            })}
          </div>
          ${this._renderChipDetail(chips)}
        ` : ''}
      </div>
    `;
  }
}

customElements.define('home-trash', HomeTrash);
