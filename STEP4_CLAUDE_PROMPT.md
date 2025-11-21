# Step 4: Claude Multi-Source Synthesis Prompt

## Current Full Prompt (as of November 20, 2025)

---

## 📋 **System Context**

**Model:** Claude Sonnet 4.5  
**Function:** Synthesize multiple source articles into one comprehensive dual-language article  
**Location:** `step4_multi_source_synthesis.py` - `build_synthesis_prompt()` function

---

## 🔤 **Full Prompt Template**

```
You are writing a news article by synthesizing information from {N} sources about the same event.

EVENT: {event_name}

SOURCE 1 ({source_name}, Score: {score}/1000):
Title: {title}
Content: {content (max 2000 chars)}

SOURCE 2 ({source_name}, Score: {score}/1000):
Title: {title}
Content: {content (max 2000 chars)}

[... additional sources ...]

INSTRUCTIONS:
1. Write ONE comprehensive article that synthesizes information from ALL {N} sources above
2. Combine the most important facts from each source
3. If sources disagree on facts (like casualty numbers), use the most recent source or say "at least X"
4. DO NOT quote sources or say "according to" - write as if you're reporting firsthand
5. Use clear, objective, journalistic style
6. Follow inverted pyramid structure (most newsworthy information first)
7. Generate content in TWO language versions:
   - NEWS (Advanced): Professional journalism language
   - B2 (Simplified): Easier English for intermediate learners

OUTPUT FORMAT (JSON):
{
  "title_news": "Advanced journalistic title with **bold** key terms",
  "title_b2": "Simplified title with **bold** key terms",
  "summary_bullets_news": [
    "First key point in advanced language",
    "Second key point in advanced language",
    "Third key point in advanced language"
  ],
  "summary_bullets_b2": [
    "First key point in simplified language",
    "Second key point in simplified language",
    "Third key point in simplified language"
  ],
  "content_news": "200-word article synthesizing all sources in advanced language...",
  "content_b2": "200-word article synthesizing all sources in simplified language..."
}

TITLE FORMATTING:
- Use **bold** for key terms (people, places, numbers)
- Example: "**European Central Bank** raises interest rates to **4.5 percent**"

BULLET POINTS:
- 3-5 bullets per version
- Each bullet ≤15 words
- Focus on key facts

ARTICLE CONTENT:
- Exactly 200 words per version
- Start with most newsworthy information
- Include who, what, when, where, why
- Combine facts from ALL sources
- Write as cohesive narrative, not list of facts

Return ONLY valid JSON, no markdown, no explanations.
```

---

## 📊 **Prompt Structure Breakdown**

### **1. Context Setting**
```
You are writing a news article by synthesizing information from {N} sources about the same event.
```
- Sets Claude's role as a news synthesizer
- Emphasizes it's ONE event covered by multiple sources

### **2. Event Name**
```
EVENT: {event_name}
```
- Generated from cluster in Step 1.5
- Example: "European Central Bank Raises Interest Rates"

### **3. Source Articles** (sorted by score, highest first)
```
SOURCE 1 ({source_name}, Score: {score}/1000):
Title: {title}
Content: {content (max 2000 chars)}
```
- **Max 10 sources** passed to Claude (to avoid token limits)
- Each source includes:
  - Source name (e.g., "Reuters", "BBC News")
  - Article score from Step 1 (0-1000)
  - Title
  - Full content from Step 2 (Jina fetch), truncated to 2000 chars

### **4. Instructions** (7 main rules)

1. ✅ **Write ONE article** - synthesize all sources into single piece
2. ✅ **Combine facts** - most important info from each source
3. ✅ **Handle disagreements** - use most recent or say "at least X"
4. ✅ **No attribution** - don't say "according to", write firsthand
5. ✅ **Journalistic style** - clear, objective
6. ✅ **Inverted pyramid** - most newsworthy first
7. ✅ **Dual-language** - Advanced (NEWS) + Simplified (B2)

### **5. Output Format** (JSON with 6 fields)

**Title Fields:**
- `title_news` - Advanced English with **bold** key terms
- `title_b2` - Simplified English with **bold** key terms

**Bullet Fields:**
- `summary_bullets_news` - 3-5 bullets, advanced language
- `summary_bullets_b2` - 3-5 bullets, simplified language

**Article Fields:**
- `content_news` - 200 words, advanced language
- `content_b2` - 200 words, simplified language

### **6. Formatting Rules**

**Bold Syntax:**
```
**European Central Bank** raises interest rates to **4.5 percent**
```
- Bold: people, places, numbers
- Frontend renders as colored + bold text

**Bullets:**
- 3-5 per version
- Max 15 words each
- Focus on key facts

**Article Content:**
- Exactly 200 words (per version)
- Inverted pyramid structure
- Include 5W's (who, what, when, where, why)
- Cohesive narrative (not list)

---

## 🔢 **Token Optimization**

### **Source Limiting:**
```python
# Step 4 only sends max 10 sources to Claude
sorted_sources = sorted(full_articles, key=lambda x: x.get('score', 0), reverse=True)
limited_sources = sorted_sources[:10]  # Max 10
```

### **Content Truncation:**
```python
# Each source content truncated to 1500 chars (~225 words)
# UPDATED: Increased from 800 to 1500 chars on Nov 20, 2025
content_preview = source.get('full_text', '')[:1500]
```

**Why 1500 chars?**
- ✅ Captures lead paragraph + supporting details + context
- ✅ 87.5% more content than previous 800-char limit
- ✅ Balances depth vs token costs
- ❌ 800 chars was too short (only lead paragraph)

