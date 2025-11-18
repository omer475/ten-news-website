# 📰 Complete Content Generation Rules - News Plus

**Last Updated:** November 18, 2025

---

## 🎯 Overview

The AI generates **6 pieces of content** for each article:

1. **Titles** (2 versions: News + B2)
2. **Bullet Points** (2 versions: News + B2)
3. **Full Article Content** (2 versions: News + B2)

---

## 📋 JSON Output Format

```json
{
  "title_news": "Advanced news title (max 12 words)",
  "title_b2": "B2 English title (max 12 words)",
  
  "summary_bullets_news": [
    "First bullet in professional language (10-15 words)",
    "Second bullet in professional language (10-15 words)",
    "Third bullet in professional language (10-15 words)",
    "Fourth bullet in professional language (10-15 words)"
  ],
  "summary_bullets_b2": [
    "First bullet in B2 English (10-15 words)",
    "Second bullet in B2 English (10-15 words)",
    "Third bullet in B2 English (10-15 words)",
    "Fourth bullet in B2 English (10-15 words)"
  ],
  
  "content_news": "Full article in professional journalism style (300-400 words)",
  "content_b2": "Full article in B2 English (300-400 words)"
}
```

---

## 1️⃣ TITLE RULES (2 Versions Required)

Both titles must convey the **SAME information** but in different language complexity.

### A. TITLE_NEWS (Advanced Professional)

**Requirements:**
- **Length:** Maximum 12 words
- **Style:** Declarative statement (NEVER a question)
- **Context:** Must include geographic/entity context
- **Voice:** Active voice
- **Case:** Sentence case (capitalize only first word and proper nouns)
- **Language:** Professional journalism vocabulary

**Examples:**
✅ "European Central Bank raises interest rates to 4.5 percent"
✅ "Indian Parliament approves controversial citizenship amendment bill"
✅ "Australian wildfires force evacuation of 50,000 residents"

---

### B. TITLE_B2 (B2 English)

**Requirements:**
- **Length:** Maximum 12 words
- **Style:** Same as title_news - declarative statement
- **Context:** Same geographic/entity context
- **Voice:** Active voice
- **Case:** Sentence case
- **Language:** B2 upper-intermediate English (simpler, clearer)

**B2 Guidelines:**
- Same information as title_news
- Simpler vocabulary when possible
- Shorter words preferred
- Clear and direct phrasing

**Examples:**
```
TITLE_NEWS: "European Central Bank raises interest rates to 4.5 percent"
TITLE_B2: "European Central Bank makes borrowing more expensive, rates at 4.5 percent"

TITLE_NEWS: "Indian Parliament approves controversial citizenship amendment bill"
TITLE_B2: "Indian Parliament passes new citizenship law despite controversy"

TITLE_NEWS: "Australian wildfires force evacuation of 50,000 residents"
TITLE_B2: "Australia wildfires force 50,000 people to leave their homes"
```

### Prohibited (Both Versions):
❌ Questions
❌ Clickbait phrases
❌ Exclamation marks
❌ ALL CAPS
❌ Editorial opinions
❌ Vague geographic references

---

## 2️⃣ BULLET POINTS (4 bullets × 10-15 words each)

### A. SUMMARY_BULLETS_NEWS (Professional Language)

**Structure:**
- **Count:** EXACTLY 4 bullets
- **Length:** 10-15 words per bullet
- **Content:** Most important facts in understandable way
- **Style:** Professional news language

**Rules:**
- Each bullet is complete, standalone thought
- Start directly with key information (no "The" or "This")
- No periods at end
- Include specific details (numbers, names, locations)
- Active voice
- Use standard journalism vocabulary

**Example:**
```
✅ "European Central Bank raises interest rates to 4.5 percent, tenth consecutive increase"
✅ "Inflation remains at 5.3 percent across eurozone, well above 2 percent target"
✅ "340 million residents face higher costs for mortgages and consumer loans"
✅ "ECB President Christine Lagarde commits to bringing inflation under control"
```

---

### B. SUMMARY_BULLETS_B2 (B2 English)

**Structure:**
- **Count:** EXACTLY 4 bullets
- **Length:** 10-15 words per bullet
- **Content:** Same information as news version, simpler language
- **Style:** B2 upper-intermediate English

**Rules:**
- Same structure as news bullets
- Use clearer, more direct language
- Avoid complex technical terms
- Maintain professional tone
- Same information, just easier to understand

**Example:**
```
✅ "European Central Bank makes borrowing money more expensive for the tenth time"
✅ "Prices still rising at 5.3 percent, more than double the target"
✅ "340 million people will pay more for home loans and credit"
✅ "Bank leader promises to control rising prices despite economic concerns"
```

---

## 3️⃣ FULL ARTICLE CONTENT (300-400 words each)

### A. CONTENT_NEWS (Professional Journalism)

**Length:** 300-400 words

**Style:**
- **Tone:** Professional journalism (BBC, Reuters, NYT style)
- **Vocabulary:** Standard journalism language
- **Structure:** Inverted pyramid (most important first)
- **Tense:** Past for events, present for ongoing situations
- **Voice:** Active voice preferred

