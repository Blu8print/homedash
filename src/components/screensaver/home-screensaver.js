import { LitElement, html, css } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { supabase } from '../../lib/supabase.js';
import { getSlideSecs } from '../home-settings.js';

const BUCKET_URL = 'https://unwclrqvrmnaynsoyhqc.supabase.co/storage/v1/object/public/screensaver';
const PHOTO_LIST_CACHE_KEY = 'screensaver_photo_list';
const PHOTO_LIST_TTL = 24 * 60 * 60 * 1000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pad(n) { return String(n).padStart(2, '0'); }

function wapiEmoji(code) {
  if (code === 1000)                                                   return '☀';
  if (code === 1003)                                                   return '⛅';
  if (code === 1006 || code === 1009)                                  return '☁';
  if (code === 1030 || code === 1135 || code === 1147)                 return '🌫';
  if ([1087,1273,1276,1279,1282].includes(code))                       return '⛈';
  if ([1222,1225,1258].includes(code))                                 return '❄';
  if ([1204,1207,1210,1213,1216,1219,1249,1252,1255].includes(code))  return '🌨';
  if ([1237,1261,1264].includes(code))                                 return '🌩';
  if ([1063,1150,1153,1168,1180,1240].includes(code))                  return '🌦';
  return '🌧';
}

export class HomeScreensaver extends LitElement {
  static properties = {
    _photos: { state: true },
    _idx:    { state: true },
    _time:   { state: true },
    _cover:  { state: true },
  };