### **Total Tokens (estimated):**
- System prompt: ~400 tokens
- Source articles (10 × 1500 chars): ~3,750 tokens
- Instructions: ~300 tokens
- **Total input:** ~4,450 tokens
- **Expected output:** ~600 tokens (200 words × 2 + metadata)
- **Total per request:** ~5,050 tokens

---

## 📝 **Example Input/Output**

### **Example Input:**

```
You are writing a news article by synthesizing information from 3 sources about the same event.

EVENT: Nvidia Reports Record Earnings

SOURCE 1 (Reuters, Score: 850/1000):
Title: Nvidia beats expectations with $22.1B quarterly revenue
Content: Nvidia Corporation reported quarterly revenue of $22.1 billion on Wednesday, exceeding Wall Street expectations of $20.4 billion. The chip maker's data center segment, which includes AI processors, grew 217% year-over-year...

SOURCE 2 (Bloomberg, Score: 820/1000):
Title: AI demand drives Nvidia to record profit
Content: Strong demand for artificial intelligence chips pushed Nvidia's profit to a record $13.5 billion in the third quarter, the company announced. CEO Jensen Huang said AI adoption is accelerating across industries...

SOURCE 3 (CNBC, Score: 800/1000):
Title: Nvidia stock surges 8% after earnings beat
Content: Shares of Nvidia jumped more than 8% in after-hours trading following the company's better-than-expected earnings report. The chipmaker's data center revenue reached $18.4 billion, up from $8.5 billion a year ago...

INSTRUCTIONS:
[... full instructions as above ...]
```

### **Example Output (Claude's Response):**

```json
{
  "title_news": "**Nvidia** Reports Record **$22.1 Billion** Revenue as AI Demand Surges",
  "title_b2": "**Nvidia** Makes Record **$22 Billion** from AI Chips",
  "summary_bullets_news": [
    "**Quarterly revenue** reached **$22.1 billion**, beating analyst expectations by **$1.7 billion**",
    "Data center segment grew **217%** year-over-year to **$18.4 billion**",
    "Shares surged **8%** in after-hours trading following earnings announcement",
    "CEO predicts **accelerating** AI adoption across industries through 2025"
  ],
  "summary_bullets_b2": [
    "**Nvidia** made **$22.1 billion** in three months, more than expected",
    "AI chip sales grew **217%** compared to last year",
    "Company stock price went up **8%** after the news",
    "CEO says AI demand will keep growing next year"
  ],
  "content_news": "Nvidia Corporation reported record quarterly revenue of $22.1 billion on Wednesday, exceeding Wall Street expectations by $1.7 billion as artificial intelligence chip demand continues to surge. The semiconductor manufacturer's data center segment, which produces AI processors, generated $18.4 billion in revenue, representing a 217% year-over-year increase from $8.5 billion. Profit reached a record $13.5 billion in the third quarter. Shares jumped more than 8% in after-hours trading following the announcement. CEO Jensen Huang attributed the exceptional performance to accelerating AI adoption across multiple industries, from cloud computing to autonomous vehicles. The company's high-performance graphics processing units have become essential infrastructure for training and deploying large language models and other AI systems. Analysts view the results as confirmation that AI investment remains robust despite broader economic uncertainties. The strong earnings report positions Nvidia to maintain its dominant market position in the rapidly expanding AI semiconductor sector. Industry observers expect continued growth as enterprises increase spending on AI infrastructure throughout 2025.",
  "content_b2": "Nvidia, a computer chip company, made $22.1 billion in just three months. This was much more money than experts expected the company to make. The main reason for this success is that many companies want to buy Nvidia's special AI chips. These chips help computers learn and think. Nvidia's AI chip sales grew by 217% compared to last year. This means they sold more than three times as many chips. The company made a profit of $13.5 billion, which is the most money they have ever made in one quarter. After this news, Nvidia's stock price went up by 8%. The company's CEO, Jensen Huang, said that more and more businesses are starting to use AI technology. He believes this trend will continue next year. Nvidia's chips are very important for AI systems because they help train computer programs to be smarter. Many big technology companies buy these chips to improve their AI products and services."
}
```

---

## 🎯 **Key Characteristics**

### **What Makes This Prompt Effective:**

1. ✅ **Clear role definition** - "synthesizing information"
2. ✅ **Structured input** - numbered sources with metadata
3. ✅ **Explicit instructions** - 7 numbered rules
4. ✅ **Format specification** - exact JSON structure
5. ✅ **Examples** - shows bold formatting usage
6. ✅ **Constraints** - word counts, bullet limits
7. ✅ **Dual-language** - consistent output for both versions

### **Potential Improvements:**

1. **Add source credibility weighting** - tell Claude which sources are most reliable
2. **Specify tone** - more explicit about neutrality, formality
3. **Add fact-checking instructions** - how to handle conflicting information
4. **Include category context** - prompt might vary by category (Tech vs Politics)
5. **Add examples** - show a good/bad synthesis example

---

## 🔄 **Related Prompts**

### **Update Prompt** (when new sources are added)
- Location: `step4_multi_source_synthesis.py` - `build_update_prompt()`
- Similar structure but includes current article + new sources
- Instructions emphasize updating, not rewriting

### **Component Generation Prompt** (Steps 6-7)
- Location: `step6_7_claude_component_generation.py`
- Uses synthesis output + Perplexity context
- Generates timeline, details, graph components

---

**This is the exact prompt sent to Claude Sonnet 4.5 for every article synthesis in Step 4! 🎯**

