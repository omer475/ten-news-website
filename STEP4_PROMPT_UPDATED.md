# ✨ Step 4 Claude Prompt - Major Update

## Date: November 20, 2025 - 22:00

---

## 🎯 **What Changed**

Replaced the basic Step 4 prompt with a **comprehensive, structured prompt** that includes detailed guidelines for highlighting, writing structure, and content requirements.

---

## 📊 **Before vs After**

### **OLD PROMPT (Simple):**
```
You are writing a news article for Today+. You have {N} sources about the same event.

SOURCES:
{sources_text}

Your task: Write ONE comprehensive article synthesizing ALL sources.

Generate in this EXACT JSON format:
{...basic JSON structure...}

Write only the JSON, no preamble.
```

**Length:** ~15 lines  
**Guidance:** Minimal  
**Examples:** None  
**Highlighting rules:** Vague ("use **bold**")

---

### **NEW PROMPT (Comprehensive):**

```
You are writing a news article by synthesizing information from {N} sources...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 YOUR ROLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a professional news editor synthesizing multiple source articles...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ HIGHLIGHTING REQUIREMENTS (**BOLD** SYNTAX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT TO HIGHLIGHT:
  ✓ Specific numbers: **$22.1 billion**, **3.2%**
  ✓ Key people: **Jerome Powell**, **Elon Musk**
  ✓ Organizations: **Federal Reserve**, **Nvidia**
  ...

MANDATORY HIGHLIGHTING COUNTS:
📌 TITLE: 2-3 highlights
📌 EACH BULLET: 1-3 highlights (must have at least 1)
📌 ARTICLE: 5-15 highlights distributed throughout

[... detailed rules for titles, bullets, article structure ...]
```

**Length:** ~100 lines  
**Guidance:** Comprehensive with examples  
**Examples:** Multiple (✓ good vs ✗ bad)  
**Highlighting rules:** Specific mandatory counts

---

## 🆕 **What's New in the Prompt**

### **1. ✨ Highlighting Requirements Section**

**Clear Rules on WHAT to Highlight:**
- ✅ Specific numbers: **$22.1 billion**, **3.2%**
- ✅ Key people: **Jerome Powell**, **Elon Musk**
- ✅ Organizations: **Federal Reserve**, **Nvidia**
- ✅ Places: **Wall Street**, **Tokyo**
- ✅ Important dates: **Wednesday**, **November 20**

**What NOT to Highlight:**
- ❌ Common words: "said," "announced," "market"
- ❌ Every number (only significant ones)
- ❌ Generic terms: "company," "officials"

---

### **2. 📌 Mandatory Highlighting Counts**

**Titles (title_news + title_b2):**
- Minimum: 2 highlights
- Maximum: 3 highlights
- Example: "**Bitcoin** Drops **8%** as Crypto Fear Hits **2022** Lows"

**Bullets (each of 3 bullets):**
- Per bullet: 1-3 highlights
- MUST have at least 1 highlight per bullet
- Total: 3-9 highlights across all bullets

**Article Content:**
- Minimum: 5 highlights
- Maximum: 15 highlights
- **Distribution rule:** Spread throughout, don't cluster in one paragraph
- Guide: 1-3 highlights per paragraph

---

### **3. ✍️ Enhanced Writing Rules**

1. **SYNTHESIZE, DON'T COPY** - Combine all sources into one story
2. **NEVER quote sources** - No "according to Reuters"
3. **HANDLE CONFLICTS** - Use most recent OR say "at least X"
4. **INVERTED PYRAMID** - Most newsworthy first
5. **JOURNALISTIC STANDARDS** - Objective, neutral, factual

---

### **4. 📝 Detailed Title Requirements**

**Structure:** [Subject] + [Strong Verb] + [Key Detail]

**TITLE_NEWS:**
- 8-10 words maximum
- Strong verbs: Plunge, Crash, Soar, Jump, Fall, Drop, Rise, Surge
- Active voice, present tense
- **2-3 bold highlights**

**Examples:**
- ✅ "**Bitcoin** Drops **8%** as Crypto Fear Index Hits **2022** Lows"
- ❌ "Crypto Market Sentiment Plunges to 'Extreme Fear' Amid Stock Market Crash" (no highlights, too long)

---

### **5. 🔹 Bullet Requirements (18-25 words each)**

**Progressive Structure:**
1. **Bullet 1:** Immediate impact/consequence (with numbers)
2. **Bullet 2:** Key factual details (who, when, where, names)
3. **Bullet 3:** Context, cause, or future implications

**Mandatory:**
- Specific numbers in 2+ bullets
- Named entities
- NO title repetition
- Each bullet MUST have 1-3 highlights

**Example:**
✅ "**S&P 500** plunged **3.2%** erasing **$1.1 trillion** in market value, while Tokyo's Nikkei dropped 2.8%"
   → 3 highlights: S&P 500, 3.2%, $1.1 trillion

