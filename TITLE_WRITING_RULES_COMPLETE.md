# 📰 TITLE WRITING RULES - COMPLETE GUIDE
## All Systems & File Locations

---

## ⚠️ IMPORTANT: TWO DIFFERENT SYSTEMS

There are **TWO different title length requirements** depending on which system is generating the news:

| System | Word Count | Model | File Location |
|--------|------------|-------|---------------|
| **Live News (RSS Feed)** | **4-10 words** | Claude 3.5 Sonnet | `ai_filter.py`, `AI_GENERATION_RULES.md` |
| **Daily Ten News Generator** | **8-12 words** | Claude 3.5 Sonnet | `news-generator.py` |

---

## 🔴 LIVE NEWS SYSTEM (RSS Feed)
### Title Rules: 4-10 Words

### 📁 File Locations:

1. **Main Implementation:** `/Users/omersogancioglu/Ten news website /ai_filter.py`
   - Lines: 487-528 (function `_optimize_title`)
   
2. **Documentation:** `/Users/omersogancioglu/Ten news website /AI_GENERATION_RULES.md`
   - Lines: 121-151 (Section 3: TITLE OPTIMIZATION)

3. **System Scripts:**
   - `RUN_LIVE_SYSTEM.sh` - Line 79
   - `START_FIXED_SYSTEM.sh` - Line 41
   - `RESTART_FIXED_SYSTEM.sh` - Line 16

---

### 📋 Complete Rules (Live News System)

**From `ai_filter.py` (Lines 487-528):**

```python
def _optimize_title(self, article):
    """Optimize title to 4-10 words with Claude"""
    original_title = article.get('title', '')
    
    if not original_title:
        return original_title
    
    # Check if title is already 4-10 words
    word_count = len(original_title.split())
    if 4 <= word_count <= 10:
        return original_title
    
    try:
        prompt = f"""Optimize this news title to 4-10 words while keeping the key information.

Original title: {original_title}

Requirements:
- MUST be 4-10 words
- Keep the most important information
- Make it clear and compelling
- No clickbait

Write the optimized title now (4-10 words):"""

        response = self.claude.messages.create(
            model=self.claude_model,
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        
        optimized = response.content[0].text.strip()
        optimized_word_count = len(optimized.split())
        
        if 4 <= optimized_word_count <= 10:
            return optimized
        else:
            return original_title
            
    except Exception as e:
        self.logger.error(f"Title optimization failed: {str(e)}")
        return original_title
```

---

### 📖 Documentation (from `AI_GENERATION_RULES.md`)

**Section 3: TITLE OPTIMIZATION (Claude 3.5 Sonnet)**

**Model:** `claude-3-5-sonnet-20241022`  
**Temperature:** Default  
**Max Tokens:** 100

**Prompt:**
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

**Rules:**
- ✅ **Word count:** 4-10 words (strict)
- ✅ **No clickbait:** Factual and clear
- ✅ **Key info:** Keep most important details
- ✅ **Smart skip:** If already 4-10 words, keep original

**Output Examples:**
- ❌ Original: "A groundbreaking study by Harvard researchers reveals shocking new insights about climate change"
- ✅ Optimized: "Harvard Study Reveals Climate Change Insights" (6 words)

---

## 🔵 DAILY TEN NEWS GENERATOR
### Title Rules: 8-12 Words

### 📁 File Location:

**Main File:** `/Users/omersogancioglu/Ten news website /news-generator.py`
- Lines: 719-793 (function `create_dedicated_rewriting_prompt`)
- Lines: 795-1032 (function `create_rewriting_prompt`)

---

### 📋 Complete Rules (Daily Generator)

**From `news-generator.py` (Line 728):**

```python
4. **TITLE**: 8-12 engaging words (NO emoji in title field)
```

**From `news-generator.py` (Line 800):**

```python
REWRITE RULES:
- TITLE: 8-12 words, engaging headline (NO emoji in title field)
- SUMMARY: CRITICAL - MUST be EXACTLY 40-50 words
- DETAILS: CRITICAL - Follow the comprehensive Details Section Instructions
- EMOJI: Choose relevant emoji for each article
- CATEGORY: World News/Business/Technology/Science/Climate/Health
```

---

### 🎯 Key Differences Between Systems

