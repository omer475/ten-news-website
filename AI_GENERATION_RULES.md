# 🤖 AI GENERATION RULES & PROMPTS

Complete documentation of all AI prompts used in the Ten News system.

---

## 1. 📊 SCORING (Gemini 2.5 Flash)

### Model: `gemini-2.5-flash`
### Temperature: Default
### Max Tokens: Default

### Prompt:
```
You are a GLOBAL NEWS CURATOR scoring articles for INTERNATIONAL SHAREABILITY.

ARTICLE:
Title: {article['title']}
Source: {article['source']}
Description: {article['description'][:500]}

Score from 0-100 using this breakdown:

1. SHAREABILITY (60 points):
   - Makes You Look Smart (25 pts): Non-obvious insights, surprises, explains complex ideas
   - Makes You Look Cool (25 pts): Emerging trends, early knowledge, future-facing
   - Makes You Interesting (10 pts): Cross-cultural, sophisticated, fascinating

2. GLOBAL APPEAL (25 points) ⭐ CRITICAL:
   - Universal Relevance (10 pts): Matters to ANY country (science, tech, health, nature, psychology)
   - Cross-Cultural (10 pts): No local context needed, works in Tokyo, Lagos, Mumbai, Stockholm
   - International Impact (5 pts): Affects multiple countries or humanity

3. INTEREST & NOVELTY (10 points):
   - Uniqueness (4 pts), Educational Value (3 pts), Curiosity Gap (3 pts)

4. NEWS RELEVANCE (5 points):
   - Timeliness (3 pts), Significance (2 pts)

AUTOMATIC PENALTIES:
-20 pts: Hyper-local (city council, local weather, single-city news, regional sports)
-20 pts: Single small-country politics with no global impact
-15 pts: Clickbait, misinformation
-10 pts: Heavy bias, duplicate story

AUTOMATIC BONUSES:
+10 pts: Multi-country impact, scientific breakthroughs, global health, space, planet-affecting
+5 pts: Data visualization, exclusive research, cross-disciplinary

EXAMPLES:
- "Scientists discover new human organ": 100/100 (science, affects everyone, fascinating)
- "Manchester parking regulations": 0/100 (hyper-local, -20 penalty)
- "AI predicts earthquakes 24h in advance": 100/100 (tech breakthrough, global safety)
- "Texas governor signs education bill": 0/100 (single state, -20 penalty)

PUBLISH THRESHOLD: 55+ points

CATEGORIES: breaking, science, technology, business, environment, politics, general

Return ONLY this JSON:
{
  "score": <0-100>,
  "category": "<category>",
  "emoji": "<single emoji>",
  "reasoning": "<Explain: shareability score, global appeal, penalties/bonuses applied>"
}
```

### Output Example:
```json
{
  "score": 91,
  "category": "science",
  "emoji": "🔬",
  "reasoning": "Shareability: 55/60 (makes you look smart, fascinating breakthrough). Global Appeal: 25/25 (affects all humanity, cross-cultural). Novelty: 11/10 (+1 bonus for groundbreaking discovery). Score: 91/100"
}
```

### Adjustments:
- Source credibility bonus: +4 to -4 points based on source reputation
- Final score clamped to 0-100

---

## 2. 📝 DETAILED ARTICLE TEXT (Claude 3.5 Sonnet)

### Model: `claude-3-5-sonnet-20241022`
### Temperature: Default
### Max Tokens: 800

### Prompt:
```
Rewrite this news article as a comprehensive, detailed news article.

STRICT REQUIREMENTS:
- MUST be between 150-200 words (tolerance: +/- 10 words)
- Write in detailed, journalistic style
- Provide comprehensive coverage of the story
- Include background context, current developments, and implications
- Use multiple paragraphs for better readability
- Include specific details, quotes, statistics, and expert opinions
- Cover WHO, WHAT, WHEN, WHERE, WHY, and HOW
- Use bold markdown (**text**) to emphasize 2-3 key terms

Article Title: {article['title']}
Article: {article['description']}
{article['content'][:1000] if article['content'] else ''}

Write the 150-200 word detailed article now:
```

### Rules:
- **Word count**: 150-200 words (strict validation: 140-210 acceptable)
- **Format**: Multiple paragraphs for readability
- **Markdown**: Use **bold** for 2-3 key terms/numbers
- **Tone**: Comprehensive, journalistic, factual

### Output Example:
```
Scientists have discovered a **new human organ** in the digestive system, potentially affecting **90% of the population**. The breakthrough, published in Nature Medicine, identifies the mesentery as a distinct organ that plays crucial roles in immune function and nutrient absorption.

The discovery emerged from detailed anatomical studies conducted at University College Dublin, where researchers examined the mesentery's structure and function. Previously considered fragmented tissue, the mesentery is now recognized as a continuous organ connecting the intestine to the abdominal wall.

This finding could revolutionize treatment for chronic diseases including Crohn's disease, diabetes, and certain cancers. The mesentery's role in immune system regulation suggests new therapeutic targets for autoimmune conditions. Medical textbooks will require updates to reflect this fundamental change in human anatomy understanding.

The research team, led by Dr. Calvin Coffey, spent over four years mapping the organ's structure using advanced imaging techniques. Their work demonstrates how modern technology continues to reveal previously unknown aspects of human biology, potentially opening new avenues for medical treatment and disease prevention.
```

