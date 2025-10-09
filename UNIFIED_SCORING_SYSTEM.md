# 🎯 TEN NEWS - UNIFIED 0-100 SCORING SYSTEM

## 🌟 Philosophy: Quality Over Quantity

**Better to show 0 articles than 1 mediocre article.**

Your news platform now uses an **EXTREMELY STRICT** filtering system where most articles (90-95%) are rejected.

---

## 📊 THE SYSTEM

### Unified Across Both Parts

Both **Part 1 (Breaking)** and **Part 2 (Global)** use the **SAME scoring system**:

- **Scoring Range:** 0-100 points
- **Minimum Threshold:** 70 points
- **Rejection Rate:** 90-95% of all articles

### How It Works

**Every 5 minutes (Part 1):**
1. Fetch articles from 12 breaking news sources
2. AI filters and scores all articles
3. Only articles ≥70 points get added to website
4. If nothing scores ≥70, **NOTHING is added**

**Every 50 minutes (Part 2):**
1. Fetch articles from 123 global sources
2. AI filters and scores all articles
3. Only articles ≥70 points get added to website
4. If nothing scores ≥70, **NOTHING is added**

### Article Display

**All articles are sorted by score (highest first)**, regardless of which part they came from.

**Example:**
```
🏆 92 points - "Nuclear fusion breakthrough" (Part 1)
🏆 89 points - "Major earthquake in Tokyo" (Part 1)
🏆 85 points - "AI cures rare disease" (Part 2)
🏆 78 points - "Climate agreement signed" (Part 2)
🏆 72 points - "Tech giant announces layoffs" (Part 1)
```

---

## 🚫 STAGE 1: INSTANT REJECTION

These are **automatically rejected without scoring**:

### ❌ Rejected Categories:

1. **Celebrity & Entertainment Gossip**
   - Relationships, fashion, personal drama
   - Reality TV, award shows, influencer drama
   - Movie/TV reviews (unless major cultural impact)

2. **Local News Without Global Significance**
   - Local crime, traffic accidents
   - City council decisions
   - Regional festivals or events
   - Local business news

3. **Routine Sports Content**
   - Game scores and results
   - Player statistics and standings
   - Player transfers (unless massive deal)
   - **Exceptions:** Major records, Olympic moments, scandals

4. **Clickbait & Low-Quality Content**
   - Listicles ("10 ways to...")
   - "You won't believe..." headlines
   - Quizzes, horoscopes, lifestyle tips
   - Product reviews, shopping deals

5. **Promotional Content**
   - Company press releases (unless major innovation)
   - Product launches (unless revolutionary)
   - Corporate earnings (unless market-moving)

6. **Opinion Pieces Without News Value**
   - Personal opinions without new information
   - Editorial commentary on old news
   - Hot takes without substance

---

## 🤖 STAGE 2: AI SCORING (0-100 POINTS)

Articles that pass Stage 1 are scored across **5 dimensions**:

### 1. GLOBAL IMPACT & IMPORTANCE (0-35 points)

**30-35 points - World-Changing:**
- Global pandemics, wars
- Major natural disasters affecting millions
- International agreements (climate, trade, peace)
- Revolutionary scientific discoveries
- Economic crises, market crashes
- *Examples:*
  - "WHO declares new pandemic" → 35
  - "Nuclear fusion achieves net energy gain" → 34
  - "Major earthquake hits Tokyo" → 32

**20-29 points - Nationally/Regionally Significant:**
- Major country-level events
- Significant elections in large countries
- Important court decisions
- Major corporate developments affecting industries
- *Examples:*
  - "US Supreme Court overturns precedent" → 28
  - "Amazon acquires major competitor" → 24

**10-19 points - Notable but Limited:**
- Sector-specific developments
- Regional news with some broader interest
- *Examples:*
  - "Tech company announces layoffs" → 15

**0-9 points - Minor/Local:**
- Local events, minor announcements

### 2. SCIENTIFIC/TECHNOLOGICAL BREAKTHROUGH (0-30 points)

**25-30 points - Revolutionary Breakthrough:**
- Cures for major diseases
- Paradigm-shifting discoveries
- Revolutionary technology
- Game-changing innovations
- *Examples:*
  - "Scientists reverse aging in mice" → 30
  - "Room-temperature superconductor discovered" → 29
  - "Malaria vaccine proves 95% effective" → 27

**15-24 points - Significant Advancement:**
- Important research findings
- Notable technological progress
- Meaningful medical advances
- *Examples:*
  - "New battery tech doubles EV range" → 23
  - "AI model outperforms doctors in diagnosis" → 22

**5-14 points - Incremental Progress:**
- Small improvements
- Confirmatory studies
- Minor innovations

