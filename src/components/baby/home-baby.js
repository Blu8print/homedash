import { LitElement, html, css } from 'lit';

const OPENROUTER_KEY = import.meta.env.VITE_OpenRouter_Key;
const DUE_DATE   = new Date('2027-03-19T00:00:00');
const TOTAL_DAYS = 280;

const BABY_SIZE = {
   4: { name: 'Poppy seed',      size: '0.1 cm',  emoji: '🌱' },
   5: { name: 'Apple seed',      size: '0.2 cm',  emoji: '🍏' },
   6: { name: 'Sweet pea',       size: '0.6 cm',  emoji: '🫛' },
   7: { name: 'Blueberry',       size: '1.3 cm',  emoji: '🫐' },
   8: { name: 'Kidney bean',     size: '1.6 cm',  emoji: '🫘' },
   9: { name: 'Grape',           size: '2.3 cm',  emoji: '🍇' },
  10: { name: 'Strawberry',      size: '3.1 cm',  emoji: '🍓' },
  11: { name: 'Lime',            size: '4.1 cm',  emoji: '🍈' },
  12: { name: 'Plum',            size: '5.4 cm',  emoji: '🍑' },
  13: { name: 'Lemon',           size: '7.4 cm',  emoji: '🍋' },
  14: { name: 'Peach',           size: '8.7 cm',  emoji: '🍑' },
  15: { name: 'Apple',           size: '10.1 cm', emoji: '🍎' },
  16: { name: 'Avocado',         size: '11.6 cm', emoji: '🥑' },
  17: { name: 'Pear',            size: '13 cm',   emoji: '🍐' },
  18: { name: 'Bell pepper',     size: '14.2 cm', emoji: '🫑' },
  19: { name: 'Mango',           size: '15.3 cm', emoji: '🥭' },
  20: { name: 'Banana',          size: '25.6 cm', emoji: '🍌' },
  21: { name: 'Carrot',          size: '26.7 cm', emoji: '🥕' },
  22: { name: 'Papaya',          size: '27.8 cm', emoji: '🍈' },
  23: { name: 'Grapefruit',      size: '28.9 cm', emoji: '🍊' },
  24: { name: 'Corn',            size: '30 cm',   emoji: '🌽' },
  25: { name: 'Cauliflower',     size: '34.6 cm', emoji: '🥦' },
  26: { name: 'Cabbage',         size: '35.6 cm', emoji: '🥬' },
  27: { name: 'Rutabaga',        size: '36.6 cm', emoji: '🫚' },
  28: { name: 'Eggplant',        size: '37.6 cm', emoji: '🍆' },
  29: { name: 'Butternut squash', size: '38.6 cm', emoji: '🎃' },
  30: { name: 'Cabbage',         size: '39.9 cm', emoji: '🥬' },
  31: { name: 'Coconut',         size: '41.1 cm', emoji: '🥥' },
  32: { name: 'Squash',          size: '42.4 cm', emoji: '🎃' },
  33: { name: 'Pineapple',       size: '43.7 cm', emoji: '🍍' },
  34: { name: 'Cantaloupe',      size: '45 cm',   emoji: '🍈' },
  35: { name: 'Honeydew melon',  size: '46.2 cm', emoji: '🍈' },
  36: { name: 'Romaine lettuce', size: '47.4 cm', emoji: '🥬' },
  37: { name: 'Leek',            size: '48.6 cm', emoji: '🥗' },
  38: { name: 'Pumpkin',         size: '49.8 cm', emoji: '🎃' },
  39: { name: 'Watermelon',      size: '50.7 cm', emoji: '🍉' },
  40: { name: 'Pumpkin',         size: '51.2 cm', emoji: '🎃' },
};

const MILESTONES = [
  { week: 20, label: 'Halfway there!' },
  { week: 24, label: 'Viability milestone' },
  { week: 28, label: 'Third trimester begins' },
  { week: 32, label: 'Baby settles head-down' },
  { week: 36, label: 'Full-term soon' },
  { week: 37, label: 'Early term' },
  { week: 39, label: 'Full term' },
  { week: 40, label: 'Due date' },
];

function calcBaby() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysLeft     = Math.round((DUE_DATE - today) / 86400000);
  const daysPregnant = TOTAL_DAYS - daysLeft;
  const weeks        = Math.floor(daysPregnant / 7);
  const dayOfWeek    = daysPregnant % 7;
  const pct          = Math.min(100, Math.round(daysPregnant / TOTAL_DAYS * 100));
  const trimester    = weeks < 13 ? 1 : weeks < 27 ? 2 : 3;
  return { daysLeft, daysPregnant, weeks, dayOfWeek, pct, trimester };
}

