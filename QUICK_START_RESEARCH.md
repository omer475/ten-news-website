# 🚀 Quick Start: Research Enhancer (5 Minutes)

Get started with Perplexity-powered research enhancement in 5 minutes!

---

## Step 1: Get Perplexity API Key (2 minutes)

1. **Go to:** https://www.perplexity.ai/settings/api
2. **Sign up** or log in
3. Click **"Generate API Key"**
4. **Copy your key** (starts with `pplx-...`)

**You get $20 free credit to start!** 🎉

---

## Step 2: Set Environment Variable (1 minute)

### **Mac/Linux:**
```bash
export PERPLEXITY_API_KEY="pplx-your-actual-key-here"
```

### **Make it permanent:**
```bash
echo 'export PERPLEXITY_API_KEY="pplx-your-actual-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### **Windows:**
```cmd
set PERPLEXITY_API_KEY=pplx-your-actual-key-here
```

### **Verify it's set:**
```bash
echo $PERPLEXITY_API_KEY
# Should show: pplx-...
```

---

## Step 3: Install Requirements (1 minute)

```bash
pip install -r requirements.txt
```

This installs the `openai` package (Perplexity uses OpenAI SDK).

---

## Step 4: Test It! (1 minute)

### **If you have a daily digest file:**
```bash
python news-research-enhancer.py tennews_data_2025_10_06.json
```

### **If you have a live news file:**
```bash
python news-research-enhancer.py livenews_data_2025_10_06_1430.json
```

### **Expected output:**
```
🚀 TEN NEWS - RESEARCH ENHANCER
================================================================
Input: tennews_data_2025_10_06.json
📂 Loaded: tennews_data_2025_10_06.json
📰 Found 10 articles to enhance

🔬 RESEARCH ENHANCEMENT SYSTEM
================================================================
Using Perplexity API (sonar)
Articles to enhance: 10
Delay between calls: 2 seconds
================================================================

🔍 Article 1/10: Researching 'Apple Announces iPhone 16...'
   📡 Received response from Perplexity
   ✅ Details: 3, Timeline: 3 events, Citations: 3 sources

🔍 Article 2/10: Researching 'Climate Summit Reaches...'
   📡 Received response from Perplexity
   ✅ Details: 3, Timeline: 4 events, Citations: 4 sources

[... continues for all articles ...]

================================================================
📊 RESEARCH SUMMARY:
   ✅ Successful: 10
   ⚠️ Insufficient sources: 0
   ❌ Failed: 0
   📚 Total enhanced: 10
================================================================

✅ SUCCESS! Saved enhanced news to: tennews_data_2025_10_06_enhanced.json

🎉 Enhancement complete!
📄 Enhanced file: tennews_data_2025_10_06_enhanced.json

✨ Articles now include:
   • Bold markup on key terms
   • 3 verified details with numbers/dates
   • Timeline with 2-4 events
   • Citations from reputable sources
```

---

## Step 5: Check the Result

```bash
# View the enhanced file
cat tennews_data_2025_10_06_enhanced.json

# Or open in your editor
code tennews_data_2025_10_06_enhanced.json
```

### **What Changed:**

**Before:**
```json
{
  "title": "Apple Announces iPhone 16",
  "summary": "Apple unveiled the iPhone 16 with AI features."
}
```

**After:**
```json
{
  "title": "Apple Announces iPhone 16",
  "summary": "**Apple** unveiled the **iPhone 16** with **AI features**.",
  "details": [
    "Launch date: September 12, 2025",
    "Battery life: 22 percent longer",
    "Markets: 28 countries initially"
  ],
  "timeline": [
    {"date": "2024-09-12", "event": "iPhone 15 released worldwide"},
    {"date": "2025-09-12", "event": "iPhone 16 announced at Apple event"},
    {"date": "2025-09-22", "event": "Pre-orders begin in key markets"}
  ],
  "citations": [
    {"url": "https://apple.com/newsroom/...", "publisher": "Apple"},
    {"url": "https://reuters.com/...", "publisher": "Reuters"}
  ]
}
```

**Notice:**
- ✅ Bold markup added (no words changed)
- ✅ 3 new facts with numbers/dates
- ✅ Timeline with specific dates
- ✅ Citations from reputable sources

---

## 🎯 Common Use Cases

### **Daily Workflow:**
```bash
# 1. Generate daily news
python news-generator.py

# 2. Enhance with research
python news-research-enhancer.py tennews_data_$(date +%Y_%m_%d).json

# 3. Use enhanced file for email/website
```

### **Enhance Old Files:**
```bash
# Enhance multiple files
for file in tennews_data_2025_10_*.json; do
    python news-research-enhancer.py "$file"
done
```

### **Custom Output Name:**
```bash
python news-research-enhancer.py input.json my_custom_output.json
```

---

## ⚠️ Quick Troubleshooting

### **"Perplexity API key not configured"**
```bash
# Did you export it?
echo $PERPLEXITY_API_KEY

# If empty, export again
export PERPLEXITY_API_KEY="pplx-..."
```

### **"No articles found in file"**
- Check file path is correct
- Verify file has `"articles": [...]` array
- Ensure file is valid JSON

### **"Failed to parse JSON response"**
- Usually temporary API issue
- Script continues with remaining articles
- Failed articles keep original content

### **"Insufficient sources found"**
- Story might be too new
- Limited information available
- Article marked as insufficient_sources
- Still usable, just no research added

---

## 💰 Cost Estimate

**Free trial:** $20 credit (covers ~100-200 enhancements)

**Pay-as-you-go:**
- 10 articles: ~$0.05-0.10
- 30 articles: ~$0.15-0.30
- Daily (10): ~$1.50-3/month
- Multiple times/day: Scale accordingly

**Start free, upgrade only if needed!**

---

## 📚 More Info

- **Complete Setup Guide:** `RESEARCH_ENHANCER_SETUP.md`
- **System Architecture:** `COMPLETE_SYSTEM_ARCHITECTURE.md`
- **Code Documentation:** See comments in `news-research-enhancer.py`

---

## ✅ Checklist

- [ ] Got Perplexity API key
- [ ] Set `PERPLEXITY_API_KEY` environment variable
- [ ] Ran `pip install -r requirements.txt`
- [ ] Tested with: `python news-research-enhancer.py <file>`
- [ ] Verified output has bold, details, timeline, citations
- [ ] Ready to use in production!

---

## 🎉 Done!

You now have:
- ✅ Research enhancement working
- ✅ Verified facts with citations
- ✅ Timelines with specific dates
- ✅ Professional bold formatting
- ✅ Ready for production

**Next:** Integrate enhanced articles into your website!

---

**Questions? Check `RESEARCH_ENHANCER_SETUP.md` for detailed docs!** 🚀

