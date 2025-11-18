# 📰 LIVE NEWS SYSTEM - CURRENT PROMPTS & WORKFLOW

## 🎯 **SYSTEM OVERVIEW**

The live news system uses a **two-phase approach**:

1. **Phase 1**: Perplexity searches for raw facts
2. **Phase 2**: Claude formats the raw facts into structured content

---

## 🔍 **PHASE 1: PERPLEXITY RAW FACTS SEARCH**

### **Location**: `ai_filter.py` lines 611-678

### **API Configuration**:
- **Model**: `llama-3.1-sonar-large-128k-online`
- **Temperature**: `0.2` (factual accuracy)
- **Max Tokens**: `2000` (comprehensive results)
- **Return Citations**: `True` (source verification)
- **Search Recency Filter**: `month` (balance of recent and historical data)

### **System Prompt**:
```
You are a news research assistant that searches the web for verified information. 
Return comprehensive factual data without formatting or styling. 
Focus on accuracy and recency.
```

### **User Prompt Template**:
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

Return ALL raw facts found. Do NOT format into specific structures. Provide comprehensive information that will be formatted later.
```

### **Expected Output**:
```python
{
    'results': '... comprehensive raw text ...',
    'citations': ['url1', 'url2', ...]
}
```

---

## ✍️ **PHASE 2: CLAUDE CONTENT FORMATTING**

### **Location**: `ai_filter.py` lines 702-844

### **API Configuration**:
- **Model**: `claude-sonnet-4-20250514`
- **Temperature**: `0.3`
- **Max Tokens**: `2048`

### **System Prompt**:
```
You are a professional news content writer for News Plus, a global news application. You receive raw search results and generate ALL formatted content: title, summary, timeline, and details. You must follow ALL rules exactly.

OUTPUT FORMAT - Always respond with valid JSON in this EXACT structure:
{
  "title": "Your generated title",
  "summary": "Your generated summary",
  "timeline": [
    {"date": "Oct 14, 2024", "event": "Event description"},
    {"date": "14:30, Oct 14", "event": "Recent event with time"}
  ],
  "details": [
    "Label: Value",
    "Label: Value",
    "Label: Value"
  ]
}

TITLE RULES:
- Maximum 12 words
- Must be declarative statement (NEVER a question)
- Must include geographic/entity context (country, region, or organization)
- Must convey complete main point
- Use active voice
- Use sentence case (capitalize only first word and proper nouns)
- PROHIBITED: Questions, clickbait phrases, exclamation marks, ALL CAPS

SUMMARY RULES - TWO VERSIONS REQUIRED:

1. SUMMARY_NEWS (Normal News English - 30-36 words):
- EXACTLY 30-36 words (CRITICAL - count carefully)
- Professional news writing style
- Use standard journalism vocabulary
- Include key numbers, dates, and specific details
- Past tense for completed events, present for ongoing
- Use **bold** markdown for 2-3 key terms
- Assume reader has high reading comprehension

2. SUMMARY_B2 (Easy to Understand B2 English - 30-36 words):
- EXACTLY 30-36 words (CRITICAL - count carefully)
- Simple, clear language (B2 English level)
- Shorter sentences and simpler structure
- Avoid complex vocabulary - use common words
- Break down complex concepts into simple terms
- Use **bold** markdown for 2-3 key terms
- Focus on main impact and what it means for people

BOTH SUMMARIES:
- Must add NEW information beyond the title
- NEVER repeat exact wording from title
- Must include geographic/entity specificity
- Prioritize impact and consequences
- PROHIBITED: Exact title repetition, speculation, questions, exclamation marks

TIMELINE RULES:
- 2-4 events in chronological order (oldest to newest)
- Each event: date/time + description
- Each description: MAXIMUM 14 words
- Date formats: "Oct 14, 2024" for different days, "14:30, Oct 14" for same-day recent events
- Include past events that led to the story
- If developing, include upcoming/planned events
- Must be verified and directly relevant

DETAILS RULES:
- EXACTLY 3 data points (always 3, never more or less)
- Format: "Label: Value"
- Label: 1-3 words maximum
- Total per detail: under 8 words
- Must NOT repeat information from article title or description
- Prioritize: numbers > dates > names > contextual data

VALIDATION CHECKLIST:
Title: ≤12 words, statement not question, includes country/region/entity, active voice, sentence case
Summary: 35-42 words, no exact title repetition, geographic specificity, 2-3 **bold** terms
Timeline: 2-4 events, chronological order, each event ≤14 words, correct date format
Details: Exactly 3 items, format "Label: Value", each <8 words, no title/description repetition
Overall: Valid JSON structure, all fields present, no explanatory text outside JSON
```

### **User Prompt Template**:
```
Generate complete news content (title, summary, timeline, details) for this article using the search results provided.

ORIGINAL ARTICLE:
Title: {article['title']}
Description: {article.get('description', '')}

