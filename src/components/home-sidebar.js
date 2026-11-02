import { LitElement, html, css } from 'lit';

const NAV_ITEMS = [
  { hash: 'today',    label: 'Today',    icon: '⌂' },
  { hash: 'calendar', label: 'Calendar', icon: '◫' },
  { hash: 'todo',     label: 'ToDo',     icon: '✓' },
  { hash: 'shopping', label: 'Shopping', icon: '⊟' },
  { hash: 'budget',   label: 'Budget',   icon: '$' },
  { hash: 'baby',     label: 'Baby',     icon: null, img: '/baby.svg' },
];

export class HomeSidebar extends LitElement {
  static properties = {
    active:    { type: String },
    _syncing:  { state: true },
    _time:     { state: true },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width, 80px);
      background: var(--color-sidebar, #1a1a1a);
      color: var(--color-sidebar-text, #fff);
      height: 100vh;
      flex-shrink: 0;
    }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 16px 8px;
      flex: 1;
    }

    a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 4px;
      border-radius: 10px;
      text-decoration: none;
      color: rgba(255,255,255,0.45);
      font-family: var(--font-sans);
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      transition: background 0.15s, color 0.15s;
    }

    a:hover {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.8);
    }

    a.active {
      background: rgba(255,255,255,0.12);
      color: #fff;
    }

    .icon {
      font-size: 20px;
      line-height: 1;
    }
    .icon-img {
      width: 20px;
      height: 20px;
      object-fit: contain;
      filter: brightness(0) invert(0.45);
    }
    a.active .icon-img, a:hover .icon-img {
      filter: brightness(0) invert(1);
    }

    .bottom {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 8px 16px;
    }

    .icon-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
      padding: 10px 4px;
      border-radius: 10px;
      border: none;
      background: none;
      color: rgba(255,255,255,0.45);
      font-family: var(--font-sans);
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .icon-btn:hover {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.8);
    }

    .icon-btn .icon {
      font-size: 20px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .icon-btn.syncing .icon {
      display: inline-block;
      animation: spin 0.8s linear infinite;
    }

    .clock {
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: rgba(255,255,255,0.45);
      padding: 8px 4px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._tick();
    this._clock = setInterval(() => this._tick(), 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clock);
  }

  _tick() {
    const now = new Date();
    this._time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }

  _sync() {
    this._syncing = true;
    this.dispatchEvent(new CustomEvent('calendar-sync', { bubbles: true, composed: true }));
    setTimeout(() => { this._syncing = false; }, 1500);
  }

  render() {
    return html`
      <nav class="nav">
        ${NAV_ITEMS.map(item => html`
          <a
            href="#${item.hash}"
            class=${this.active === item.hash ? 'active' : ''}
          >
            ${item.img
              ? html`<img class="icon-img" src="${item.img}" alt="${item.label}" />`
              : html`<span class="icon">${item.icon}</span>`}
            ${item.label}
          </a>
        `)}
      </nav>
      <div class="bottom">
        <button class="icon-btn ${this._syncing ? 'syncing' : ''}" @click=${this._sync} title="Sync calendar">
          <span class="icon">↻</span>
          Sync
        </button>
        <div class="clock">${this._time}</div>
      </div>
    `;
  }
}

customElements.define('home-sidebar', HomeSidebar);
