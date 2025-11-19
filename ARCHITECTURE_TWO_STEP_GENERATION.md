# Two-Step Content Generation Architecture

## 📅 Date: November 19, 2024

## 🎯 **New Architecture: Step 5 + Step 6**

### **User Requirement:**
> "The article and bullet text must be written by the full article got from the scraping bee (Step 2). The details, timeline, and graph must be written by the perplexity search (Step 4). These should be separate steps."

---

## 🔄 **Complete Workflow**

```
Step 1: Gemini Scoring & Filtering
        ↓ (Approved articles)
        
Step 2: ScrapingBee Full Article Fetching
        ↓ (Scraped article text)
        
Step 3: Gemini Component Selection
        ↓ (Selected components: timeline, details, graph)
        
Step 4: Perplexity Context Search
        ↓ (Web search results for components)
        
Step 5: Dual-Language Content Generation
        ↓ (Uses SCRAPED ARTICLE TEXT from Step 2)
        Generates:
        - title_news (Advanced, ≤12 words)
        - title_b2 (B2 English, ≤12 words)
        - content_news (Advanced, 300-400 words)
        - content_b2 (B2 English, 300-400 words)
        - summary_bullets_news (4 bullets, 10-15 words each)
        - summary_bullets_b2 (4 bullets, 10-15 words each)
        
Step 6: Component Generation
        ↓ (Uses PERPLEXITY SEARCH CONTEXT from Step 4)
        Generates:
        - timeline (2-4 events) - if selected
        - details (exactly 3 data points) - if selected
        - graph (4+ data points) - if selected
        
Publish to Supabase
        ↓
        Live on tennews.ai
```

---

## 📝 **Step 5: Dual-Language Content Generation**

### **File:** `step5_claude_final_writing_formatting.py`

### **Purpose:**
Generate high-quality dual-language titles, articles, and bullets based on the **original scraped article text**.

### **Input:**
- Scraped article text from Step 2 (via `article['text']`)
- Original title and description

### **Output (6 fields):**
1. **`title_news`** - Advanced English (≤12 words, **bold** markup)
2. **`title_b2`** - B2 English (≤12 words, **bold** markup)
3. **`content_news`** - Advanced article (300-400 words, **bold** markup)
4. **`content_b2`** - B2 article (300-400 words, **bold** markup)
5. **`summary_bullets_news`** - Advanced bullets (4 bullets, 10-15 words each, **bold** markup)
6. **`summary_bullets_b2`** - B2 bullets (4 bullets, 10-15 words each, **bold** markup)

### **Why Separate from Components?**
- Main content should be **faithful to the original article**
- Requires close reading of the actual news text
- Should NOT add external information
- Focus on clarity and dual-language quality

### **Example:**
**Scraped Article:** "The European Central Bank raised interest rates to 4.5% today..."

**Step 5 Generates:**
- Advanced Title: "**European Central Bank** raises interest rates to **4.5 percent**"
- B2 Title: "**European Central Bank** increases **interest rates** to **4.5 percent**"
- Advanced Article: 350 words explaining the rate hike in professional journalism tone
- B2 Article: 350 words explaining the same information in simpler B2 English
- 4 Advanced bullets summarizing key points
- 4 B2 bullets with same information, simpler language

---

## 🎨 **Step 6: Component Generation**

### **File:** `step6_claude_component_generation.py` (NEW)

### **Purpose:**
Generate supplementary visual components based on **broader web context from Perplexity search**.

### **Input:**
- Articles from Step 5 (with dual-language content)
- Perplexity search context from Step 4 (via `article['context_data']`)
- Selected components from Step 3 (via `article['components']`)

### **Output (0-3 components):**
1. **`timeline`** - Chronological events (2-4 events) - Optional
2. **`details`** - Key data points (exactly 3) - Optional
3. **`graph`** - Visual data (4+ points) - Optional

### **Why Separate from Content?**
- Components need **broader context beyond the original article**
- Timeline requires historical events (not in original article)
- Details need comparative data (from web search)
- Graph requires time-series data (from web search)
- Should ADD value with external information

### **Example:**
**Perplexity Context:** "ECB began raising rates in July 2023. Previous rate was 4.25%. Inflation currently at 5.3%..."