**0-4 points - Not Scientific/Tech:**
- No scientific merit

### 3. NOVELTY & URGENCY (0-20 points)

**18-20 points - Breaking/Urgent:**
- Happening right now
- Rapidly developing
- Time-critical information
- *Examples:*
  - "BREAKING: Earthquake strikes major city" → 20
  - "Developing: Coup attempt underway" → 19

**12-17 points - Fresh & Timely:**
- Published in last 3 hours
- New significant development
- *Examples:*
  - "Election results announced 1 hour ago" → 16

**6-11 points - Recent:**
- Published in last 24 hours
- Still relevant but not urgent

**0-5 points - Old:**
- Published >24 hours ago
- Rehashed old news

### 4. SOURCE CREDIBILITY (0-10 points)

**9-10 points - Gold Standard:**
- Reuters, Associated Press, BBC
- Nature, Science, Cell, Lancet, NEJM
- New York Times, Washington Post
- Financial Times, The Economist, Bloomberg

**7-8 points - Highly Credible:**
- Major national newspapers (Guardian, Le Monde)
- Established science outlets (New Scientist, Scientific American)
- Major broadcasters (CNN, NPR, ABC)

**5-6 points - Credible:**
- Regional quality newspapers
- Specialized publications

**0-4 points - Lower Credibility:**
- Tabloids, blogs, unverified sources

### 5. ENGAGEMENT & INTEREST FACTOR (0-15 points)

**13-15 points - Extremely Engaging:**
- Mind-blowing discoveries
- Clear life-changing implications
- Fascinating insights
- *Examples:*
  - "AI can predict death with 85% accuracy" → 15
  - "Humans can live to 150, study suggests" → 14

**8-12 points - Quite Interesting:**
- Educational and informative
- Surprising findings
- Important implications

**3-7 points - Moderately Interesting:**
- Somewhat interesting
- Niche appeal

**0-2 points - Boring:**
- Dry information
- No clear implications

---

## 📐 FINAL SCORE CALCULATION

```
FINAL_SCORE = Global_Impact + Scientific_Significance + 
              Novelty + Credibility + Engagement

MINIMUM THRESHOLD = 70 POINTS
```

**Note:** The dimensions are already weighted (0-35, 0-30, 0-20, 0-10, 0-15), so the final score is simply the sum.

**If FINAL_SCORE < 70 → REJECT**

---

## 📊 EXAMPLE SCORING

### Example 1: Revolutionary Scientific Breakthrough ✅

**"Scientists successfully reverse aging in human cells"**

- **Global Impact:** 32 (affects everyone)
- **Scientific Significance:** 30 (breakthrough)
- **Novelty:** 18 (breaking, 2 hours ago)
- **Credibility:** 10 (Nature journal)
- **Engagement:** 15 (mind-blowing)

**FINAL SCORE: 105 points** ✅ **PUBLISH**

---

### Example 2: Major Global Event ✅

**"Major earthquake strikes Tokyo, hundreds feared dead"**

- **Global Impact:** 30 (affects millions)
- **Scientific Significance:** 5 (not scientific)
- **Novelty:** 20 (breaking now)
- **Credibility:** 10 (Reuters/AP)
- **Engagement:** 12 (tragic but important)

**FINAL SCORE: 77 points** ✅ **PUBLISH**

---

### Example 3: Important Tech Innovation ✅

**"New battery technology enables 1000-mile EV range"**

- **Global Impact:** 26 (could transform transportation)
- **Scientific Significance:** 24 (major advance)
- **Novelty:** 16 (announced today)
- **Credibility:** 9 (MIT Tech Review)
- **Engagement:** 13 (exciting implications)

**FINAL SCORE: 88 points** ✅ **PUBLISH**

---

### Example 4: Good But Not Great ❌

**"Study shows Mediterranean diet linked to longevity"**

- **Global Impact:** 18 (health news)
- **Scientific Significance:** 16 (good research, not breakthrough)
- **Novelty:** 14 (published today)
- **Credibility:** 9 (Journal of Medicine)
- **Engagement:** 9 (interesting but not shocking)

**FINAL SCORE: 66 points** ❌ **REJECT**

---

### Example 5: Celebrity News ❌

**"Famous actor announces divorce"**

**Stage 1 Filter: INSTANT REJECT** - Celebrity gossip

No scoring needed.

---

### Example 6: Routine Sports ❌

**"Manchester United defeats Arsenal 3-1"**

**Stage 1 Filter: INSTANT REJECT** - Routine sports score

No scoring needed.

---

## 🎯 EXPECTED OUTCOMES

### Daily Article Volume:

**Input:** ~6,750 articles/day from 135 sources

