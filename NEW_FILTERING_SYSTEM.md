# 🎯 NEW FILTERING SYSTEM - October 12, 2025

## Major System Change: From Scoring to Filtering

### What Changed

**OLD SYSTEM:**
- Score: 0-100
- Threshold: 55+
- Complex multi-category scoring (shareability, global appeal, source credibility, etc.)

**NEW SYSTEM:**
- Score: 0-1000
- Threshold: 600+
- Priority-based filtering focusing on breaking news and importance

---

## New Scoring System (0-1000)

### Scoring Priority (In Order):

**1. BREAKING NEWS (Highest Priority)**
- Detected through context and significance, NOT keywords
- Major events: disasters, political upheavals, significant deaths, major announcements
- Significant proper nouns: world leaders, major countries, Fortune 500 companies

**2. TOPIC IMPORTANCE (5 Factors Required)**
- Scale of impact: Millions vs thousands affected
- Global significance: Geopolitical events, economic shifts, scientific breakthroughs
- Institutional weight: Government actions, major corporate moves
- Historical significance: Lasting consequences
- Public interest: Informed citizenship topics

**3. TITLE QUALITY (5 Characteristics Required)**
- Clear and informative
- Specific with details
- Neutral tone
- Complete thought
- Grammatically correct

**4. SOURCE REPUTATION**
- **TIER 1**: Reuters, AP, AFP, BBC, CNN, Al Jazeera, NYT, WSJ, Guardian, FT
- **TIER 2**: National outlets, Nature, Science, The Lancet, Axios, The Verge
- **TIER 3**: Smaller regional outlets

---

## Score Ranges

- **950-1000**: Critical breaking news, major global events (rare)
- **800-950**: Excellent, highly important news
- **600-800**: Good, engaging news worth showing ✅ **PUBLISHED**
- **400-600**: Decent but not interesting enough ❌ **FILTERED**
- **Below 400**: Low quality, unimportant ❌ **FILTERED**

---

## Automatic Filters (Score Below 600)

Articles automatically filtered out:
- ❌ Clickbait
- ❌ Low-quality sources
- ❌ Trivial stories
- ❌ Duplicate stories (keep best 1-2 only)
- ❌ Opinion pieces
- ❌ Vague titles
- ❌ Spam/promotional
- ❌ Unverified rumors
- ❌ Local/hyper-specific news (unless globally significant)
- ❌ Satire
- ❌ Sponsored content

---

## Source Credibility Adjustment

Sources get bonus/penalty points based on reputation:
- **Tier 1** (Score 10): +40 points
- **Tier 2** (Score 8): +24 points
- **Tier 3** (Score 6): +8 points
- **Tier 4** (Score 4): -8 points
- **Unknown** (Score 0): -40 points

Formula: `(source_score - 5) * 8 = adjustment`

---

## Key Principles

1. **Importance dominates** - Don't artificially balance categories
2. **Quality over quantity** - Better to show fewer high-quality items
3. **No duplicate management** - AI decides which articles to keep (1-2 max per story)
4. **Breaking news prioritized** - Detected by context, not keywords
5. **Title clarity required** - Eliminate engaging but vague titles
6. **Source reputation matters** - Tier 1 sources get significant advantages

---

## Expected Results

### Before (0-100 system):
- ~20-40% of articles published
- Many borderline articles (score 55-65) published
- Complex category balancing

### After (0-1000 system):
- **~5-15% of articles published**
- Only truly important/interesting news (600+)
- Natural clustering by importance
- More selective, higher quality feed

---

## Example Scores

### High Scores (800-1000) - Published
```
"NASA Discovers Water on Mars" - Source: NASA
Score: 950 (Breaking scientific discovery, global significance)

"UN Security Council Passes Emergency Resolution on Climate" - Source: Reuters
Score: 880 (Major geopolitical event, global impact)

"Scientists Cure Rare Disease in Clinical Trial" - Source: Nature
Score: 820 (Medical breakthrough, scientific importance)
```

### Medium Scores (600-800) - Published
```
"Apple Announces New iPhone 16" - Source: The Verge
Score: 720 (Major tech company, public interest)

"Earthquake Hits Major City, Hundreds Evacuated" - Source: BBC
Score: 680 (Breaking news, human impact)

"Federal Reserve Raises Interest Rates by 0.5%" - Source: WSJ
Score: 650 (Economic significance, affects millions)
```

### Low Scores (Below 600) - Filtered
```
"Celebrity Couple Spotted at Restaurant" - Source: TMZ
Score: 250 (Trivial, celebrity gossip, low-quality source)

"Local Council Approves Parking Plan" - Source: Local News
Score: 150 (Hyper-local, no global significance)

"You Won't Believe What Happened Next!" - Source: Unknown Blog
Score: 50 (Clickbait, low-quality source, vague title)
```

---

## System Changes Summary

### Files Modified:
1. **ai_filter.py**:
   - Changed `min_score` from 55 to 600
   - Updated scoring prompt (0-1000 scale)
   - Updated source credibility adjustment formula
   - Changed score clamping from 0-100 to 0-1000

2. **rss_sources.py**:
   - Reduced from 158 to 73 premium sources
   - Focused on high-quality international sources
   - Removed low-quality and hyper-local sources

### What Stays the Same:
- ✅ Parallel scoring (10 workers)
- ✅ Image filtering (no images = rejected)
- ✅ Content generation (summary, title, timeline, details)
- ✅ Database structure
- ✅ Push to Supabase workflow

---

## Testing

Run the system and watch for:
- ✅ Scores in 0-1000 range
- ✅ Only articles 600+ published
- ✅ Much more selective (fewer but higher quality)
- ✅ Breaking news getting high scores (800-950+)
- ✅ Trivial/local news getting low scores (<400)
- ✅ Good quality articles in 600-800 range

The system should now be **extremely selective**, publishing only the most important and engaging news!

