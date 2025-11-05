# 🤖 GOOGLE GEMINI API - ARTICLE SCORING INPUT DATA

## 📊 **INFORMATION SENT TO GEMINI API**

The Google Gemini API receives **minimal but strategic information** for scoring articles. The system uses different approaches across different parts of the system.

---

## 🎯 **LIVE NEWS SYSTEM (ai_filter.py)**

### **Model Used**: `gemini-2.5-flash`
### **Input Data**: **ONLY 2 FIELDS**

```python
# Data sent to Gemini API
Title: {article['title']}
Source: {article['source']}
```

### **Example Input**:
```
Title: "Scientists discover breakthrough in nuclear fusion energy"
Source: "BBC News"
```

### **Key Characteristics**:
- **Minimal Data**: Only title and source name
- **No Description**: Description is NOT sent to Gemini
- **No Full Text**: Article content is NOT sent
- **Truncated Title**: Title is limited to prevent token overflow
- **Source Only**: Just the source name, not full source object

---

## 🌍 **UNIFIED SCORING SYSTEM (unified_news_scoring.py)**

### **Model Used**: `gemini-2.0-flash-exp`
### **Input Data**: **ONLY 2 FIELDS**

```python
# Data preparation
articles_info.append({
    'id': i,
    'title': article.get('title', '')[:200],  # Truncated to 200 chars
    'source': article.get('source', {}).get('name', ''),  # Only source name
})
```

### **Example Input**:
```json
{
  "id": 1,
  "title": "Major earthquake hits Tokyo, thousands evacuated",
  "source": "Reuters"
}
```

### **Key Characteristics**:
- **Title Truncated**: Limited to 200 characters
- **Source Name Only**: Extracts just the name from source object
- **No Description**: Description field is NOT included
- **No Content**: Full text is NOT sent
- **Batch Processing**: Up to 30 articles processed together

---

## 📰 **PART 1 BREAKING NEWS (news-part1-breaking.py)**

### **Model Used**: `gemini-2.5-flash`
### **Input Data**: **4 FIELDS**

```python
# Data preparation
articles_info.append({
    'id': i,
    'title': article.get('title', '')[:150],  # Truncated to 150 chars
    'description': article.get('description', '')[:300],  # Truncated to 300 chars
    'full_text_preview': article.get('full_text', '')[:500] if article.get('full_text') else '',  # Truncated to 500 chars
    'source': article.get('source', {}).get('name', '')  # Only source name
})
```

### **Example Input**:
```json
{
  "id": 1,
  "title": "Breaking: Major earthquake hits Tokyo",
  "description": "A powerful 7.2 magnitude earthquake struck Tokyo early this morning, causing widespread damage and forcing thousands to evacuate.",
  "full_text_preview": "TOKYO - A powerful earthquake measuring 7.2 on the Richter scale struck the Tokyo metropolitan area at 6:30 AM local time, causing significant damage to buildings and infrastructure. The Japan Meteorological Agency issued tsunami warnings for coastal areas...",
  "source": "BBC News"
}
```

### **Key Characteristics**:
- **Title**: Limited to 150 characters
- **Description**: Limited to 300 characters
- **Full Text Preview**: Limited to 500 characters
- **Source Name**: Only the source name
- **Batch Processing**: Up to 50 articles processed together

---

## 🌐 **PART 2 GLOBAL NEWS (news-part2-global.py)**

### **Model Used**: `gemini-2.5-flash`
### **Input Data**: **4 FIELDS**

```python
# Data preparation
articles_info.append({
    'id': i,
    'title': article.get('title', '')[:150],  # Truncated to 150 chars
    'description': article.get('description', '')[:300],  # Truncated to 300 chars
    'full_text_preview': article.get('full_text', '')[:500] if article.get('full_text') else '',  # Truncated to 500 chars
    'source': article.get('source', {}).get('name', '')  # Only source name
})
```

### **Example Input**:
```json
{
  "id": 1,
  "title": "Scientists achieve nuclear fusion breakthrough",
  "description": "Researchers at MIT have successfully achieved net energy gain in nuclear fusion reaction, marking a historic milestone in clean energy development.",
  "full_text_preview": "CAMBRIDGE, Mass. - Scientists at the Massachusetts Institute of Technology have achieved a major breakthrough in nuclear fusion technology, producing more energy than consumed in the reaction for the first time in history. The experiment, conducted at the MIT Plasma Science and Fusion Center...",
  "source": "Nature"
}
```

