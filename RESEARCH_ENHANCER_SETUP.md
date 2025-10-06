# 🔬 Ten News - Research Enhancer Setup Guide

## Overview

The **Research Enhancer** is a powerful system that uses **Perplexity API** to add verified research, citations, timelines, and formatting to your news articles.

---

## ✨ What It Does

For each news article, it adds:

1. **Bold Markup** - Highlights 3-6 key terms (names, numbers, places, organizations)
2. **3 Verified Details** - New facts with numbers/dates (Label: Value format)
3. **Timeline** - 2-4 chronological events (Past → Today → Future)
4. **Citations** - 2-6 reputable source URLs that verify the facts

---

## 🎯 Key Features

### **Web Research**
- Searches multiple reputable sources automatically
- Cross-verifies facts across Reuters, AP, BBC, Bloomberg, etc.
- Only returns verified information (no hallucination)

### **Quality Sources**
- Prioritizes: Reuters, AP, AFP, BBC, Bloomberg, WSJ, Guardian
- Includes official government and company sites
- Filters out unreliable sources

### **Structured Output**
- Details in "Label: Value" format (perfect for display)
- Timeline with specific dates
- Full citation list for transparency

### **Works With Both Systems**
- Enhances Daily Digest (10 curated articles)
- Enhances Live News Feed (30+ real-time articles)
- Compatible with any JSON news format

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Perplexity API Key

1. Go to: https://www.perplexity.ai/settings/api
2. Sign up or log in
3. Click "Generate API Key"
4. Copy your key (starts with `pplx-...`)

**Free trial:** $20 credit to start (covers ~100-200 enhancements)

### Step 2: Set Environment Variable

**On Mac/Linux:**
```bash
export PERPLEXITY_API_KEY="pplx-your-key-here"
```

**Make it permanent:**
```bash
echo 'export PERPLEXITY_API_KEY="pplx-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**On Windows:**
```cmd
set PERPLEXITY_API_KEY=pplx-your-key-here
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

This installs the `openai` package (Perplexity uses OpenAI SDK).

### Step 4: Test It!

**Enhance your daily digest:**
```bash
python news-research-enhancer.py tennews_data_2025_10_06.json
```

**Enhance your live feed:**
```bash
python news-research-enhancer.py livenews_data_2025_10_06_1430.json
```

**Custom output name:**
```bash
python news-research-enhancer.py input.json output_enhanced.json
```

### Step 5: Check Output

```bash
# Output file created automatically
ls -la *_enhanced.json

# View enhanced articles
cat tennews_data_2025_10_06_enhanced.json
```

---

## 📊 Before & After Example

### Before (Original Article):
```json
{
  "title": "Apple Announces iPhone 16 with AI Features",
  "summary": "Apple unveiled the iPhone 16 today, featuring advanced AI capabilities and improved battery life, according to company executives at the launch event.",
  "category": "Technology",
  "source": "TechCrunch",
  "url": "https://techcrunch.com/..."
}
```

### After (Enhanced with Research):
```json
{
  "title": "Apple Announces iPhone 16 with AI Features",
  "summary": "**Apple** unveiled the **iPhone 16** today, featuring advanced **AI capabilities** and improved **battery life**, according to **company executives** at the launch event.",
  "details": [
    "Launch date: September 12, 2025",
    "Battery improvement: 22 percent increase",
    "Markets: 28 countries initially"
  ],
  "timeline": [
    {
      "date": "September 2024",
      "event": "iPhone 15 series launched globally"
    },
    {
      "date": "September 12, 2025",
      "event": "iPhone 16 officially announced at event"
    },
    {
      "date": "September 22, 2025",
      "event": "Pre-orders begin worldwide"
    }
  ],
  "citations": [
    {
      "url": "https://www.apple.com/newsroom/2025/09/apple-unveils-iphone-16/",
      "publisher": "Apple Newsroom"
    },
    {
      "url": "https://www.reuters.com/technology/apple-iphone-16-2025-09-12/",
      "publisher": "Reuters"
    },
    {
      "url": "https://www.bloomberg.com/news/articles/2025-09-12/apple-iphone-16",
      "publisher": "Bloomberg"
    }
  ],
  "category": "Technology",
  "source": "TechCrunch",
  "url": "https://techcrunch.com/...",
  "research_status": "ok"
}
```

**Notice:**
- ✅ Bold markup on key terms (no words changed!)
- ✅ 3 new verified details with numbers
- ✅ Timeline with specific dates
- ✅ Citations from Apple, Reuters, Bloomberg

---

## 💡 How It Works

### Research Process

```
1. Input Article
   ↓
2. Perplexity API
   ├─ Searches: Reuters, AP, BBC, Bloomberg, etc.
   ├─ Verifies facts across multiple sources
   └─ Extracts: Numbers, dates, events
   ↓
3. Returns Research
   ├─ Bold markup (3-6 key terms)
   ├─ 3 verified details
   ├─ 2-4 timeline events
   └─ 2-6 source citations
   ↓
4. Enhanced Article
   └─ Original + Research data
```

