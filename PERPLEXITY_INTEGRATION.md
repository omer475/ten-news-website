# 🌐 Perplexity API Integration - Internet-Powered Research

## 🎯 **Why This Change Matters**

Previously, we were using **Claude AI for everything**, including timeline and details generation. However:

- ❌ **Claude doesn't have internet access** - it can only work with the article text provided
- ❌ **No fact-checking** - couldn't verify dates, numbers, or events
- ❌ **Limited context** - couldn't search for background information
- ❌ **No citations** - couldn't reference external sources

Now with **Perplexity API**, timeline and details generation include:

- ✅ **Real-time internet search** from reliable sources
- ✅ **Fact verification** with current, accurate data
- ✅ **Historical context** from multiple sources
- ✅ **Citations** and references to original sources

---

## 📊 **AI Task Distribution**

| Task | AI Model | Reason |
|------|----------|--------|
| **Article Scoring** | Gemini 2.0 Flash | Fast, cost-effective for high-volume scoring |
| **Article Categorization** | Gemini 2.0 Flash | Excellent at classification tasks |
| **Emoji Selection** | Gemini 2.0 Flash | Creative, understands context |
| **Summary Generation** | Claude 3.5 Sonnet | Best at writing concise, engaging summaries |
| **Title Optimization** | Claude 3.5 Sonnet | Expert at wordsmithing and brevity |
| **Timeline Generation** | **Perplexity Sonar** | **Internet search for accurate dates/facts** |
| **Details Section** | **Perplexity Sonar** | **Internet search for comprehensive analysis** |

---

## 🔧 **What Changed**

### 1. **ai_filter.py** - API Configuration

**Before:**
```python
# Only Claude and Gemini
self.claude_api_key = os.getenv('CLAUDE_API_KEY')
self.google_api_key = os.getenv('GOOGLE_API_KEY')
```

**After:**
```python
# Claude + Gemini + Perplexity
self.claude_api_key = os.getenv('CLAUDE_API_KEY')
self.google_api_key = os.getenv('GOOGLE_API_KEY')
self.perplexity_api_key = os.getenv('PERPLEXITY_API_KEY')

# Configure Perplexity (uses OpenAI SDK)
if self.perplexity_api_key:
    from openai import OpenAI
    self.perplexity_client = OpenAI(
        api_key=self.perplexity_api_key,
        base_url="https://api.perplexity.ai"
    )
```

### 2. **_generate_timeline()** - Now Uses Internet Search

**Before:**
```python
# Claude without internet - just article text
response = requests.post("https://api.anthropic.com/v1/messages", ...)
```

**After:**
```python
# Perplexity with internet search
response = self.perplexity_client.chat.completions.create(
    model="sonar",
    messages=[{
        "role": "system",
        "content": "You are a factual news researcher with internet access. Search for accurate information..."
    }],
    temperature=0.2  # Lower for factual accuracy
)
```

### 3. **_generate_details()** - Now Uses Internet Search

**Before:**
```python
# Claude without internet - just article text
data = {
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": prompt}]
}
```

**After:**
```python
# Perplexity with internet search
response = self.perplexity_client.chat.completions.create(
    model="sonar",
    messages=[{
        "role": "system",
        "content": "You are an expert news analyst with internet access. Search for comprehensive, cited information..."
    }],
    max_tokens=1200,
    temperature=0.3
)
```

### 4. **test_system.py** - Added Perplexity Check

```python
required = [
    'CLAUDE_API_KEY',
    'GOOGLE_API_KEY',
    'PERPLEXITY_API_KEY'  # Now required!
]
```

---

## 🚀 **How to Run the System Now**

### **Step 1: Get Perplexity API Key**

1. Go to https://www.perplexity.ai/settings/api
2. Create an API key
3. Copy it

### **Step 2: Set All Three API Keys**

```bash
cd "/Users/omersogancioglu/Ten news website "

# Set all three API keys
export CLAUDE_API_KEY='your-claude-key-here'
export GOOGLE_API_KEY='your-google-key-here'
export PERPLEXITY_API_KEY='your-perplexity-key-here'
```

### **Step 3: Verify Setup**

```bash
python3 test_system.py
```

