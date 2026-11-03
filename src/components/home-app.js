import { LitElement, html, css } from 'lit';
import './home-sidebar.js';
import './home-settings.js';
import { applyStoredScale } from './home-settings.js';
import './today/home-today.js';
import './calendar/home-calendar.js';
import './chores/home-todo.js';
import './shopping/home-shopping.js';
import './budget/home-budget.js';
import './baby/home-baby.js';

applyStoredScale();

export class HomeApp extends LitElement {
  static properties = {
    activeSection:   { type: String },
    _settingsOpen:   { state: true },
  };

  static styles = css`
    :host {
      display: flex;
      width: calc(100vw / var(--app-scale, 1));
      height: calc(100vh / var(--app-scale, 1));
      overflow: hidden;
      transform: scale(var(--app-scale, 1));
      transform-origin: top left;
    }
    main {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
    }
  `;

  constructor() {
    super();
    this.activeSection = location.hash.slice(1) || 'today';
    this._settingsOpen = false;
    window.addEventListener('hashchange', () => {
      this.activeSection = location.hash.slice(1) || 'today';
    });
    this._idleTimeout = null;
    this._resetIdle = () => {
      clearTimeout(this._idleTimeout);
      this._idleTimeout = setTimeout(() => {
        location.hash = 'today';
      }, 3 * 60 * 1000);
    };
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(e =>
      window.addEventListener(e, this._resetIdle, { passive: true })
    );
    this._resetIdle();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._idleTimeout);
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(e =>
      window.removeEventListener(e, this._resetIdle)
    );
  }

  render() {
    return html`
      <home-sidebar .active=${this.activeSection} @open-settings=${() => this._settingsOpen = true}></home-sidebar>
      <home-settings ?open=${this._settingsOpen} @settings-close=${() => this._settingsOpen = false}></home-settings>
      <main>
        ${this.activeSection === 'today'    ? html`<home-today></home-today>`       : ''}
        ${this.activeSection === 'calendar' ? html`<home-calendar></home-calendar>` : ''}
        ${this.activeSection === 'todo'      ? html`<home-todo></home-todo>`         : ''}
        ${this.activeSection === 'shopping' ? html`<home-shopping></home-shopping>` : ''}
        ${this.activeSection === 'budget'   ? html`<home-budget></home-budget>`     : ''}
        ${this.activeSection === 'baby'     ? html`<home-baby></home-baby>`         : ''}
      </main>
    `;
  }
}

customElements.define('home-app', HomeApp);
