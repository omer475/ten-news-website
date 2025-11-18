# 📝 Quick Summary Writing Rules - Updated

## ✨ **What's New**

Your AI now generates **TWO summaries** instead of one:

### 1️⃣ **Summary News** (Professional)
- **30-36 words** exactly
- Professional news English
- For readers with high comprehension

### 2️⃣ **Summary B2** (Easy to Understand)
- **30-36 words** exactly
- Simple B2 English level
- For English learners or simpler reading

---

## 📊 **Side-by-Side Comparison**

| Aspect | Summary News | Summary B2 |
|--------|--------------|------------|
| **Words** | 30-36 (strict) | 30-36 (strict) |
| **Vocabulary** | Professional journalism | Common everyday words |
| **Sentences** | Standard length | Shorter (under 15 words) |
| **Audience** | High comprehension | English learners |
| **Style** | Formal news writing | Simple and clear |

---

## 💡 **Example**

### Same News Story, Two Versions:

**Summary News** (34 words):
> The **European Central Bank** raised interest rates to **4.5 percent** on Thursday, the tenth consecutive increase since July 2023. The decision affects **340 million** eurozone residents as inflation remains at 5.3 percent.

**Summary B2** (33 words):
> The **European Central Bank** made borrowing money more expensive again. This is the **tenth time** they raised rates since July 2023. The change affects **340 million people** in countries using the euro.

**Notice the differences:**
- News: "raised interest rates" → B2: "made borrowing money more expensive"
- News: "tenth consecutive increase" → B2: "tenth time they raised rates"
- News: "eurozone residents" → B2: "people in countries using the euro"

---

## 🎯 **B2 Writing Tips**

### ✅ **DO USE**:
- "raise rates" ✓
- "prices going up" ✓
- "borrow money" ✓
- "cost more" ✓
- "people affected" ✓

### ❌ **DON'T USE**:
- "monetary tightening" ✗
- "inflation pressures" ✗
- "credit markets" ✗
- "increased expenditure" ✗
- "impacted demographics" ✗

---

## 📋 **Rules for BOTH Summaries**

1. **EXACTLY 30-36 words** (count carefully!)
2. **2-3 bold terms** using **markdown**
3. **NEW information** beyond the title
4. **NO title repetition** (exact wording)
5. **Geographic specificity** (name countries/entities)
6. **Active voice**
7. **Correct tense** (past for completed, present for ongoing)

---

## 🔧 **Technical Details**

**JSON Output Format:**
```json
{
  "title": "Article title (max 12 words)",
  "summary": "Long detailed summary (max 200 words)",
  "summary_news": "Professional 30-36 words",
  "summary_b2": "Simple B2 30-36 words",
  "summary_bullets": ["bullet 1", "bullet 2", "bullet 3"]
}
```

**Updated Files:**
- ✅ `step1_claude_title_summary.py` - Main implementation
- ✅ `AI_GENERATION_RULES.md` - Complete documentation
- ✅ `LIVE_NEWS_CURRENT_PROMPTS.md` - Current prompts
- ✅ `STEP_1_CLAUDE_TITLE_SUMMARY.md` - Step 1 docs

---

## 🚀 **Ready to Use!**

The system is now configured to automatically generate both summary versions. Every article will have:
- Professional news English for experienced readers
- Simple B2 English for broader accessibility

**No additional action needed** - the AI handles both versions automatically!

