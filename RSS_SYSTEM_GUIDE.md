# 🚀 TEN NEWS LIVE - RSS SYSTEM GUIDE

## ✅ SYSTEM OVERVIEW

**You now have a complete RSS-based news system!**

### What It Does:
- ✅ Fetches from **200+ RSS sources** every 10 minutes
- ✅ Uses **Claude Sonnet 4** to score articles (0-100 points)
- ✅ Publishes only the **best articles** (45-60 point threshold by category)
- ✅ Provides **REST API** for your frontend
- ✅ **Completely FREE** (no NewsAPI costs!)
- ✅ **No rate limits**

---

## 📁 NEW FILES CREATED

### Core System:
1. **`rss_sources.py`** - 200+ curated RSS feeds
2. **`rss_fetcher.py`** - Parallel RSS fetching (30 workers)
3. **`ai_filter.py`** - Claude AI scoring & filtering
4. **`database.py`** - SQLite database schema
5. **`api.py`** - Flask REST API
6. **`main.py`** - Main orchestrator
7. **`config.py`** - Configuration
8. **`health_check.py`** - Health monitoring
9. **`requirements-rss.txt`** - Python dependencies

---

## 🏃 QUICK START

### Step 1: Install Dependencies

```bash
pip install -r requirements-rss.txt
```

### Step 2: Set API Key

```bash
export ANTHROPIC_API_KEY='your-claude-api-key-here'
```

### Step 3: Initialize Database

```bash
python3 database.py
```

### Step 4: Test Components

**Test RSS Fetcher:**
```bash
python3 rss_fetcher.py
```

**Test AI Filter:**
```bash
python3 ai_filter.py
```

**Check System Health:**
```bash
python3 health_check.py
```

### Step 5: Run Main System

```bash
python3 main.py
```

This will:
- Fetch RSS every 10 minutes
- Filter with AI every 5 minutes
- Run continuously 24/7

### Step 6: Start API Server (Separate Terminal)

```bash
python3 api.py
```

API will be available at `http://localhost:5000`

---

## 🌐 API ENDPOINTS

### Get Articles
```
GET /api/articles?category=science&limit=50&hours=24
```

### Get Categories
```
GET /api/categories
```

### Get Single Article
```
GET /api/article/123
```

### Search Articles
```
GET /api/search?q=climate
```

### Get Stats
```
GET /api/stats
```

---

## 📊 EXPECTED RESULTS

### Input:
- **~10,000-15,000 articles/day** from 200+ sources
- Fetched every 10 minutes

### Output:
- **~500-1,000 published articles/day**
- Only exceptional news (5-10% acceptance rate)

### Latency:
- Articles appear **10-15 minutes** after publication

### Quality:
- Only important, interesting, globally relevant news

---

## 💰 COST BREAKDOWN

| Item | Cost |
|------|------|
| RSS feeds | **$0/month** (FREE!) |
| Claude API | **~$50-150/month** |
| Server | **~$10-50/month** |
| **Total** | **~$60-200/month** |

**vs NewsAPI Business Plan: $449/month** ✅ Save $250-400/month!

---

## 🔧 CONFIGURATION

Edit `config.py` to customize:

```python
# Fetching frequency
RSS_FETCH_INTERVAL_MINUTES = 10  # How often to fetch RSS

# AI filtering
AI_FILTER_INTERVAL_MINUTES = 5  # How often to run AI filter

# Category thresholds (minimum score to publish)
CATEGORY_THRESHOLDS = {
    'breaking': 55,    # Higher threshold for breaking news
    'science': 45,     # Lower threshold for science (more articles)
    'technology': 45,
    'business': 50,
    # etc...
}
```

---

## 📱 FRONTEND INTEGRATION

Your existing Next.js frontend needs minor updates to use the new API.

### Example: Fetch Articles

```javascript
// Old (local JSON file)
const response = await fetch('/tennews_data_live.json');

// New (REST API)
const response = await fetch('http://localhost:5000/api/articles?limit=50');
const data = await response.json();
const articles = data.articles;
```

---

## 🎯 SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    TEN NEWS LIVE (RSS)                      │
└─────────────────────────────────────────────────────────────┘

Every 10 minutes:              Every 5 minutes:
┌─────────────────┐           ┌─────────────────┐
│  RSS FETCHER    │──────────▶│   AI FILTER     │
│                 │           │                 │
│ • 200+ sources  │           │ • Claude Sonnet │
│ • 30 workers    │           │ • Score 0-100   │
│ • Parallel      │           │ • Threshold 45+ │
└─────────────────┘           └─────────────────┘
        │                              │
        └──────────┬───────────────────┘
                   ▼
          ┌─────────────────┐
          │   DATABASE      │
          │   (SQLite)      │
          └─────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   REST API      │
          │   (Flask)       │
          └─────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │   FRONTEND      │
          │   (Next.js)     │
          └─────────────────┘
```

---

## 🏥 MONITORING

### Check System Health:
```bash
python3 health_check.py
```

Shows:
- ✅ RSS fetcher status
- ✅ AI filter status
- ✅ Articles processed today
- ✅ Queue size
- ✅ Database stats

### View Database Stats:
```bash
sqlite3 news.db
SELECT category, COUNT(*) FROM articles WHERE published = TRUE GROUP BY category;
```

---

## 🐛 TROUBLESHOOTING

### No articles being fetched?
```bash
# Test single source
python3 -c "import feedparser; print(len(feedparser.parse('https://www.reuters.com/rssfeed/worldNews').entries))"
```

### AI filter not working?
```bash
# Check API key
echo $ANTHROPIC_API_KEY

# Test AI manually
python3 -c "from ai_filter import AINewsFilter; f = AINewsFilter(); print('OK')"
```

### Too many/few articles?
Edit thresholds in `config.py`:
```python
CATEGORY_THRESHOLDS = {
    'science': 40,  # Lower = more articles
    'breaking': 60, # Higher = fewer articles
}
```

---

## 🚀 DEPLOYMENT (Production)

### Option 1: Railway.app

1. Create new project on Railway.app
2. Connect your GitHub repo
3. Add environment variable: `ANTHROPIC_API_KEY`
4. Deploy!

### Option 2: VPS (DigitalOcean, AWS, etc.)

1. Install Python 3.8+
2. Clone repo
3. Install dependencies
4. Run with systemd or supervisor
5. Set up nginx reverse proxy

---

## 📝 NEXT STEPS

1. ✅ **System is ready!** - All components built
2. ⏳ **Update frontend** - Modify to use REST API endpoints
3. ⏳ **Deploy** - Choose Railway or VPS
4. ⏳ **Monitor** - Use health check script

---

## 🎉 YOU'RE ALL SET!

Your RSS-based news system is **complete** and **ready to run**!

**Advantages over NewsAPI:**
- ✅ **FREE** RSS feeds (no API costs)
- ✅ **No rate limits**
- ✅ **200+ sources** (more than NewsAPI)
- ✅ **Better science sources**
- ✅ **Full control**
- ✅ **Faster updates**

**Questions?** Check the code comments or run `python3 health_check.py` to monitor!

---

**Built with ❤️ by Ten News Live Team**

