# 🚀 QUICK START: Live News Generator

## Get Your NewsAPI Key & Start in 5 Minutes

---

### Step 1: Get NewsAPI Key (2 minutes)

1. **Go to:** https://newsapi.org/register
2. **Sign up** with your email
3. **Copy your API key** from the dashboard

**Example key format:** `1234567890abcdef1234567890abcdef`

---

### Step 2: Set Environment Variable (1 minute)

**On Mac/Linux:**
```bash
export NEWSAPI_KEY="paste-your-key-here"
export CLAUDE_API_KEY="your-existing-claude-key"
```

**To make it permanent:**
```bash
echo 'export NEWSAPI_KEY="paste-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**On Windows:**
```bash
set NEWSAPI_KEY=paste-your-key-here
```

---

### Step 3: Install Requirements (1 minute)

```bash
pip install -r requirements.txt
```

This installs the new `newsapi-python` package (and updates any other dependencies).

---

### Step 4: Run Live News Generator (1 minute)

```bash
python live-news-generator.py
```

**When prompted, choose:**
- Press **Enter** for: 30 articles, run once
- Type **2** for: 50 articles, run once  
- Type **3** for: Continuous updates every 15 min
- Type **4** for: Continuous updates every 30 min

---

### Step 5: Check Output

You'll see a new file created:
```
livenews_data_2025_10_06_1430.json
```

**Open it to see:**
- 30-50 live news articles
- Images for each article
- Categories (Business, Technology, etc.)
- Importance ratings
- Publication timestamps

---

## That's It! 🎉

You now have **TWO NEWS SYSTEMS** running:

1. **Daily Digest** (`news-generator.py`) → 10 curated stories
2. **Live Feed** (`live-news-generator.py`) → 30+ real-time stories **WITH IMAGES**

---

## What You Can Do Now

### Option A: Test Both Systems
```bash
# Generate daily digest (existing system)
python news-generator.py

# Generate live feed (new system)  
python live-news-generator.py
```

### Option B: Run Live Feed Continuously
```bash
python live-news-generator.py
# Choose option 3 or 4 for continuous updates
```

### Option C: Review the Documentation
- `LIVE_NEWS_SETUP.md` - Complete setup guide
- `NEWS_SYSTEMS_COMPARISON.md` - Comparison of both systems

---

## Next Phase: Update Website

Once you're happy with the live news generation, we'll update your website to:

1. Display the **daily digest** (10 curated stories) at the top
2. Show the **live feed** (30+ stories with images) below
3. Auto-refresh the live feed
4. Add filters by category
5. Show timestamps ("Updated 2 minutes ago")

---

## Need Help?

**Common Issues:**

**"NewsAPI key not configured"**
```bash
# Make sure you exported it
echo $NEWSAPI_KEY  # Should show your key
```

**"Rate limit reached"**
- Free tier: 100 requests/day
- Wait 24 hours or upgrade to paid
- Reduce generation frequency

**"No images in output"**
- Some articles don't have images (normal)
- Check `"image": ""` field - empty means no image
- Most articles will have images

**"Claude API error"**
- AI enhancement is optional
- System works without it
- Images and categorization still work

---

## Free Tier Limits

**NewsAPI Free:**
- 100 requests per day
- Run every 30 min = ~48 requests/day ✅
- Run every 15 min = ~96 requests/day ✅
- Perfect for testing!

**NewsAPI Paid ($449/month):**
- Unlimited requests
- Only needed for high-frequency production use

---

## Example Output

Here's what one article looks like:

```json
{
  "title": "Apple Announces New AI Features in iOS 18",
  "description": "Apple unveils groundbreaking AI capabilities...",
  "url": "https://techcrunch.com/2025/10/06/apple-ai-ios18",
  "image": "https://cdn.techcrunch.com/apple-ios18.jpg",
  "publishedAt": "2025-10-06T14:25:00Z",
  "source": "TechCrunch",
  "author": "Sarah Johnson",
  "category": "Technology",
  "importance": 8,
  "emoji": "🍎"
}
```

**Key fields:**
- `image` ← **NEW!** Use this for website display
- `category` ← Filter by this
- `importance` ← Sort by this (1-10)
- `publishedAt` ← Show relative time

---

## Ready? Let's Go! 🚀

1. Get your NewsAPI key: https://newsapi.org/register
2. Set the environment variable
3. Run: `python live-news-generator.py`
4. Check the output file
5. Let me know when you're ready to update the website!

---

**Questions? Issues? Let me know and I'll help!** 💪

