import { LitElement, html, css } from 'lit';

const WEBHOOK_URL  = 'https://automation.whiterabbit.earth/webhook/0fc8915f-c932-4fd0-a7b9-be0eb31e302d';
const HEADER_NAME  = import.meta.env.VITE_BUDGET_API_KEY;
const HEADER_VALUE = import.meta.env.VITE_BUDGET_API_HEADER;

export class HomeBudget extends LitElement {
  static properties = {
    _items:   { state: true },
    _loading: { state: true },
    _error:   { state: true },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 32px;
      box-sizing: border-box;
      font-family: var(--font-sans);
      overflow-y: auto;
    }

    h1 {
      font-family: var(--font-serif);
      font-size: 2rem;
      margin: 0 0 4px;
      color: #1a1a1a;
    }

    .subtitle {
      font-size: 0.75rem;
      color: #9ca3af;
      margin: 0 0 28px;
    }

    .error {
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: var(--radius, 12px);
      padding: 16px;
    }

    .loading { color: #6b7280; }

    /* ── Summary totals ── */
    .totals {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .total-card {
      background: var(--color-card, #fff);
      border-radius: var(--radius, 12px);
      padding: 16px 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }

    .total-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 4px;
    }

    .total-value {
      font-family: var(--font-serif);
      font-size: 1.5rem;
      color: #1a1a1a;
    }

    .total-value.green  { color: #10b981; }
    .total-value.amber  { color: #f59e0b; }
    .total-value.red    { color: #ef4444; }

    /* ── Group section ── */
    .group {
      background: var(--color-card, #fff);
      border-radius: var(--radius, 12px);
      padding: 20px 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      margin-bottom: 16px;
    }

    .group-header {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 16px;
    }

    /* ── Category row ── */
    .cat-row {
      display: grid;
      grid-template-columns: 180px 1fr 72px;
      align-items: center;
      gap: 14px;
      margin-bottom: 12px;
    }

    .cat-row:last-child { margin-bottom: 0; }

    .cat-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bar-track {
      height: 22px;
      background: #f3f4f6;
      border-radius: 6px;
      position: relative;
      overflow: hidden;
    }

    /* full budget width = 100%; spent overlaid on top */
    .bar-budget {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: #dbeafe;
      border-radius: 6px;
      transition: width 0.5s ease;
    }

    .bar-spent {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      background: #3b82f6;
      border-radius: 6px;
      transition: width 0.5s ease;
    }

    .bar-spent.overspent { background: #ef4444; }

    .cat-balance {
      font-size: 0.8rem;
      font-weight: 700;
      text-align: right;
      color: #10b981;
    }

    .cat-balance.overspent { color: #ef4444; }
    .cat-balance.zero      { color: #9ca3af; }

    /* legend */
    .legend {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.7rem;
      color: #6b7280;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._fetch();
  }

  async _fetch() {
    this._loading = true;
    this._error   = null;
    try {
      const headers = {};
      if (HEADER_NAME && HEADER_VALUE) headers[HEADER_NAME] = HEADER_VALUE;
      const res = await fetch(WEBHOOK_URL, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this._items = Array.isArray(json) ? json : [json];
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
    }
  }

  _groups(items) {
    const map = new Map();
    for (const item of items) {
      const g = item.category_group_name;
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(item);
    }
    return map;
  }

  _renderGroup(groupName, items) {
    return html`
      <div class="group">
        <div class="group-header">${groupName}</div>
        ${items.map(item => {
          const budgeted  = item.budgeted_currency ?? 0;
          const spent     = Math.abs(item.activity_currency ?? 0);
          const balance   = item.balance_currency ?? 0;
          const overspent = balance < 0;

          const spentPct = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;

          return html`
            <div class="cat-row">
              <span class="cat-name">${item.name}</span>
              <div class="bar-track">
                <div class="bar-budget" style="width:100%"></div>
                <div class="bar-spent ${overspent ? 'overspent' : ''}" style="width:${spentPct}%"></div>
              </div>
              <span class="cat-balance ${overspent ? 'overspent' : balance === 0 ? 'zero' : ''}">
                ${item.balance_formatted ?? `€${balance}`}
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }

  render() {
    if (this._loading) return html`<h1>Budget</h1><p class="loading">Loading…</p>`;
    if (this._error)   return html`<h1>Budget</h1><div class="error">Fetch failed: ${this._error}</div>`;

    const items       = this._items;
    const totalBudget = items.reduce((s, i) => s + (i.budgeted_currency ?? 0), 0);
    const totalSpent  = items.reduce((s, i) => s + Math.abs(i.activity_currency ?? 0), 0);
    const totalLeft   = items.reduce((s, i) => s + (i.balance_currency ?? 0), 0);
    const groups      = this._groups(items);

    const fmt = v => `€${Math.abs(v).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return html`
      <h1>Budget</h1>
      <p class="subtitle">YNAB · current month</p>

      <div class="totals">
        <div class="total-card">
          <div class="total-label">Budgeted</div>
          <div class="total-value">${fmt(totalBudget)}</div>
        </div>
        <div class="total-card">
          <div class="total-label">Spent</div>
          <div class="total-value amber">${fmt(totalSpent)}</div>
        </div>
        <div class="total-card">
          <div class="total-label">Remaining</div>
          <div class="total-value ${totalLeft < 0 ? 'red' : 'green'}">${fmt(totalLeft)}</div>
        </div>
      </div>

      <div class="legend">
        <div class="legend-item">
          <div class="legend-dot" style="background:#dbeafe"></div> Budgeted
        </div>
        <div class="legend-item">
          <div class="legend-dot" style="background:#3b82f6"></div> Spent
        </div>
      </div>

      ${[...groups.entries()].map(([name, cats]) => this._renderGroup(name, cats))}
    `;
  }
}

customElements.define('home-budget', HomeBudget);
