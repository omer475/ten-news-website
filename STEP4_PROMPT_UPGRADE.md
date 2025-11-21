# ✨ Step 4 Claude Prompt - Major Upgrade

## Date: November 20, 2025 - 22:00

---

## 🎯 **What Changed**

Replaced the basic Step 4 prompt with **comprehensive writing guidelines** that specify exactly how Claude should write titles, bullets, and articles.

---

## 📊 **Comparison**

### **OLD PROMPT (Simple):**
```
You are writing a news article for Today+. You have N sources.

Generate in this EXACT JSON format:
{
  "title_news": "Professional title (≤12 words)",
  "title_b2": "B2 simple title",
  "content_news": "Advanced article 200-500 words",
  ...
}

Write only the JSON, no preamble.
```

**Problems:**
- ❌ Too vague - no specific guidelines
- ❌ No examples or anti-patterns
- ❌ Inconsistent output quality
- ❌ Bullets often repeated title content
- ❌ Weak title verbs

---

### **NEW PROMPT (Comprehensive):**

**80 lines of detailed instructions covering:**

✅ **General Writing Rules** (5 core principles)
✅ **Title Requirements** (8-10 words, strong verbs, examples)
✅ **Bullet Requirements** (18-25 words, progressive structure)
✅ **Article Requirements** (220-280 words, 5-paragraph structure)
✅ **Examples** (good ✓ and bad ✗)
✅ **Vocabulary guides** (NEWS vs B2 simplification)

---

## 📝 **Key Improvements**

### **1. TITLE WRITING**

**New Rules:**
- **8-10 words maximum** (was: ≤12 words)
- **Strong action verbs** (Plunge, Crash, Soar, Jump, Fall, Drop, Rise)
- **Active voice mandatory**
- **Present tense** for recent events
- **Include numbers** when impactful

**Examples Given:**
```
✓ "**Bitcoin** Drops **8%** as Crypto Fear Index Hits **2022** Lows"
✗ "Crypto Market Sentiment Plunges to 'Extreme Fear' Amid Stock Market Crash"
   (too long, repeated "market", vague)
```

**Avoid:**
- Starting with "The" or "A"
- Weak verbs (Advocate, Signal, Implement)
- Passive voice
- Vague adjectives (Major, Significant)

---

### **2. BULLET SUMMARIES**

**New Rules:**
- **18-25 words each** (was: 10-15 words)
- **Exactly 3 bullets** (was: 4 bullets)
- **Progressive structure:**
  1. **Bullet 1:** Immediate impact/consequence with numbers
  2. **Bullet 2:** Key factual details with names
  3. **Bullet 3:** Context, cause, or future implications

**CRITICAL NEW RULE:**
```
Bullets MUST provide NEW information NOT in the title
```

**Before (Problem):**
```
Title: "Global Stocks Fall Following Wall Street Reversal"
Bullet 1: "Global stocks declined following sharp Wall Street reversal" ❌
          (Just repeats title!)
```

**After (Fixed):**
```
Title: "Global Stocks Fall Following Wall Street Reversal"
Bullet 1: "S&P 500 plunged 3.2% erasing $1.1 trillion in market value, 
           while Tokyo's Nikkei dropped 2.8% and Hong Kong's Hang Seng fell 3.5%." ✅
          (Provides NEW specific data!)
```

**Mandatory Elements:**
- ✅ Specific numbers in at least 2 bullets
- ✅ Named entities (people, organizations, indices)
- ✅ Each bullet teaches something NEW

---

### **3. ARTICLE CONTENT**

**New Structure:**

**CONTENT_NEWS (220-280 words):**
```
Paragraph 1 (35-45 words): 5 Ws - Who, What, When, Where, Why
Paragraph 2 (40-50 words): Key details, quotes, critical numbers
Paragraph 3 (40-50 words): Background/context, significance
Paragraph 4 (40-50 words): Supporting details, reactions
Paragraph 5 (35-45 words): Future implications, next steps
```

**Mandatory Elements:**
- ✅ At least **5 specific numbers**
- ✅ At least **3 named entities**
- ✅ At least **1 quote** (if available in sources)
- ✅ Date and time references
- ✅ Attribution for all claims

**Writing Style:**
- Objective, neutral tone
- Third person only (no "I," "we," "you")
- Active voice predominantly
- Varied sentence length (15-25 words)
- AP/Reuters journalistic style

---

**CONTENT_B2 (220-280 words):**
```
Same 5-paragraph structure but:
- Maximum 20 words per sentence
- Simple tenses only (past simple, present simple, present perfect)
- Active voice only
- Common vocabulary
- 2-3 sentences per paragraph
```

**Vocabulary Simplification Guide:**
```
"Plummeted" → "fell quickly"
"Volatility" → "going up and down quickly"
"Market capitalization" → "total value"
"Sentiment" → "feeling"
"Amid" → "during" or "while"
```

**Technical Term Definition:**
```
"The S&P 500 (a measure of the 500 biggest US companies) fell..."
```

---

## 🎯 **Expected Improvements**

### **Before (Old Prompt):**

**Title:**
```
"Global Stock Markets Decline Following Wall Street Reversal"
```
- ❌ Vague verb "decline"
- ❌ No numbers
- ❌ 7 words (could be stronger)