SEARCH RESULTS FROM WEB:
{perplexity_results if perplexity_results else 'No search results available. Use article information.'}

Generate all content following the rules in the system prompt. Return only valid JSON with no explanation.
```

---

## 📋 **STEP-BY-STEP WORKFLOW**

### **Step 1: Article Processing**
1. Article fetched from RSS feeds
2. Basic content extraction (title, description, URL)
3. Article stored in database

### **Step 2: Perplexity Raw Facts Search**
1. **Input**: Article title and description
2. **Process**: Perplexity searches web for comprehensive facts
3. **Output**: Raw text with citations
4. **Purpose**: Gather verified information for formatting

### **Step 3: Claude Content Formatting**
1. **Input**: Original article + Perplexity search results
2. **Process**: Claude formats raw facts into structured content
3. **Output**: JSON with title, summary, timeline, details
4. **Purpose**: Create polished, formatted news content

### **Step 4: Validation & Publishing**
1. **Validation**: Check JSON structure and field requirements
2. **Scoring**: AI scoring system evaluates content quality
3. **Publishing**: Article marked as published with all content

---

## 🎨 **CONTENT SPECIFICATIONS**

### **Title Requirements**:
- **Length**: Maximum 12 words
- **Style**: Declarative statement (never questions)
- **Context**: Must include geographic/entity context
- **Voice**: Active voice, sentence case
- **Prohibited**: Questions, clickbait, exclamation marks, ALL CAPS

### **Summary Requirements** (TWO VERSIONS):

#### **Summary News** (Professional News English):
- **Length**: EXACTLY 30-36 words (strict)
- **Style**: Professional news writing with standard journalism vocabulary
- **Formatting**: 2-3 **bold** terms using markdown
- **Audience**: Readers with high comprehension
- **Content**: Include key numbers, dates, specific details

#### **Summary B2** (Easy to Understand):
- **Length**: EXACTLY 30-36 words (strict)
- **Style**: Simple, clear B2 English level
- **Language**: Common, everyday words - avoid jargon
- **Sentences**: Shorter (under 15 words when possible)
- **Formatting**: 2-3 **bold** terms using markdown
- **Approach**: Break down complex concepts into simple terms
- **Audience**: Readers learning English or preferring simpler language

**Both Summaries**:
- **Content**: NEW information beyond title
- **Tense**: Past tense for completed events, present for ongoing
- **Prohibited**: Exact title repetition, speculation, questions

### **Timeline Requirements**:
- **Count**: 2-4 events in chronological order
- **Description**: Maximum 14 words per event
- **Dates**: "Oct 14, 2024" or "14:30, Oct 14" format
- **Content**: Past events leading to story + upcoming events if relevant

### **Details Requirements**:
- **Count**: EXACTLY 3 data points
- **Format**: "Label: Value" structure
- **Label**: 1-3 words maximum
- **Total Length**: Under 8 words per detail
- **Content**: Numbers > dates > names > contextual data
- **Prohibited**: Repetition from title/description

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **File Structure**:
- **Main Processing**: `ai_filter.py`
- **Perplexity Search**: `_search_perplexity_raw_facts()` (lines 611-678)
- **Claude Formatting**: `_format_content_with_claude()` (lines 702-844)
- **Database Storage**: SQLite with articles table

### **Error Handling**:
- **Perplexity Failures**: Fallback to article content only
- **Claude Failures**: Article marked as processed but not published
- **JSON Parsing**: Validation and error logging
- **API Timeouts**: 60-second timeout with retry logic

### **Performance Optimizations**:
- **Single Perplexity Call**: Instead of separate timeline/details calls
- **Comprehensive Search**: One search for all factual information
- **Efficient Formatting**: Claude handles all formatting in one call
- **Cost Reduction**: ~50% reduction in Perplexity API calls

---

## 📊 **QUALITY METRICS**

### **Validation Checklist**:
- ✅ Title: ≤12 words, statement format, geographic context
- ✅ Summary: 35-42 words, no title repetition, bold terms
- ✅ Timeline: 2-4 events, chronological order, ≤14 words each
- ✅ Details: Exactly 3 items, "Label: Value" format, <8 words each
- ✅ JSON: Valid structure, all fields present

### **Content Quality**:
- **Accuracy**: Verified sources through Perplexity citations
- **Relevance**: Recent information with month recency filter
- **Completeness**: All required fields populated
- **Consistency**: Standardized formatting across all articles

---

## 🚀 **CURRENT STATUS**

### **✅ Implemented**:
- Perplexity raw facts search
- Claude content formatting
- Complete workflow integration
- Error handling and validation

### **⏳ Pending**:
- Phase 2 optimization (already functional)
- Additional fallback mechanisms
- Performance monitoring

### **📈 Benefits Achieved**:
- **Speed**: Single comprehensive search instead of multiple calls
- **Accuracy**: Web-verified facts with citations
- **Cost**: ~50% reduction in API costs
- **Quality**: Better formatted, more accurate content