### What Perplexity Searches For

**For Details:**
- Revenue, profit, market cap numbers
- Deaths, casualties, affected people counts
- Dates (launch dates, deadlines, events)
- Geographic data (countries, cities, regions)
- Performance metrics (percentages, growth rates)

**For Timeline:**
- Historical context (when did this start?)
- Previous related events
- Current development (today's news)
- Future scheduled events (launches, deadlines)

**Sources Used:**
- News wires: Reuters, AP, AFP
- Major outlets: BBC, Bloomberg, WSJ, Guardian
- Official sites: Company websites, government pages
- Verified sources only (no blogs, social media)

---

## 🎛️ Configuration Options

### Choose Perplexity Model

Edit `news-research-enhancer.py`:

```python
# Standard model (good quality, lower cost)
PERPLEXITY_MODEL = "sonar"

# Premium model (best quality, higher cost)
PERPLEXITY_MODEL = "sonar-pro"
```

**Model Comparison:**
| Model | Quality | Speed | Cost per 1M tokens | Best For |
|-------|---------|-------|-------------------|----------|
| `sonar` | Very Good | Fast | ~$5 | Most use cases |
| `sonar-pro` | Excellent | Medium | ~$5 + $3/1K requests | Premium quality |

### Adjust Delay Between Calls

To avoid rate limits:

```python
# Default: 2 seconds between articles
enhanced_articles = enhance_articles_batch(articles, delay_seconds=2)

# Faster (if you have high rate limits): 1 second
enhanced_articles = enhance_articles_batch(articles, delay_seconds=1)

# Slower (for free tier): 3 seconds
enhanced_articles = enhance_articles_batch(articles, delay_seconds=3)
```

---

## 💰 Cost Estimates

### Perplexity Pricing

**Free Trial:**
- $20 credit
- Covers ~100-200 article enhancements
- Perfect for testing

**Pay-As-You-Go:**
- `sonar` model: ~$5 per 1M tokens
- Typical cost per article: ~$0.005-0.01
- 30 articles: ~$0.15-0.30

**Monthly Estimates:**

| Usage | Articles/Month | Cost/Month |
|-------|---------------|------------|
| **Daily Digest Only** | 10 × 30 = 300 | ~$1.50-3 |
| **Live Feed (hourly)** | 30 × 24 × 30 = 21,600 | ~$108-216 |
| **Live Feed (every 6h)** | 30 × 4 × 30 = 3,600 | ~$18-36 |
| **Hybrid (digest + 6h)** | 300 + 3,600 = 3,900 | ~$20-39 |

**Recommendation:** Start with **Daily Digest only** (~$2-3/month)

---

## 🎯 Usage Scenarios

### Scenario 1: Enhance Daily Digest

```bash
# Generate daily news
python news-generator.py

# Enhance with research
python news-research-enhancer.py tennews_data_2025_10_06.json

# Result: tennews_data_2025_10_06_enhanced.json
```

**Use case:** Email newsletter with verified facts and citations

### Scenario 2: Enhance Live Feed

```bash
# Generate live news
python live-news-generator.py

# Enhance with research
python news-research-enhancer.py livenews_data_2025_10_06_1430.json

# Result: livenews_data_2025_10_06_1430_enhanced.json
```

**Use case:** Website with research-backed articles

### Scenario 3: Batch Enhancement

```bash
# Enhance multiple files
for file in tennews_data_*.json; do
    python news-research-enhancer.py "$file"
done
```

**Use case:** Backfill research for old articles

### Scenario 4: Automated Pipeline

```bash
# Daily automation script
#!/bin/bash

# Generate daily news
python news-generator.py

# Get today's file
TODAY=$(date +%Y_%m_%d)
INPUT="tennews_data_${TODAY}.json"

# Enhance with research
python news-research-enhancer.py "$INPUT"

# Upload enhanced version to website
ENHANCED="tennews_data_${TODAY}_enhanced.json"
# ... upload logic ...
```

---

## 🔍 Output Structure

### Enhanced Article Fields

```json
{
  "rank": 1,
  "emoji": "🌍",
  "title": "Original title",
  "summary": "Summary with **bold** markup",
  "details": [
    "Label: Value",
    "Label: Value",
    "Label: Value"
  ],
  "timeline": [
    {"date": "YYYY-MM-DD", "event": "Event description"},
    {"date": "Today", "event": "Current development"}
  ],
  "citations": [
    {"url": "https://...", "publisher": "Reuters"},
    {"url": "https://...", "publisher": "BBC"}
  ],
  "category": "World News",
  "source": "Reuters",
  "url": "https://...",
  "research_status": "ok"
}
```

### Research Status Values

- `"ok"` - Research successful, all fields populated
- `"insufficient_sources"` - Could not verify enough facts
- Field will be missing if not enhanced

---

## ⚠️ Troubleshooting

### "Perplexity API key not configured"
```bash
# Verify key is set
echo $PERPLEXITY_API_KEY

# Should show your key (pplx-...)
# If empty, export it again
export PERPLEXITY_API_KEY="pplx-your-key-here"
```

### "Failed to parse JSON response"
- Usually temporary API issue
- Script will continue with remaining articles
- Failed articles keep original content

### "Insufficient sources found"
- Story might be too new (breaking news)
- Limited information available
- Article marked as `research_status: "insufficient_sources"`
- Details set to `["INSUFFICIENT", ...]`

### "Rate limit exceeded"
- Free tier: Limited requests
- Solution: Increase delay between calls
- Or upgrade to paid tier

### "No articles found in file"
- Check input file format
- Must have `"articles": [...]` array
- Verify file is valid JSON

---

## 🎨 Integration with Website

### Display Enhanced Articles

**Show Details:**
```javascript
// In your React component
{article.details && article.details[0] !== 'INSUFFICIENT' && (
  <div className="details">
    {article.details.map((detail, i) => (
      <div key={i} className="detail-item">
        {detail}
      </div>
    ))}
  </div>
)}
```

**Show Timeline:**
```javascript
{article.timeline && article.timeline.length > 0 && (
  <div className="timeline">
    {article.timeline.map((event, i) => (
      <div key={i} className="timeline-event">
        <span className="date">{event.date}</span>
        <span className="event">{event.event}</span>
      </div>
    ))}
  </div>
)}
```

**Show Citations:**
```javascript
{article.citations && article.citations.length > 0 && (
  <div className="citations">
    <h4>Sources:</h4>
    {article.citations.map((cite, i) => (
      <a key={i} href={cite.url} target="_blank" rel="noopener">
        {cite.publisher}
      </a>
    ))}
  </div>
)}
```

**Render Bold Markdown:**
```javascript
// Convert **bold** to <strong>
function renderBoldText(text) {
  return text.split(/(\*\*.*?\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// Use in component
<p>{renderBoldText(article.summary)}</p>
```

---

## 📈 Quality Metrics

### Success Criteria

**Good Enhancement:**
- ✅ All 3 details are numbers/dates
- ✅ Details are NEW (not in summary)
- ✅ Timeline has 2-4 events
- ✅ 2+ citations provided
- ✅ Citations from reputable sources

**Check Quality:**
```bash
# Count enhancements
grep -c '"research_status": "ok"' *_enhanced.json

# Check citation count
jq '[.articles[].citations | length] | add' tennews_data_2025_10_06_enhanced.json

# Verify details format
jq '.articles[].details' tennews_data_2025_10_06_enhanced.json
```

---

## 🔄 Automation

### Daily Cron Job

```bash
# Add to crontab (run at 7:30 AM after news generation)
30 7 * * * cd /path/to/project && python news-research-enhancer.py tennews_data_$(date +\%Y_\%m_\%d).json
```

### Integration with Existing Scripts

```python
# In your news-generator.py (end of file)
if __name__ == "__main__":
    # Generate news
    success = generate_daily_news()
    
    if success:
        # Auto-enhance with research
        import subprocess
        today = datetime.now().strftime('%Y_%m_%d')
        input_file = f"tennews_data_{today}.json"
        subprocess.run([
            "python", 
            "news-research-enhancer.py", 
            input_file
        ])
```

---

## 🎯 Best Practices

### 1. Start Small
- Test with daily digest (10 articles) first
- Verify quality before scaling to live feed
- Monitor costs

### 2. Review Citations
- Check that sources are reputable
- Verify facts match citations
- Report issues to improve prompts

### 3. Handle Failures Gracefully
- Always check `research_status` field
- Display original content if research failed
- Don't block article display on enhancement failure

### 4. Cache Results
- Don't re-enhance the same article twice
- Save enhanced versions
- Use enhanced version on website

### 5. Monitor Costs
- Track API usage
- Set up billing alerts
- Adjust frequency if needed

---

## 📚 Additional Resources

- **Perplexity API Docs:** https://docs.perplexity.ai/
- **API Dashboard:** https://www.perplexity.ai/settings/api
- **Pricing:** https://docs.perplexity.ai/docs/pricing
- **OpenAI SDK Docs:** https://github.com/openai/openai-python

---

## ✅ Summary

You now have a **complete research enhancement system** that:

- ✅ Uses Perplexity API for web research
- ✅ Adds verified details with numbers/dates
- ✅ Creates timelines with specific dates
- ✅ Provides citations from reputable sources
- ✅ Adds bold markup for key terms
- ✅ Works with both news systems
- ✅ Handles failures gracefully
- ✅ Ready for production use

**Next:** Get your Perplexity API key and test it!

---

**Questions? Issues? Check the troubleshooting section or review the code comments!** 🚀