**Step 6 Generates:**
```json
{
  "timeline": [
    {"date": "Jul 2023", "event": "ECB begins rate hike cycle with increase to 3.75 percent"},
    {"date": "Mar 2024", "event": "ECB holds rates steady for first time in eight months"}
  ],
  "details": [
    "Previous rate: 4.25%",
    "Inflation target: 2%",
    "Current inflation: 5.3%"
  ],
  "graph": {
    "type": "line",
    "title": "ECB Interest Rates 2020-2024",
    "data": [
      {"date": "2020-03", "value": 0.25},
      {"date": "2023-07", "value": 3.75},
      {"date": "2024-11", "value": 4.50}
    ],
    "y_label": "Interest Rate (%)",
    "x_label": "Date"
  }
}
```

---

## 🔑 **Key Differences**

| Aspect | Step 5 (Dual-Language Content) | Step 6 (Components) |
|--------|-------------------------------|---------------------|
| **Source** | Scraped article text (Step 2) | Perplexity search (Step 4) |
| **Purpose** | Faithful representation of article | Broader context & visualization |
| **Content Type** | Titles, articles, bullets | Timeline, details, graph |
| **Information** | From original article ONLY | From web search context |
| **Always Generated** | Yes (all articles) | No (only if selected by Gemini) |
| **API Calls** | 1 per article | 1 per article (if components selected) |
| **Max Tokens** | 4096 | 1536 |
| **Cost per 100** | ~$1.20 | ~$0.60 |
| **Time per 100** | ~4-5 min | ~2-3 min |

---

## 💰 **Cost & Performance**

### **Old Architecture (Single Step):**
- 1 Claude call per article
- Generated everything at once
- $1.80 per 100 articles
- 5-7 minutes per 100 articles

### **New Architecture (Two Steps):**
- 2 Claude calls per article
- Step 5: Dual-language content
- Step 6: Components (optional)
- $1.80 per 100 articles (same total cost)
- 6-8 minutes per 100 articles
- **Better quality** (specialized prompts)

---

## 📊 **Data Flow**

### **Step 5 Input:**
```python
{
  "title": "European Central Bank raises interest rates",
  "text": "The European Central Bank announced Thursday... [1500 chars]",
  "description": "ECB increases rates to combat inflation"
}
```

### **Step 5 Output:**
```python
{
  "title_news": "**European Central Bank** raises interest rates to **4.5 percent**",
  "title_b2": "**European Central Bank** increases **interest rates** to **4.5 percent**",
  "content_news": "The European Central Bank... [350 words]",
  "content_b2": "The European Central Bank... [350 words in simpler English]",
  "summary_bullets_news": ["Advanced bullet 1", "Advanced bullet 2", ...],
  "summary_bullets_b2": ["B2 bullet 1", "B2 bullet 2", ...]
}
```

### **Step 6 Input:**
```python
{
  # From Step 5:
  "title_news": "**European Central Bank** raises interest rates to **4.5 percent**",
  "content_news": "...",
  # From Step 3:
  "components": ["timeline", "details"],
  # From Step 4:
  "context_data": {
    "timeline": "ECB began raising rates in July 2023...",
    "details": "Previous rate: 4.25%, Inflation: 5.3%..."
  }
}
```

### **Step 6 Output:**
```python
{
  # Preserves all Step 5 fields, adds:
  "timeline": [{"date": "Jul 2023", "event": "..."}],
  "details": ["Previous rate: 4.25%", "Inflation: 5.3%", "Target: 2%"]
}
```

---

## ✅ **Benefits of Two-Step Architecture**

1. **🎯 Accuracy**: Content based on actual article, not web search
2. **🌐 Context**: Components enriched with broader web context
3. **🔍 Clarity**: Specialized prompts for each task
4. **⚡ Flexibility**: Components are optional
5. **🧪 Testability**: Can test content and components separately
6. **🔧 Maintainability**: Easier to update prompts independently
7. **📈 Quality**: Each step optimized for its specific task

---

## 🧪 **Testing**

### **Test Step 5 Alone:**
```bash
cd "/Users/omersogancioglu/Ten news website "
python step5_claude_final_writing_formatting.py
```

### **Test Step 6 Alone:**
```bash
cd "/Users/omersogancioglu/Ten news website "
python step6_claude_component_generation.py
```

### **Test Full Pipeline:**
```bash
cd "/Users/omersogancioglu/Ten news website "
./RUN_LIVE_CONTINUOUS_SYSTEM.sh
```

---

## 📝 **Summary**

**Step 5:** Generate dual-language content (titles, articles, bullets) from **scraped article**
**Step 6:** Generate components (timeline, details, graph) from **web search context**

This separation ensures:
- ✅ Articles stay faithful to original source
- ✅ Components provide enriched context from web
- ✅ Clear separation of concerns
- ✅ Better quality for each type of content

