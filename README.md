# VBallStatApp — Community Edition

> **Community Edition (local-only).** This build runs entirely on your machine. Your videos and data stay local; there’s no cloud backend, account, or sync. Demo content streams from the CDN, but your own games play from local files.

A local-first volleyball stats + video review app. Register games, seed timestamp rows, edit stats inline, and scrub video with rally-aware controls. You can click any row in the stats table to jump the video to that moment, and in **Edit Mode** you can work the table entirely from the keyboard, just like Excel.

### Looking for the full service?

For a hosted, end-to-end solution with more features, see **https://vballtracker.mckeon.ca**.  
Includes/targets:

- Team & Player pages with tracking
- Cloud storage for uploaded videos with **resumable uploads**
- **DASH & HLS** for low-latency streaming
- **Google Cast** and **AirPlay** support
- **Roadmap:** AI to initialize tables with data, additional statistics, DataVolley import & export, CSV export, highlight reels export, augmented reality with real-time overlays, and an overlay drawing canvas

## Quick Start

### Prerequisites
- **Docker Desktop** (includes Docker Compose v2)
- **Node.js (LTS) + npm** for building the frontend once (`npm` ships with Node)

### Install Node.js/npm on Windows (terminal)

**Option A — Chocolatey (Admin PowerShell):**
```powershell
# Install Chocolatey (run in an elevated/Administrator PowerShell)
Set-ExecutionPolicy Bypass -Scope Process -Force;
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12;
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Then install Node.js LTS (includes npm)
choco install nodejs-lts -y

# New terminal:
node -v
npm -v
```

**Option B — Official Installer:** download “LTS” from https://nodejs.org/, run it, reopen PowerShell, then `node -v && npm -v`.

### Install & Run

From the repo root:
```bash
# 1) Install frontend deps (once)
cd frontend
npm install

# 2) Build and start containers
cd ..
docker compose build
docker compose up -d

# 3) Open the app
http://localhost:5173
```

To view logs:
```bash
docker compose logs -f
```

To stop:
```bash
docker compose down
```

### Mobile Access (same Wi-Fi)
This app is **mobile-friendly** on modern browsers with a responsive layout and touch-optimized controls.

To open it on your phone/tablet:
1) Put your phone on the **same network** as the computer running the app.  
2) Find your computer’s local IP (Windows):
   - **Command line:**
     ```powershell
     ipconfig
     ```
     Find your active adapter and copy the **IPv4 Address** (e.g., `192.168.1.23`).

   - **Settings path:**
     **Settings → Network & Internet →** (Wi-Fi or Ethernet) **→ Properties → IPv4 address**

3) On the phone, browse to:
  `http://<your-ip>:5173`
  Example: `http://192.168.1.23:5173`.

**Tips**
- If it doesn’t load, confirm **Docker** is running and `docker compose up -d` is active.  
- Allow any Windows Defender Firewall prompts the first time.  
- Demo video still requires internet; your own local videos play from the host machine.

## Features

- **Click-to-seek from table**: click any row in DBStats and the video jumps to that row’s timestamp.  
- **Excel-style inline editing**: edit cells in place; Enter/Tab to commit and move, Esc to cancel, arrow keys to navigate.
- **Rally-aware playback**: `Ctrl+←/→` jumps to previous/next rally; optional autoplay advances between rallies.
- **Frame-accurate review**: when paused, use `,` and `.` to step one frame backward/forward.
- **Familiar player controls**: Space to play/pause, `←/→` to rewind/forward, `0–9` to scrub by percentage, `m` to mute, `f` fullscreen, `p` picture-in-picture, `c` overlay toggle.
- **Sorting & filtering**: click column headers to sort; filter inputs appear under headers.
- **Local-first video**: your own games play from local files; on Chromium the app can remember file handles, on Firefox it mirrors to the origin’s private storage so reloads work.
- **Demo team streaming**: demo video streams from CDN (internet required).

## Using the App

### Register a Team
1. Open **Team Selector** → **Register new team**.
2. Enter a team name and register a video file, giving it a date and list of players. The players are used for syntax higlighting and autocomplete when editing the table.

### Register additional Game & Seed Rows
1. Open **Game Selector** → **New Game**.
2. Fill our the info and select a video file. The app registers the game and seeds 100 rows for editing.

### Filtering, Sorting & Highlight Reels
- **Sort by any column.** Click a header to sort; click again to toggle direction.  
  Open the filter menu on a column (funnel icon) to add one or more filters. Supported operators include:
  - `between` (numbers/dates), `=` / `!=`, `<` / `<=` / `>=` / `>`,  
  - `begins_with`, `contains`, `ends_with`,  
  - `blank` / `not_blank`.
- **Filter multiple columns.** Each column’s filter is combined with the others. You can quickly clear all filters with **Clear all** in the filter popover.
- **Play just the filtered touches.** After filtering the table, use **Play Filtered Touches** to watch a highlight reel that jumps the video through only the matching rows. Press **S** to stop the reel at any time.
- **Pause filters while editing.** Enable **Pause Filters** to *freeze* the current set. Your edits won’t cause rows to disappear until you **Resume Filters**, it's handy when cleaning up data in place.

### Edit Stats
- **Enter**: commit value; move down.
- **Shift+Enter**: commit; move up.
- **Tab**: commit value; move right.
- **Shift+Tab**: commit; move left.
- **Esc**: cancel edits in the current cell.
- **Arrow keys**: move between cells when not actively typing.
- **Add specific row**: use the green arrow icon on the left of a row to add a new row beneath it.
- **Add 10 rows**: use the large button at the bottom to add 10 rows to the bottom of the table.
- **Delete row**: use the trash icon on the row.

