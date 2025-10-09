# 🚀 START HERE - Complete Setup in 10 Minutes

You have all three API keys! Let's get everything working.

---

## ⚡ Quick Setup (Follow These Steps)

### **Step 1: Install Dependencies** (2 minutes)

```bash
cd "/Users/omersogancioglu/Ten news website "
pip install -r requirements.txt
```

**This installs:**
- `google-generativeai` (Gemini)
- `openai` (Perplexity)
- `newsapi-python` (NewsAPI)
- All existing packages

---

### **Step 2: Set Your API Keys** (3 minutes)

**Copy this block and replace with YOUR actual keys:**

```bash
# Claude API Key (you already have this)
export CLAUDE_API_KEY="sk-ant-your-actual-claude-key-here"

# Google Gemini API Key (NEW)
export GOOGLE_API_KEY="your-actual-gemini-key-here"

# Perplexity API Key (NEW)
export PERPLEXITY_API_KEY="pplx-your-actual-perplexity-key-here"

# NewsAPI Key (optional - for later)
export NEWSAPI_KEY="your-actual-newsapi-key-here"
```

**Paste into your terminal and press Enter.**

---

### **Step 3: Test Everything Works** (2 minutes)

```bash
python test-api-keys.py
```

**Expected output:**
```
🔍 TEN NEWS - API KEYS VERIFICATION
============================================================

📋 STEP 1: Checking Environment Variables
------------------------------------------------------------
✅ Claude AI               sk-ant-api03-...
✅ Google Gemini           AIzaSy...
✅ Perplexity AI           pplx-...
⏸️  NewsAPI (optional)     Not set (optional)

✅ All required environment variables are set!

📡 STEP 2: Testing API Connections
------------------------------------------------------------

🤖 Testing Claude API...
   ✅ Claude API: Working!

🔮 Testing Gemini API...
   ✅ Gemini API: Working!

🔍 Testing Perplexity API...
   ✅ Perplexity API: Working!

============================================================
✅ VERIFICATION COMPLETE
```

**If you see errors:**
- Double-check your API keys are correct
- Make sure you exported them (run export commands again)
- Check that packages installed correctly

---

### **Step 4: Generate Your First Enhanced News** (3 minutes)

```bash
# Generate daily digest (10 curated articles)
python news-generator.py

# Enhance with research (add facts, timeline, citations)
python news-research-enhancer.py tennews_data_$(date +%Y_%m_%d).json
```

**You'll see:**
```
🚀 TEN NEWS - Daily Digest Generator
...
✅ SUCCESS! Saved: tennews_data_2025_10_06.json

🔬 RESEARCH ENHANCEMENT SYSTEM
...
✅ Details: 3, Timeline: 3 events, Citations: 3 sources
...
✅ SUCCESS! Saved: tennews_data_2025_10_06_enhanced.json
```

---

### **Step 5: Check Your Results**

```bash
# View the enhanced file
cat tennews_data_$(date +%Y_%m_%d)_enhanced.json
```

**You'll see articles with:**
- ✅ Bold markup on key terms
- ✅ 3 verified details (numbers, dates, facts)
- ✅ Timeline (2-4 events with dates)
- ✅ Citations (source URLs)

---

## 🎯 What You Can Do Now

### **Option A: Daily Enhanced Newsletter** (Recommended)
```bash
# Morning routine (can automate this)
python news-generator.py
python news-research-enhancer.py tennews_data_$(date +%Y_%m_%d).json

# Use the *_enhanced.json file for your email
```

**Cost:** ~$0.07/day = $2.10/month
**Quality:** Professional with verified research

---

### **Option B: Add Live News Feed** (Optional)
```bash
# Real-time news with images (needs NewsAPI key)
python live-news-generator.py

# Output: 30-50 articles with images
```

**Cost:** Free tier (100 requests/day)
**Use:** Website live feed

---

### **Option C: Complete System** (Best)
```bash
# 1. Morning: Enhanced daily digest (for email)
python news-generator.py
python news-research-enhancer.py tennews_data_$(date +%Y_%m_%d).json

# 2. Throughout day: Live feed (for website)
python live-news-generator.py
# Run every 30-60 minutes

# 3. (Optional) Enhance live feed
python news-research-enhancer.py livenews_data_*_latest.json
```

