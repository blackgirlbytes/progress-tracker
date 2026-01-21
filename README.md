# 🎯 OS DevRel Progress Tracker

A real-time dashboard that tracks your team's quarterly and monthly goals against completed Asana tasks.

## Features

- 📊 **Quarterly & Monthly Views** - Track progress at different time scales
- 🔄 **Multi-Quarter Support** - View historical quarters and add new ones easily
- 🎯 **Goal Tracking** - Compare completed tasks against numeric targets
- 👥 **Assignee Tracking** - See who completed each task
- 📈 **Progress Visualization** - Color-coded status (On Track, At Risk, Behind)
- 🔍 **Drill-down** - Click to see specific tasks for each deliverable
- ⏰ **Auto-refresh** - Updates every 5 minutes

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your Asana token:**
   
   Create a `.env` file in the project root:
   ```
   ASANA_TOKEN=your_personal_access_token_here
   ```
   
   Get your token from: https://app.asana.com/0/my-apps

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open the dashboard:**
   
   Visit http://localhost:3000

---

## 🔮 Adding New Quarters (Future-Proofing)

When a new quarter starts, you have two options:

### Option 1: Ask Goose to Update (Recommended)

Simply share your new goals with Goose and say:

> "Here are my Q2 2026 goals. Please update the goals.config.js file."

Then provide your goals in any format (table, list, etc.). Goose will:
1. Add the new quarter to `QUARTERLY_GOALS`
2. Add monthly breakdowns to `MONTHLY_GOALS`
3. Update `QUARTER_CONFIG` with date ranges
4. Add any new tag mappings if needed

### Option 2: Manual Update

Edit `goals.config.js` directly:

1. **Add quarterly goals:**
   ```javascript
   // In QUARTERLY_GOALS, add:
   '2026-Q2': {
     'Build': {
       'Side projects': 4,
       'goose contributions': 4,
       // ... more deliverables
     },
     // ... more categories
   },
   ```

2. **Add monthly goals:**
   ```javascript
   // In MONTHLY_GOALS, add:
   '2026-Q2': {
     'April': {
       'Build': { 'Side projects': 2, 'goose contributions': 2 },
       // ... more categories
     },
     'May': { /* ... */ },
     'June': { /* ... */ },
   },
   ```

3. **Quarter config is already set** - `QUARTER_CONFIG` has all quarters pre-defined with date ranges.

---

## Configuration Files

### `goals.config.js`

The main configuration file containing:

| Export | Description |
|--------|-------------|
| `QUARTERLY_GOALS` | Goals for each quarter (e.g., `'2026-Q1': { ... }`) |
| `MONTHLY_GOALS` | Monthly breakdown for each quarter |
| `TAG_CATEGORY_MAP` | Maps Asana tag GIDs to categories |
| `TAG_NAME_MAP` | Fallback mapping by tag name |
| `QUARTER_CONFIG` | Date ranges and month names for each quarter |
| `getCurrentQuarter()` | Helper to get current quarter ID |
| `getAvailableQuarters()` | Helper to list configured quarters |

### `.env`

Environment variables (not committed to git):
```
ASANA_TOKEN=your_token_here
```

---

## Task Categorization

Tasks are categorized based on:

1. **Asana Tag GIDs** (most reliable)
2. **Tag Names** (fallback)
3. **Task Name Keywords** (last resort)

| Tag/Keyword | Category | Deliverable |
|-------------|----------|-------------|
| `video tutorial`, `tutorial` | Videos | Tutorial videos |
| `video`, `[shorts]` | Videos | Shorts |
| `blog` | Blogs | Blog posts |
| `livestream` | Livestreams | Vibe Code w/ goose streams |
| `podcast` | Public Speaking | Podcast recordings |
| `public speaking`, `workshop` | Public Speaking | Talks delivered |
| `cfp` | Public Speaking | CFP applications |
| `newsletter` | Community | Newsletter issues |
| `documentation`, `guide` | Documentation | Docs |
| `goose` | Build | goose contributions |

### Adding New Categories

To add a new category or deliverable:

1. Add to `QUARTERLY_GOALS` and `MONTHLY_GOALS` in `goals.config.js`
2. Add tag mappings to `TAG_CATEGORY_MAP` (by GID) or `TAG_NAME_MAP` (by name)
3. Optionally add keyword detection in `server.js` → `categorizeTask()`
4. Add icon in `public/index.html` → `CATEGORY_ICONS`

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/quarters` | List available quarters |
| `GET /api/progress/:quarterId` | Get progress for a specific quarter |
| `GET /api/progress` | Get progress for current quarter (redirects) |
| `GET /api/uncategorized/:quarterId` | Debug: show uncategorized tasks |

---

## Project Structure

```
progress-tracker/
├── server.js           # Express server & Asana API integration
├── goals.config.js     # 📝 EDIT THIS for new quarters/goals
├── public/
│   └── index.html      # Dashboard frontend
├── package.json
├── .env                # Your Asana token (not in git)
├── .gitignore
├── start.sh            # Helper script to run
└── README.md
```

---

## Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** Vanilla HTML/CSS/JS
- **API:** Asana REST API
- **Styling:** CSS Variables, CSS Grid, Inter font

---

## Troubleshooting

### "ASANA_TOKEN not configured"
- Make sure `.env` file exists with your token
- Restart the server after adding the token

### Tasks not being categorized
- Check `/api/uncategorized` to see which tasks aren't mapped
- Add appropriate tags in Asana, or update `TAG_CATEGORY_MAP`

### Wrong quarter showing
- The app auto-detects current quarter based on system date
- Use the dropdown to manually select a different quarter
