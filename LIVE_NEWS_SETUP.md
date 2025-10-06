# TEN NEWS - LIVE NEWS GENERATOR SETUP GUIDE

## Overview

The Live News Generator is a **NEW** system that works **alongside** your existing daily 10-news digest. It provides real-time news updates with images using NewsAPI.

### Two Systems Running Together:

1. **Daily Digest** (`news-generator.py`) - Generates 10 curated articles daily at 7 AM
2. **Live News Feed** (`live-news-generator.py`) - Fetches real-time news continuously with images

---

## Quick Start

### 1. Get NewsAPI Key

1. Go to https://newsapi.org/
2. Sign up for a free account
3. Copy your API key from the dashboard

**Free Tier Limits:**
- 100 requests per day
- Articles from last 24 hours only
- Perfect for testing and small-scale use

**Paid Tier Benefits:**
- Unlimited requests
- Full article archive
- Premium sources

### 2. Set Environment Variables

**On macOS/Linux:**
```bash
export NEWSAPI_KEY="your-newsapi-key-here"
export CLAUDE_API_KEY="your-claude-key-here"
```

**Make it permanent (add to ~/.zshrc or ~/.bash_profile):**
```bash
echo 'export NEWSAPI_KEY="your-newsapi-key-here"' >> ~/.zshrc
echo 'export CLAUDE_API_KEY="your-claude-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**On Windows:**
```cmd
set NEWSAPI_KEY=your-newsapi-key-here
set CLAUDE_API_KEY=your-claude-key-here
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- `newsapi-python` - Official NewsAPI client
- All existing dependencies (requests, beautifulsoup4, etc.)

### 4. Run the Live News Generator

**Option 1: Generate Once (30 articles)**
```bash
python live-news-generator.py
# Press Enter or type 1 when prompted
```

**Option 2: Generate More Articles (50)**
```bash
python live-news-generator.py
# Type 2 when prompted
```

**Option 3: Continuous Feed (updates every 15 min)**
```bash
python live-news-generator.py
# Type 3 when prompted
```

**Option 4: Continuous Feed (updates every 30 min)**
```bash
python live-news-generator.py
# Type 4 when prompted
```

---

## Features

### 1. Real-Time News
- Fetches latest breaking news as it happens
- Multiple sources: BBC, Reuters, CNN, Bloomberg, TechCrunch, etc.
- Updates can be continuous or on-demand

### 2. Images Included
- Every article includes an image URL (`urlToImage`)
- Perfect for visual news displays
- Fallback handling for articles without images

### 3. Multiple Categories
- World News
- Business
- Technology
- Science
- Health
- Sports
- Entertainment

### 4. AI Enhancement (Optional)
- Uses Claude AI to categorize articles
- Assigns importance ratings (1-10)
- Adds relevant emojis
- Works even without AI (falls back to default categorization)

### 5. Smart Deduplication
- Removes duplicate articles by URL
- Detects similar titles
- Ensures unique content

---

## Output Format

The live news generator creates files named `livenews_data_YYYY_MM_DD_HHMM.json`:

```json
{
  "generatedAt": "2025-10-06T14:30:00.123456",
  "generatedAtUK": "2025-10-06T15:30:00.123456+01:00",
  "displayTimestamp": "Sunday, October 6, 2025 at 15:30 BST",
  "totalArticles": 30,
  "source": "NewsAPI Live Feed",
  "articles": [
    {
      "title": "Breaking: Major Tech Company Announces New AI Product",
      "description": "Detailed description of the news...",
      "url": "https://example.com/article",
      "image": "https://example.com/image.jpg",
      "publishedAt": "2025-10-06T14:25:00Z",
      "source": "TechCrunch",
      "author": "John Doe",
      "content": "Full article content...",
      "category": "Technology",
      "importance": 8,
      "emoji": "💻"
    }
  ]
}
```

### Key Fields:
- **title**: Article headline
- **description**: Brief summary
- **url**: Link to full article
- **image**: URL to article image (NEW!)
- **publishedAt**: Publication timestamp
- **source**: News source name
- **author**: Article author
- **category**: AI-assigned category
- **importance**: Rating 1-10 (AI-assigned)
- **emoji**: Relevant emoji (AI-assigned)

---

## Comparison: Daily vs Live

