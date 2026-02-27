# Hurricane Intelligence Platform v3 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Hurricane Dashboard as a clean, Dragon-styled single-page app with KPI dashboard + interactive timeline explorer.

**Architecture:** Single HTML file (`index.html`) + one JS module (`app.js`) + existing data files. No frameworks, no iframes, no build step. Plotly for the scatter timeline, Leaflet for storm track maps. Dragon Design System for all styling.

**Tech Stack:** Vanilla HTML/CSS/JS, Plotly.js (CDN), Leaflet.js (CDN), Google Fonts (Libre Baskerville, Source Sans Pro, IBM Plex Mono)

**Data assets (already copied from v2):**
- `atlantic-storms-enhanced.js` — 2,004 storms, loads as `ATLANTIC_STORMS_ENHANCED` global array
- `hurdat2_data/points_[decade]s.geojson` — storm track points with wind/status per observation
- `hurdat2_data/tracks_[decade]s.geojson` — simple polyline fallbacks

**Storm object shape** (from atlantic-storms-enhanced.js):
```js
{
  storm_id: "AL092022",    // HURDAT2 ID
  name: "IAN",
  year: 2022, month: 9, day: 22,
  category: 5,             // -1=TD, 0=TS, 1-5
  wind_mph: 160,
  pressure: 937,
  landfall_states: ["FL", "SC"],
  deaths: 156,
  narrative: "Description...",
  resources: { tcr_pdf: "https://..." }
}
```

**Category colors** (preserved from v2):
```js
{ 0: "#8B9DC3", 1: "#5CB85C", 2: "#F0AD4E", 3: "#FF7F00", 4: "#D9534F", 5: "#8B008B" }
```

---

### Task 1: Create index.html with Dragon Design skeleton

**Files:**
- Create: `index.html`

**Step 1: Write the HTML file**

Create `index.html` with:
- Dragon Design System CSS tokens (all `:root` variables from the skill)
- Google Fonts import (Libre Baskerville, Source Sans Pro, IBM Plex Mono)
- Plotly.js CDN (`https://cdn.plot.ly/plotly-2.27.0.min.js`)
- Leaflet.js CDN (CSS + JS, v1.9.4)
- Script tags for `atlantic-storms-enhanced.js` and `app.js`

**Page structure (top to bottom):**

1. **Header** — white bg, 3px black bottom border
   - Red Cross SVG mark + "American Red Cross" label (13px uppercase, red)
   - "Hurricane Intelligence Platform" in Libre Baskerville 36px bold
   - "1,999 Atlantic storms (1851-2025) — HURDAT2 Best Track Data" subtitle

2. **KPI row** — 4 white cards on cream bg, inside `.container` (max-width 1200px)
   - Total Storms (IBM Plex Mono 32px, this one in red)
   - Category 5 Hurricanes (black)
   - Major Hurricanes Cat 3-5 (black)
   - U.S. Landfalls (black)
   - Each card: 1px gray-100 border, 4px border-radius, 24px padding
   - Label: 12px uppercase Source Sans, gray-500
   - Sublabel: 13px, gray-500 (e.g., "1851-2025")

3. **Explorer section** — red rule + section header "Timeline Explorer"
   - **Filter bar** (sticky white strip, 1px bottom border):
     - Search input (pill-styled)
     - Category pills: TS, Cat 1, 2, 3, 4, 5 (Dragon pill style: rounded, outlined, black fill when active)
     - Default active: Cat 3, 4, 5
     - Landfall Only toggle pill
     - Show Names toggle pill
     - Year range display (e.g., "2010-2025")
   - **Split panel** — `display: flex`
     - Left 65%: `<div id="timeline">` for Plotly
     - Right 35%: Storm detail sidebar
       - Storm header: category badge (colored circle) + name + quick stats row
       - Map container: `<div id="map">` with compact horizontal legend
       - Narrative panel: "Historical Narrative" header + scrollable text

4. **Footer** — white, 3px black top border, copyright + data attribution

**CSS notes:**
- All Dragon tokens as CSS variables
- `body { background: var(--arc-cream); }`
- Cards are white on cream
- Filter pills: `border-radius: 20px; border: 1px solid var(--arc-gray-300);`
- Active pill: `background: var(--arc-black); color: white;`
- Map container: fixed height (calc-based to fill available space)
- Responsive: on mobile (<768px), stack timeline above sidebar

**Step 2: Verify HTML loads without JS errors**