You should see:
```
✅ CLAUDE_API_KEY is set (sk-ant-api03-...)
✅ GOOGLE_API_KEY is set (AIzaSy...)
✅ PERPLEXITY_API_KEY is set (pplx-...)
```

### **Step 4: Run the System**

```bash
python3 main.py
```

---

## 📋 **Complete Testing Command (ALL-IN-ONE)**

```bash
cd "/Users/omersogancioglu/Ten news website " && \
export CLAUDE_API_KEY='PUT-YOUR-CLAUDE-KEY-HERE' && \
export GOOGLE_API_KEY='PUT-YOUR-GOOGLE-KEY-HERE' && \
export PERPLEXITY_API_KEY='PUT-YOUR-PERPLEXITY-KEY-HERE' && \
echo "✅ All API keys set" && \
echo "🧪 Testing system..." && \
python3 test_system.py && \
echo "" && \
echo "🚀 Starting Ten News Live System..." && \
python3 main.py
```

**⚠️ Replace the placeholder keys with your actual API keys!**

---

## 💰 **Cost Implications**

### **Perplexity API Pricing:**
- **Sonar model**: ~$1 per 1M tokens (input) + $1 per 1M tokens (output)
- **Per article**: ~800 tokens for timeline + ~1200 tokens for details = ~2000 tokens
- **Cost per article**: ~$0.002 (0.2 cents)

### **Expected Monthly Cost (100 articles/day):**
- Perplexity: ~$6/month
- Claude (summary + title): ~$3/month
- Gemini (scoring): ~$0.50/month
- **Total**: ~$10/month

---

## 📊 **What You'll See in Logs**

### **With Perplexity:**
```
📊 Science: Quantum computing breakthrough... → Score: 82.1
   ✅ Published (score: 82.1)
   📝 Generated 37-word summary (Claude)
   📰 Optimized title to 6 words (Claude)
   📅 Generated timeline with 3 events (Perplexity + Web Search) ← NEW!
   📄 Generated details section (1,234 chars, Perplexity + Web Search) ← NEW!
```

### **Without Perplexity (if key not set):**
```
📊 Science: Quantum computing breakthrough... → Score: 82.1
   ✅ Published (score: 82.1)
   📝 Generated 37-word summary (Claude)
   📰 Optimized title to 6 words (Claude)
   ⚠️ Perplexity API not configured - skipping timeline
   ⚠️ Perplexity API not configured - skipping details
```

---

## ✅ **Benefits of This Change**

1. **Accurate Dates**: Perplexity searches for exact dates and events
2. **Verified Facts**: Cross-references multiple sources
3. **Rich Context**: Includes background information not in the original article
4. **Citations**: Can reference where information came from
5. **Current Data**: Always has access to latest information
6. **Better Quality**: Details section is more comprehensive and accurate

---

## 🎯 **Example Output Comparison**

### **Before (Claude without internet):**
```json
{
  "timeline": [
    {"date": "2024", "event": "Research was conducted"},
    {"date": "Recently", "event": "Paper was published"}
  ]
}
```
*Vague dates, limited context*

### **After (Perplexity with internet search):**
```json
{
  "timeline": [
    {"date": "March 15, 2024", "event": "**MIT researchers** announced initial quantum breakthrough"},
    {"date": "April 2, 2024", "event": "Study published in **Nature Physics** journal"},
    {"date": "May 10, 2024", "event": "**IBM** announced commercial applications"}
  ]
}
```
*Specific dates, proper citations, rich context*

---

## 🔗 **Resources**

- **Perplexity API Docs**: https://docs.perplexity.ai/
- **Perplexity Dashboard**: https://www.perplexity.ai/settings/api
- **OpenAI SDK** (used by Perplexity): https://github.com/openai/openai-python

---

## ✅ **Summary**

| Component | Status |
|-----------|--------|
| Perplexity API Integration | ✅ Complete |
| Timeline Generation (Internet Search) | ✅ Complete |
| Details Generation (Internet Search) | ✅ Complete |
| API Key Configuration | ✅ Complete |
| Test System Updated | ✅ Complete |
| Documentation | ✅ Complete |

**Next Step**: Set your `PERPLEXITY_API_KEY` and test the system! 🚀

