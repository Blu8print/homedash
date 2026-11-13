import { LitElement, html, css } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { supabase } from '../../lib/supabase.js';

const BUCKET_URL = 'https://unwclrqvrmnaynsoyhqc.supabase.co/storage/v1/object/public/screensaver';
const SLIDE_MS = 8000;

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
  };

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
      object-fit: contain;
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
      justify-content: flex-end;
      background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 40%, transparent 65%);
      pointer-events: none;
      padding: 48px 56px;
      box-sizing: border-box;
    }

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
  }

  async _loadPhotos() {
    const { data, error } = await supabase.storage.from('screensaver').list('', { limit: 500 });
    if (error || !data?.length) return;
    const images = data.filter(f => f.name && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    this._photos = shuffle(images.map(f => `${BUCKET_URL}/${f.name}`));
    this._idx = 0;
    this._slideTimer = setInterval(() => {
      this._idx = (this._idx + 1) % this._photos.length;
    }, SLIDE_MS);
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
      return {
        temp: Math.round(d.current.temp_c),
        cond: d.current.condition.text,
        code: d.current.condition.code,
      };
    } catch { return null; }
  }

  render() {
    const photo   = this._photos[this._idx];
    const weather = this._getWeather();
    const total   = this._photos.length;

    if (!photo) {
      return html`
        <div class="overlay" style="justify-content:center;align-items:center;pointer-events:auto">
          <div style="color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:0.9rem">Loading photos…</div>
        </div>
      `;
    }

    return html`
      ${keyed(this._idx, html`
        <div class="bg" style="background-image:url('${photo}')"></div>
        <img class="photo" src="${photo}" alt="" />
      `)}
      <div class="overlay">
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