| Feature | Live News (RSS) | Daily Generator |
|---------|-----------------|-----------------|
| **Word Count** | 4-10 words | 8-12 words |
| **Emoji in Title** | Not specified | ❌ **NO emoji in title** |
| **When Applied** | Real-time RSS feeds | Daily 7 AM generation |
| **Skip Optimization** | Yes (if already 4-10) | No (always rewrite) |
| **Source** | External RSS feeds | Curated 10 stories |

---

## 📝 DETAILED TITLE REQUIREMENTS

### ✅ REQUIRED ELEMENTS (Both Systems)

1. **Clear and Informative**
   - Explains what happened
   - Not a teaser or question
   - Complete thought

2. **Specific with Details**
   - Names, numbers, locations
   - Concrete information
   - No vague language

3. **Factual and Neutral**
   - No emotional manipulation
   - No clickbait words
   - Professional tone

4. **Grammatically Correct**
   - Proper sentence structure
   - Correct punctuation
   - Professional style

5. **Key Information Preserved**
   - Most important facts retained
   - Core message clear
   - Context maintained

---

### ❌ FORBIDDEN ELEMENTS (Both Systems)

1. **Clickbait Tactics**
   - ❌ "You Won't Believe..."
   - ❌ "This One Trick..."
   - ❌ "Shocking Discovery..."
   - ❌ Excessive punctuation (!!!)
   - ❌ ALL CAPS WORDS

2. **Vague Language**
   - ❌ "Something Amazing"
   - ❌ "Everything Changes"
   - ❌ "The Truth About X"
   - ❌ No specific information

3. **Emotional Manipulation**
   - ❌ Fear-based language
   - ❌ Sensationalism
   - ❌ Exaggeration
   - ❌ Misleading framing

4. **Questions as Titles**
   - ❌ "Is This the End?"
   - ❌ "What Does This Mean?"
   - ❌ "Could This Change Everything?"

5. **Daily Generator Only:**
   - ❌ **NO EMOJI IN TITLE FIELD** (emoji goes in separate field)

---

## 📊 VALIDATION PROCESS

### Live News System (4-10 words)

```python
# Check original word count
original_word_count = len(title.split())

# If already 4-10 words, skip optimization
if 4 <= original_word_count <= 10:
    return title

# Otherwise, optimize with Claude
optimized_title = claude_optimize(title)
optimized_word_count = len(optimized_title.split())

# Validate optimized version
if 4 <= optimized_word_count <= 10:
    return optimized_title
else:
    return original_title  # Fallback to original
```

### Daily Generator (8-12 words)

```python
# Always rewrite all titles
# No skip condition
# Strict validation: must be 8-12 words

CRITICAL REQUIREMENTS:
4. **TITLE**: 8-12 engaging words (NO emoji in title field)
```

---

## 💡 EXAMPLES BY WORD COUNT

### 4 Words (Live News Only)
✅ "Mars Rover Finds Water"
✅ "Fed Raises Interest Rates"
✅ "China Launches Space Station"

### 6 Words (Both Systems)
✅ "Harvard Study Reveals Climate Change Insights"
✅ "Apple Reports Record Quarter Revenue Growth"
✅ "UN Announces Major Peace Agreement Deal"

### 8 Words (Both Systems)
✅ "Scientists Discover New Human Organ in Digestive System"
✅ "Federal Reserve Raises Interest Rates to Combat Inflation"
✅ "OpenAI Releases GPT-5 with Revolutionary New Capabilities"

### 10 Words (Both Systems)
✅ "Tesla Announces Record Quarterly Profits Despite Supply Chain Challenges Globally"
✅ "European Union Passes Landmark AI Regulation Law Affecting Tech Giants"
✅ "NASA Mars Mission Discovers Evidence of Ancient Life Under Surface"

### 12 Words (Daily Generator Only)
✅ "Apple Reports Record $89.5 Billion Revenue for Q4 2024 Exceeding All Analyst Expectations"
✅ "United Nations Security Council Passes Resolution to Address Global Climate Crisis Emergency"

---

## 🔧 IMPLEMENTATION DETAILS

### Live News System Process

1. **Fetch** article from RSS feed
2. **Check** word count (4-10?)
3. **Skip** if already valid
4. **Optimize** with Claude if needed
5. **Validate** optimized version
6. **Fallback** to original if optimization fails