**After Stage 1 (Instant Rejection):**
- Reject 70-80% immediately
- Remaining: ~1,350-2,000 articles

**After Stage 2 (AI Scoring + 70-Point Threshold):**
- Reject 95-98% of remaining
- **Final output: 10-80 articles/day**

### Possible Scenarios:

**Slow News Day:**
- 5-10 articles pass threshold
- Most days will have 10-30 articles

**Major News Day:**
- 50-80 articles pass threshold
- Multiple breaking stories, major discoveries

**Extremely Slow Day:**
- **ZERO articles pass threshold**
- Website shows: "No significant news today"
- Expected 5-10 days per year

---

## 🚨 THE ZERO ARTICLES SCENARIO

**Yes, sometimes the website will show NOTHING. This is by design.**

### When This Happens:
- No major global events
- No significant scientific breakthroughs
- No important developments
- Only routine, boring news

### What Users See:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TEN NEWS LIVE

   No significant news today.

   The world is having a quiet day.
   We'll update when something 
   important happens.

   Last update: [timestamp]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Why This Is Good:
1. **Builds trust** - Users know you only show important news
2. **Respects their time** - No clickbait, no filler
3. **Creates anticipation** - When news appears, it matters
4. **Reduces anxiety** - No need to constantly check
5. **Differentiates you** - No other news site does this

---

## 🛠️ TECHNICAL IMPLEMENTATION

### Files:

1. **`unified_news_scoring.py`** - Core scoring module
2. **`news-part1-breaking.py`** - Part 1 generator (uses unified scoring)
3. **`news-part2-global.py`** - Part 2 generator (uses unified scoring)
4. **`merge_news_parts.py`** - Combines outputs, sorts by score

### Workflow:

```
┌─────────────────────────────────────────────────────┐
│  PART 1: Breaking News (Every 5 minutes)           │
│  ├─ Fetch from 12 sources                          │
│  ├─ Stage 1: Instant rejection                     │
│  ├─ Stage 2: AI scoring (0-100)                    │
│  ├─ Filter: Keep only ≥70 points                   │
│  └─ Output: part1_breaking_YYYYMMDD_HHMM.json      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  PART 2: Global News (Every 50 minutes)            │
│  ├─ Fetch from 123 sources                         │
│  ├─ Stage 1: Instant rejection                     │
│  ├─ Stage 2: AI scoring (0-100)                    │
│  ├─ Filter: Keep only ≥70 points                   │
│  └─ Output: part2_global_YYYYMMDD_HHMM.json        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  MERGER: Combine & Sort                            │
│  ├─ Load latest Part 1 output                      │
│  ├─ Load latest Part 2 output                      │
│  ├─ Combine all articles                           │
│  ├─ Sort by final_score (highest first)            │
│  └─ Output: tennews_data_YYYYMMDD_HHMM.json        │
└─────────────────────────────────────────────────────┘
                        ↓
                  YOUR WEBSITE
```

### Running the System:

**1. Generate Part 1:**
```bash
python3 news-part1-breaking.py
```

**2. Generate Part 2:**
```bash
python3 news-part2-global.py
```

**3. Merge outputs:**
```bash
python3 merge_news_parts.py
```

**4. Use the merged file:**
```bash
cp tennews_data_*.json public/
```

---

## 📈 QUALITY METRICS

### What to Track:

**Daily:**
- Total articles fetched: ~6,750
- Stage 1 rejections: ~70-80%
- Stage 2 rejections: ~95-98%
- Final published: 10-80 (or 0!)
- Average final score: 72-85

**Weekly:**
- Zero-news days: 0-2 per week expected
- Score distribution: Most 70-85 range
- User engagement metrics

### Score Distribution (Expected):

```
100+ points: Extremely rare (1-2/month)
90-99:       Rare (5-10/month)
80-89:       Uncommon (20-40/month)
70-79:       Most published articles
60-69:       Good but rejected
<60:         Rejected
```

---

## 🎯 FINAL PHILOSOPHY

**"If in doubt, leave it out."**

Better to show nothing than to show mediocre news.
Your users will thank you for respecting their time and intelligence.

**The goal:** When users see news on Ten News Live, they know it **MATTERS**.

---

## 🚀 NEXT STEPS

1. ✅ Test Part 1: `python3 news-part1-breaking.py`
2. ✅ Test Part 2: `python3 news-part2-global.py`
3. ✅ Test Merger: `python3 merge_news_parts.py`
4. ✅ Review scores in output files
5. ✅ Integrate with your website
6. ✅ Monitor rejection rates
7. ✅ Adjust if needed (but keep threshold at 70+)

**Your news platform is now powered by the strictest quality filter in the industry.** 🎉