❌ "Market volatility spread across international centers"
   → No highlights, vague, no specifics

---

### **6. 📄 Article Structure (220-280 words)**

**5-Paragraph Structure with Word Counts:**

**CONTENT_NEWS (Advanced):**
- Para 1 (35-45w): 5 Ws - Who, What, When, Where, Why | **2-3 highlights**
- Para 2 (40-50w): Key details, critical numbers | **1-2 highlights**
- Para 3 (40-50w): Background/context, significance | **1-2 highlights**
- Para 4 (40-50w): Supporting details, reactions | **1-2 highlights**
- Para 5 (35-45w): Future implications, next steps | **0-2 highlights**

**CONTENT_B2 (Simplified):**
- Same structure
- Max 20 words per sentence
- Simple tenses, active voice only
- Simplify vocabulary: "Plummeted" → "fell quickly"
- **5-15 highlights distributed throughout**

---

## 📊 **Key Improvements**

| Feature | Old Prompt | New Prompt |
|---------|-----------|------------|
| **Highlighting rules** | Vague | Specific counts + examples |
| **Title guidance** | Basic | Detailed with good/bad examples |
| **Bullet structure** | None | Progressive 3-bullet structure |
| **Article structure** | "200-500 words" | 5 paragraphs with word counts |
| **Examples** | None | Multiple ✓ vs ✗ examples |
| **Word limits** | Vague | Specific (220-280 words) |
| **Highlight distribution** | Not mentioned | Mandatory distribution guide |
| **Length** | ~15 lines | ~100 lines |

---

## 🎯 **Expected Impact**

### **Better Highlighting:**
✅ Consistent 2-3 highlights per title  
✅ Every bullet has at least 1 highlight  
✅ Articles have 5-15 highlights distributed throughout  
✅ No more missing or excessive highlights

### **Better Structure:**
✅ Titles are 8-10 words (not too long)  
✅ Bullets follow progressive structure (Impact → Details → Context)  
✅ Articles are 220-280 words (was too flexible at 200-500)  
✅ No title repetition in bullets

### **Better Content:**
✅ Strong action verbs in titles  
✅ Specific numbers and named entities  
✅ Clear distinction between NEWS and B2 versions  
✅ Proper paragraph-by-paragraph structure

---

## 🚀 **Testing the New Prompt**

Pull the latest code and restart:

```bash
cd "/Users/omersogancioglu/Ten news website "
git pull origin main

# Stop current system (Ctrl+C), then restart:
./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

---

## 📋 **What to Watch For**

**Next articles should have:**

1. **Titles with 2-3 highlights:**
   - ✅ "**Nvidia** Reports Record **$22.1 Billion** Revenue as AI Demand Surges"
   - ❌ "Nvidia Reports Record Quarterly Revenue as AI Demand Surges" (no highlights)

2. **Each bullet with 1-3 highlights:**
   - ✅ "**Quarterly revenue** reached **$22.1 billion**, beating analyst expectations by **$1.7 billion**"
   - ❌ "Quarterly revenue beat expectations significantly" (no highlights)

3. **Article with 5-15 highlights distributed:**
   - ✅ Paragraph 1: **Nvidia**, **$22.1 billion**, **Wednesday**
   - ✅ Paragraph 2: **data center**, **$18.4 billion**
   - ✅ Paragraph 3: **CEO Jensen Huang**
   - ❌ All highlights in first paragraph only

---

## ✅ **Checklist for Each Article**

Use this to verify Claude is following the new rules:

**Title (NEWS):**
- [ ] 8-10 words? ✓
- [ ] 2-3 highlights? ✓
- [ ] Strong verb? ✓

**Title (B2):**
- [ ] 8-10 words? ✓
- [ ] 2-3 highlights? ✓
- [ ] Simple vocabulary? ✓

**Bullets (NEWS, 3 bullets):**
- [ ] Bullet 1: 18-25 words, 1-3 highlights? ✓
- [ ] Bullet 2: 18-25 words, 1-3 highlights? ✓
- [ ] Bullet 3: 18-25 words, 1-3 highlights? ✓
- [ ] Progressive structure (Impact→Details→Context)? ✓
- [ ] No title repetition? ✓

**Article (NEWS):**
- [ ] 220-280 words? ✓
- [ ] 5-15 highlights total? ✓
- [ ] Distributed across paragraphs? ✓
- [ ] 5 paragraphs with correct word counts? ✓

**Article (B2):**
- [ ] 220-280 words? ✓
- [ ] 5-15 highlights total? ✓
- [ ] Simple vocabulary? ✓
- [ ] Max 20 words per sentence? ✓

---

## 📝 **Commit Info**

```
commit fabbcdc
✨ Update Step 4 Claude prompt with comprehensive highlighting rules

Files changed:
- complete_clustered_8step_workflow.py (73 insertions, 34 deletions)
```

---

**The new comprehensive prompt is now active! Articles will have much better structure and highlighting! 🎉**

