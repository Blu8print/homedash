import { LitElement, html, css } from 'lit';
import { supabase } from '../../lib/supabase.js';

const CATEGORIES = ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Other'];

export class HomeShopping extends LitElement {
  static properties = {
    _items:    { state: true },
    _usuals:   { state: true },
    _tab:      { state: true },
    _search:   { state: true },
    _loading:  { state: true },
  };

  constructor() {
    super();
    this._items   = [];
    this._usuals  = [];
    this._tab     = 'usuals';
    this._search  = '';
    this._loading = true;
    this._channel = null;
  }

  async connectedCallback() {
    super.connectedCallback();
    await Promise.all([this._loadItems(), this._loadUsuals()]);
    this._subscribeRealtime();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._channel) supabase.removeChannel(this._channel);
  }

  async _loadItems() {
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('done', false)
      .order('created_at');
    this._items = data ?? [];
    this._loading = false;
  }

  async _loadUsuals() {
    const { data } = await supabase
      .from('shopping_usuals')
      .select('*')
      .order('sort_order');
    this._usuals = data ?? [];
  }

  _subscribeRealtime() {
    this._channel = supabase
      .channel('shopping_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => {
        this._loadItems();
      })
      .subscribe();
  }

  // ── helpers ──────────────────────────────────────────────

  get _todoCount() { return this._items.filter(i => !i.done).length; }

  _itemsFor(cat) { return this._items.filter(i => i.category === cat); }

  _isOnList(name) {
    return this._items.some(i => i.name.toLowerCase() === name.toLowerCase() && !i.done);
  }

  _countOnList(name) {
    return this._items.filter(i => i.name.toLowerCase() === name.toLowerCase() && !i.done)
      .reduce((s, i) => s + i.qty, 0);
  }

  async _toggle(id) {
    const item = this._items.find(i => i.id === id);
    if (!item) return;
    if (item.done) {
      // unchecking — restore immediately
      this._items = this._items.map(i => i.id === id ? { ...i, done: false } : i);
      await supabase.from('shopping_items').update({ done: false, done_at: null }).eq('id', id);
      return;
    }
    // checking — mark done visually, then delete after delay
    this._items = this._items.map(i => i.id === id ? { ...i, done: true } : i);
    setTimeout(async () => {
      this._items = this._items.filter(i => i.id !== id);
      await supabase.from('shopping_items').delete().eq('id', id);
    }, 700);
  }

  async _setQty(id, delta) {
    const item = this._items.find(i => i.id === id);
    if (!item) return;
    const qty = Math.max(1, item.qty + delta);
    this._items = this._items.map(i => i.id === id ? { ...i, qty } : i);
    await supabase.from('shopping_items').update({ qty }).eq('id', id);
  }

  async _addFromUsual(usual) {
    const existing = this._items.find(
      i => i.name.toLowerCase() === usual.name.toLowerCase() && !i.done
    );
    if (existing) {
      await this._setQty(existing.id, 1);
    } else {
      const { data } = await supabase
        .from('shopping_items')
        .insert({ name: usual.name, category: usual.category, qty: 1 })
        .select()
        .single();
      if (data) this._items = [...this._items, data];
    }
  }

  async _addSearchItem(name, category = 'Other') {
    if (!name.trim()) return;
    const existing = this._items.find(
      i => i.name.toLowerCase() === name.toLowerCase() && !i.done
    );
    if (existing) {
      await this._setQty(existing.id, 1);
    } else {
      const { data } = await supabase
        .from('shopping_items')
        .insert({ name: name.trim(), category, qty: 1 })
        .select()
        .single();
      if (data) this._items = [...this._items, data];
    }
    this._search = '';
    this._tab = 'usuals';
  }

  _onSearchKey(e) {
    if (e.key === 'Enter' && this._search.trim()) {
      this._addSearchItem(this._search.trim());
    }
  }

  // ── suggestions ──────────────────────────────────────────

  get _suggestions() {
    const q = this._search.toLowerCase().trim();
    if (!q) return [];
    const known = [
      ...this._usuals,
      ...this._items.map(i => ({ name: i.name, category: i.category })),
    ];
    const seen = new Set();
    return known
      .filter(u => {
        if (!u.name.toLowerCase().includes(q)) return false;
        if (seen.has(u.name.toLowerCase())) return false;
        seen.add(u.name.toLowerCase());
        return true;
      })
      .slice(0, 5);
  }

  // ── render helpers ────────────────────────────────────────

  _renderStepper(item) {
    return html`
      <div class="stepper">
        <button class="step-btn" @click=${() => this._setQty(item.id, -1)}>−</button>
        <span class="step-val">${item.qty}</span>
        <button class="step-btn" @click=${() => this._setQty(item.id, +1)}>+</button>
      </div>`;
  }

  _renderItem(item) {
    return html`
      <div class="item ${item.done ? 'item--done' : ''}">
        <label class="item-left">
          <input
            type="checkbox"
            class="item-check"
            .checked=${item.done}
            @change=${() => this._toggle(item.id)}
          >
          <div class="item-text">
            <span class="item-name">${item.name}</span>
            ${item.notes ? html`<span class="item-notes">${item.notes}</span>` : ''}
          </div>
        </label>
        ${this._renderStepper(item)}
      </div>`;
  }

  _renderCategory(cat) {
    const items = this._itemsFor(cat);
    if (!items.length) return '';
    const doneCount = items.filter(i => i.done).length;
    return html`
      <section class="cat-section">
        <div class="cat-header">
          <span class="cat-name">${cat}</span>
          <span class="cat-count">${doneCount > 0 ? `${doneCount}/${items.length}` : items.length}</span>
        </div>
        <div class="cat-items">
          ${items.map(i => this._renderItem(i))}
        </div>
      </section>`;
  }

  _renderUsuals() {
    return html`
      <div class="usuals-grid">
        ${this._usuals.map(u => {
          const onList   = this._isOnList(u.name);
          const count    = this._countOnList(u.name);
          return html`
            <button
              class="usual-card ${onList ? 'usual-card--on' : ''}"
              @click=${() => this._addFromUsual(u)}
            >
              <span class="usual-name">${u.name}</span>
              ${onList
                ? html`<span class="usual-status usual-status--on">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>
                    on list${count > 1 ? html` ×${count}` : ''}
                  </span>`
                : html`<span class="usual-status">${u.category}</span>`}
            </button>`;
        })}
      </div>`;
  }

  _renderSearch() {
    const q = this._search.trim();
    const suggestions = this._suggestions;
    return html`
      <div class="search-area">
        <div class="search-box">
          <svg class="search-plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          <input
            class="search-input"
            type="text"
            placeholder="Add an item..."
            .value=${this._search}
            @input=${e => { this._search = e.target.value; }}
            @keydown=${this._onSearchKey}
            autofocus
          >
          ${q ? html`
            <button class="search-clear" @click=${() => { this._search = ''; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>` : ''}
        </div>

        ${suggestions.length ? html`
          <div class="sugg-list">
            <span class="sugg-label">Suggestions</span>
            ${suggestions.map(s => {
              const onList  = this._isOnList(s.name);
              const count   = this._countOnList(s.name);
              return html`
                <div class="sugg-item">
                  <span class="sugg-name">${s.name}</span>
                  <div class="sugg-right">
                    ${onList ? html`<span class="sugg-badge sugg-badge--list">on list${count > 1 ? ` ×${count}` : ''}</span>` : ''}
                    <span class="sugg-cat">${s.category}</span>
                    <button class="sugg-add" @click=${() => this._addSearchItem(s.name, s.category)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  </div>
                </div>`;
            })}
            ${q ? html`
              <div class="sugg-item sugg-item--new">
                <span class="sugg-name">Add "${q}"</span>
                <div class="sugg-right">
                  <button class="sugg-add sugg-add--primary" @click=${() => this._addSearchItem(q)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </div>` : ''}
          </div>` : q ? html`
          <div class="sugg-list">
            <span class="sugg-label">Suggestions</span>
            <div class="sugg-item sugg-item--new">
              <span class="sugg-name">Add "${q}"</span>
              <div class="sugg-right">
                <button class="sugg-add sugg-add--primary" @click=${() => this._addSearchItem(q)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
            </div>
          </div>` : ''}
      </div>`;
  }

  render() {
    const doneCount = this._items.filter(i => i.done).length;

    return html`
      <div class="shell">

        <!-- ── Header ── -->
        <header class="hdr">
          <h1 class="hdr-name">Groceries</h1>
          <span class="hdr-count"><strong>${this._todoCount}</strong> to get</span>
        </header>

        <!-- ── Body ── -->
        <div class="body">

          <!-- LEFT: item list -->
          <main class="list-col">
            ${this._loading
              ? html`<div class="loading">Loading...</div>`
              : this._items.length === 0
                ? html`<div class="empty">Your list is empty — add items from Usuals or Search.</div>`
                : CATEGORIES.map(c => this._renderCategory(c))}
            <div style="height:2rem"></div>
          </main>

          <!-- RIGHT: panel -->
          <aside class="panel-col">

            <!-- Tab switcher -->
            <div class="tabs">
              <button
                class="tab ${this._tab === 'usuals' ? 'tab--active' : ''}"
                @click=${() => { this._tab = 'usuals'; this._search = ''; }}
              >Usuals</button>
              <button
                class="tab ${this._tab === 'search' ? 'tab--active' : ''}"
                @click=${() => this._tab = 'search'}
              >Search &amp; Add</button>
            </div>

            <!-- Tab body -->
            <div class="panel-body">
              ${this._tab === 'usuals' ? this._renderUsuals() : this._renderSearch()}
            </div>

            <!-- Footer -->
            <div class="panel-footer">
              ${doneCount > 0 ? html`
                <button class="finish-btn" @click=${this._clearDone}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>
                  Clear ${doneCount} done item${doneCount !== 1 ? 's' : ''}
                </button>` : html`
                <div class="footer-empty">Check off items as you shop</div>`}
            </div>

          </aside>
        </div>
      </div>`;
  }

  static styles = css`
    :host {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: block;
    }

    /* ── shell ── */
    .shell {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--color-bg, #f0ebe0);
      overflow: hidden;
    }

    /* ── header ── */
    .hdr {
      padding: 0.75rem 2.5rem;
      border-bottom: 1px solid var(--color-border, #e0dbd0);
      flex-shrink: 0;
      display: flex;
      align-items: baseline;
      gap: 1rem;
    }
    .hdr-name {
      font-family: var(--font-serif);
      font-size: 2rem;
      font-weight: 400;
      line-height: 1;
      color: var(--color-text, #1a1a1a);
      letter-spacing: -0.01em;
    }
    .hdr-count {
      font-family: var(--font-sans);
      font-size: 0.9rem;
      color: var(--color-text-muted, #666);
    }
    .hdr-count strong {
      color: var(--color-text, #1a1a1a);
      font-weight: 700;
    }

    /* ── body layout ── */
    .body {
      flex: 1;
      min-height: 0;
      display: flex;
      gap: 2rem;
      padding: 1rem 2.5rem 0;
      overflow: hidden;
    }

    /* ── left list ── */
    .list-col {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
      padding-right: 0.5rem;
    }

    /* scrollbar */
    .list-col::-webkit-scrollbar { width: 4px; }
    .list-col::-webkit-scrollbar-track { background: transparent; }
    .list-col::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 9999px; }

    /* ── loading / empty ── */
    .loading, .empty {
      font-family: var(--font-sans);
      font-size: 0.85rem;
      color: var(--color-text-muted, #666);
      padding: 2rem 0.5rem;
    }

    /* ── category ── */
    .cat-section { margin-bottom: 1.75rem; }
    .cat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.4rem;
      margin-bottom: 0.25rem;
      border-bottom: 2px solid var(--color-text, #1a1a1a);
    }
    .cat-name {
      font-family: var(--font-sans);
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--color-text, #1a1a1a);
    }
    .cat-count {
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--color-text-muted, #666);
    }
    .cat-items { }

    /* ── item row ── */
    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.9rem 0.5rem;
      border-bottom: 1px solid var(--color-border, #e0dbd0);
      border-radius: 10px;
      transition: background 0.15s;
      gap: 1rem;
    }
    .item:last-child { border-bottom: none; }
    .item:hover { background: rgba(255,255,255,0.5); }
    .item--done .item-name {
      text-decoration: line-through;
      color: var(--color-text-muted, #666);
    }
    .item--done .item-check { opacity: 0.6; }

    .item-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      min-width: 0;
      cursor: pointer;
    }
    .item-check {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 8px;
      border: 2px solid var(--color-border, #e0dbd0);
      accent-color: var(--color-text, #1a1a1a);
      cursor: pointer;
      flex-shrink: 0;
      appearance: auto;
    }
    .item-text { min-width: 0; }
    .item-name {
      display: block;
      font-family: var(--font-sans);
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-text, #1a1a1a);
      transition: color 0.15s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-notes {
      display: block;
      font-size: 0.72rem;
      color: var(--color-text-muted, #666);
      margin-top: 0.15rem;
    }

    /* ── stepper ── */
    .stepper {
      display: flex;
      align-items: center;
      background: var(--color-card-alt, #f5f0e8);
      border-radius: 9999px;
      padding: 0.15rem 0.2rem;
      gap: 0;
      flex-shrink: 0;
    }
    .step-btn {
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text, #1a1a1a);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.12s;
      line-height: 1;
    }
    .step-btn:hover { background: rgba(0,0,0,0.08); }
    .step-btn:active { transform: scale(0.9); }
    .step-val {
      min-width: 1.6rem;
      text-align: center;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--color-text, #1a1a1a);
    }

    /* ── right panel ── */
    .panel-col {
      width: 380px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 0;
    }

    /* ── tabs ── */
    .tabs {
      display: flex;
      background: rgba(0,0,0,0.05);
      border-radius: 14px;
      padding: 0.25rem;
      gap: 0.25rem;
      flex-shrink: 0;
    }
    .tab {
      flex: 1;
      padding: 0.55rem 0.75rem;
      border-radius: 10px;
      border: none;
      background: transparent;
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted, #666);
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab:hover { color: var(--color-text, #1a1a1a); }
    .tab--active {
      background: var(--color-text, #1a1a1a);
      color: #fff !important;
    }

    /* ── panel body (scroll area) ── */
    .panel-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    .panel-body::-webkit-scrollbar { width: 4px; }
    .panel-body::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 9999px; }

    /* ── usuals grid ── */
    .usuals-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }
    .usual-card {
      background: var(--color-card, #fff);
      border: 1px solid var(--color-border, #e0dbd0);
      border-radius: 14px;
      padding: 0.75rem;
      height: 6.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
    }
    .usual-card:hover { border-color: #aaa; background: #fff; }
    .usual-card:active { transform: scale(0.97); }
    .usual-card--on {
      background: var(--color-text, #1a1a1a);
      border-color: var(--color-text, #1a1a1a);
    }
    .usual-card--on:hover { background: #000; border-color: #000; }
    .usual-name {
      font-family: var(--font-sans);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      line-height: 1.2;
      color: var(--color-text, #1a1a1a);
    }
    .usual-card--on .usual-name { color: #fff; }
    .usual-status {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted, #999);
    }
    .usual-card--on .usual-status { color: rgba(255,255,255,.45); }
    .usual-status--on {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: rgba(255,255,255,.55);
    }

    /* ── search ── */
    .search-area { display: flex; flex-direction: column; gap: 1rem; }
    .search-box {
      background: #000;
      padding: 0.4rem;
      border-radius: 999px;
      display: flex;
      align-items: center;
    }
    .search-inner {
      background: #fff;
      border-radius: 999px;
      display: flex;
      align-items: center;
      flex: 1;
      padding: 0.6rem 1rem;
      gap: 0.75rem;
    }
    .search-plus { color: var(--color-text, #1a1a1a); flex-shrink: 0; }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      background: #fff;
      font-family: var(--font-sans);
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--color-text, #1a1a1a);
      padding: 0.6rem 0.75rem;
      border-radius: 999px;
      width: 100%;
    }
    .search-input::placeholder { color: #aaa; font-weight: 400; }
    .search-clear {
      background: transparent;
      border: none;
      cursor: pointer;
      color: #888;
      padding: 0.3rem;
      display: flex;
      align-items: center;
      margin-right: 0.25rem;
    }
    .search-clear:hover { color: #333; }

    .sugg-label {
      display: block;
      font-family: var(--font-sans);
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--color-text-muted, #666);
      margin-bottom: 0.5rem;
    }
    .sugg-list { }
    .sugg-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-card, #fff);
      border: 1px solid var(--color-border, #e0dbd0);
      border-radius: 14px;
      padding: 0.85rem 1rem;
      margin-bottom: 0.4rem;
    }
    .sugg-item--new { background: var(--color-card-alt, #f5f0e8); }
    .sugg-name {
      font-family: var(--font-sans);
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-text, #1a1a1a);
    }
    .sugg-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .sugg-badge {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted, #666);
    }
    .sugg-cat {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted, #666);
    }
    .sugg-add {
      width: 2rem;
      height: 2rem;
      border-radius: 10px;
      border: 1px solid var(--color-border, #e0dbd0);
      background: var(--color-card-alt, #f5f0e8);
      color: var(--color-text, #1a1a1a);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.12s;
    }
    .sugg-add:hover { background: var(--color-text, #1a1a1a); color: #fff; border-color: var(--color-text); }
    .sugg-add--primary {
      background: var(--color-text, #1a1a1a);
      color: #fff;
      border-color: var(--color-text);
    }
    .sugg-add--primary:hover { background: #000; }

    /* ── panel footer ── */
    .panel-footer {
      flex-shrink: 0;
      padding-top: 0.5rem;
    }
    .finish-btn {
      width: 100%;
      padding: 0.75rem;
      border-radius: 14px;
      border: 1px solid var(--color-border, #e0dbd0);
      background: var(--color-card, #fff);
      font-family: var(--font-sans);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text, #1a1a1a);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.15s;
    }
    .finish-btn:hover { background: var(--color-text, #1a1a1a); color: #fff; border-color: var(--color-text); }
    .footer-empty {
      text-align: center;
      font-size: 0.7rem;
      color: var(--color-text-muted, #666);
      padding: 0.5rem;
      letter-spacing: 0.05em;
    }
  `;
}

customElements.define('home-shopping', HomeShopping);