**Cost:** $2-3/month (daily enhanced + live basic)
**Result:** Premium email + live website

---

## 💡 Pro Tips

### **Make API Keys Permanent:**

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
# Edit your shell config
nano ~/.zshrc

# Add these lines:
export CLAUDE_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
export PERPLEXITY_API_KEY="pplx-..."

# Save and reload
source ~/.zshrc
```

Now keys persist across terminal sessions!

---

### **Automate Daily Generation:**

Create a script `generate-daily.sh`:

```bash
#!/bin/bash
cd "/Users/omersogancioglu/Ten news website "

# Generate
python news-generator.py

# Enhance
TODAY=$(date +%Y_%m_%d)
python news-research-enhancer.py tennews_data_${TODAY}.json

echo "✅ Done! Check tennews_data_${TODAY}_enhanced.json"
```

Make it executable:
```bash
chmod +x generate-daily.sh
```

Run it:
```bash
./generate-daily.sh
```

---

### **Add to Crontab (Auto-run daily at 7 AM):**

```bash
crontab -e

# Add this line:
0 7 * * * cd "/Users/omersogancioglu/Ten news website " && ./generate-daily.sh
```

---

## 🔧 Troubleshooting

### **"ModuleNotFoundError: No module named 'google.generativeai'"**
```bash
pip install google-generativeai
```

### **"API key not found"**
```bash
# Check if set
echo $GOOGLE_API_KEY

# If empty, export again
export GOOGLE_API_KEY="your-key"
```

### **"Failed to parse JSON"**
- Usually temporary API issue
- Script continues with remaining articles
- Check internet connection

### **"Rate limit exceeded"**
- Wait a few minutes
- Check API dashboard for limits
- Upgrade plan if needed

---

## 📊 System Overview

You now have **THREE SYSTEMS**:

```
1. Daily Digest (Claude + Gemini)
   → 10 curated global stories
   → Professional writing
   → File: tennews_data_*.json
   
2. Research Enhancer (Perplexity)
   → Adds verified facts & citations
   → Web research & timelines
   → File: *_enhanced.json
   
3. Live Feed (NewsAPI + Gemini) - Optional
   → 30-50 real-time articles
   → Images included
   → File: livenews_data_*_*.json
```

**Working together = Premium news platform!**

---

## 📚 Documentation

- **`API_KEYS_SETUP.md`** - Detailed key setup
- **`RESEARCH_ENHANCER_SETUP.md`** - Research system guide
- **`COMPLETE_SYSTEM_ARCHITECTURE.md`** - Full system overview
- **`LIVE_NEWS_SETUP.md`** - Live news guide
- **`NEWS_SYSTEMS_COMPARISON.md`** - Compare all systems

---

## ✅ Checklist

- [ ] Installed dependencies (`pip install -r requirements.txt`)
- [ ] Set all three API keys (Claude, Gemini, Perplexity)
- [ ] Ran test script (`python test-api-keys.py`)
- [ ] Generated first daily digest (`python news-generator.py`)
- [ ] Enhanced with research (`python news-research-enhancer.py <file>`)
- [ ] Verified output has bold, details, timeline, citations
- [ ] Made API keys permanent (added to ~/.zshrc)
- [ ] (Optional) Set up automation script
- [ ] (Optional) Tested live news generator

---

## 🎉 You're Ready!

Everything is configured! You can now:

✅ Generate professional news digests
✅ Enhance with verified research
✅ Add timelines and citations
✅ (Optional) Generate live news feeds

**Cost:** ~$2-3/month for premium quality

**Next:** 
- Use `*_enhanced.json` files for your website/email
- Automate the daily generation
- Add live news feed (optional)

---

## 🆘 Need Help?

If anything doesn't work:

1. Run: `python test-api-keys.py` - see what's failing
2. Check: `API_KEYS_SETUP.md` - detailed troubleshooting
3. Verify: API keys are correct in your dashboard
4. Try: Re-export keys and test again

---

**Ready to generate your first enhanced news? Run the Step 4 commands!** 🚀

