import { LitElement, html, css } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { supabase } from '../../lib/supabase.js';

const CATEGORIES = ['Produce', 'Bakery', 'Meat & Fish', 'Dairy & Eggs', 'Pantry', 'Other'];
const PREFIXES = ['fluent-emoji-high-contrast', 'tabler', 'lucide', 'mdi', 'game-icons'];
const BAD_SEGMENTS = ['off', 'remove', 'minus', 'plus', 'alert'];
const RECENT_MAX = 18;
const DONE_KEEP = 50;
const COLLAPSE_KEY = 'shopping-recent-collapsed';
const SVG_CACHE_PREFIX = 'iconify-svg:';

const key = (name) => (name ?? '').trim().toLowerCase();
const catIdx = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? CATEGORIES.length : i; };
const doneTime = (i) => (i.done_at ? Date.parse(i.done_at) : 0);

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

function searchUrl(q, limit) {
  return `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=${limit}&prefixes=${PREFIXES.join(',')}`;
}

/** Shared ranking with phone app — do not change without changing both. */
export function pickIcon(query, icons) {
  const words = key(query).split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const joined = words.join('-');
  let best = null;
  for (const id of icons ?? []) {
    const [prefix, name] = id.split(':');
    if (!prefix || !name) continue;
    const segs = name.split('-');
    if (segs.slice(1).some(s => BAD_SEGMENTS.includes(s))) continue;
    let score;
    if (name === joined || name === `${joined}-filled`) score = 0;
    else if (words.every(w =>
      segs.includes(w) || segs.includes(`${w}s`) || (w.endsWith('s') && segs.includes(w.slice(0, -1)))
    )) score = 1;
    else continue;
    const p = PREFIXES.indexOf(prefix);
    const cand = { id, score, p: p < 0 ? PREFIXES.length : p, len: name.length };
    if (!best
      || cand.score < best.score
      || (cand.score === best.score && cand.p < best.p)
      || (cand.score === best.score && cand.p === best.p && cand.len < best.len)) best = cand;
  }
  return best?.id ?? null;
}

export class HomeShopping extends LitElement {
  static properties = {
    _items:      { state: true },
    _usuals:     { state: true },
    _icons:      { state: true },
    _svgs:       { state: true },
    _input:      { state: true },
    _loading:    { state: true },
    _collapsed:  { state: true },
    _ticking:    { state: true },
    _edit:       { state: true },
    _iconQuery:  { state: true },
    _iconHits:   { state: true },
  };

  constructor() {
    super();
    this._items = [];
    this._usuals = [];
    this._icons = new Map();      // key -> icon id | null
    this._svgs = new Map();       // icon id -> svg string
    this._input = '';
    this._loading = true;
    this._collapsed = lsGet(COLLAPSE_KEY) === '1';
    this._ticking = new Set();
    this._edit = null;            // { id, qty, notes, category, icon, iconChanged }
    this._iconQuery = '';
    this._iconHits = [];
    this._channel = null;
    this._iconsLoaded = false;
    this._resolving = new Map();  // key -> Promise
    this._svgPending = new Set();
    this._pressTimer = null;
    this._pressFired = false;
  }

