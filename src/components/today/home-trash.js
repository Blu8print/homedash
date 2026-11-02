import { LitElement, html, css } from 'lit';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const WASTE_META = {
  GFT:       { label: 'GFT',    color: '#10b981', bg: '#d1fae5', icon: '♻' },
  PMD:       { label: 'PMD',    color: '#f59e0b', bg: '#fef3c7', icon: '♳' },
  Restafval: { label: 'Rest',   color: '#6b7280', bg: '#f3f4f6', icon: '\uD83D\uDDD1' },
  Papier:    { label: 'Papier', color: '#3b82f6', bg: '#dbeafe', icon: '\uD83D\uDCC4' },
  Kerstbomen:{ label: 'Kerst',  color: '#059669', bg: '#d1fae5', icon: '\uD83C\uDF84' },
};

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(date) - today) / 86400000);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export class HomeTrash extends LitElement {
  static properties = {
    _items: { state: true },
    _loading: { state: true },
    _error: { state: true },
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
    .items {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .badge {
      width: 2rem;
      height: 2rem;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .info { flex: 1; min-width: 0; }
    .waste-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .date-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      text-transform: capitalize;
    }
    .days-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
    }
    .days-today { background: #fef3c7; color: #92400e; }
    .days-soon  { background: #dbeafe; color: #1e40af; }
    .days-later { background: var(--color-card-alt); color: var(--color-text-muted); }
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
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  async _load() {
    this._loading = true;
    this._error = null;

    const today = new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/trash_collection?date=gte.${today}&order=date.asc&limit=6`,
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

  _pillClass(days) {
    if (days === 0) return 'days-pill days-today';
    if (days <= 3) return 'days-pill days-soon';
    return 'days-pill days-later';
  }

  _pillLabel(days) {
    if (days === 0) return 'Vandaag';
    if (days === 1) return 'Morgen';
    return `${days}d`;
  }

  render() {
    return html`
      <div class="card">
        <div class="header">
          <span class="title">Afval</span>
          <button class="refresh" @click=${() => this._load()} title="Verversen">↻</button>
        </div>
        ${this._loading
          ? html`<div class="status">Laden...</div>`
          : this._error
            ? html`<div class="status">Fout: ${this._error}</div>`
            : this._items.length === 0
              ? html`<div class="status">Geen ophaaldata gevonden</div>`
              : html`
                <div class="items">
                  ${this._items.map(({ date, waste_type }) => {
                    const meta = WASTE_META[waste_type] ?? { label: waste_type, color: '#6b7280', bg: '#f3f4f6', icon: '?' };
                    const days = daysUntil(date);
                    return html`
                      <div class="item">
                        <div class="badge" style="background:${meta.bg};color:${meta.color}">
                          ${meta.icon}
                        </div>
                        <div class="info">
                          <div class="waste-label">${meta.label}</div>
                          <div class="date-label">${formatDate(date)}</div>
                        </div>
                        <span class="${this._pillClass(days)}">${this._pillLabel(days)}</span>
                      </div>
                    `;
                  })}
                </div>
              `
        }
      </div>
    `;
  }
}

customElements.define('home-trash', HomeTrash);