  _blobCache = new Map();

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: block;
      background: #000;
      cursor: none;
      overflow: hidden;
    }

    .bg {
      position: absolute;
      inset: -10%;
      background-size: cover;
      background-position: center;
      filter: blur(40px) brightness(0.35);
      animation: fadein 1.5s ease-in-out forwards;
    }

    .photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      animation: fadein 1.5s ease-in-out forwards;
    }

    @keyframes fadein {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(to bottom,
        rgba(0,0,0,0.55) 0%,
        transparent 28%,
        transparent 65%,
        rgba(0,0,0,0.65) 100%
      );
      pointer-events: none;
      padding: 48px 56px;
      box-sizing: border-box;
    }

    /* ── Top section (events) ── */
    .ss-top {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 540px;
    }

    .ss-next-card {
      background: rgba(255,255,255,0.14);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 16px;
      padding: 18px 22px;
      color: #fff;
    }

    .ss-next-label {
      font-family: var(--font-sans, system-ui);
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.6);
      margin-bottom: 8px;
    }

    .ss-next-hero {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .ss-next-title {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 1.9rem;
      font-weight: 700;
      line-height: 1.1;
      color: #fff;
      flex: 1;
    }

    .ss-next-meta {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.6);
      margin-top: 4px;
    }

    .ss-next-countdown {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
    }

    .ss-count-num {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 2.4rem;
      font-weight: 900;
      line-height: 1;
      color: #fff;
    }

    .ss-count-label {
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: rgba(255,255,255,0.5);
      margin-top: 2px;
    }

    .ss-event-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .ss-event-row {
      display: flex;
      align-items: center;
      gap: 10px;
      color: rgba(255,255,255,0.8);
      font-family: var(--font-sans, system-ui);
      font-size: 0.82rem;
    }

    .ss-event-time {
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      min-width: 36px;
      flex-shrink: 0;
    }

    /* ── Bottom row ── */
    .bottom-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }

    .clock-time {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 7.5rem;
      font-weight: 900;
      line-height: 1;
      color: #fff;
      letter-spacing: -0.03em;
      text-shadow: 0 2px 24px rgba(0,0,0,0.5);
    }

    .clock-date {
      font-family: var(--font-sans, system-ui);
      font-size: 1.1rem;
      color: rgba(255,255,255,0.75);
      margin-top: 8px;
      text-transform: capitalize;
      letter-spacing: 0.01em;
    }

    .right-stack {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    }

    .weather-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 999px;
      padding: 10px 20px;
      color: #fff;
      font-family: var(--font-sans, system-ui);
    }

    .weather-icon { font-size: 1.5rem; line-height: 1; }

    .weather-temp {
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1;
    }

    .weather-cond {
      font-size: 0.85rem;
      opacity: 0.75;
      font-weight: 500;
    }

    .tap-hint {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.3);
      font-size: 0.7rem;
      font-family: var(--font-sans, system-ui);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      pointer-events: none;
    }

    .dots {
      display: flex;
      gap: 6px;
      justify-content: center;
    }
    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      transition: background 0.3s;
    }
    .dot.active { background: rgba(255,255,255,0.9); }
  `;

  constructor() {
    super();
    this._photos = [];
    this._idx    = 0;
    this._time   = this._nowTime();
    this._cover  = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadPhotos();
    this._clockTimer = setInterval(() => { this._time = this._nowTime(); }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockTimer);
    clearInterval(this._slideTimer);
    for (const url of this._blobCache.values()) URL.revokeObjectURL(url);
    this._blobCache.clear();
  }

  async _loadPhotos() {
    let urls = null;

    try {
      const cached = JSON.parse(localStorage.getItem(PHOTO_LIST_CACHE_KEY));
      if (cached?.urls?.length && Date.now() - cached.ts < PHOTO_LIST_TTL) {
        urls = cached.urls;
      }
    } catch {}

    if (!urls) {
      const { data, error } = await supabase.storage.from('screensaver').list('', { limit: 500 });
      if (error || !data?.length) return;
      const images = data.filter(f => f.name && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
      urls = images.map(f => `${BUCKET_URL}/${f.name}`);
      try {
        localStorage.setItem(PHOTO_LIST_CACHE_KEY, JSON.stringify({ ts: Date.now(), urls }));
      } catch {}
    }

    this._photos = shuffle(urls);
    this._idx = 0;
    this._preloadAhead(0);

    this._slideTimer = setInterval(() => {
      this._idx = (this._idx + 1) % this._photos.length;
      this._cover = true;
      this._preloadAhead(this._idx);
    }, getSlideSecs() * 1000);
  }

  async _preloadAhead(fromIdx) {
    const len = this._photos.length;
    if (!len) return;
    const indices = [0, 1, 2].map(i => (fromIdx + i) % len);
    for (const i of indices) {
      const url = this._photos[i];
      if (!this._blobCache.has(url)) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            this._blobCache.set(url, URL.createObjectURL(blob));
          }
        } catch {}
      }
    }
    this.requestUpdate();
  }

  _onPhotoLoad(e) {
    const img = e.target;
    this._cover = img.naturalWidth >= img.naturalHeight;
  }

  _nowTime() {
    const now = new Date();
    return {
      display: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  }

  _getWeather() {
    try {
      const cached = JSON.parse(localStorage.getItem('weather_cache'));
      if (!cached?.data) return null;
      const d = cached.data;
      return { temp: Math.round(d.current.temp_c), cond: d.current.condition.text, code: d.current.condition.code };
    } catch { return null; }
  }

  _getEvents() {
    try {
      const cached = JSON.parse(localStorage.getItem('calendar_events_cache'));
      if (!cached?.events) return [];
      const now = Date.now();
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      return cached.events.filter(ev => {
        if (!ev.start?.dateTime) return false;
        const start = new Date(ev.start.dateTime).getTime();
        const end = ev.end?.dateTime ? new Date(ev.end.dateTime).getTime() : start;
        return end > now && start <= todayEnd.getTime();
      }).sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
    } catch { return []; }
  }

  _countdownDisplay(startMs) {
    const now = Date.now();
    if (now >= startMs) return { top: 'NOW', bottom: null, label: null };
    const diffMin = Math.ceil((startMs - now) / 60000);
    if (diffMin >= 60) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return { top: `${h}H`, bottom: m > 0 ? `${m}M` : null, label: null };
    }
    return { top: String(diffMin), bottom: null, label: 'MIN' };
  }

  _renderEvents() {
    const events = this._getEvents();
    if (!events.length) return '';

    const now = Date.now();
    const threeHours = 3 * 60 * 60 * 1000;
    const nextEvent = events.find(ev => {
      const start = new Date(ev.start.dateTime).getTime();
      const end = ev.end?.dateTime ? new Date(ev.end.dateTime).getTime() : start;
      return end > now && (start - now) <= threeHours;
    });
    const restEvents = events.filter(ev => ev !== nextEvent);
    const fmtTime = ev => {
      const d = new Date(ev.start.dateTime);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return html`
      <div class="ss-top">
        ${nextEvent ? (() => {
          const { top, bottom, label } = this._countdownDisplay(new Date(nextEvent.start.dateTime).getTime());
          return html`
            <div class="ss-next-card">
              <div class="ss-next-label">Next Up</div>
              <div class="ss-next-hero">
                <div style="flex:1;min-width:0">
                  <div class="ss-next-title">${nextEvent.summary ?? '(no title)'}</div>
                  <div class="ss-next-meta">${fmtTime(nextEvent)}</div>
                </div>
                <div class="ss-next-countdown">
                  <div class="ss-count-num">${top}</div>
                  ${bottom ? html`<div class="ss-count-num">${bottom}</div>` : ''}
                  ${label ? html`<div class="ss-count-label">${label}</div>` : ''}
                </div>
              </div>
            </div>
          `;
        })() : ''}
        ${restEvents.length ? html`
          <div class="ss-event-list">
            ${restEvents.slice(0, 4).map(ev => html`
              <div class="ss-event-row">
                <span class="ss-event-time">${fmtTime(ev)}</span>
                <span>${ev.summary ?? '(no title)'}</span>
              </div>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }

  render() {
    const photo   = this._photos[this._idx];
    const weather = this._getWeather();
    const total   = this._photos.length;
    const src     = photo ? (this._blobCache.get(photo) ?? photo) : null;

    if (!photo) {
      return html`
        <div class="overlay" style="justify-content:center;align-items:center;pointer-events:auto">
          <div style="color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:0.9rem">Loading photos…</div>
        </div>
      `;
    }

    return html`
      ${keyed(this._idx, html`
        <div class="bg" style="background-image:url('${src}')"></div>
        <img class="photo" src="${src}" alt="" @load=${this._onPhotoLoad}
             style="object-fit:${this._cover ? 'cover' : 'contain'}" />
      `)}
      <div class="overlay">
        ${this._renderEvents()}
        <div class="bottom-row">
          <div class="clock-left">
            <div class="clock-time">${this._time.display}</div>
            <div class="clock-date">${this._time.date}</div>
          </div>
          <div class="right-stack">
            ${weather ? html`
              <div class="weather-pill">
                <span class="weather-icon">${wapiEmoji(weather.code)}</span>
                <span class="weather-temp">${weather.temp}°</span>
                <span class="weather-cond">${weather.cond}</span>
              </div>
            ` : ''}
            ${total > 1 ? html`
              <div class="dots">
                ${Array.from({ length: Math.min(total, 12) }, (_, i) => html`
                  <div class="dot ${i === this._idx % 12 ? 'active' : ''}"></div>
                `)}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="tap-hint">Tap anywhere to continue</div>
    `;
  }
}

customElements.define('home-screensaver', HomeScreensaver);
