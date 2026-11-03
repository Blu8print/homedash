import { LitElement, html, css } from 'lit';

const SCALE_KEY = 'dashboard-scale';
const DEFAULT_SCALE = 1.0;

export class HomeSettings extends LitElement {
  static properties = {
    open:   { type: Boolean, reflect: true },
    _scale: { state: true },
    _info:  { state: true },
  };

  static styles = css`
    :host {
      display: none;
    }
    :host([open]) {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 9999;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
    }

    .modal {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--color-card, #fff);
      border-radius: var(--radius, 12px);
      padding: 32px;
      width: min(520px, 90vw);
      box-shadow: 0 24px 60px rgba(0,0,0,0.3);
      font-family: var(--font-sans);
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header h2 {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-text, #1a1a1a);
      letter-spacing: -0.01em;
    }

    .close-btn {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 22px;
      color: var(--color-text-muted, #666);
      line-height: 1;
      padding: 4px 8px;
      border-radius: 6px;
      transition: background 0.15s;
    }
    .close-btn:hover {
      background: var(--color-card-alt, #f5f0e8);
    }

    .section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted, #666);
      margin-bottom: 12px;
    }

    /* Scale section */
    .scale-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .scale-value {
      font-size: 28px;
      font-weight: 700;
      font-family: var(--font-serif, Georgia, serif);
      color: var(--color-text, #1a1a1a);
      min-width: 52px;
      text-align: center;
    }

    input[type=range] {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 3px;
      background: var(--color-border, #e0dbd0);
      outline: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--color-text, #1a1a1a);
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    input[type=range]::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      background: var(--color-text, #1a1a1a);
      cursor: pointer;
    }

    .scale-presets {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    .preset-btn {
      border: 1.5px solid var(--color-border, #e0dbd0);
      background: none;
      border-radius: 20px;
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      color: var(--color-text, #1a1a1a);
      transition: background 0.12s, border-color 0.12s;
    }
    .preset-btn:hover,
    .preset-btn.active {
      background: var(--color-text, #1a1a1a);
      color: #fff;
      border-color: var(--color-text, #1a1a1a);
    }

    /* Info section */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .info-item {
      background: var(--color-card-alt, #f5f0e8);
      border-radius: 8px;
      padding: 10px 14px;
    }

    .info-item .key {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted, #888);
      margin-bottom: 3px;
    }

    .info-item .val {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text, #1a1a1a);
      word-break: break-all;
      line-height: 1.3;
    }

    .info-item.full {
      grid-column: 1 / -1;
    }
  `;

  constructor() {
    super();
    this.open = false;
    this._scale = parseFloat(localStorage.getItem(SCALE_KEY) ?? DEFAULT_SCALE);
    this._info = this._gatherInfo();
  }

  _gatherInfo() {
    const ua = navigator.userAgent;
    const w = window.screen.width;
    const h = window.screen.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = window.devicePixelRatio ?? 1;

    // Best-effort browser name
    let browser = 'Unknown';
    if (/Edg\//.test(ua))        browser = 'Microsoft Edge';
    else if (/OPR\//.test(ua))   browser = 'Opera';
    else if (/Samsung/.test(ua)) browser = 'Samsung Internet';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua)) browser = 'Safari';

    // OS
    let os = 'Unknown';
    if (/Android/.test(ua))       os = 'Android';
    else if (/iPhone|iPad/.test(ua)) os = 'iOS';
    else if (/Win/.test(ua))      os = 'Windows';
    else if (/Mac/.test(ua))      os = 'macOS';
    else if (/Linux/.test(ua))    os = 'Linux';

    return { browser, os, screenW: w, screenH: h, viewW: vw, viewH: vh, dpr };
  }

  _onScaleInput(e) {
    const v = parseFloat(e.target.value);
    this._setScale(v);
  }

  _setScale(v) {
    this._scale = v;
    localStorage.setItem(SCALE_KEY, v);
    document.documentElement.style.setProperty('--app-scale', v);
  }

  _close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('settings-close', { bubbles: true, composed: true }));
  }

  render() {
    const { browser, os, screenW, screenH, viewW, viewH, dpr } = this._info;
    const pct = Math.round(this._scale * 100);
    const presets = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0, 1.1, 1.2];

    return html`
      <div class="backdrop" @click=${this._close}></div>
      <div class="modal">
        <div class="header">
          <h2>Settings</h2>
          <button class="close-btn" @click=${this._close} title="Close">&#x2715;</button>
        </div>

        <div>
          <div class="section-label">UI Scale</div>
          <div class="scale-row">
            <span class="scale-value">${pct}%</span>
            <input
              type="range"
              min="0.4"
              max="1.5"
              step="0.05"
              .value=${String(this._scale)}
              @input=${this._onScaleInput}
            />
          </div>
          <div class="scale-presets">
            ${presets.map(p => html`
              <button
                class="preset-btn ${Math.abs(this._scale - p) < 0.01 ? 'active' : ''}"
                @click=${() => this._setScale(p)}
              >${Math.round(p * 100)}%</button>
            `)}
          </div>
        </div>

        <div>
          <div class="section-label">Device &amp; Browser</div>
          <div class="info-grid">
            <div class="info-item">
              <div class="key">Browser</div>
              <div class="val">${browser}</div>
            </div>
            <div class="info-item">
              <div class="key">OS</div>
              <div class="val">${os}</div>
            </div>
            <div class="info-item">
              <div class="key">Screen</div>
              <div class="val">${screenW} &times; ${screenH}</div>
            </div>
            <div class="info-item">
              <div class="key">Viewport</div>
              <div class="val">${viewW} &times; ${viewH}</div>
            </div>
            <div class="info-item">
              <div class="key">Pixel Ratio</div>
              <div class="val">${dpr}&times;</div>
            </div>
            <div class="info-item">
              <div class="key">Effective px</div>
              <div class="val">${Math.round(screenW / dpr)} &times; ${Math.round(screenH / dpr)}</div>
            </div>
            <div class="info-item full">
              <div class="key">User Agent</div>
              <div class="val">${navigator.userAgent}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('home-settings', HomeSettings);

export function applyStoredScale() {
  const v = localStorage.getItem(SCALE_KEY);
  if (v) document.documentElement.style.setProperty('--app-scale', v);
}
