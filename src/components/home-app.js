import { LitElement, html, css } from 'lit';
import './home-sidebar.js';
import './today/home-today.js';
import './calendar/home-calendar.js';
import './chores/home-todo.js';
import './shopping/home-shopping.js';
import './budget/home-budget.js';
import './baby/home-baby.js';

export class HomeApp extends LitElement {
  static properties = {
    activeSection: { type: String },
  };

  static styles = css`
    :host {
      display: flex;
      height: 100vh;
      overflow: hidden;
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
    window.addEventListener('hashchange', () => {
      this.activeSection = location.hash.slice(1) || 'today';
    });
  }

  render() {
    return html`
      <home-sidebar .active=${this.activeSection}></home-sidebar>
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
