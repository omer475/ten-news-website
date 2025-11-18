# 📝 Summary Writing Rules Update - Changelog

**Date**: November 18, 2025  
**Update**: Changed summary requirements to generate TWO versions with different English levels

---

## 🎯 **WHAT CHANGED**

### **Previous System**:
- Generated ONE summary: 35-40 words (max 42)
- Single English level (professional news writing)

### **New System**:
- Generates TWO summaries: **30-36 words each** (strict)
- Two different English levels:
  1. **Summary News**: Professional news English
  2. **Summary B2**: Easy to understand B2 English

---

## 📊 **NEW SUMMARY SPECIFICATIONS**

### **1. Summary News (summary_news)**
- **Word Count**: EXACTLY 30-36 words (strict requirement)
- **English Level**: Professional news writing
- **Vocabulary**: Standard journalism vocabulary
- **Audience**: Readers with high reading comprehension
- **Format**: Include key numbers, dates, specific details
- **Styling**: 2-3 **bold** key terms using markdown
- **Tense**: Past tense for completed events, present for ongoing

**Example** (34 words):
```
The **European Central Bank** raised interest rates to **4.5 percent** on Thursday, the tenth consecutive increase since July 2023. The decision affects **340 million** eurozone residents as inflation remains at 5.3 percent.
```

### **2. Summary B2 (summary_b2)**
- **Word Count**: EXACTLY 30-36 words (strict requirement)
- **English Level**: B2 (Common European Framework)
- **Vocabulary**: Simple, common, everyday words
- **Sentences**: Shorter (under 15 words when possible)
- **Audience**: English learners or readers preferring simpler language
- **Approach**: Break down complex concepts into simple terms
- **Styling**: 2-3 **bold** key terms using markdown
- **Tense**: Simple present/past tense

**B2 Language Guidelines**:
- ✅ Use "raise rates" instead of "monetary tightening"
- ✅ Use "prices going up" instead of "inflation pressures"
- ✅ Use "borrow money" instead of "credit markets"
- ✅ Use "cost more" instead of "increased expenditure"

**Example** (33 words):
```
The **European Central Bank** made borrowing money more expensive again. This is the **tenth time** they raised rates since July 2023. The change affects **340 million people** in countries using the euro.
```

### **Both Summaries Share**:
- Must add NEW information beyond the title
- NEVER repeat exact wording from title
- Must include geographic/entity specificity
- Prioritize impact and consequences
- Use **bold** markdown for 2-3 key terms
- PROHIBITED: Title repetition, speculation, questions, exclamation marks

---

## 🔧 **TECHNICAL CHANGES**

### **Updated Files**:

#### 1. `step1_claude_title_summary.py`
- **System prompt**: Added rules for two summary versions
- **Output format**: Now returns 5 fields instead of 3:
  ```json
  {
    "title": "...",
    "summary": "... (long 200-word summary)",
    "summary_news": "... (30-36 words, professional)",
    "summary_b2": "... (30-36 words, B2 English)",
    "summary_bullets": ["...", "...", "..."]
  }
  ```
- **Validation function**: Updated to validate both new summary fields
- **Max tokens**: Increased from 512 to 800 to accommodate more content
- **User prompt**: Updated to request both summary versions

#### 2. `AI_GENERATION_RULES.md`
- Updated Section 2 with new summary specifications
- Added examples for both summary types
- Added B2 language guidelines

#### 3. `LIVE_NEWS_CURRENT_PROMPTS.md`
- Updated summary requirements section
- Added specifications for both summary versions
- Added B2 language examples

#### 4. `STEP_1_CLAUDE_TITLE_SUMMARY.md`
- Updated all summary rules sections
- Added two-version requirements
- Updated validation requirements

#### 5. `SUMMARY_UPDATE_CHANGELOG.md` (this file)
- New file documenting all changes

---

## 🎨 **API CONFIGURATION**

### **Claude API Settings**:
- **Model**: `claude-sonnet-4-20250514` (unchanged)
- **Temperature**: `0.5` (unchanged)
- **Max Tokens**: `800` (increased from 512)
- **System Prompt**: Updated with two-summary requirements