  async connectedCallback() {
    super.connectedCallback();
    await Promise.all([this._loadItems(true), this._loadUsuals(), this._loadIcons()]);
    this._subscribeRealtime();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._channel) supabase.removeChannel(this._channel);
    clearTimeout(this._pressTimer);
  }

  // ── data ─────────────────────────────────────────────────

  async _loadItems(prune = false) {
    const { data } = await supabase.from('shopping_items').select('*').order('created_at');
    let items = data ?? [];
    if (prune) {
      const done = items.filter(i => i.done).sort((a, b) => doneTime(b) - doneTime(a));
      const excess = done.slice(DONE_KEEP).map(i => i.id);
      if (excess.length) {
        await supabase.from('shopping_items').delete().in('id', excess);
        const gone = new Set(excess);
        items = items.filter(i => !gone.has(i.id));
      }
    }
    this._items = items;
    this._loading = false;
  }

  async _loadUsuals() {
    const { data } = await supabase.from('shopping_usuals').select('*').order('sort_order');
    this._usuals = data ?? [];
  }

  async _loadIcons() {
    const { data } = await supabase.from('shopping_icons').select('name, icon');
    const m = new Map();
    for (const r of data ?? []) m.set(key(r.name), r.icon ?? null);
    this._icons = m;
    this._iconsLoaded = true;
  }

  _subscribeRealtime() {
    this._channel = supabase
      .channel('shopping_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, () => this._loadItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_icons' }, (p) => {
        const m = new Map(this._icons);
        if (p.eventType === 'DELETE') m.delete(key(p.old?.name));
        else if (p.new?.name) m.set(key(p.new.name), p.new.icon ?? null);
        this._icons = m;
      })
      .subscribe();
  }

  get _active() {
    return this._items
      .filter(i => !i.done)
      .sort((a, b) => catIdx(a.category) - catIdx(b.category)
        || String(a.created_at).localeCompare(String(b.created_at)));
  }

  get _allDone() {
    return this._items.filter(i => i.done).sort((a, b) => doneTime(b) - doneTime(a));
  }

  get _recent() { return this._allDone.slice(0, RECENT_MAX); }

  _findActive(name) { return this._items.find(i => !i.done && key(i.name) === key(name)); }

  _patchLocal(id, patch) {
    this._items = this._items.map(i => (i.id === id ? { ...i, ...patch } : i));
  }

  async _incActive(row) {
    const qty = (row.qty ?? 1) + 1;
    this._patchLocal(row.id, { qty });
    await supabase.from('shopping_items').update({ qty }).eq('id', row.id);
  }

  async _insertOrInc(name, category) {
    name = name.trim();
    if (!name) return;
    const existing = this._findActive(name);
    if (existing) return this._incActive(existing);
    const { data } = await supabase
      .from('shopping_items')
      .insert({ name, category: category || 'Other', qty: 1, done: false })
      .select()
      .single();
    if (data && !this._items.some(i => i.id === data.id)) this._items = [...this._items, data];
  }

  // ── actions ──────────────────────────────────────────────

  _tick(item) {
    if (this._ticking.has(item.id)) return;
    this._ticking = new Set(this._ticking).add(item.id);
    setTimeout(async () => {
      const done_at = new Date().toISOString();
      const others = this._items
        .filter(i => i.done && i.id !== item.id && key(i.name) === key(item.name))
        .map(i => i.id);
      const gone = new Set(others);
      this._items = this._items
        .filter(i => !gone.has(i.id))
        .map(i => (i.id === item.id ? { ...i, done: true, done_at } : i));
      const t = new Set(this._ticking); t.delete(item.id); this._ticking = t;
      await supabase.from('shopping_items').update({ done: true, done_at }).eq('id', item.id);
      if (others.length) await supabase.from('shopping_items').delete().in('id', others);
    }, 200);
  }

  async _restore(item) {
    const existing = this._findActive(item.name);
    if (existing) return this._incActive(existing);
    this._patchLocal(item.id, { done: false, done_at: null, qty: 1 });
    await supabase.from('shopping_items').update({ done: false, done_at: null, qty: 1 }).eq('id', item.id);
  }

  _categoryFor(name) {
    const k = key(name);
    return this._allDone.find(i => key(i.name) === k)?.category
      ?? this._usuals.find(u => key(u.name) === k)?.category
      ?? 'Other';
  }

  _addTyped(name = this._input) {
    const n = name.trim();
    if (!n) return;
    this._input = '';
    this._insertOrInc(n, this._categoryFor(n));
  }

  _toggleCollapsed() {
    this._collapsed = !this._collapsed;
    lsSet(COLLAPSE_KEY, this._collapsed ? '1' : '0');
  }

  // ── long press ───────────────────────────────────────────

  _pressStart(item) {
    this._pressFired = false;
    clearTimeout(this._pressTimer);
    this._pressTimer = setTimeout(() => { this._pressFired = true; this._openEdit(item); }, 500);
  }

  _pressEnd() { clearTimeout(this._pressTimer); }

  _tileClick(item, fn) {
    if (this._pressFired) { this._pressFired = false; return; }
    fn(item);
  }

  _contextMenu(e, item) {
    e.preventDefault();
    clearTimeout(this._pressTimer);
    this._pressFired = true;
    this._openEdit(item);
  }

  // ── edit sheet ───────────────────────────────────────────

  _openEdit(item) {
    if (this._edit?.id === item.id) return;
    this._edit = {
      id: item.id, name: item.name, qty: item.qty ?? 1, notes: item.notes ?? '',
      category: item.category || 'Other', icon: this._icons.get(key(item.name)) ?? null, iconChanged: false,
    };
    this._iconQuery = item.name;
    this._iconHits = [];
  }

  _closeEdit() { this._edit = null; this._pressFired = false; }

  async _saveEdit() {
    const e = this._edit;
    if (!e) return;
    const patch = { qty: Math.max(1, e.qty), notes: e.notes.trim() || null, category: e.category };
    this._patchLocal(e.id, patch);
    this._closeEdit();
    await supabase.from('shopping_items').update(patch).eq('id', e.id);
    if (e.iconChanged) await this._setIcon(e.name, e.icon);
  }

  async _deleteEdit() {
    const e = this._edit;
    if (!e) return;
    this._items = this._items.filter(i => i.id !== e.id);
    this._closeEdit();
    await supabase.from('shopping_items').delete().eq('id', e.id);
  }

  async _setIcon(name, icon) {
    const k = key(name);
    this._icons = new Map(this._icons).set(k, icon);
    await supabase.from('shopping_icons').upsert({ name: k, icon, updated_at: new Date().toISOString() });
  }

  async _searchIcons() {
    const q = this._iconQuery.trim();
    if (!q) return;
    try {
      const r = await fetch(searchUrl(q, 48));
      const j = await r.json();
      this._iconHits = j.icons ?? [];
    } catch { this._iconHits = []; }
  }

  // ── icon resolution ──────────────────────────────────────

  updated() {
    if (!this._iconsLoaded) return;
    const names = [...this._items.map(i => i.name), ...this._usuals.map(u => u.name)];
    if (this._edit) names.push(this._edit.name);
    for (const n of names) {
      const k = key(n);
      if (!k) continue;
      if (!this._icons.has(k)) this._resolveIcon(k);
      else {
        const id = this._icons.get(k);
        if (id) this._ensureSvg(id);
      }
    }
    if (this._edit?.icon) this._ensureSvg(this._edit.icon);
  }

  _resolveIcon(k) {
    if (this._resolving.has(k)) return this._resolving.get(k);
    const p = (async () => {
      try {
        const r = await fetch(searchUrl(k, 32));
        if (!r.ok) return;
        const j = await r.json();
        const hit = pickIcon(k, j.icons);
        if (this._icons.has(k)) return; // set meanwhile (realtime / manual)
        this._icons = new Map(this._icons).set(k, hit);
        await supabase.from('shopping_icons')
          .upsert({ name: k, icon: hit }, { onConflict: 'name', ignoreDuplicates: true });
      } catch { /* offline: letter fallback, retry next load */ }
    })();
    this._resolving.set(k, p);
    return p;
  }

  async _ensureSvg(id) {
    if (this._svgs.has(id) || this._svgPending.has(id)) return;
    this._svgPending.add(id);
    let svg = lsGet(SVG_CACHE_PREFIX + id);
    if (!svg) {
      try {
        const [prefix, name] = id.split(':');
        const r = await fetch(`https://api.iconify.design/${prefix}/${name}.svg`);
        if (!r.ok) throw new Error();
        svg = (await r.text())
          .replace(/\swidth="[^"]*"/, ' width="100%"')
          .replace(/\sheight="[^"]*"/, ' height="100%"')
          .replace(/(fill|stroke)="(?!none|currentColor)[^"]*"/g, '$1="currentColor"');
        if (!svg.startsWith('<svg')) throw new Error();
        lsSet(SVG_CACHE_PREFIX + id, svg);
      } catch { return; } // stays pending → no retry loop; letter fallback
    }
    this._svgs = new Map(this._svgs).set(id, svg);
  }

  // ── render ───────────────────────────────────────────────

  _renderIcon(name, iconOverride) {
    const id = iconOverride !== undefined ? iconOverride : this._icons.get(key(name));
    const svg = id ? this._svgs.get(id) : null;
    if (svg) return html`<span class="icon">${unsafeHTML(svg)}</span>`;
    return html`<span class="letter">${(name ?? '?').trim().charAt(0).toUpperCase()}</span>`;
  }

  _renderTile(item, kind, onTap) {
    const ticking = this._ticking.has(item.id);
    const editable = kind !== 'usual';
    return html`
      <button
        class="tile tile--${kind} ${ticking ? 'tile--ticking' : ''}"
        @click=${() => (editable ? this._tileClick(item, onTap) : onTap(item))}
        @pointerdown=${editable ? () => this._pressStart(item) : null}
        @pointerup=${editable ? this._pressEnd : null}
        @pointerleave=${editable ? this._pressEnd : null}
        @pointercancel=${editable ? this._pressEnd : null}
        @contextmenu=${editable ? (e) => this._contextMenu(e, item) : null}
      >
        ${item.qty > 1 && kind !== 'usual' ? html`<span class="qty">×${item.qty}</span>` : ''}
        ${this._renderIcon(item.name)}
        <span class="tile-name">${item.name}</span>
      </button>`;
  }

  get _suggestions() {
    const q = key(this._input);
    if (!q) return [];
    const seen = new Set();
    const pool = [...this._allDone.map(i => i.name), ...this._usuals.map(u => u.name)]
      .filter(n => { const k = key(n); if (seen.has(k) || !k.includes(q)) return false; seen.add(k); return true; });
    return pool.sort((a, b) => (key(a).startsWith(q) ? 0 : 1) - (key(b).startsWith(q) ? 0 : 1)).slice(0, 6);
  }

  _renderEdit() {
    const e = this._edit;
    if (!e) return '';
    const upd = (patch) => { this._edit = { ...this._edit, ...patch }; };
    return html`
      <div class="overlay" @click=${this._closeEdit}>
        <div class="sheet" @click=${(ev) => ev.stopPropagation()}>
          <div class="sheet-hdr">
            <div class="sheet-preview">${this._renderIcon(e.name, e.icon)}</div>
            <h2 class="sheet-title">${e.name}</h2>
            <button class="x" @click=${this._closeEdit} aria-label="Close">✕</button>
          </div>

          <div class="row">
            <span class="lbl">Quantity</span>
            <div class="stepper">
              <button @click=${() => upd({ qty: Math.max(1, e.qty - 1) })}>−</button>
              <span>${e.qty}</span>
              <button @click=${() => upd({ qty: e.qty + 1 })}>+</button>
            </div>
          </div>

          <div class="row">
            <span class="lbl">Notes</span>
            <input class="field" .value=${e.notes} placeholder="e.g. ripe ones"
              @input=${(ev) => upd({ notes: ev.target.value })}>
          </div>

          <div class="row">
            <span class="lbl">Category</span>
            <select class="field" .value=${e.category} @change=${(ev) => upd({ category: ev.target.value })}>
              ${CATEGORIES.map(c => html`<option value=${c} ?selected=${c === e.category}>${c}</option>`)}
            </select>
          </div>

          <div class="icon-picker">
            <span class="lbl">Change icon</span>
            <div class="icon-search">
              <input class="field" .value=${this._iconQuery} placeholder="Search icons"
                @input=${(ev) => { this._iconQuery = ev.target.value; }}
                @keydown=${(ev) => { if (ev.key === 'Enter') this._searchIcons(); }}>
              <button class="pill" @click=${this._searchIcons}>Search</button>
              <button class="pill ${e.icon === null ? 'pill--on' : ''}"
                @click=${() => upd({ icon: null, iconChanged: true })}>Use letter</button>
            </div>
            ${this._iconHits.length ? html`
              <div class="icon-grid">
                ${this._iconHits.map(id => {
                  const [p, n] = id.split(':');
                  return html`
                    <button class="icon-opt ${e.icon === id ? 'icon-opt--on' : ''}" title=${id}
                      @click=${() => upd({ icon: id, iconChanged: true })}>
                      <img src="https://api.iconify.design/${p}/${n}.svg" alt=${n} loading="lazy">
                    </button>`;
                })}
              </div>` : ''}
          </div>

          <div class="sheet-actions">
            <button class="btn btn--danger" @click=${this._deleteEdit}>Delete</button>
            <button class="btn btn--primary" @click=${this._saveEdit}>Save</button>
          </div>
        </div>
      </div>`;
  }

  render() {
    const active = this._active;
    const recent = this._recent;
    const shown = new Set([...active, ...recent].map(i => key(i.name)));
    const usuals = this._usuals.filter(u => !shown.has(key(u.name)));
    const sugg = this._suggestions;

    return html`
      <div class="shell">
        <header class="hdr">
          <h1 class="hdr-name">Groceries</h1>
          <span class="hdr-count"><strong>${active.length}</strong> to get</span>
        </header>

        <main class="scroll">
          ${this._loading
            ? html`<div class="muted">Loading…</div>`
            : active.length
              ? html`<div class="grid">${active.map(i => this._renderTile(i, 'active', (it) => this._tick(it)))}</div>`
              : html`<div class="muted">Nothing needed — tap a recent item or type below</div>`}

          ${recent.length ? html`
            <button class="sec-hdr" @click=${this._toggleCollapsed}>
              <span>Recently bought</span>
              <svg class="chev ${this._collapsed ? 'chev--closed' : ''}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            ${this._collapsed ? '' : html`
              <div class="grid">${recent.map(i => this._renderTile(i, 'recent', (it) => this._restore(it)))}</div>`}
          ` : ''}

          ${usuals.length ? html`
            <div class="sec-hdr sec-hdr--static"><span>Usuals</span></div>
            <div class="grid">${usuals.map(u => this._renderTile(u, 'usual', (it) => this._insertOrInc(it.name, it.category)))}</div>
          ` : ''}
          <div style="height:1rem"></div>
        </main>

        <footer class="bar">
          ${sugg.length ? html`
            <div class="sugg">
              ${sugg.map(n => html`<button class="sugg-chip" @click=${() => this._addTyped(n)}>${n}</button>`)}
            </div>` : ''}
          <div class="bar-row">
            <input class="bar-input" type="text" placeholder="I need …" .value=${this._input}
              @input=${(e) => { this._input = e.target.value; }}
              @keydown=${(e) => { if (e.key === 'Enter') this._addTyped(); }}>
            <button class="bar-add" aria-label="Add" @click=${() => this._addTyped()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </footer>

        ${this._renderEdit()}
      </div>`;
  }

  static styles = css`
    :host { flex: 1; min-height: 0; overflow: hidden; display: block; }

    .shell {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
      overflow: hidden;
    }

    .hdr {
      padding: 0.75rem 2rem;
      border-bottom: 1px solid var(--color-border);
      display: flex; align-items: baseline; gap: 1rem;
      flex-shrink: 0;
    }
    .hdr-name {
      margin: 0;
      font-family: var(--font-serif);
      font-size: 2rem; font-weight: 400; line-height: 1;
      color: var(--color-text);
    }
    .hdr-count { font-size: 0.9rem; color: var(--color-text-muted); }
    .hdr-count strong { color: var(--color-text); }

    .scroll {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 1rem 2rem 0;
    }
    .scroll::-webkit-scrollbar { width: 4px; }
    .scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 9999px; }

    .muted { font-size: 0.95rem; color: var(--color-text-muted); padding: 1.5rem 0.25rem; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 4px;
    }

    .sec-hdr {
      display: flex; align-items: center; gap: 0.4rem;
      margin: 1.5rem 0 0.6rem; padding: 0;
      background: none; border: none; cursor: pointer;
      font-family: var(--font-serif);
      font-size: 1.35rem; font-weight: 700;
      color: var(--color-text);
    }
    .sec-hdr--static { cursor: default; }
    .chev { transition: transform 0.2s; color: var(--color-text-muted); }
    .chev--closed { transform: rotate(-90deg); }

    /* ── tile ── */
    .tile {
      position: relative;
      aspect-ratio: 1 / 1;
      container-type: inline-size;
      border: none; border-radius: 12px;
      padding: 8% 6% 6%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4%;
      cursor: pointer;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
      touch-action: manipulation;
      transition: transform 0.2s, opacity 0.2s;
      font-family: var(--font-sans);
      overflow: hidden;
    }
    .tile:active { transform: scale(0.96); }
    .tile--active { background: var(--shop-active, #E2725B); color: #fff; }
    .tile--recent { background: var(--shop-recent, #7FA393); color: #fff; }
    .tile--usual {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }
    .tile--ticking { transform: scale(0.9); opacity: 0; pointer-events: none; }

    .icon {
      width: 45cqw; height: 45cqw;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .icon svg { width: 100%; height: 100%; display: block; }
    .letter {
      font-family: var(--font-serif);
      font-weight: 900;
      font-size: 55cqw;
      line-height: 0.85;
      flex-shrink: 0;
    }
    .tile-name {
      font-size: 14px; font-weight: 600; line-height: 1.15;
      text-align: center;
      max-width: 100%;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .qty {
      position: absolute; top: 6px; right: 6px;
      background: rgba(255,255,255,0.25);
      border-radius: 9999px;
      padding: 1px 7px;
      font-size: 12px; font-weight: 700;
    }

    /* ── bottom bar ── */
    .bar {
      flex-shrink: 0;
      padding: 0.6rem 2rem 0.9rem;
      border-top: 1px solid var(--color-border);
      background: var(--color-bg);
    }
    .sugg { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }
    .sugg-chip {
      border: 1px solid var(--color-border);
      background: var(--color-card);
      color: var(--color-text);
      border-radius: 9999px;
      padding: 0.45rem 0.9rem;
      font-size: 0.9rem; font-weight: 600;
      cursor: pointer;
    }
    .bar-row { display: flex; gap: 0.5rem; align-items: center; }
    .bar-input {
      flex: 1;
      border: 1px solid var(--color-border);
      background: #fff;
      border-radius: 9999px;
      padding: 0.75rem 1.25rem;
      font-family: var(--font-sans);
      font-size: 1.05rem;
      color: var(--color-text);
      outline: none;
    }
    .bar-input:focus { border-color: var(--color-text-muted); }
    .bar-add {
      width: 3rem; height: 3rem;
      border-radius: 9999px; border: none;
      background: var(--color-sidebar); color: #fff;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
    }

    /* ── edit sheet ── */
    .overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      z-index: 10;
    }
    .sheet {
      background: var(--color-card);
      border-radius: 16px;
      width: min(560px, 92%);
      max-height: 90%;
      overflow-y: auto;
      padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 0.9rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .sheet-hdr { display: flex; align-items: center; gap: 0.75rem; }
    .sheet-preview {
      width: 52px; height: 52px; border-radius: 10px;
      container-type: inline-size;
      background: var(--shop-active, #E2725B); color: #fff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sheet-preview .icon { width: 60cqw; height: 60cqw; }
    .sheet-preview .letter { font-size: 65cqw; }
    .sheet-title {
      flex: 1; margin: 0;
      font-family: var(--font-serif); font-size: 1.5rem; font-weight: 700;
      color: var(--color-text);
    }
    .x { background: none; border: none; font-size: 1.2rem; color: var(--color-text-muted); cursor: pointer; }
    .row { display: flex; align-items: center; gap: 1rem; }
    .lbl {
      width: 6.5rem; flex-shrink: 0;
      font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .field {
      flex: 1; min-width: 0;
      border: 1px solid var(--color-border); border-radius: 10px;
      background: #fff; padding: 0.55rem 0.75rem;
      font-family: var(--font-sans); font-size: 1rem; color: var(--color-text);
    }
    .stepper { display: flex; align-items: center; gap: 0.25rem; background: var(--color-card-alt); border-radius: 9999px; padding: 0.2rem; }
    .stepper button {
      width: 2.25rem; height: 2.25rem; border-radius: 9999px; border: none;
      background: transparent; font-size: 1.2rem; cursor: pointer; color: var(--color-text);
    }
    .stepper span { min-width: 2rem; text-align: center; font-weight: 700; color: var(--color-text); }
    .icon-picker { display: flex; flex-direction: column; gap: 0.5rem; }
    .icon-search { display: flex; gap: 0.4rem; align-items: center; }
    .pill {
      border: 1px solid var(--color-border); background: var(--color-card-alt);
      border-radius: 9999px; padding: 0.5rem 0.9rem;
      font-size: 0.8rem; font-weight: 700; color: var(--color-text);
      cursor: pointer; white-space: nowrap;
    }
    .pill--on { background: var(--color-text); color: #fff; border-color: var(--color-text); }
    .icon-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 4px;
      max-height: 220px; overflow-y: auto;
    }
    .icon-opt {
      aspect-ratio: 1 / 1; border-radius: 8px;
      border: 1px solid var(--color-border); background: #fff;
      display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 8px;
    }
    .icon-opt img { width: 100%; height: 100%; }
    .icon-opt--on { border: 2px solid var(--shop-active, #E2725B); background: var(--color-card-alt); }
    .sheet-actions { display: flex; justify-content: space-between; gap: 0.5rem; margin-top: 0.25rem; }
    .btn {
      border: none; border-radius: 9999px; padding: 0.7rem 1.4rem;
      font-size: 0.85rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
      cursor: pointer;
    }
    .btn--danger { background: transparent; color: #c0392b; border: 1px solid #e3b5ae; }
    .btn--primary { background: var(--color-sidebar); color: #fff; }
  `;
}

customElements.define('home-shopping', HomeShopping);
