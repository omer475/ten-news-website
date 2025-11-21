# ⏱️ Cycle Time Changed to 5 Minutes

## Date: November 20, 2025

---

## ✅ **Change Applied**

**Before:**
```
🔄 Repeat every 10 minutes
😴 Sleeping 10 minutes until next cycle...
time.sleep(600)  # 600 seconds
```

**After:**
```
🔄 Repeat every 5 minutes
😴 Sleeping 5 minutes until next cycle...
time.sleep(300)  # 300 seconds (5 minutes)
```

---

## 📊 **Impact**

| Metric | Before (10 min) | After (5 min) | Change |
|--------|-----------------|---------------|--------|
| **Cycles per hour** | 6 | 12 | +100% |
| **Updates per day** | 144 | 288 | +100% |
| **API calls per hour** | ~6 per API | ~12 per API | +100% |
| **Freshness** | Up to 10 min delay | Up to 5 min delay | 50% faster |

---

## 🚀 **Benefits**

✅ **Faster news updates** - Articles appear on tennews.ai twice as fast
✅ **More responsive** - Breaking news shows up within 5 minutes
✅ **Better coverage** - Catch news in smaller time windows

---

## ⚠️ **Considerations**

**API Usage:**
- Gemini API: 12 calls/hour (was 6)
- Perplexity API: 12 calls/hour (was 6)
- Claude API: ~12 calls/hour (was 6)
- ScrapingBee: ~12 calls/hour (was 6)

**Cost Impact:**
- Approximately 2x API costs
- Monitor your API quotas and billing

**Load:**
- Database queries increase 2x
- Server load increases slightly

---

## 🎯 **How to Apply**

### **Option 1: Wait for Current Cycle to Restart**

Your system is currently running. The change will apply automatically after:
1. Current cycle completes
2. System pulls latest changes (if auto-update enabled)
3. OR restart manually

### **Option 2: Restart Now**

```bash
# Stop current system (Ctrl+C in the terminal)
cd "/Users/omersogancioglu/Ten news website "
git pull origin main
./RUN_LIVE_CLUSTERED_SYSTEM.sh
```

---

## 📈 **Expected Behavior**

You'll see:
```
================================================================================
✅ PIPELINE COMPLETE
================================================================================
   Articles fetched: 25
   Approved by Gemini: 1
   Clusters processed: 1
   Articles published: 1
================================================================================

😴 Sleeping 5 minutes until next cycle...  ← Changed!
```

Then **5 minutes later** (not 10), the next cycle starts automatically.

---

## 🔄 **To Change Back to 10 Minutes**

If you want to revert:

```bash
# Edit the files:
# RUN_LIVE_CLUSTERED_SYSTEM.sh: Change "5 minutes" → "10 minutes"
# complete_clustered_8step_workflow.py: Change 300 → 600

# Or just ask me to change it back!
```

---

## ✅ **Changes Committed**

```
commit 2f775dd
⏱️ Change cycle time from 10 minutes to 5 minutes

Files changed:
- RUN_LIVE_CLUSTERED_SYSTEM.sh (display message)
- complete_clustered_8step_workflow.py (sleep time: 600→300)
```

---

**Your system will now update news every 5 minutes! 🚀**