---

## ✅ **VALIDATION RULES**

### **Summary News Validation**:
- Word count MUST be 30-36 (inclusive)
- Must contain 2-3 **bold** terms
- No title repetition
- Professional vocabulary required

### **Summary B2 Validation**:
- Word count MUST be 30-36 (inclusive)
- Must contain 2-3 **bold** terms
- No title repetition
- Simple vocabulary required (B2 level)

### **Python Validation Function**:
```python
def validate_title_summary(response):
    # Checks for 5 required fields
    # Validates summary_news: 30-36 words
    # Validates summary_b2: 30-36 words
    # Checks title repetition in all summaries
    # Returns (is_valid, errors)
```

---

## 🚀 **IMPLEMENTATION STATUS**

### ✅ **Completed**:
- [x] Updated `step1_claude_title_summary.py` with new prompt
- [x] Updated validation function for two summaries
- [x] Increased max_tokens to 800
- [x] Updated `AI_GENERATION_RULES.md` documentation
- [x] Updated `LIVE_NEWS_CURRENT_PROMPTS.md` documentation
- [x] Updated `STEP_1_CLAUDE_TITLE_SUMMARY.md` documentation
- [x] Added B2 language guidelines
- [x] Added examples for both summary types

### ⏳ **Next Steps** (if needed):
- [ ] Update database schema to store both summary versions
- [ ] Update frontend to display both summary options
- [ ] Add user toggle to switch between summary versions
- [ ] Test with real articles to validate quality

---

## 📖 **USAGE EXAMPLES**

### **Calling the Function**:
```python
from step1_claude_title_summary import claude_write_title_summary

article = {
    "title": "ECB Raises Rates",
    "description": "The European Central Bank announced..."
}

result = claude_write_title_summary(article)

print("Title:", result['title'])
print("Long Summary:", result['summary'])
print("News English (30-36 words):", result['summary_news'])
print("B2 English (30-36 words):", result['summary_b2'])
print("Bullets:", result['summary_bullets'])
```

### **Expected Output**:
```python
{
    "title": "European Central Bank raises interest rates to 4.5 percent",
    "summary": "The European Central Bank announced a quarter-point interest rate increase to 4.5 percent on Thursday, marking the tenth consecutive rate hike since July 2023. The decision comes as inflation remains stubbornly high at 5.3 percent, well above the ECB's 2 percent target. The rate increase affects 340 million people across 19 eurozone countries...",
    "summary_news": "The **European Central Bank** raised interest rates to **4.5 percent** on Thursday, the tenth consecutive increase since July 2023. The decision affects **340 million** eurozone residents as inflation remains at 5.3 percent.",
    "summary_b2": "The **European Central Bank** made borrowing money more expensive again. This is the **tenth time** they raised rates since July 2023. The change affects **340 million people** in countries using the euro.",
    "summary_bullets": [
        "European Central Bank raises interest rates to 4.5 percent, tenth consecutive hike",
        "Inflation remains at 5.3 percent, well above ECB's 2 percent target",
        "340 million eurozone residents face higher borrowing costs for mortgages"
    ]
}
```

---

## 🎯 **KEY BENEFITS**

1. **Accessibility**: Readers can choose their preferred comprehension level
2. **Global Reach**: B2 English makes news accessible to non-native speakers
3. **User Experience**: Better serves diverse audience needs
4. **Consistency**: Strict 30-36 word count ensures uniform formatting
5. **Clarity**: Simpler B2 version improves understanding for all readers

---

## 📚 **REFERENCE**

### **B2 English Level Definition**:
B2 is the Common European Framework level where users can:
- Understand main ideas of complex text
- Interact with a degree of fluency
- Produce clear, detailed text on wide range of subjects
- Explain viewpoints with advantages/disadvantages

### **Writing for B2**:
- Use common vocabulary (3000-4000 most frequent words)
- Keep sentences short and simple
- Avoid idioms and complex grammar
- Use active voice
- Break down technical terms
- Focus on clarity over sophistication

---

**Questions?** Review the updated documentation files or check the implementation in `step1_claude_title_summary.py`

