# Gemini Scoring Prompt - Major Update

**Date**: October 24, 2025  
**Status**: ✅ DEPLOYED

---

## 🎯 **What Changed**

Complete overhaul of the Gemini scoring prompt in `step1_gemini_news_scoring_filtering.py` to focus on:

**EVENTS over ANALYSIS**  
**BREAKING over FEATURES**  
**SURPRISING over EXPECTED**  
**GLOBAL over LOCAL**  
**NEWS over TRENDS**

---

## 📋 **New Three-Question Framework**

Every article must pass these tests:

### 1. "DID SOMETHING HAPPEN?"
- We want: Events with clear "before" and "after"
- We don't want: Trends, situations, ongoing descriptions

✅ **APPROVE**: "Congress passes bill," "Earthquake strikes," "Company announces"  
❌ **FILTER**: "ETFs gaining popularity," "Markets showing nervousness"

### 2. "WOULD I ACTUALLY TELL SOMEONE ABOUT THIS?"
- Would you text a friend "Did you see this?!"
- Is it genuinely interesting, not just "supposed to be important"?

✅ **APPROVE**: "Not exercising deadlier than smoking" (shocking)  
❌ **FILTER**: "Active ETFs shift market share" (only traders care)

### 3. "DOES THIS MATTER TO REGULAR PEOPLE?"
- Affects millions, not just specialists
- Globally significant, not just local
- General conversation, not specialist forums

✅ **APPROVE**: Fed interest rate decision (affects everyone)  
❌ **FILTER**: "Store fires one volunteer" (who cares?)

---

## 🚫 **What Gets Filtered**

The prompt now explicitly filters:

1. **Market Predictions & Analyst Opinions**  
   - Example: "Bank warns S&P 500 near peak" (just opinion, no event)

2. **Trend Pieces & Market Shifts**  
   - Example: "ETFs gaining popularity" (when did this happen? it didn't)

3. **Feature Stories & Program Descriptions**  
   - Example: "Schools address gap through programs" (not breaking news)

4. **Local Incidents (One Person/Business)**  
   - Example: "Store fires volunteer" (affects one person)

5. **Retrospective Analysis & Documentaries**  
   - Example: "Documentary reveals details" (old event, no current impact)

6. **Technical/Niche Updates**  
   - Example: "Technical indicators trigger" (specialists only)

7. **Ongoing Situations Without New Developments**  
   - Example: "Day 347 of conflict" (we know, what's new?)

8. **Old News (>7 days)**  
   - Not timely, not relevant to today's conversation

---

## ✅ **Special Cases: When To Approve**

### Studies & Research
- ✅ **APPROVE** if shocking: "Not exercising deadlier than smoking"
- ❌ **FILTER** if obvious: "Study shows exercise is healthy" (duh)

### Political News
- ✅ **APPROVE** if final action: "Congress passes healthcare reform"
- ❌ **FILTER** if procedural: "Senator introduces bill" (might not pass)

### Sports News
- ✅ **APPROVE** if major final: "World Cup final," "Olympics ceremony"
- ❌ **FILTER** if regular games: "Team advances to next round"

### Business/Economy
- ✅ **APPROVE** if broadly impactful: "Fed raises interest rates"
- ❌ **FILTER** if niche: "ETF market share shifts"

---

## 🎯 **The Mindset**

**Think like someone scrolling news at breakfast:**
- What happened in the world TODAY?
- What surprising things did I not know?
- What should I know so I'm not out of the loop?
- What's interesting enough to tell someone about?

**You're curating for your intelligent, busy friend who trusts you to:**
- Show them what actually HAPPENED today
- Surprise them with fascinating things
- Keep them informed on major events
- Skip boring procedural stuff
- Skip niche industry content
- Skip predictions and analysis

---

## 📊 **Scoring Approach**

**Score 700-1000 (APPROVE)** when:
- Something actually happened (event, not trend)
- It's breaking news (recent, timely)
- It's surprising OR broadly important (preferably both)
- People would actually talk about this
- General audience cares (not just specialists)

**Score <700 (FILTER)** when:
- Nothing actually happened (trend/analysis/prediction)
- It's old news (>7 days)
- It's boring even if "important"
- It's local/individual without broad impact
- It's niche for specialists only
- Nobody would bring this up in conversation

**TARGET: 10% approval rate** (only the best stuff)

---

## 🏷️ **Updated Categories**

Changed from old categories to:
- Politics
- Economy
- International
- Health
- Science
- Technology
- Environment
- Disaster
- Sports
- Culture
- Other

---

## 📈 **Expected Impact**

### Before This Update:
- Too many trend pieces approved
- Analyst predictions getting through
- Niche financial content approved
- Local stories without significance
- Features/explainers mixed with news

### After This Update:
- Only actual events (things that happened)
- No predictions, only completed actions
- Broad impact required
- Surprising or important (ideally both)
- Genuinely conversation-worthy content

---

## 🧪 **Testing**

Monitor the next few cycles:
1. Check approval rate (should be ~10%)
2. Verify approved articles are events, not trends
3. Confirm no analyst opinions getting through
4. Ensure no local/individual stories unless extraordinary

---

## 💡 **Key Principles**

**The prompt now teaches Gemini to understand:**

- **NEWS vs NOT NEWS**: Something happened vs description of situations
- **EVENT vs SITUATION**: Specific time vs ongoing state
- **GLOBAL vs LOCAL**: Millions affected vs few people
- **SURPRISING vs EXPECTED**: "Wait, really?!" vs "Obviously"
- **BREAKING vs EVERGREEN**: Just happened vs could run anytime

---

## 🚀 **Deployment**

- ✅ Updated `step1_gemini_news_scoring_filtering.py`
- ✅ Committed and pushed to main
- ✅ Live on production system

**Next news cycle will use the new prompt!**

---

## 📝 **Summary**

This is a **fundamental shift** in how we filter news:

**OLD APPROACH**: Score based on importance, even if boring  
**NEW APPROACH**: Only approve things people would actually talk about

**OLD MINDSET**: "This is important news"  
**NEW MINDSET**: "Did you see this?!"

**Result**: Higher quality, more engaging, more conversation-worthy news feed.

Perfect! 🎯