**Code Location:** `ai_filter.py` lines 487-528

---

### Daily Generator Process

1. **Select** top 10 stories
2. **Scrape** full article content
3. **Rewrite** ALL articles (no skip)
4. **Format** with 8-12 word titles
5. **Validate** all requirements met
6. **Publish** to website

**Code Location:** `news-generator.py` lines 719-1032

---

## 📂 ALL FILE LOCATIONS SUMMARY

### Primary Implementation Files

1. **`ai_filter.py`** (Live System)
   - Line 248: Title optimization call
   - Line 250: Optimized title assignment
   - Lines 487-528: `_optimize_title()` function
   - **Rule:** 4-10 words

2. **`news-generator.py`** (Daily Generator)
   - Line 728: Title requirement in dedicated prompt
   - Line 800: Title requirement in main prompt
   - **Rule:** 8-12 words

### Documentation Files

3. **`AI_GENERATION_RULES.md`**
   - Lines 121-151: Section 3 - TITLE OPTIMIZATION
   - Line 386: Workflow step 4
   - Line 424: Quality control validation
   - **Rule:** 4-10 words (Live System)

### System Scripts

4. **`RUN_LIVE_SYSTEM.sh`** - Line 79
5. **`START_FIXED_SYSTEM.sh`** - Line 41
6. **`RESTART_FIXED_SYSTEM.sh`** - Line 16

### Other References

7. **`news-part1-breaking.py`** - Lines 466-520 (title optimization function)
8. **`news-part2-global.py`** - Lines 582-626 (title optimization function)
9. **`MIGRATION_COMPLETE.md`** - Line 260
10. **`README_RSS_SYSTEM.md`** - Line 106
11. **`TWO_PART_NEWS_SYSTEM.md`** - Lines 37, 89

---

## 🎯 QUICK REFERENCE

### Which System Am I Using?

**Live News (RSS Feed):**
- Files: `ai_filter.py`, `rss_fetcher.py`
- Scripts: `RUN_LIVE_SYSTEM.sh`, `START_FIXED_SYSTEM.sh`
- **Title:** 4-10 words
- Updates: Real-time (every 15 min)

**Daily Ten News Generator:**
- File: `news-generator.py`
- Script: `RUN_COMPLETE_SYSTEM.sh`
- **Title:** 8-12 words
- Updates: Once daily at 7 AM UK

---

## ✅ VALIDATION CHECKLIST

### For Live News (4-10 words):
- [ ] Title is 4-10 words long
- [ ] Clear and informative
- [ ] Specific details included
- [ ] No clickbait language
- [ ] Grammatically correct
- [ ] Key information preserved

### For Daily Generator (8-12 words):
- [ ] Title is 8-12 words long
- [ ] Engaging and compelling
- [ ] **NO emoji in title field**
- [ ] Clear and informative
- [ ] Specific details included
- [ ] No clickbait language
- [ ] Grammatically correct

---

## 🔄 API USAGE

### Both Systems Use:
- **Model:** Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`)
- **Max Tokens:** 100
- **Temperature:** Default
- **Purpose:** Generate concise, clear titles

---

## 📖 BEST PRACTICES

1. **Always validate word count** before publishing
2. **Preserve key information** - names, numbers, locations
3. **Avoid losing context** when shortening
4. **Test readability** - title should make sense standalone
5. **Check for completeness** - not a teaser or cliffhanger
6. **Verify neutrality** - factual tone, no manipulation
7. **Daily Generator:** Remember NO emoji in title field!

---

## 🚨 COMMON MISTAKES TO AVOID

1. ❌ Putting emojis in titles (Daily Generator)
2. ❌ Using questions as titles
3. ❌ Clickbait language ("You won't believe...")
4. ❌ Vague titles without specifics
5. ❌ Too long (over 10 words for Live, over 12 for Daily)
6. ❌ Too short (under 4 words for Live, under 8 for Daily)
7. ❌ Losing critical context when shortening
8. ❌ Incomplete thoughts or teasers

---

**Summary:**
- **Live News:** 4-10 words | `ai_filter.py` line 487
- **Daily Generator:** 8-12 words | `news-generator.py` line 728
- Both use Claude 3.5 Sonnet
- Both require clear, factual, non-clickbait titles
- Daily Generator explicitly forbids emojis in title field

