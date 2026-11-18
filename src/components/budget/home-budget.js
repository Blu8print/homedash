import { LitElement, html, css } from 'lit';
import { supabase } from '../../lib/supabase.js';

const fmt = v => Number(v).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export class HomeBudget extends LitElement {
  static properties = {
    _lines:     { state: true },
    _summary:   { state: true },
    _periods:   { state: true },
    _periodKey: { state: true },
    _loading:   { state: true },
    _error:     { state: true },
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
      gap: 20px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    h1 {
      font-family: var(--font-serif);
      font-size: 2rem;
      margin: 0 0 4px;
      color: #1a1a1a;
    }

    .subtitle {
      font-size: 1.1rem;
      font-weight: 600;
      color: #6b7280;
      margin: 0;
    }

    .period-select {
      font-family: var(--font-sans);
      font-size: 0.8rem;
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: var(--color-card, #fff);
      color: #374151;
      cursor: pointer;
      flex-shrink: 0;
    }

    /* ── Warnings ── */
    .warn {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: var(--radius, 12px);
      padding: 10px 16px;
      font-size: 0.8rem;
      color: #92400e;
    }

    .error {
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: var(--radius, 12px);
      padding: 16px;
    }

    .loading { color: #6b7280; }

    /* ── Summary cards ── */
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .sum-card {
      background: var(--color-card, #fff);
      border-radius: var(--radius, 12px);
      padding: 14px 18px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }

    .sum-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 4px;
    }

    .sum-value {
      font-family: var(--font-serif);
      font-size: 1.35rem;
      color: #1a1a1a;
      line-height: 1.1;
    }

    .sum-sub {
      font-size: 0.7rem;
      color: #9ca3af;
      margin-top: 2px;
    }

    .sum-value.green { color: #10b981; }
    .sum-value.red   { color: #ef4444; }

    /* ── Category list ── */
    .cats {
      background: var(--color-card, #fff);
      border-radius: var(--radius, 12px);
      padding: 20px 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .cat-row {
      display: grid;
      grid-template-columns: 200px 1fr 90px;
      align-items: center;
      gap: 14px;
    }

    .cat-meta {
      display: flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
    }

    .cat-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: #e0e7ff;
      color: #4338ca;
      border-radius: 4px;
      padding: 1px 5px;
      flex-shrink: 0;
    }

    /* ── Progress bar ── */
    .bar-track {
      height: 20px;
      background: #f3f4f6;
      border-radius: 6px;
      position: relative;
      overflow: visible;
    }

    .bar-fill {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      border-radius: 6px;
      transition: width 0.4s ease;
    }

    .bar-fill.green  { background: #10b981; }
    .bar-fill.orange { background: #f59e0b; }
    .bar-fill.red    { background: #ef4444; }

    /* pace marker — thin line, overflows track slightly */
    .pace-mark {
      position: absolute;
      top: -3px;
      bottom: -3px;
      width: 2px;
      background: #6b7280;
      border-radius: 2px;
      transform: translateX(-50%);
      pointer-events: none;
    }

    .cat-remaining {
      font-size: 0.8rem;
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
    }

    .cat-remaining.green { color: #10b981; }
    .cat-remaining.red   { color: #ef4444; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._init();
    this._timer = setInterval(() => this._fetchPeriod(), 15 * 60 * 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._timer);
  }

  async _init() {
    this._loading = true;
    this._error = null;
    try {
      const { data: periods } = await supabase
        .from('period_summary')
        .select('period_key, period_start, period_end, is_current')
        .order('period_start', { ascending: false });
      this._periods = periods ?? [];
      const cur = periods?.find(p => p.is_current);
      this._periodKey = cur?.period_key ?? periods?.[0]?.period_key ?? null;
      await this._fetchPeriod();
    } catch (e) {
      this._error = e.message;
      this._loading = false;
    }
  }

  async _fetchPeriod() {
    if (!this._periodKey) return;
    this._loading = true;
    this._error = null;
    try {
      const [linesRes, summaryRes] = await Promise.all([
        supabase.from('budget_overview').select('*').eq('period_key', this._periodKey).order('sort_order'),
        supabase.from('period_summary').select('*').eq('period_key', this._periodKey),
      ]);
      this._lines = linesRes.data ?? [];
      this._summary = summaryRes.data?.[0] ?? null;
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
    }
  }

  _onPeriodChange(e) {
    this._periodKey = e.target.value;
    this._fetchPeriod();
  }

  render() {
    if (this._loading && !this._lines) return html`<h1>Budget</h1><p class="loading">Loading…</p>`;
    if (this._error) return html`<h1>Budget</h1><div class="error">${this._error}</div>`;

    const s = this._summary;
    const HIDDEN = new Set(['Bank costs', 'Taxes & debts', 'Subscriptions']);
    const lines = (this._lines ?? []).filter(l => !HIDDEN.has(l.category));
    const pace = s ? Number(s.days_elapsed) / Number(s.days) : 0;

    const dateOpts = { day: 'numeric', month: 'long' };
    const periodLabel = s
      ? `${new Date(s.period_start).toLocaleDateString('en-GB', dateOpts)} – ${new Date(s.period_end).toLocaleDateString('en-GB', dateOpts)}`
      : '';

    return html`
      <div class="header">
        <div>
          <h1>Budget</h1>
          <p class="subtitle">
            ${periodLabel}${s ? html` · day ${s.days_elapsed} of ${s.days}` : ''}
          </p>
        </div>
        ${(this._periods?.length ?? 0) > 1 ? html`
          <select class="period-select" @change=${this._onPeriodChange}>
            ${this._periods.map(p => html`
              <option value=${p.period_key} ?selected=${p.period_key === this._periodKey}>
                ${new Date(p.period_start).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}${p.is_current ? ' ·' : ''}
              </option>
            `)}
          </select>
        ` : ''}
      </div>

      ${s && Number(s.uncategorised) > 0 ? html`
        <div class="warn">⚠ ${s.uncategorised} transaction${Number(s.uncategorised) > 1 ? 's' : ''} without a category</div>
      ` : ''}


      <div class="cats">
        ${lines.map(line => {
          const budget    = Number(line.budget);
          const spent     = Number(line.spent);
          const remaining = Number(line.remaining);
          const pctUsed   = Number(line.pct_used);
          const overspent = remaining < 0;
          const ahead     = !overspent && pctUsed > pace * 100;
          const color     = overspent ? 'red' : ahead ? 'orange' : 'green';
          const barWidth  = Math.min(Math.max(pctUsed, 0), 100);

          return html`
            <div class="cat-row">
              <div class="cat-meta">
                <span class="cat-name">${line.category}</span>
                ${line.fixed ? html`<span class="badge">fixed</span>` : ''}
              </div>
              <div class="bar-track">
                <div class="bar-fill ${color}" style="width:${barWidth}%"></div>
                <div class="pace-mark" style="left:${(pace * 100).toFixed(1)}%"></div>
              </div>
              <span class="cat-remaining ${overspent ? 'red' : 'green'}">
                ${overspent ? '−' : ''}${fmt(Math.abs(remaining))}
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }
}

customElements.define('home-budget', HomeBudget);
