# Home HQ Dashboard

A family home dashboard inspired by https://home-dashboard.wesbos.workers.dev/

## Stack

- **Vite** — build tool / dev server (port 3000)
- **Lit 3** — web components with reactive properties. Each panel is a custom element (`<home-*>`)
- **Vanilla JS** — no framework, no virtual DOM
- **Deploy target**: static bundle (Cloudflare Pages, Netlify, or `file://`)

## Project structure

```
src/
  main.js                  # entry — imports home-app
  styles/
    global.css             # CSS custom properties, resets, design tokens
  components/
    home-app.js            # root shell: sidebar + section routing
    home-sidebar.js        # vertical nav + clock
    today/
      home-today.js        # Today view (main dashboard)
      home-clock.js        # large live clock + date
      home-weather.js      # current temp, condition, hourly row, AI narrative
      home-family-map.js   # family member locations + ETAs
      home-next-event.js   # yellow "next up" countdown card
      home-on-this-day.js  # photo from this date in past years
      home-family-cal.js   # per-person event columns for today
      home-chores-mini.js  # circular progress rings summary
      home-shopping-mini.js# item count + first few items
      home-home-mini.js    # lights/lock/temp summary
    calendar/
      home-calendar.js     # day/3-day/week/month timeline
    chores/
      home-chores.js       # morning/after-school/evening per-person columns
    shopping/
      home-shopping.js     # grouped grocery list + usuals quick-add
    photos/
      home-photos.js       # full-bleed "on this day" slideshow
    home-control/
      home-control.js      # smart home: lights, locks, climate, media, cameras
    agents/
      home-agents.js       # AI service usage meters + sparklines
```

## Design system (CSS custom properties in global.css)

```
--color-bg: #f0ebe0          warm cream background
--color-sidebar: #1a1a1a     near-black sidebar
--color-card: #ffffff
--color-card-alt: #f5f0e8

--color-wes: #3b82f6         blue
--color-claudia: #ec4899     pink/magenta
--color-buzzsaw: #10b981     teal/green
--color-skidmark: #f59e0b    amber/yellow

--font-serif: Georgia, serif  headings, event names, display numbers
--font-sans: system-ui        labels, metadata, UI chrome

--sidebar-width: 80px
--radius: 12px
```

Active states: yellow/amber bg for lights on, blue bg for blinds/shades open.
Completed chores: strikethrough + dark checkmark tile.

## Sections (hash routing via `location.hash`)

| Hash | Component | Description |
|------|-----------|-------------|
| `#today` | `<home-today>` | Main dashboard overview |
| `#calendar` | `<home-calendar>` | Full calendar with timeline |
| `#chores` → routes to `#tasks` | `<home-chores>` | Chore tracker per person |
| `#shopping` | `<home-shopping>` | Shared grocery list |
| `#photos` | `<home-photos>` | On This Day photo viewer |
| `#control` | `<home-control>` | Smart home controls |
| `#agents` | `<home-agents>` | AI service usage dashboard |

## Today view layout (grid)

```
[ CLOCK + DATE ] [ WEATHER          ] [ FAMILY LOCATIONS ]
[ NEXT EVENT (yellow, large)        ] [ ON THIS DAY photo ]
[ WES | CLAUDIA | BUZZSAW | SKIDMARK] [ CHORES rings      ]
[                                   ] [ SHOPPING mini     ]
[                                   ] [ HOME mini         ]
```

## Widget specs

### Clock (`<home-clock>`)
- Live — updates every second
- Large serif display number, smaller "PM/AM"
- Day of week + full date beneath

### Weather (`<home-weather>`)
- Current temp (large), condition label, H/L
- AI narrative sentence ("Rain from 4PM. Pack a rain jacket for soccer.")
- Hourly row: time label + weather icon + temp for next ~7 hours

### Family locations (`<home-family-map>`)
- Avatar circle (initial + person color) + name
- Status: "Home" / "At the office" / "ETA X min" (in blue when ETA)

### Next event card (`<home-next-event>`)
- Yellow card; label "NEXT UP · [PERSON]"
- Event title in large serif
- Time + location
- Countdown: "XX MIN" (large, right side)
- "LEAVE IN X MIN" button (dark pill)

### Calendar (`<home-calendar>`)
- Views: TODAY / 3 DAY / WEEK / MONTH
- Day-of column per family member (color-coded header)
- Red "current time" indicator line
- All-day events banner across top
- Event chips show "Leave X:XX" travel time
- +/- navigation, + button for new event

### Chores (`<home-chores>`)
- Time-of-day tabs: MORNING / AFTER SCHOOL / EVENING
- Per-person column with colored header, name, score (★ points), ratio badge
- Chore card: emoji icon, name, star value
- Completed = strikethrough + dark checkmark overlay
- OVERDUE = red border + red "OVERDUE" label
- "THIS WEEK" dot row (M T W T F S S) for completion history
- "ANYONE" column for unassigned chores
- Overall counter (X/Y DONE) top right

### Shopping (`<home-shopping>`)
- "Groceries — X to get"
- Store filter pills: ALL / FRESHCO / COSTCO
- Grouped by category (Produce, Bakery, Meat & Fish, etc.)
- Each item: checkbox, name, notes, store badge (if specific store), quantity stepper (- N +)
- Right panel: text input "+ Add an item..." + "USUALS · TAP TO ADD" grid of dark quick-add tiles (shows "ON LIST" if already added)

### Photos (`<home-photos>`)
- Full-bleed background photo
- "ON THIS DAY · X YEARS AGO TODAY · LOCATION" overlay text
- Large date (e.g., "November 1, 2019")
- Display mode pills: AUTO / COVER / PAIR / COLLAGE / POLAROID
- Prev / Next arrows + FAVOURITE button

### Home control (`<home-control>`)
- Summary row: LIGHTS (count + rooms), SECURITY (locked/unlocked), CLIMATE (temp), MEDIA (playing/paused)
- Scene buttons: MORNING / DINNER / MOVIE / AWAY / GOODNIGHT
- Per-room sections with device cards:
  - Lights: icon + name + brightness %; yellow bg when on
  - Blinds/shades: blue bg when open, shows % open
  - Locks: "Locked/Unlocked", hold-to-unlock interaction
- Right panel: thermostat (large temp, SET TO label, HEAT/COOL/AUTO/OFF tabs, inside temp + humidity)
- Camera snapshots grid (auto-refresh every 20s) — Front Porch, Driveway, etc.
- Now Playing: album art, track, artist, pause/play button

### Agents (`<home-agents>`)
- Cards per AI service: Claude, Codex (ChatGPT), Cursor, Gemini, Copilot
- Each card: service name + plan tier + status dot (green=operational, amber=degraded)
- Warning banner (amber) for "Near session limit" / "Elevated errors"
- Usage meters with progress bar + % + "X over/under pace" label + reset timer
- Tokens today + API cost today + mini sparkline chart
- "ALL AGENTS" summary card: stacked bar chart (7 days), total tokens + API cost, color legend

## Conventions

- One component per file, named `home-*.js`
- Use Lit `css\`` tagged template for component styles (scoped)
- Shared design tokens via CSS custom properties (inherited through shadow DOM with `::part` or CSS vars)
- Data is mocked/static to start; each component accepts properties for its data
- No global state manager — parent passes data down via properties
- `home-app.js` owns routing (hash) and renders the active section
- `home-sidebar.js` contains the nav + bottom clock display

## Dev

```bash
npm run dev     # http://localhost:3000
npm run build   # dist/
npm run preview # preview production build
```