Run: `cd /Users/jefffranzen/hurricane-dashboard-v3 && python3 -m http.server 8000 &`
Open: `http://localhost:8000`
Expected: Dragon-styled page with header, empty KPI cards, empty explorer section, no console errors.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: Dragon-styled HTML skeleton with KPI dashboard and explorer layout"
```

---

### Task 2: Create app.js — KPI computation and filter state

**Files:**
- Create: `app.js`

**Step 1: Write the core app initialization**

```js
// app.js — Hurricane Intelligence Platform v3

(function() {
  'use strict';

  // --- State ---
  let storms = [];
  let filteredStorms = [];
  let map = null;
  let mapLayers = [];
  let currentStorm = null;

  const CATEGORY_COLORS = {
    '-1': '#D3D3D3', 0: '#8B9DC3', 1: '#5CB85C',
    2: '#F0AD4E', 3: '#FF7F00', 4: '#D9534F', 5: '#8B008B'
  };

  const DEFAULT_CATEGORIES = [3, 4, 5];

  // --- Filter state ---
  let activeCategories = new Set(DEFAULT_CATEGORIES);
  let landfallOnly = false;
  let showNames = true;
  let yearMin = 2010;
  let yearMax = 2025;
  let searchQuery = '';

  // --- Initialization ---
  function init() {
    storms = typeof ATLANTIC_STORMS_ENHANCED !== 'undefined' ? ATLANTIC_STORMS_ENHANCED : [];
    computeKPIs();
    setupFilters();
    applyFilters();
    initMap();
  }

  function computeKPIs() {
    document.getElementById('kpi-total').textContent = storms.length.toLocaleString();
    document.getElementById('kpi-cat5').textContent = storms.filter(s => s.category === 5).length;
    document.getElementById('kpi-major').textContent = storms.filter(s => s.category >= 3).length.toLocaleString();
    document.getElementById('kpi-landfall').textContent = storms.filter(s =>
      Array.isArray(s.landfall_states) && s.landfall_states.length > 0
    ).length.toLocaleString();
  }

  // ... rest of app
  document.addEventListener('DOMContentLoaded', init);
})();
```

**Step 2: Verify KPIs populate**

Reload page. Expected: 4 KPI numbers appear (2,004 | 45 | 342 | 545 or similar).

**Step 3: Commit**

```bash
git add app.js
git commit -m "feat: app.js with KPI computation and filter state management"
```

---

### Task 3: Implement filter UI and filter logic

**Files:**
- Modify: `app.js` (add filter functions)
- Modify: `index.html` (wire filter event listeners)

**Step 1: Implement filter functions in app.js**

Add to app.js:
- `setupFilters()` — attach click handlers to category pills (toggle active class + update `activeCategories` Set), search input (debounced), landfall toggle, show names toggle
- `applyFilters()` — filter `storms` array by: year range, active categories, landfall-only flag, name search query. Store result in `filteredStorms`. Call `createTimeline()`.
- Category pill click: toggle `active` class (Dragon: black bg + white text), toggle category in Set, call `applyFilters()`
- Year range: two number inputs or a Plotly relayout event to capture y-axis zoom changes

**Step 2: Verify filters work**

Click category pills on/off, type in search, toggle landfall. Timeline should update each time.

**Step 3: Commit**

```bash
git add app.js index.html
git commit -m "feat: filter bar with category pills, search, landfall toggle"
```

---

### Task 4: Implement Plotly scatter timeline

**Files:**
- Modify: `app.js` (add `createTimeline()`)

**Step 1: Implement the scatter plot**

Port the `createTimeline()` function from v2 (`enhanced-timeline.html:392-506`):
- X-axis: months (Jun-Dec), position = `month + (day-1)/31`
- Y-axis: year with season offset, `year + (month - 6 + (day-1)/31) / 7`
- Y-axis reversed (most recent on top)
- Markers: sized by wind speed (`10 + wind_mph/10`), colored by category
- Text labels: storm names (toggled by `showNames`)
- Hover template: name, date, category, wind
- Responsive, hide Plotly logo
- Click handler: call `selectStorm(filteredStorms[pointIndex])`
- Dynamic Y-axis tick calculation (max 15 gridlines, nice intervals)

**Step 2: Verify timeline renders**

Expected: Plotly scatter chart with colored dots, clickable, filters update it.

**Step 3: Commit**

```bash
git add app.js
git commit -m "feat: Plotly scatter timeline with year/month axes and click selection"
```

---

### Task 5: Implement storm sidebar — info panel + Leaflet map

**Files:**
- Modify: `app.js` (add `selectStorm()`, `initMap()`, `showStormOnMap()`, `loadStormTrack()`, `drawRainbowTrack()`)

**Step 1: Implement `selectStorm(storm)`**

Update the right sidebar:
- Category badge: colored circle with category number (or "TS")
- Storm name in Libre Baskerville 18px bold
- Stats row: Date, Wind (mph), Landfall states — IBM Plex Mono
- Call `showStormOnMap(storm)`
- Update narrative text

**Step 2: Implement `initMap()`**

Initialize Leaflet map in `#map` div:
- OpenStreetMap tiles
- Default center: Atlantic basin [25, -70], zoom 4
- Compact horizontal legend overlay (category colors)