---

## 3. ✏️ TITLE OPTIMIZATION (Claude 3.5 Sonnet)

### Model: `claude-3-5-sonnet-20241022`
### Temperature: Default
### Max Tokens: 100

### Prompt:
```
Optimize this news title to 4-10 words while keeping the key information.

Original title: {title}

Requirements:
- MUST be 4-10 words
- Keep the most important information
- Make it clear and compelling
- No clickbait

Write the optimized title now (4-10 words):
```

### Rules:
- **Word count**: 4-10 words (strict)
- **No clickbait**: Factual and clear
- **Key info**: Keep most important details
- If already 4-10 words, keep original

### Output Examples:
- Original: "A groundbreaking study by Harvard researchers reveals shocking new insights about climate change"
- Optimized: "Harvard Study Reveals Climate Change Insights"

---

## 4. 📅 TIMELINE (Perplexity Sonar Pro - Primary)

### Model: `sonar-pro` (with internet search)
### Temperature: 0.2 (factual)
### Max Tokens: 500

### Prompt:
```
Search the internet and create a chronological timeline of key events for this news story.

Article: {article['title']}
Description: {article['description']}

Requirements:
- Search for the latest verified information about this topic
- 2-4 key events in chronological order with REAL dates
- Each event: date/time + brief description (MAXIMUM 14 WORDS)
- Plain text only - NO bold markdown or formatting
- ONLY include verified information from reliable sources

Return ONLY a JSON array (no explanation):
[
  {"date": "October 2024", "event": "Description in 14 words or less"},
  {"date": "October 9, 2024", "event": "Another brief event description"}
]
```

### Rules:
- **Format**: JSON array only
- **Events**: 2-4 chronological events
- **Word Limit**: MAXIMUM 14 words per event description
- **Dates**: REAL dates from internet search
- **Verification**: Only verified facts from reliable sources
- **NO Markdown**: Plain text only (no bold, no formatting)

### Output Example:
```json
[
  {
    "date": "October 2024",
    "event": "Harvard researchers published findings in Nature journal showing new climate patterns"
  },
  {
    "date": "October 9, 2024",
    "event": "UN Climate Panel cited study in emergency briefing to world leaders"
  },
  {
    "date": "October 11, 2024",
    "event": "G7 nations announced joint response plan based on new data"
  }
]
```

### Fallback: Claude 3.5 Sonnet
If Perplexity fails, Claude generates timeline without internet search (less accurate dates).

---

## 5. 📊 DETAILS SECTION (Perplexity Sonar Pro - Primary)

### Model: `sonar-pro` (with internet search)
### Temperature: 0.2 (factual)
### Max Tokens: 300

### Prompt:
```
Search the internet and find key data points for this news article.

Article: {article['title']}
Description: {article['description']}

Requirements:
- Search for the latest verified data about this topic
- Find EXACTLY 3 key data points NOT mentioned in the article description
- Format: "Label: Value" where Label is 1-3 words, Value is key data
- Keep each detail under 7 words total
- Examples: "Revenue: $89.5B", "Market cap: $2.8T", "Recovery: 18-24 months estimated"
- ONLY include verified facts from reliable sources

Return ONLY 3 lines of text (no JSON, no brackets, no quotes, no commas):
Market cap: $1.2T
Patent portfolio: 50,000+
R&D budget: 18% revenue
```

### ✍️ **Writing Rules**
- **Exactly 3 details** per article (no more, no less)
- **"Label: Value" format** structure
- **NEW information** only (not mentioned in summary)
- **Data-driven** with hard numbers
- **Maximum 7 words** per detail (preferably 3-6)

### 🎨 **Visual Styling**
- **Container:** Glassmorphism card with `rgba(255,255,255,0.15)` background, `blur(20px)`, `16px` border-radius
- **Label Font:** `10px` (9px mobile), `#6b7280` color, `UPPERCASE`, `600` weight, `1px` letter-spacing
- **Value Font:** `20px` (16px mobile), `#111827` (light) / `#f9fafb` (dark), `800` weight
- **Subtitle Font:** `11px` (10px mobile), `#6b7280` color, `500` weight
- **Layout:** Horizontal flexbox, center-aligned, equal width
- **Dividers:** Thin vertical lines BETWEEN details (between 1st & 2nd, between 2nd & 3rd)
- **Spacing:** `12px` vertical, `20px` horizontal padding, `15px` item padding

### 📏 **Length Guidelines**
- **Short format**: 3-4 words (`Stock drop: 91%`)
- **Medium format**: 5-6 words (`Market share: 28% of global`)
- **Descriptive format**: 6-7 words max (`Recovery timeline: 18-24 months estimated`)

### 🏷️ **Label Rules**
- **1-3 words maximum**
- Capitalize first word only
- Be specific, not generic
- No colons in the label itself

