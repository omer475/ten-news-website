# NEW PERPLEXITY SYSTEM - RAW FACTS SEARCH

## ✅ IMPLEMENTED - Phase 1: Perplexity Raw Facts Search

### What Changed

The live news system has been updated to use a new two-phase approach:

**Phase 1 (✅ Complete): Perplexity searches for RAW facts**
**Phase 2 (⏳ Pending): Claude formats the raw facts**

---

## Implementation Details

### File Modified: `ai_filter.py`

#### 1. New Function: `_search_perplexity_raw_facts()`

**Location:** Lines 586-675

**Purpose:** Searches Perplexity for comprehensive, unformatted factual information

**API Configuration:**
- **Model:** `llama-3.1-sonar-large-128k-online`
- **Temperature:** `0.2` (for factual accuracy)
- **Max Tokens:** `2000` (comprehensive results)
- **Return Citations:** `True` (source verification)
- **Search Recency Filter:** `month` (balance of recent and historical data)

**What It Searches For:**
1. **Timeline Events:** 2-4 major events in chronological order with exact dates
2. **Key Data Points:** 3 pieces of contextual data (statistics, numbers, percentages)
3. **Additional Context:** Geographic locations, entities, organizations, impact scale

**Returns:**
```python
{
    'results': '... comprehensive raw text ...',
    'citations': ['url1', 'url2', ...]
}
```

#### 2. Updated Processing Flow

**Location:** Lines 241-264

**New Flow:**
1. Generate title and summary with Claude ✅
2. Search Perplexity for raw facts ✅ (NEW)
3. Pass raw facts to Claude for formatting ⏳ (PENDING - Phase 2)
4. Publish article

#### 3. Placeholder Functions

**`_generate_timeline()`** - Lines 677-683
- Returns empty array for now
- Will be replaced by Claude formatting in Phase 2

**`_generate_details()`** - Lines 685-690
- Returns None for now
- Will be replaced by Claude formatting in Phase 2

#### 4. Removed Old System

**Deleted:**
- `_generate_timeline_claude()` - Old fallback method
- `_generate_details_claude()` - Old fallback method
- Direct Perplexity timeline generation
- Direct Perplexity details generation

---

## Advantages of New System

### 1. Single Perplexity Call
- **Before:** 2 separate API calls (timeline + details)
- **After:** 1 comprehensive search
- **Benefit:** Faster, cheaper, more context for Claude

### 2. Raw Facts Approach
- **Before:** Perplexity tried to format data into specific structures
- **After:** Perplexity just searches and returns everything
- **Benefit:** More reliable, no format constraints on Perplexity

### 3. Better Context for Claude
- **Before:** Claude had to format blind (no web search)
- **After:** Claude will receive comprehensive web-searched facts
- **Benefit:** More accurate, better formatted output

### 4. Cost Efficiency
- **Perplexity:** 1 search instead of 2 (~50% cost reduction)
- **Claude:** Will handle formatting (cheaper than multiple Perplexity calls)

---

## System Prompt (Perplexity)

```
You are a news research assistant that searches the web for verified information. 
Return comprehensive factual data without formatting or styling. 
Focus on accuracy and recency.
```

**User Prompt Template:**
```
Search the web and gather comprehensive factual information about this news story.

Article Title: {title}
Article Description: {description}

SEARCH TASKS:

1. TIMELINE EVENTS:
- Find 2-4 major events related to this story in chronological order
- Include past events that led to this story
- If the story is developing, find any important upcoming/planned events
- For each event, provide: exact date/time and what happened
- For very recent events on the same day, include the specific time with timezone
- Prioritize verified information from reliable sources

2. KEY DATA POINTS:
- Find 3 pieces of key data that provide context
- Prioritize: statistics, numbers, percentages, amounts, timeframes, scale indicators
- Examples: market values, affected populations, rates, percentages, rankings, comparisons
- If hard numbers unavailable, include contextual data like impacts, estimates, historical comparisons
- Must be recent and relevant data
- Must NOT repeat information from the article title or description

3. ADDITIONAL CONTEXT:
- Geographic locations involved (cities, regions, countries)
- Key entities, organizations, or people involved
- Impact scale and affected parties
- Any official statements or sources

Return ALL raw facts found. Do NOT format into specific structures. 
Provide comprehensive information that will be formatted later.
```

---

## Next Steps - Phase 2: Claude Formatting

**Awaiting user instructions for Claude formatting implementation**

When Phase 2 is implemented, Claude will:
1. Receive raw facts from Perplexity
2. Format title (≤12 words)
3. Format summary (35-42 words with **bold** markup)
4. Format timeline (2-4 events, ≤14 words each)
5. Format details (exactly 3, ≤8 words each)

---

## Testing

To test the new system:

```bash
cd "/Users/omersogancioglu/Ten news website "
export PERPLEXITY_API_KEY='your-key'
export CLAUDE_API_KEY='your-key'
export GOOGLE_API_KEY='your-key'
python3 ai_filter.py
```

Watch for:
- `🔍 Searching web for raw facts...` (new Perplexity search)
- `✅ Raw facts retrieved (X chars, Y citations)` (success)

---

## Compatibility

✅ Backward compatible with existing database schema
✅ No changes to frontend required
✅ Maintains existing scoring system
✅ Works with existing publish workflow

---

## Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Perplexity Raw Search | ✅ Complete | Using new prompt and API config |
| Title Generation (Claude) | ✅ Working | No changes |
| Summary Generation (Claude) | ✅ Working | No changes |
| Timeline Formatting (Claude) | ⏳ Pending | Awaiting Phase 2 instructions |
| Details Formatting (Claude) | ⏳ Pending | Awaiting Phase 2 instructions |
| Article Scoring (Gemini) | ✅ Working | No changes |
| Database Publishing | ✅ Working | No changes |

---

## Ready for Phase 2

The system is now ready to receive the Claude formatting instructions. 

Send the Claude prompt specifications to complete the implementation.

