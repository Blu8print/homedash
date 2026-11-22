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
    const cacheKey = `baby-ai-v3-${today}`;

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
          messages: [{ role: 'user', content: `You write a daily note for Sebastiaan and Maria, expecting their daughter.
Today: ${weeks} weeks and ${dayOfWeek} days pregnant. She is about the size of a ${BABY_SIZE[weeks]?.name ?? 'pumpkin'} (${BABY_SIZE[weeks]?.size ?? '51 cm'}).

Write 3–4 warm, flowing sentences (max 100 words) about what is happening with her this week: one real developmental milestone, plus how she moves, senses or reacts.

Make it feel like their life:
- Address them as "you two" or by name (Sebastiaan, Maria); never "your wife" or "mom/dad-to-be".
- When it fits her development, link it to their home: Maria's hands and her natural oils and herbs, Diuna padding through the house, Bilbo in the garden, quiet evenings in Koolwijk.
- Use at most one such personal detail per note, and vary it day to day.
- Tone: gentle, grounded, a little soulful; no clichés or exclamation marks.

Rules: medically accurate for this exact week, metric units only, no advice, no worries or risks, no headings, lists or emoji. Plain text only.` }],
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
      background: #FFF8F8;
      font-family: var(--font-sans, system-ui);
      box-sizing: border-box;
      color: #21191C;
    }

    * { box-sizing: border-box; }

    /* ── Page header ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 28px;
      border-bottom: 1px solid #D8C1C7;
      background: #fff;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #FFECF0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    .header-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #21191C;
      line-height: 1.1;
    }
    .header-sub {
      font-size: 0.75rem;
      color: #534247;
      line-height: 1.2;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .badge-girl {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      border-radius: 999px;
      background: #FFECF0;
      border: 1px solid #FFD9E4;
      color: #8C3B5E;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .header-due {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.78rem;
      color: #534247;
    }

    /* ── Main content ── */
    .content {
      padding: 20px 28px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* ── Cards ── */
    .card {
      background: #fff;
      border: 1px solid #D8C1C7;
      border-radius: 12px;
      padding: 18px 20px;
    }
    .card-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #534247;
      margin-bottom: 8px;
    }

    /* ── Metrics row ── */
    .metrics-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px;
    }
    .metric-card {
      background: #fff;
      border: 1px solid #D8C1C7;
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .trimester-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      background: #FFECF0;
      border: 1px solid #FFD9E4;
      color: #8C3B5E;
      font-size: 0.65rem;
      font-weight: 700;
    }
    .metric-big {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 3rem;
      line-height: 1;
      color: #21191C;
      letter-spacing: -0.02em;
    }
    .metric-big-days {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 3rem;
      line-height: 1;
      color: #8C3B5E;
      letter-spacing: -0.02em;
    }
    .metric-accent {
      font-size: 1.3rem;
      color: #8C3B5E;
      margin-left: 3px;
    }
    .metric-sub {
      font-size: 0.78rem;
      color: #534247;
    }
    .metric-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid #D8C1C7;
    }
    .metric-footer-label { font-size: 0.72rem; color: #534247; }
    .metric-footer-value { font-size: 0.72rem; font-weight: 700; color: #8C3B5E; }
    .metric-footer-mono  { font-size: 0.72rem; font-weight: 600; color: #534247; font-variant-numeric: tabular-nums; }
    .size-emoji-lg {
      font-size: 2.4rem;
      line-height: 1;
    }
    .size-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .size-name-lg {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.4rem;
      color: #21191C;
      line-height: 1.1;
    }

    /* ── Progress ── */
    .progress-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .progress-title {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #534247;
    }
    .progress-title-sub {
      font-size: 0.78rem;
      color: #534247;
      margin-top: 2px;
    }
    .progress-pct {
      font-size: 0.95rem;
      font-weight: 700;
      color: #8C3B5E;
    }
    .progress-track {
      height: 10px;
      border-radius: 5px;
      background: #EEDFE2;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .progress-fill {
      height: 100%;
      background: #8C3B5E;
      border-radius: 5px;
      transition: width 0.4s ease;
    }
    .trimester-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .trimester-chip {
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: #EEDFE2;
      color: #534247;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .trimester-chip.done {
      background: #E8F5E6;
      color: #2A6323;
    }
    .trimester-chip.active {
      background: #FFECF0;
      border: 1px solid #FFD9E4;
      color: #8C3B5E;
    }

    /* ── Split layout ── */
    .split {
      display: grid;
      grid-template-columns: 7fr 5fr;
      gap: 14px;
      align-items: start;
    }

    /* ── Dev card ── */
    .dev-header {
      border-bottom: 1px solid #D8C1C7;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .dev-week-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8C3B5E;
      margin-bottom: 4px;
    }
    .dev-title {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.35rem;
      color: #21191C;
      line-height: 1.2;
    }
    .dev-blocks {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .dev-block {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #FFF0F3;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .dev-block-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #fff;
      border: 1px solid #D8C1C7;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .dev-block-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #21191C;
      margin-bottom: 4px;
    }
    .dev-block-text {
      font-size: 0.78rem;
      line-height: 1.6;
      color: #534247;
      margin: 0;
    }
    .dev-plain {
      font-size: 0.82rem;
      line-height: 1.65;
      color: #21191C;
    }
    .dev-plain p { margin: 0 0 0.6em; }
    .dev-plain p:last-child { margin-bottom: 0; }

    /* ── Loading dots ── */
    .loading {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #534247;
      padding: 8px 0;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; }
      50%       { opacity: 1; }
    }
    .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #8C3B5E;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }

    /* ── Milestones ── */
    .milestones-header {
      border-bottom: 1px solid #D8C1C7;
      padding-bottom: 12px;
      margin-bottom: 4px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }
    .milestones-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #534247;
      margin-bottom: 3px;
    }
    .milestones-title {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.1rem;
      color: #21191C;
    }
    .milestone-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #EEDFE2;
    }
    .milestone-item:last-child { border-bottom: none; }
    .milestone-item.is-next {
      background: #FFF0F3;
      border-radius: 8px;
      padding: 10px 10px;
      margin: 0 -10px;
      border-bottom: none;
    }
    .milestone-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .milestone-icon.done     { background: #E8F5E6; color: #2A6323; }
    .milestone-icon.is-next  { background: #8C3B5E; color: #fff; }
    .milestone-icon.upcoming { background: #EEDFE2; color: #534247; }
    .milestone-body { flex: 1; min-width: 0; }
    .milestone-name {
      font-size: 0.82rem;
      font-weight: 600;
      color: #21191C;
    }
    .milestone-item.done .milestone-name {
      color: #534247;
      text-decoration: line-through;
    }
    .milestone-week-label {
      font-size: 0.68rem;
      color: #534247;
      margin-top: 1px;
    }
    .milestone-week-label.is-next { color: #8C3B5E; }
    .badge-reached {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: #E8F5E6;
      color: #2A6323;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .badge-next {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: #FFECF0;
      border: 1px solid #FFD9E4;
      color: #8C3B5E;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .badge-weeks {
      font-size: 0.68rem;
      color: #534247;
      white-space: nowrap;
      flex-shrink: 0;
    }
  `;

  render() {
    const { daysLeft, weeks, dayOfWeek, pct, trimester } = calcBaby();
    const size          = BABY_SIZE[weeks] ?? BABY_SIZE[40];
    const nextMilestone = MILESTONES.find(m => m.week > weeks);
    const daysToNext    = nextMilestone ? (nextMilestone.week - weeks) * 7 - dayOfWeek : null;

    const paras = this._babyInfo
      ? this._babyInfo.split(/\n+/).map(p => p.trim()).filter(Boolean)
      : [];

    return html`
      <!-- Page header -->
      <header class="page-header">
        <div class="header-brand">
          <div class="header-icon">🌸</div>
          <div>
            <div class="header-title">Nurture</div>
            <div class="header-sub">Pregnancy Overview</div>
          </div>
        </div>
        <div class="header-right">
          <span class="badge-girl">👶 Baby Girl</span>
          <span class="header-due">📅 Due Mar 19, 2027</span>
        </div>
      </header>

      <div class="content">

        <!-- Metric cards -->
        <div class="metrics-row">
          <!-- Week -->
          <div class="metric-card">
            <div class="metric-header">
              <div class="card-label" style="margin:0">Current Week</div>
              <span class="trimester-badge">Trimester ${trimester}</span>
            </div>
            <div class="metric-big">
              ${weeks}<span class="metric-accent">${dayOfWeek > 0 ? `+${dayOfWeek}` : ''}</span>
            </div>
            <div class="metric-sub">days</div>
            <div class="metric-footer">
              <span class="metric-footer-label">of 40 weeks</span>
              <span class="metric-footer-mono">WK ${weeks} / 40</span>
            </div>
          </div>

          <!-- Days to go -->
          <div class="metric-card">
            <div class="metric-header">
              <div class="card-label" style="margin:0">Days to Go</div>
              <span style="font-size:1.1rem">⏱</span>
            </div>
            <div class="metric-big-days">${daysLeft}</div>
            <div class="metric-sub">days remaining</div>
            <div class="metric-footer">
              <span class="metric-footer-label">${nextMilestone ? `Next: Week ${nextMilestone.week}` : 'Almost there!'}</span>
              ${daysToNext != null ? html`<span class="metric-footer-value">In ${daysToNext} days</span>` : ''}
            </div>
          </div>

          <!-- Baby size -->
          <div class="metric-card">
            <div class="metric-header">
              <div class="card-label" style="margin:0">Baby is the size of a</div>
              <span class="metric-footer-mono">${size.size}</span>
            </div>
            <div class="size-row">
              <span class="size-emoji-lg">${size.emoji}</span>
              <span class="size-name-lg">${size.name}</span>
            </div>
            <div class="metric-footer">
              <span class="metric-footer-label">Head to heel length</span>
              <span class="metric-footer-value">${size.size}</span>
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div class="card">
          <div class="progress-top">
            <div>
              <div class="progress-title">Pregnancy Progress</div>
              <div class="progress-title-sub">${trimester === 1 ? 'First' : trimester === 2 ? 'Second' : 'Third'} Trimester</div>
            </div>
            <span class="progress-pct">${pct}% complete</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="trimester-row">
            <div class="trimester-chip ${trimester === 1 ? 'active' : trimester > 1 ? 'done' : ''}">
              <span>T1 · WK 1–12</span>
              ${trimester > 1 ? html`<span>✓</span>` : trimester === 1 ? html`<span>Current</span>` : html`<span>Upcoming</span>`}
            </div>
            <div class="trimester-chip ${trimester === 2 ? 'active' : trimester > 2 ? 'done' : ''}">
              <span>T2 · WK 13–26</span>
              ${trimester > 2 ? html`<span>✓</span>` : trimester === 2 ? html`<span>Current</span>` : html`<span>Upcoming</span>`}
            </div>
            <div class="trimester-chip ${trimester === 3 ? 'active' : ''}">
              <span>T3 · WK 27–40</span>
              ${trimester === 3 ? html`<span>Current</span>` : html`<span>Upcoming</span>`}
            </div>
          </div>
        </div>

        <!-- Split: development + milestones -->
        <div class="split">

          <!-- Development card -->
          <div class="card">
            <div class="dev-header">
              <div class="dev-week-label">Week ${weeks}${dayOfWeek > 0 ? ` + ${dayOfWeek} Days` : ''} — What's Happening</div>
              <div class="dev-title">Your Daughter at ${weeks} Weeks</div>
            </div>

            ${this._babyLoading ? html`
              <div class="loading">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                <span>Loading…</span>
              </div>
            ` : paras.length ? html`
              <div class="dev-plain">${paras.map(p => html`<p>${p}</p>`)}</div>
            ` : html`
              <div class="loading"><span>Could not load — check console</span></div>
            `}
          </div>

          <!-- Milestones card -->
          <div class="card">
            <div class="milestones-header">
              <div>
                <div class="milestones-label">Timeline</div>
                <div class="milestones-title">Key Milestones</div>
              </div>
            </div>

            ${MILESTONES.map(m => {
              const done   = weeks > m.week;
              const isNext = !done && m === nextMilestone;
              const weeksAway = m.week - weeks;
              return html`
                <div class="milestone-item ${done ? 'done' : ''} ${isNext ? 'is-next' : ''}">
                  <div class="milestone-icon ${done ? 'done' : isNext ? 'is-next' : 'upcoming'}">
                    ${done ? '✓' : isNext ? '⚑' : '○'}
                  </div>
                  <div class="milestone-body">
                    <div class="milestone-name">${m.label}</div>
                    <div class="milestone-week-label ${isNext ? 'is-next' : ''}">Week ${m.week}</div>
                  </div>
                  ${done    ? html`<span class="badge-reached">Reached</span>` : ''}
                  ${isNext  ? html`<span class="badge-next">Next</span>` : ''}
                  ${!done && !isNext ? html`<span class="badge-weeks">${weeksAway} wks</span>` : ''}
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