### 💎 **Value Rules**
- **Primary number/fact first**
- Context after (2-4 words max)
- Keep concise
- No full sentences

### 📚 **Examples by Story Type**

**Tech/Business Stories:**
```
Market cap: $1.2T
Patent portfolio: 50,000+ active
R&D budget: 18% of revenue
```

**Disaster/Crisis Stories:**
```
Warning time: 6 minutes only
Shelters opened: 200 facilities
Aid workers: 5,000 deployed
```

**Political/Diplomatic Stories:**
```
Bilateral trade: $340B annually
Embassy staff: 1,200 personnel
Agreements signed: 12 total
```

**Medical/Health Stories:**
```
Sample size: 1,200 patients
Study duration: 5 years
Affected population: 90% rate
```

**Economic Stories:**
```
GDP impact: 2.3% decrease
Jobs affected: 450,000
Recovery timeline: 18 months
```

### ✅ **Good Examples:**
- ✅ `Market cap: $2.8T` (concise, data-driven)
- ✅ `Stock drop: 91% decline` (specific number + context)
- ✅ `Recovery: 18-24 months estimated` (clear timeframe)
- ✅ `Affected users: 2.1M accounts` (quantified impact)

### ❌ **Bad Examples:**
- ❌ `Market capitalization: The company is valued at approximately $2.8 trillion dollars` (too long)
- ❌ `The stock has dropped significantly` (no numbers, vague)
- ❌ `Information: Not available` (not data-driven)
- ❌ `Details: See article for more` (not useful)

### ✅ **Validation Checklist**
**Content Validation:**
- ✓ New information not in summary
- ✓ Quantified with numbers
- ✓ Relevant to article topic

**Format Validation:**
- ✓ Under 7 words total
- ✓ Contains exactly one colon
- ✓ Label is 1-3 words

**Style Validation:**
- ✓ Label capitalized properly
- ✓ No full sentences
- ✓ Clear and specific

**Technical Validation:**
- ✓ Plain text format (no JSON, brackets, quotes, commas)
- ✓ Exactly 3 lines separated by newlines
- ✓ No special characters breaking format

### 🎯 **The Ultimate Goal**
> Someone scanning details should instantly grasp 3 key supplementary facts in under 3 seconds without reading sentences

### 📐 **Visual Layout Example**
```
┌──────────────────────────────────────────────────────────┐
│   DEPTH        │    AFTERSHOCKS    │     EVACUATION      │
│     63         │        25         │       10,000        │
│  km below      │     recorded      │      residents      │
│   surface      │                   │                     │
└──────────────────────────────────────────────────────────┘
```
Note: Vertical dividers (│) appear BETWEEN the three details, not before or after

### 🔧 **Implementation Details**
**For AI Generators:**
- Use internet search to find verified data
- Prioritize recent, reliable sources
- Extract hard numbers and facts
- Format consistently as plain text (no JSON)

**For Developers:**
- Parse as 3 separate lines of text (split by newline)
- Display in horizontal card layout with vertical dividers between items
- Split each line on first colon only to separate Label from Value
- Apply glassmorphism styling
- Add thin divider lines: between 1st & 2nd detail, between 2nd & 3rd detail

**For Content Reviewers:**
- Verify all 3 details are new information
- Check length constraints
- Ensure proper "Label: Value" format
- Validate data accuracy

### Fallback: Claude 3.5 Sonnet
If Perplexity fails, Claude generates details without internet search (less current information).

---

## 🎯 COMPLETE WORKFLOW

1. **Scoring** (Gemini) → Score 0-100
2. **Filter** → If score ≥ 55, proceed
3. **Summary** (Claude) → 35-40 words
4. **Title** (Claude) → 4-10 words
5. **Timeline** (Perplexity → Claude fallback) → 2-4 events (max 14 words each)
6. **Details** (Perplexity → Claude fallback) → 3 data points ("Label: Value" format)
7. **Publish** → Push to database & website

---

## 🔄 API Priority System

### Primary APIs:
- **Gemini**: Scoring (fastest, most quota)
- **Perplexity**: Timeline & Details (internet search = accuracy)
- **Claude**: Summary & Title (best at concise writing)

### Fallback Chain:
```
Timeline: Perplexity → Claude → Empty Array
Details: Perplexity → Claude → None
```

---

## ⚡ Performance Settings

- **Parallel Scoring**: 10 Gemini calls simultaneously
- **Sequential Content**: Summary/Title/Timeline/Details one at a time
- **Rate Limiting**: 2 second pause between batches
- **Timeouts**: 
  - Claude: 30-45 seconds
  - Perplexity: 60 seconds
  - Gemini: Default

---

## 📊 Quality Control

### Validation:
- **Summary**: 33-42 words accepted
- **Title**: 4-10 words required
- **Timeline**: Must be valid JSON array, max 14 words per event, no markdown
- **Details**: Exactly 3 items, "Label: Value" format, max 7 words each
- **Score**: Clamped to 0-100

### Error Handling:
- Each component has fallback
- Failed articles marked as processed
- Errors logged but don't break pipeline