export class HomeBaby extends LitElement {
  static properties = {
    _babyInfo:    { state: true },
    _babyLoading: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this._loadBabyInfo();
  }

  async _loadBabyInfo() {
    const { weeks, dayOfWeek } = calcBaby();
    const today    = new Date().toISOString().slice(0, 10);
    const cacheKey = `baby-ai-${today}`;

    // Purge stale keys from previous days
    Object.keys(localStorage)
      .filter(k => k.startsWith('baby-ai-') && k !== cacheKey)
      .forEach(k => localStorage.removeItem(k));

    const cached = localStorage.getItem(cacheKey);
    if (cached) { this._babyInfo = cached; this._scheduleMidnightRefresh(); return; }

    this._babyLoading = true;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          max_tokens: 300,
          messages: [{ role: 'user', content: `My wife is ${weeks} weeks and ${dayOfWeek} days pregnant with a girl. Write 3 short paragraphs (no headings, no bullet points) covering: (1) how big she is and what she looks like, (2) what she can perceive — senses, movement, sounds, (3) what's happening developmentally this week. Warm, personal tone. Be concise — max 120 words total.` }],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const text = json.choices?.[0]?.message?.content?.trim() ?? null;
        if (text) {
          this._babyInfo = text;
          localStorage.setItem(cacheKey, text);
          this._scheduleMidnightRefresh();
        }
      }
    } catch (e) {
      console.error('[baby] fetch failed:', e);
    } finally {
      this._babyLoading = false;
    }
  }

  _scheduleMidnightRefresh() {
    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    clearTimeout(this._midnightTimer);
    this._midnightTimer = setTimeout(() => this._loadBabyInfo(), midnight - now);
  }

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

    /* ── Hero grid ── */
    .hero-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .hero-number {
      font-family: var(--font-serif);
      font-size: 3.6rem;
      line-height: 1;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .hero-unit {
      font-size: 1rem;
      color: var(--color-text-muted);
      margin-top: 4px;
    }
    .hero-sub {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin-top: 4px;
    }
    .hero-accent { color: #ec4899; }

    /* ── Progress card ── */
    .progress-card {
      margin-bottom: 16px;
    }
    .progress-track {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .progress-bar-wrap {
      flex: 1;
      height: 10px;
      background: #fce7f3;
      border-radius: 5px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #f9a8d4, #ec4899);
      border-radius: 5px;
      transition: width 0.4s ease;
    }
    .progress-pct {
      font-size: 0.78rem;
      font-weight: 700;
      color: #ec4899;
      white-space: nowrap;
    }
    .trimester-row {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .trimester-chip {
      flex: 1;
      text-align: center;
      padding: 5px 8px;
      border-radius: 8px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: var(--color-card-alt, #f5f0e8);
      color: var(--color-text-muted);
    }
    .trimester-chip.active {
      background: #fce7f3;
      color: #be185d;
    }

    /* ── Bottom grid ── */
    .bottom-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    /* ── Milestones ── */
    .milestone-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .milestone-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 0;
      border-bottom: 1px solid var(--color-border, #e5e7eb);
      position: relative;
    }
    .milestone-item:last-child { border-bottom: none; }
    .milestone-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #fce7f3;
      border: 2px solid #f9a8d4;
      flex-shrink: 0;
    }
    .milestone-dot.done {
      background: #ec4899;
      border-color: #ec4899;
    }
    .milestone-dot.next {
      background: #fff;
      border-color: #ec4899;
      box-shadow: 0 0 0 3px #fce7f3;
    }
    .milestone-body { flex: 1; }
    .milestone-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .milestone-item.done .milestone-label {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }
    .milestone-week {
      font-size: 0.68rem;
      color: var(--color-text-muted);
      margin-top: 1px;
    }
    .milestone-badge {
      font-size: 0.62rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: #fce7f3;
      color: #be185d;
    }

    /* ── Size card ── */
    .baby-hero-img {
      display: block;
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 16px;
      background: #fce7f3;
      margin: 0 auto 8px;
    }
    .size-emoji {
      font-size: 4rem;
      line-height: 1;
      text-align: center;
      padding: 16px 0 8px;
    }
    .size-name {
      font-family: var(--font-serif);
      font-size: 1.3rem;
      text-align: center;
      color: var(--color-text);
    }
    .size-length {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      text-align: center;
      margin-top: 4px;
    }
    .size-desc {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      text-align: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border, #e5e7eb);
      line-height: 1.5;
    }

    /* ── AI stage info ── */
    .stage-card {
      margin-bottom: 16px;
    }
    .stage-body {
      font-size: 0.85rem;
      line-height: 1.65;
      color: var(--color-text);
    }
    .stage-body p {
      margin: 0 0 0.75em;
    }
    .stage-body p:last-child { margin-bottom: 0; }
    .stage-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.78rem;
      color: var(--color-text-muted);
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50%       { opacity: 1;   }
    }
    .stage-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #ec4899;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .stage-dot:nth-child(2) { animation-delay: 0.2s; }
    .stage-dot:nth-child(3) { animation-delay: 0.4s; }
  `;

  render() {
    const { daysLeft, weeks, dayOfWeek, pct, trimester } = calcBaby();
    const size = BABY_SIZE[weeks] ?? BABY_SIZE[40];
    const nextMilestone = MILESTONES.find(m => m.week > weeks);

    return html`
      <!-- Hero stats -->
      <div class="hero-grid">
        <div class="card">
          <div class="card-label">Week</div>
          <img class="baby-hero-img" src="/baby.svg" alt="Baby" />
          <div class="hero-number">${weeks}<span style="font-size:1.5rem;margin-left:4px;color:#ec4899">${dayOfWeek > 0 ? `+${dayOfWeek}` : ''}</span></div>
          <div class="hero-unit">of 40 weeks</div>
          <div class="hero-sub">Trimester ${trimester}</div>
        </div>
        <div class="card">
          <div class="card-label">Days to go</div>
          <div class="hero-number hero-accent">${daysLeft}</div>
          <div class="hero-unit">days remaining</div>
          ${nextMilestone ? html`<div class="hero-sub">Next: Week ${nextMilestone.week}</div>` : ''}
        </div>
        <div class="card">
          <div class="card-label">Baby is the size of a…</div>
          <div class="size-emoji">${size.emoji}</div>
          <div class="size-name">${size.name}</div>
          <div class="size-length">${size.length ?? size.size}</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="card progress-card">
        <div class="card-label">Pregnancy progress</div>
        <div class="progress-track">
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="progress-pct">${pct}%</div>
        </div>
        <div class="trimester-row">
          <div class="trimester-chip ${trimester === 1 ? 'active' : ''}">T1 · Wk 1–12</div>
          <div class="trimester-chip ${trimester === 2 ? 'active' : ''}">T2 · Wk 13–26</div>
          <div class="trimester-chip ${trimester === 3 ? 'active' : ''}">T3 · Wk 27–40</div>
        </div>
      </div>

      <!-- AI stage info -->
      <div class="card stage-card">
        <div class="card-label">Week ${weeks}${dayOfWeek > 0 ? ` + ${dayOfWeek} days` : ''} — what's happening</div>
        ${this._babyLoading ? html`
          <div class="stage-loading">
            <div class="stage-dot"></div>
            <div class="stage-dot"></div>
            <div class="stage-dot"></div>
            <span>Loading…</span>
          </div>
        ` : this._babyInfo ? html`
          <div class="stage-body">
            ${this._babyInfo.split(/\n+/).filter(p => p.trim()).map(p => html`<p>${p}</p>`)}
          </div>
        ` : html`<div class="stage-loading"><span>Could not load — check console</span></div>`}
      </div>

      <!-- Milestones -->
      <div class="bottom-grid">
        <div class="card">
          <div class="card-label">Milestones</div>
          <div class="milestone-list">
            ${MILESTONES.map(m => {
              const done = weeks > m.week;
              const next = !done && weeks === m.week || (!done && m === nextMilestone);
              return html`
                <div class="milestone-item ${done ? 'done' : ''}">
                  <div class="milestone-dot ${done ? 'done' : next ? 'next' : ''}"></div>
                  <div class="milestone-body">
                    <div class="milestone-label">${m.label}</div>
                    <div class="milestone-week">Week ${m.week}</div>
                  </div>
                  ${next ? html`<span class="milestone-badge">Next</span>` : ''}
                  ${done ? html`<span style="font-size:0.9rem">✓</span>` : ''}
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('home-baby', HomeBaby);