**Content Requirements:**
- Cover ALL key aspects: WHO, WHAT, WHEN, WHERE, WHY, HOW
- Include specific numbers, dates, and data
- Provide context and background
- Quote sources when relevant
- Explain implications and impact
- Maintain objectivity
- Use multiple paragraphs for readability

**Structure Guide:**
1. **Opening (50-80 words):** Main event with key details
2. **Context (80-120 words):** Background, why it matters, previous developments
3. **Details (80-120 words):** Specific numbers, quotes, additional information
4. **Impact (80-100 words):** Consequences, who's affected, future implications

**Example Opening:**
"The European Central Bank raised its key interest rate by 0.25 percentage points to 4.5 percent on Thursday, marking the tenth consecutive increase since July 2023. The decision comes as inflation across the 19-nation eurozone remains at 5.3 percent, more than double the ECB's 2 percent target. The move will affect 340 million people across member states, leading to higher borrowing costs for mortgages, business loans, and consumer credit."

---

### B. CONTENT_B2 (B2 Upper-Intermediate English)

**Length:** 300-400 words

**Style:**
- **Tone:** Professional but clearer and more direct
- **Vocabulary:** B2 level (upper-intermediate)
- **Structure:** Same information as news version, simpler language
- **Sentences:** Shorter (12-18 words average)
- **Tense:** Simple tenses preferred

**Content Requirements:**
- **SAME INFORMATION** as content_news
- **SAME STRUCTURE** (opening, context, details, impact)
- **DIFFERENT LANGUAGE:** Simpler, clearer, more direct
- Avoid complex jargon
- Break down technical concepts
- Use shorter sentences
- Maintain professional tone

**Language Guidelines:**

**✅ USE (B2 Appropriate):**
- Standard terms: interest rates, inflation, government, economy, policy
- Common business words: investment, loans, borrowing, employment
- Basic technical terms: GDP, recession, budget, deficit
- Clear explanations: "raised interest rates" instead of "monetary tightening"

**❌ AVOID (Too Complex):**
- Technical jargon: quantitative easing, fiscal consolidation, structural reforms
- Complex academic words: promulgate, ameliorate, exacerbate
- Financial jargon: derivative instruments, credit default swaps
- Long compound sentences with multiple clauses

**Simplification Examples:**
- "monetary policy tightening" → "making borrowing more expensive"
- "quantitative easing" → "central bank buying bonds to help the economy"
- "fiscal stimulus" → "government spending to boost the economy"
- "exacerbate inflation" → "make inflation worse"

**Example Opening (B2 Version):**
"The European Central Bank made borrowing money more expensive on Thursday by raising interest rates to 4.5 percent. This is the tenth time the bank has raised rates since July 2023. The bank took this action because prices are still rising too fast across countries that use the euro. Inflation is currently at 5.3 percent, which is more than double the bank's target of 2 percent. The change will affect 340 million people across 19 European countries."

---

## 🎯 Key Differences Between News and B2 Versions

| Aspect | NEWS (Professional) | B2 (Upper-Intermediate) |
|--------|---------------------|-------------------------|
| **Vocabulary** | Standard journalism terms | Common, clear words |
| **Sentence Length** | 15-25 words | 12-18 words |
| **Structure** | Complex when needed | Simpler, more direct |
| **Technical Terms** | Used with context | Explained or replaced |
| **Tone** | Professional, formal | Professional, clearer |
| **Information** | Comprehensive | **SAME INFO**, simpler language |

---

## ✅ Validation Checklist

Before outputting, verify:

- [ ] title_news: ≤12 words, statement, includes location/entity, professional vocabulary
- [ ] title_b2: ≤12 words, statement, includes location/entity, B2 English
- [ ] Both titles convey the SAME information
- [ ] summary_bullets_news: 4 bullets, 10-15 words each, professional language
- [ ] summary_bullets_b2: 4 bullets, 10-15 words each, B2 English
- [ ] content_news: 300-400 words, professional journalism
- [ ] content_b2: 300-400 words, B2 English, SAME information
- [ ] No exact title wording repeated in any content
- [ ] Both title versions, bullet versions, and content versions contain the same facts

---

## 📊 Supabase Database Structure

Add these columns to your `articles` table:

```sql
-- For titles (max 12 words each)
ALTER TABLE articles 
ADD COLUMN title_news TEXT,
ADD COLUMN title_b2 TEXT;

-- For bullet points (4 bullets, 10-15 words each)
ALTER TABLE articles 
ADD COLUMN summary_bullets_news TEXT[],
ADD COLUMN summary_bullets_b2 TEXT[];

-- For full article content (300-400 words each)
ALTER TABLE articles 
ADD COLUMN content_news TEXT,
ADD COLUMN content_b2 TEXT;
```

---

## 🔄 Generation Process

1. Read original article carefully
2. Identify main event and geographic context
3. Generate title_news (≤12 words, professional)
4. Generate title_b2 (≤12 words, B2 English, same information)
5. Generate summary_bullets_news (4 bullets, professional)
6. Generate summary_bullets_b2 (4 bullets, B2 English)
7. Generate content_news (300-400 words, professional journalism)
8. Generate content_b2 (300-400 words, same info in B2 English)
9. Verify all word counts
10. Check all versions (titles, bullets, content) contain the same information

---

**END OF SPECIFICATION**

