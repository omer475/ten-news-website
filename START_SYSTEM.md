# 🚀 START TEN NEWS SYSTEM - Complete Commands

## Option 1: Three Separate Terminals (RECOMMENDED)

### Terminal 1: RSS Fetcher & AI Filter
```bash
cd "/Users/omersogancioglu/Ten news website "
python3 main.py
```
**What it does:** Fetches articles from 139 RSS sources every 10 minutes, scores them with AI, publishes top stories

---

### Terminal 2: Flask API Server
```bash
cd "/Users/omersogancioglu/Ten news website "
python3 api.py
```
**What it does:** Serves articles with images from database on http://localhost:5001

---

### Terminal 3: Next.js Website
```bash
cd "/Users/omersogancioglu/Ten news website "
npm run dev
```
**What it does:** Runs your website on http://localhost:3000

---

## Option 2: All in One Terminal (Background Processes)

```bash
cd "/Users/omersogancioglu/Ten news website "

# Start RSS Fetcher in background
python3 main.py > rss_fetcher.log 2>&1 &
echo "✅ RSS Fetcher started (PID: $!)"

# Start Flask API in background
python3 api.py > api.log 2>&1 &
echo "✅ Flask API started (PID: $!)"

# Wait 2 seconds for services to start
sleep 2

# Start Next.js website (keeps terminal open)
npm run dev
```

**To stop all background processes later:**
```bash
pkill -f "python3 main.py"
pkill -f "python3 api.py"
```

---

## Quick Start (All-in-One Command)

```bash
cd "/Users/omersogancioglu/Ten news website " && python3 main.py > rss_fetcher.log 2>&1 & python3 api.py > api.log 2>&1 & sleep 2 && npm run dev
```

---

## Verify Everything is Running

```bash
# Check RSS Fetcher
ps aux | grep "main.py" | grep -v grep

# Check Flask API
curl http://localhost:5001/api/news?limit=1

# Check Next.js
curl http://localhost:3000

# Check database stats
python3 test_images.py
```

---

## View Logs

```bash
# RSS Fetcher logs
tail -f rss_fetcher.log

# API logs
tail -f api.log

# Both at once
tail -f rss_fetcher.log api.log
```

---

## Stop Everything

```bash
# Kill all background processes
pkill -f "python3 main.py"
pkill -f "python3 api.py"

# Stop Next.js (Ctrl+C in the terminal where it's running)
```

---

## Check System Status

```bash
cd "/Users/omersogancioglu/Ten news website "
python3 health_check.py
```

---

## Expected Output

### Terminal 1 (RSS Fetcher):
```
============================================================
🌐 RSS FETCHER - Starting fetch cycle
============================================================
📊 Processing 139 sources...
✅ Fetched 45 new articles
🤖 AI Filter processing...
✅ Published 8 articles (score > 60)
😴 Sleeping for 600s (10 minutes)...
```

### Terminal 2 (Flask API):
```
 * Serving Flask app 'api'
 * Debug mode: on
 * Running on http://0.0.0.0:5001
📸 Sample article image_url: https://...
```

### Terminal 3 (Next.js):
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
✅ Serving LIVE RSS news from Flask API (316 articles with images!)
```

---

## Troubleshooting

### Port 5001 already in use:
```bash
# Find and kill the process
lsof -ti:5001 | xargs kill -9

# Then restart Flask API
python3 api.py
```

### Database locked error:
```bash
# Stop all processes first
pkill -f "python3 main.py"
pkill -f "python3 api.py"

# Wait 5 seconds
sleep 5

# Start again
python3 main.py &
python3 api.py &
```

### No articles in database:
```bash
# Check if database exists
ls -lh ten_news.db

# Run one manual fetch cycle
python3 -c "from rss_fetcher import OptimizedRSSFetcher; f = OptimizedRSSFetcher(); f.fetch_once()"
```

---

## Production Deployment

For Railway/Render/Heroku:
```bash
# Only run these (no npm run dev):
python3 main.py &  # RSS Fetcher
python3 api.py     # Flask API

# Next.js runs separately on Vercel
```