**Bullets:**
```
1. "Global stocks declined following sharp Wall Street reversal" (repeats title ❌)
2. "Market volatility spread across international centers" (vague ❌)
3. "Experts monitoring the situation closely" (adds nothing ❌)
4. "Economic concerns persist" (obvious ❌)
```

**Article:**
```
Market sentiment deteriorated globally... (passive, vague, no specifics)
```

---

### **After (New Prompt):**

**Title:**
```
"**Asian Stocks** Fall After **Wall Street** Posts Worst Day Since **August**"
```
- ✅ Strong verb "Fall"
- ✅ Specific reference "worst day since August"
- ✅ Named entities (Asian Stocks, Wall Street)
- ✅ 10 words (optimal)

**Bullets:**
```
1. "S&P 500 plunged 3.2% erasing $1.1 trillion in market value, 
    while Tokyo's Nikkei dropped 2.8% and Hong Kong's Hang Seng fell 3.5%."
    ✅ Specific numbers, named indices, NEW info

2. "Federal Reserve Chair Jerome Powell indicated interest rates may remain 
    elevated through mid-2025 despite recent inflation data showing core CPI at 3.7%."
    ✅ Named person, specific date, percentage, NEW detail

3. "European markets opened lower with London's FTSE down 2.1% and Germany's DAX 
    dropping 2.9% as traders await Thursday's ECB policy decision."
    ✅ Geographic spread, specific numbers, future event
```

**Article:**
```
Global equity markets tumbled Wednesday following the S&P 500's steepest 
single-day decline since August, with $1.1 trillion erased from the index's 
market capitalization as Federal Reserve Chair Jerome Powell's hawkish 
comments rattled investors worldwide. Asian markets led the selloff...
```
- ✅ Active voice, specific numbers, named entities
- ✅ Inverted pyramid (most important first)
- ✅ Professional journalistic style

---

## 📈 **Quality Metrics**

| Metric | Old Prompt | New Prompt | Improvement |
|--------|-----------|------------|-------------|
| **Title Length** | Variable (7-15 words) | Consistent (8-10 words) | ✅ More concise |
| **Title Verb Quality** | Weak (decline, change) | Strong (plunge, crash, soar) | ✅ More impactful |
| **Bullet Uniqueness** | Often repeated title | Must be NEW info | ✅ More informative |
| **Bullet Length** | 10-15 words (too short) | 18-25 words (optimal) | ✅ More detail |
| **Numbers per Bullet** | Optional | Mandatory (2+ bullets) | ✅ More specific |
| **Article Structure** | Vague "200-500 words" | Clear 5-para structure | ✅ More consistent |
| **B2 Simplification** | Generic "simpler" | Detailed vocab guide | ✅ More accessible |

---

## 🚀 **Testing the New Prompt**

### **What to Do:**

```bash
cd "/Users/omersogancioglu/Ten news website "
git pull origin main

# If system is running, stop (Ctrl+C) and restart:
./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

### **What to Watch:**

**Next cycle should show:**

```
✍️  STEP 4: MULTI-SOURCE SYNTHESIS
   Synthesizing article from 3 sources...
   [Claude now receives comprehensive guidelines]
   ✅ Synthesized: Asian Stocks Fall After Wall Street Posts Worst Day...
```

**Check for:**
- ✅ Stronger title verbs (not "decline" or "signal")
- ✅ Titles 8-10 words (not 12-15)
- ✅ Bullets provide NEW info (not title repeats)
- ✅ Bullets 18-25 words (not 10-15)
- ✅ Specific numbers in bullets
- ✅ Article follows clear 5-paragraph structure
- ✅ B2 version uses simpler vocabulary

---

## 💡 **Why This Matters**

### **Before:**
Claude had minimal guidance → Inconsistent quality
- Some articles had strong titles, others were weak
- Bullets often just rephrased the title
- Article structure varied widely
- B2 simplification was hit-or-miss

### **After:**
Claude has detailed specifications → Consistent quality
- ✅ Every title follows proven journalistic format
- ✅ Every bullet adds unique information
- ✅ Every article follows AP/Reuters structure
- ✅ B2 version has clear simplification rules

**Result:** More professional, consistent, informative articles! 🎯

---

## 📚 **Examples of What to Expect**

### **Tech News Example:**

**OLD:**
```
Title: "Nvidia Reports Strong Quarterly Earnings Results"
Bullet 1: "Company revenue exceeded analyst expectations"
Bullet 2: "Data center segment shows growth"
Bullet 3: "Stock price reacts positively"
```

**NEW:**
```
Title: "**Nvidia** Reports Record **$22.1 Billion** Revenue as AI Demand Surges"
Bullet 1: "Quarterly revenue reached **$22.1 billion**, beating Wall Street expectations 
           by **$1.7 billion** as data center segment grew **217%** year-over-year."
Bullet 2: "CEO **Jensen Huang** predicts accelerating AI adoption through **2025** 
           with enterprise spending on AI infrastructure expected to double."
Bullet 3: "Shares surged **8%** in after-hours trading to **$495**, positioning company 
           to maintain dominant market share in AI semiconductor sector."
```

**Much more specific, informative, and professional! 🎯**

---

## ✅ **Commit Info**

```
commit 6e94979
✨ Major Update: Comprehensive Step 4 Claude Prompt

Files changed:
- complete_clustered_8step_workflow.py (+80 lines of detailed instructions)
```

---

**Claude now has professional journalism guidelines - expect dramatically better article quality! ✨**