| Feature | Daily Digest | Live News Feed |
|---------|-------------|----------------|
| **Schedule** | Once daily at 7 AM | Continuous or on-demand |
| **Articles** | 10 curated stories | 30-50+ articles |
| **Source** | GDELT (comprehensive) | NewsAPI (real-time) |
| **Images** | ❌ No | ✅ Yes |
| **AI Processing** | Extensive rewriting | Categorization |
| **Timeline** | ✅ Yes | ❌ No |
| **Historical Events** | ✅ Yes | ❌ No |
| **File Name** | `tennews_data_*.json` | `livenews_data_*.json` |
| **Use Case** | Daily digest email | Live website feed |

---

## Usage Strategies

### Strategy 1: Live Website Feed
Run continuous mode to keep your website updated:
```bash
python live-news-generator.py
# Choose option 3 (updates every 15 min)
```

### Strategy 2: Hourly Updates
Use cron (Linux/Mac) to run every hour:
```bash
# Add to crontab
0 * * * * cd /path/to/project && python live-news-generator.py
```

### Strategy 3: On-Demand Breaking News
Run manually when you need fresh content:
```bash
python live-news-generator.py
```

### Strategy 4: Both Systems Together
- **Morning**: Daily digest email (10 curated stories)
- **Throughout day**: Live feed on website (30+ real-time articles)

---

## Customization

### Change Number of Articles
Edit in `live-news-generator.py`:
```python
generate_live_news(num_articles=50)  # Change from 30 to 50
```

### Add More News Sources
Edit `PREMIUM_SOURCES` list:
```python
PREMIUM_SOURCES = [
    'bbc-news',
    'reuters',
    'your-favorite-source',  # Add here
    # ...
]
```

### Change Update Frequency
Edit in continuous mode:
```python
run_continuous_live_feed(interval_minutes=10)  # Every 10 minutes
```

### Disable AI Enhancement
If you don't have Claude API or want faster generation:
```python
generate_live_news(num_articles=30, use_ai_enhancement=False)
```

---

## Rate Limits & Best Practices

### NewsAPI Free Tier
- **100 requests/day**
- **1 request every ~15 minutes** = ~96 requests/day
- If you hit limits, increase interval or upgrade

### NewsAPI Paid Tier
- **Unlimited requests**
- Run as frequently as needed
- Access to full archive

### Claude API (Optional)
- Only used for categorization
- ~1 request per generation
- Can be disabled if needed

### Recommended Settings

**Free Tier:**
- Generate once every 30 minutes
- Use 30 articles per generation
- Avoid continuous 15-min mode

**Paid Tier:**
- Generate every 10-15 minutes
- Use 50+ articles per generation
- Run continuous mode 24/7

---

## Troubleshooting

### "NewsAPI key not configured"
```bash
# Set the environment variable
export NEWSAPI_KEY="your-actual-key-here"
```

### "Rate limit reached"
- You've hit your daily limit (100 requests on free tier)
- Wait until tomorrow or upgrade to paid tier
- Reduce generation frequency

### "No articles found"
- Check your internet connection
- Verify NewsAPI key is correct
- Try different categories or sources

### "Claude API error"
- AI enhancement is optional
- System will work without it
- Set `use_ai_enhancement=False` to skip

### Images not loading
- Some articles don't have images
- Check if `image` field is empty string
- NewsAPI provides images when available

---

## Next Steps

1. ✅ Get NewsAPI key from https://newsapi.org/
2. ✅ Set environment variables
3. ✅ Run `pip install -r requirements.txt`
4. ✅ Test: `python live-news-generator.py`
5. 🔄 Update website to display live news (next phase)

---

## Support

- NewsAPI Docs: https://newsapi.org/docs
- NewsAPI Sources: https://newsapi.org/sources
- Claude API: https://www.anthropic.com/api

---

## File Structure

```
/Ten news website/
├── news-generator.py          # Daily 10-news digest (existing)
├── live-news-generator.py     # Live news feed (NEW)
├── tennews_data_*.json        # Daily digest output
├── livenews_data_*.json       # Live feed output (NEW)
├── requirements.txt           # Updated with newsapi-python
└── LIVE_NEWS_SETUP.md        # This file
```

---

🎉 **Ready to go! Get your NewsAPI key and start generating live news with images!**