### Update Game Settings
Use this panel to mark a game’s readiness.
- **Has Timestamps**
  Set to **Yes** after you’ve seeded/imported the timestamp rows. This tells the app the game is ready for time-based features (click-to-seek, highlight reels, etc.).
- **Is Scored**
  Set to **Yes** once you’ve finished scoring/validating the touches. This controls whether the game is treated as “complete” for stats.

**Effects**
- **Sidebar color:** scored games appear **green**; not-scored remain **red** (so you can spot what still needs work).
- **Stats inclusion:** the **All Scored Games** option in the selector on the stats matrix page aggregates games with **Is Scored = Yes**.

> Changes are instant and persisted. They don’t modify any stats, just metadata, so you can toggle them as your workflow progresses.

### VideoPlayer Keyboard Controls
- **Space**: play/pause
- **← / →**: rewind 3s / forward 10s
- **Ctrl+← / Ctrl+→**: previous/next rally
- **, / . (paused)**: step one frame backward/forward
- **0–9**: seek to 0%–90% of the video
- **↑ / ↓**: volume up/down (mutes at 0)
- **m**: mute/unmute
- **f**: toggle fullscreen
- **p**: toggle picture‑in‑picture
- **c**: toggle overlay

> Tip: with **Autoplay** on, playback advances to the next rally automatically when a rally ends.

### Video Player Settings
Open the **gear icon** in the control bar to access player settings.
- **Camera View** *(fullscreen only)*
  Fine-tune a poorly framed recording for more comfortable playback.
  - **Zoom:** 1.0–2.0 slider
  - **Pan:** on-screen arrows, or use the **arrow keys** while the settings panel is open
  - **Rotate (tilt):** coarse **±5°** and fine **±1°** adjustments
  - **Reset:** one click to restore zoom/pan/rotation
- **Overlay Options**
  Quickly toggle informational overlays:
  - **Show Overlay** (master switch)
  - **Show Score** (score badge at top)
  - **Show Touches** (upcoming touches panel)

> Tip: Press **f** to enter fullscreen, then open **Camera View** to pan/tilt/zoom. Press **c** anytime to toggle overlays.

### Visible Columns
1. Show or hide columns to focus on what matters. 
2. If none of the visible columns contain data for the current view, the table may appear empty. Your column choices are saved and automatically restored next time.

### Stats Matrix
See a per-player matrix broken down by action (Block, Dig, Free, Hit, Pass, Serve, Set, Tip), plus totals, per team.

**Controls**
- **Team** → pick which team to analyze.
- **Select Game** → `All Games`, `All Scored Games`, or a specific game.  
  `All Scored Games` only includes games you’ve marked **Is Scored = Yes** in *Update Game Settings*.
- **Select Set** → `All Sets` or a specific set.
- **Visible Columns** → show/hide action categories (Block, Dig, …). *Your choices are saved and restored next time.*
- **Visible SubColumns** → choose metrics per action:
  - **Qty** (count), **Avg** (average quality), **✓** (success %), **✗** (fail %), **Assists** (for *Set* only).  
  - When **All Games** is selected, **Avg** is automatically hidden (not shown across multi-game rollups).  
  - Sub-column preferences are saved and restored.

**How to read it**
- Green numbers = positive metrics (✓ success %, Assists). Red numbers = negative metrics (✗ fail %).
- The **Total** block on the right aggregates Qty/Avg/✓/✗ across the visible actions for each player, with a grand total footer for the team.

**Assists logic**
- An assist is counted when a **Set** by a player is immediately followed (same rally) by a **Won Point** touch. Those counts appear in the *Set → Assists* cell for each player.

**Setting Statistics — Who Got Set?**
- Filter by **Setter** to see where sets went.
- Two distributions:
  - **By Position**: Power, Middle, Opposite, Backrow.
  - **By Player**: each recipient’s share (% of all sets in the filter).

## Repository Layout

```
.
├── docker-compose.yml        # Orchestrates the app (frontend + DB)
├── initdb/                   # SQL schema & demo seed (games/stats/teams)
└── frontend/                 # React + Vite app (package.json lives here)
    ├── Dockerfile
    ├── public/
    └── src/
```

## Browser Notes

- **Demo Team:** Requires internet to stream the demo video. Offline → the demo will not play.
- **Your Videos (local files):**
  - **Chromium (Chrome/Edge):** The app can remember files using the File System Access API. After you select a file once, we’ll reopen it next time (with permission prompts as needed).
  - **Firefox/Safari:** These don’t persist native file handles. The app mirrors the selected file into the browser’s Origin Private File System (OPFS) so it can play smoothly on reloads.

## Troubleshooting

- **`npm`/`node` not recognized:** Open a **new** terminal after installing Node so PATH updates.
- **Port 5173 already in use:** Stop the conflicting process or change the exposed port in `docker-compose.yml`.
- **Browser can’t open a just‑registered game:** You’ll be prompted to pick the original video file. Select the filename shown in the toast; the app will play it immediately and cache it for next time.
- **No internet (demo won’t load):** You’ll get a toast after a few failed attempts; your own local games still work.

## Support the project

If this app helps your team, you can ☕ **[buy me a coffee](https://buymeacoffee.com/stephenmckeon)**.  
Your support covers demo-CDN & domain costs and lets me ship more features to **both** the turnkey service and this open-source AGPL Community Edition.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/stephenmckeon)

---

© 2025 Stephen McKeon · Licensed under **AGPL-3.0** (see `LICENSE`)