### **Key Characteristics**:
- **Same Structure**: Identical to Part 1 Breaking News
- **Different Focus**: Global news vs breaking news criteria
- **Batch Processing**: Up to 50 articles processed together

---

## 📋 **COMPARISON SUMMARY**

| System | Model | Title | Description | Full Text | Source | Batch Size |
|--------|-------|-------|-------------|-----------|--------|------------|
| **Live News** | `gemini-2.5-flash` | ✅ (full) | ❌ | ❌ | ✅ (name only) | 1 |
| **Unified** | `gemini-2.0-flash-exp` | ✅ (200 chars) | ❌ | ❌ | ✅ (name only) | 30 |
| **Part 1 Breaking** | `gemini-2.5-flash` | ✅ (150 chars) | ✅ (300 chars) | ✅ (500 chars) | ✅ (name only) | 50 |
| **Part 2 Global** | `gemini-2.5-flash` | ✅ (150 chars) | ✅ (300 chars) | ✅ (500 chars) | ✅ (name only) | 50 |

---

## 🎯 **STRATEGIC REASONING**

### **Why Minimal Data for Live News**:
1. **Speed**: Faster processing with less data
2. **Cost**: Lower token usage = lower API costs
3. **Focus**: Forces AI to focus on title quality and source credibility
4. **Consistency**: Title + source is sufficient for must-know news evaluation

### **Why More Data for Parts 1 & 2**:
1. **Context**: Description provides additional context
2. **Accuracy**: Full text preview helps verify claims
3. **Quality**: Better scoring with more information
4. **Different Purpose**: These systems prioritize comprehensive evaluation

### **Why No Full Articles**:
1. **Token Limits**: Full articles would exceed API limits
2. **Cost**: Full articles would be extremely expensive
3. **Speed**: Processing time would increase significantly
4. **Focus**: Title + description is sufficient for news scoring

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Data Truncation Logic**:
```python
# Title truncation
'title': article.get('title', '')[:200]  # Live News: no limit, Unified: 200, Parts: 150

# Description truncation  
'description': article.get('description', '')[:300]  # Only Parts 1 & 2

# Full text truncation
'full_text_preview': article.get('full_text', '')[:500] if article.get('full_text') else ''  # Only Parts 1 & 2

# Source extraction
'source': article.get('source', {}).get('name', '')  # All systems
```

### **API Call Structure**:
```python
# Gemini API call
model = genai.GenerativeModel(self.gemini_model)
response = model.generate_content(prompt)
```

### **Prompt Template**:
```python
prompt = f"""Your Role
You are an AI news curator for a live news feed app...

Title: {article['title']}
Source: {article['source']}

[Scoring rules and criteria...]
"""
```

---

## 📊 **PERFORMANCE IMPACT**

### **Token Usage**:
- **Live News**: ~50-100 tokens per article
- **Unified**: ~100-200 tokens per article  
- **Parts 1 & 2**: ~200-400 tokens per article

### **Processing Speed**:
- **Live News**: Fastest (minimal data)
- **Unified**: Fast (batch processing)
- **Parts 1 & 2**: Slower (more data per article)

### **Cost Efficiency**:
- **Live News**: Most cost-effective
- **Unified**: Moderate cost
- **Parts 1 & 2**: Higher cost (more tokens)

---

## 🎯 **KEY TAKEAWAYS**

1. **Live News System**: Uses minimal data (title + source only) for fastest, most cost-effective scoring
2. **Unified System**: Uses title + source with batch processing for efficiency
3. **Parts 1 & 2**: Use more comprehensive data (title + description + preview) for better accuracy
4. **All Systems**: Extract only source name, not full source object
5. **All Systems**: Truncate data to prevent token overflow and control costs
6. **Strategic Design**: Different data amounts for different use cases and priorities

The system is designed to provide **just enough information** for accurate scoring while maintaining **speed, cost efficiency, and reliability**.