**Step 3: Implement `showStormOnMap(storm)` and `loadStormTrack(storm)`**

Port from v2 (`enhanced-timeline.html:946-1081`):
- Clear existing layers
- Calculate decade: `Math.floor(storm.year / 10) * 10`
- Fetch `hurdat2_data/points_[decade]s.geojson`
- Filter features by `storm_id`
- If found: call `drawRainbowTrack()`
- If not: try `tracks_[decade]s.geojson` for simple line
- Fallback: single point marker at storm's lat/lon

**Step 4: Implement `drawRainbowTrack(pointFeatures, storm)`**

Port from v2 (`enhanced-timeline.html:1093-1190`):
- Sort points by datetime
- Build segments: each pair of adjacent points gets a colored polyline based on wind-speed-derived category
- Wind (knots) to category: >=137→5, >=113→4, >=96→3, >=83→2, >=64→1, else→0
- Animate: draw segments with 20-50ms delay (speed adapts to segment count)
- Fit map bounds to full track with padding

**Step 5: Verify storm selection flow**

Click storm on timeline → sidebar updates with name/stats → map shows animated rainbow track → narrative appears.

**Step 6: Commit**

```bash
git add app.js
git commit -m "feat: storm sidebar with Leaflet map and animated rainbow track drawing"
```

---

### Task 6: Polish, responsive, and visual QA

**Files:**
- Modify: `index.html` (CSS tweaks)
- Modify: `app.js` (edge cases)

**Step 1: Visual polish**

- Verify Dragon design compliance: cream bg, white cards, serif headlines, mono data, red accents
- Fix any spacing issues (4px base grid)
- Scrollbar styling (thin, gray)
- Ensure narrative panel scrolls for long text
- "Select a storm" placeholder state in sidebar

**Step 2: Responsive layout**

- Under 768px: stack timeline above sidebar (column layout)
- KPI cards: 2x2 grid on mobile
- Filter pills: wrap to multiple lines
- Reduce h1 to 28px on mobile

**Step 3: Playwright screenshot and visual verification**

Take screenshots at 1440px and 375px widths. Verify:
- Dragon design looks correct
- Timeline is readable
- Map displays properly
- No console errors

**Step 4: Commit**

```bash
git add index.html app.js
git commit -m "feat: responsive layout and Dragon design polish"
```

---

### Task 7: Deploy to GitHub and verify

**Files:**
- Create: `.gitignore`
- Create: `README.md` (brief, not v2's bloated version)

**Step 1: Create .gitignore**

```
.DS_Store
node_modules/
.env
```

**Step 2: Create GitHub repo and push**

```bash
gh repo create franzenjb/hurricane-dashboard-v3 --public --source=. --push
```

**Step 3: Enable GitHub Pages (main branch)**

```bash
gh api repos/franzenjb/hurricane-dashboard-v3/pages -X POST -f source.branch=main -f source.path=/
```

**Step 4: Verify live site with Playwright**

Wait 2-3 minutes, then screenshot `https://franzenjb.github.io/hurricane-dashboard-v3/`
Verify: loads, KPIs populate, timeline renders, clicking storms works.

**Step 5: Update PROJECT-REGISTRY.md**

Add hurricane-dashboard-v3 entry.

**Step 6: Commit any remaining files**

```bash
git add .
git commit -m "feat: deploy v3 to GitHub Pages"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | HTML skeleton + Dragon CSS | `index.html` |
| 2 | App init + KPI computation | `app.js` |
| 3 | Filter UI + filter logic | `app.js`, `index.html` |
| 4 | Plotly scatter timeline | `app.js` |
| 5 | Storm sidebar + Leaflet map + rainbow tracks | `app.js` |
| 6 | Polish, responsive, visual QA | `index.html`, `app.js` |
| 7 | Deploy + verify + registry update | `.gitignore`, `README.md` |
