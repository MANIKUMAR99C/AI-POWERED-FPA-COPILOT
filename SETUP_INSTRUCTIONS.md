# Job Search Automation — Setup Instructions

## COST: $0 (Completely Free)

---

## Step-by-Step Setup (5 minutes)

### Step 1: Open Google Apps Script

1. Go to: **https://script.google.com**
2. Click **"New Project"** (blue + button)
3. Name it: `C2C Job Search Automation`

---

### Step 2: Paste the Code

1. Delete everything in the default `Code.gs` file
2. Open the file `JobSearchAutomation.gs` from this repository
3. Copy ALL the code
4. Paste it into the Google Apps Script editor

---

### Step 3: Verify Sheet ID

The script already has your Sheet ID configured:
```
SHEET_ID: '1Dman4U8LcYVuOZZHGWsgVUmX5OqQ2r2ViJQFgzujKn0'
```

If you need to change it:
- Open your Google Sheet
- Look at the URL: `https://docs.google.com/spreadsheets/d/XXXXX/edit`
- The `XXXXX` part is your Sheet ID

---

### Step 4: Test the Connection

1. In the Apps Script editor, select function: `testConnection` from the dropdown
2. Click **Run** (play button ▶)
3. First time: Google will ask for permissions — click **"Allow"**
4. Check the **Execution Log** — you should see:
   ```
   ✅ Connected to sheet successfully!
   ```

---

### Step 5: Run the Job Search

1. Select function: `runJobSearch` from the dropdown
2. Click **Run** (play button ▶)
3. Wait 1-3 minutes (it searches multiple pages)
4. Check your Google Sheet — new rows will appear!
5. Check **Execution Log** for the summary report

---

### Step 6 (Optional): Set Up Daily Auto-Run

1. Select function: `setupDailyTrigger`
2. Click **Run**
3. Done! It will now run automatically at **8 AM Chicago time** every day

To stop auto-run: Run `removeTriggers`

---

## Available Functions

| Function | What it does |
|----------|-------------|
| `runJobSearch` | Runs the full search (all 3 portals) |
| `testConnection` | Tests if script can access your sheet |
| `setupDailyTrigger` | Enables daily auto-search at 8 AM |
| `removeTriggers` | Stops all auto-triggers |

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  TechFetch   │     │  Corp-Corp   │     │   JobServe   │
│  (C2C jobs)  │     │ (All C2C)   │     │ (Contract)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   FILTER ENGINE  │
                    │ • Title match    │
                    │ • C2C confirmed  │
                    │ • Domain match   │
                    │ • Pay >= $40/hr  │
                    │ • Within 48 hrs  │
                    │ • US location    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  SCORE (0-100)   │
                    │ • C2C: +30       │
                    │ • Remote: +20    │
                    │ • Domain: +20    │
                    │ • Pay: +10-15    │
                    │ • Exp: +5-15     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    DEDUP CHECK   │
                    │ Skip if exists   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  GOOGLE SHEET    │
                    │  Columns A→S     │
                    └─────────────────┘
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Permission denied" | Click Allow when Google asks for permissions |
| "Sheet not found" | Verify SHEET_ID in CONFIG matches your sheet URL |
| "No jobs found" | Normal if sites block — try again later |
| Script timeout | Google has 6-min limit — reduce pages to 2 |
| "URL fetch failed" | Some sites may block — this is expected |

---

## Important Notes

1. **Some sites may block automated requests** — this is normal. The script handles errors gracefully and continues to the next portal.

2. **HTML structure changes** — Job sites update their HTML periodically. If the script stops finding jobs, the parsing functions may need updating.

3. **Rate limiting** — The script waits 2 seconds between page fetches to be respectful to the servers.

4. **Column S (Applied Date)** — ALWAYS left blank. You fill this manually when you apply.

---

## Customization

Edit the `CONFIG` object at the top of the script to change:
- Search keywords
- Target domains
- Minimum pay rate
- Experience range
- Reject conditions
- Location preferences
