# Step 1: Gemini Scoring Prompt - Complete Overhaul

**Date**: October 24, 2025  
**Status**: ✅ COMPLETE

---

## 🎯 **What Changed**

Completely rewrote the Step 1 Gemini scoring prompt with a **much more comprehensive, human-centered approach** that focuses on what people actually want to read and share.

---

## 🧠 **New Philosophy**

### Old Approach:
- Mechanical scoring (add up points across 5 categories)
- Focused on "shareability" metrics
- Less guidance on what to filter

### New Approach:
- **Holistic judgment** (think like a friend curating news)
- **Three core questions**:
  1. "Did something happen?" (events > analysis)
  2. "Would I tell someone about this?" (genuinely interesting)
  3. "Does this matter to regular people?" (not just specialists)
- **Detailed content type understanding** (news vs trends/analysis/predictions)
- **Clear filtering guidelines** with examples

---

## 📚 **New Prompt Structure**

### 1. YOUR MINDSET
Sets the tone: You're curating for intelligent, busy people who want:
- What happened TODAY?
- Surprising things that make you say "wow"
- Stay informed without wasting time

**Core principle**: Events & surprises, not analysis & trends.

### 2. THE THREE CORE QUESTIONS
Explicit framework for evaluating each article:

**"DID SOMETHING HAPPEN?"**
- ✅ Good: "Congress passes bill," "Earthquake strikes"
- ❌ Bad: "ETFs gaining popularity" (trend, not event)

**"WOULD I ACTUALLY TELL SOMEONE ABOUT THIS?"**
- ✅ Good: "Not exercising deadlier than smoking" (shocking!)
- ❌ Bad: "Active ETFs shift market share" (boring)

**"DOES THIS MATTER TO REGULAR PEOPLE?"**
- ✅ Good: Fed rate decision (affects everyone)
- ❌ Bad: One person fired from store (local)

### 3. UNDERSTANDING WHAT WE'RE SEEING
Deep dive into content types:

**IS THIS NEWS OR SOMETHING ELSE?**
- News = Something happened
- Not News = Analysis, trends, predictions, features, opinions

**IS THIS ABOUT AN EVENT OR A SITUATION?**
- Event = Specific time, breaking, new
- Situation = Ongoing state, gradual change

**IS THIS GLOBAL OR LOCAL?**
- Global = Millions affected, broad significance
- Local = Few people, regional only

**IS THIS SURPRISING OR EXPECTED?**
- Surprising = "Wait, really?!"
- Expected = "Yeah, that makes sense"

**IS THIS BREAKING OR EVERGREEN?**
- Breaking = Just happened, urgent
- Evergreen = Could run anytime

### 4. WHAT TO FILTER (Understanding, Not Keywords)
Detailed explanations of 8 types to always filter:

1. **Market Predictions & Analyst Opinions**
   - What: Guessing about future
   - Example: "Bank warns S&P 500 near peak"

2. **Trend Pieces & Market Shifts**
   - What: Gradual changes over time
   - Example: "ETFs gaining popularity"

3. **Feature Stories & Program Descriptions**
   - What: Background pieces
   - Example: "Schools address gap through programs"

4. **Local Incidents With One Person/Business**
   - What: Individual stories
   - Example: "Store fires volunteer"

5. **Retrospective Analysis & Documentaries**
   - What: Looking back at past
   - Example: "Documentary reveals details"

6. **Technical/Niche Updates**
   - What: Industry-specific
   - Example: "Technical indicators trigger"

7. **Ongoing Situations Without New Developments**
   - What: Status updates
   - Example: "Day 347 of conflict"

8. **Old News (>7 days)**
   - What: Too long ago
   - Example: "Blue Jays won 1993 World Series"

### 5. SPECIAL CASES: When To Approve Borderline Content

**STUDIES & RESEARCH**
- ✅ Approve: "Did you know?!" quality (shocking comparisons)
- ❌ Filter: Confirming what we know

**POLITICAL NEWS**
- ✅ Approve: Final, completed action (bill passed)
- ❌ Filter: Procedural or theatrical (debate, speech)

**SPORTS NEWS**
- ✅ Approve: Championship or historic moment
- ❌ Filter: Regular games, contracts

**BUSINESS/ECONOMY**
- ✅ Approve: Broadly impactful (Fed rates)
- ❌ Filter: Industry-specific (ETF market share)

**INTERESTING FACTS**
- ✅ Approve: Surprising revelation (if revealed today)
- Must still be NEWS, not encyclopedia entry

### 6. YOUR APPROACH TO SCORING
The actual mindset to use:

**Think**: You're curating for your intelligent friend who's busy.

**Show them**:
- What HAPPENED today (events, not analysis)
- Surprising things they didn't know
- Major world events
- Skip boring procedural stuff
- Skip niche industry content
- Skip one-person local stories
- Skip predictions and warnings
- Skip features and explainers

**Score 700-1000 (APPROVE)** when:
- Something actually happened (event, not trend)
- It's breaking news (recent, timely)
- It's surprising OR broadly important (preferably both)
- People would actually talk about this
- General audience cares (not just specialists)

**Score BELOW 700 (FILTER)** when:
- Nothing actually happened
- It's old news (>7 days)
- It's boring even if "important"
- It's local/individual story
- It's niche content for specialists only
- It's opinion/analysis rather than news
- Nobody would bring this up in conversation

### 7. SCORING FACTORS (Holistic, Not Mechanical)
Five factors to consider together:

1. **RECENCY & TIMELINESS**
   - Just happened today → very high
   - Old news (>7 days) → low

2. **SURPRISE & WOW FACTOR**
   - Mind-blowing → very high
   - Obvious → very low

3. **IMPACT & SCALE**
   - Hundreds of millions → very high
   - Individual/local → very low

4. **CONVERSATION-WORTHINESS**
   - Everyone will talk → very high
   - Nobody would mention → very low

5. **EDUCATIONAL VALUE**
   - Fundamental new knowledge → very high
   - No educational value → very low

**Key**: Don't calculate mechanically - use judgment!
- Breaking but boring: might score 700
- Fascinating study: might score 850
- Local story: might score 300
- Analyst prediction: might score 400

### 8. SOURCE CREDIBILITY

**HIGH CREDIBILITY (trust them)**:
Reuters, AP, AFP, BBC, CNN, Al Jazeera, NPR, NYT, WSJ, Washington Post, The Guardian, Financial Times, Bloomberg, The Economist, Nature, Science

**MODERATE CREDIBILITY**: Established national outlets, quality regional papers

**LOW CREDIBILITY**: Blogs, aggregators, questionable sources

**ZERO CREDIBILITY**: Tabloids, conspiracy sites, satirical sources

### 9. CATEGORY ASSIGNMENT
Choose ONE category:
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

### 10. OUTPUT FORMAT
JSON array with:
- `title`: exact article title
- `score`: 0-1000
- `category`: one of above
- `status`: "APPROVED" (≥700) or "FILTERED" (<700)
- `score_breakdown`: shows thinking (recency, surprise, impact, conversation, educational)

### 11. REMEMBER YOUR MISSION
Final reminder:
- Help people stay informed without wasting time
- Think: "Would I want to read this? Would I tell someone?"
- Be selective, be ruthless with boring content
- Only approve genuinely newsworthy and interesting

**Priorities**:
- Events > Analysis
- Breaking > Features
- Surprising > Expected
- Global > Local
- News > Trends

**TARGET: 10% approval rate** - Only the best stuff makes it through.

---

## 📊 **Key Improvements**

### 1. More Human-Centered
- Uses conversational language ("Did you see this?!")
- Frames decisions as "Would I tell someone?"
- Focuses on breakfast-time news browsing mindset

### 2. Clearer Filtering Criteria
- Explains WHAT content types are (not just keywords)
- Explains WHY to filter them
- Gives specific examples for each type

### 3. Better Content Type Understanding
- Distinguishes news from analysis/trends/predictions
- Distinguishes events from situations
- Distinguishes breaking from evergreen

### 4. Special Cases Guidance
- Studies: Only if genuinely shocking
- Politics: Only if final action, not theater
- Sports: Only major championships
- Business: Only if affects millions

### 5. Holistic Scoring Approach
- Don't add up points mechanically
- Use overall judgment
- Consider all factors together
- Think about conversation-worthiness

### 6. More Examples
- ✅ Good examples (approve these)
- ❌ Bad examples (filter these)
- For each content type
- For each special case

---

## 🎯 **Expected Results**

### Better Filtering:
- Fewer trend pieces
- Fewer analyst predictions
- Fewer feature stories
- Fewer local incidents
- Fewer procedural political updates

### More Quality Content:
- Actual breaking events
- Surprising discoveries
- Globally significant news
- Conversation-worthy stories
- Things people actually want to share

### 10% Approval Rate:
- Only the truly good stuff
- No filler content
- Each article earns its place
- High quality, not high quantity

---

## 🚀 **Deployment**

**File Updated**: `step1_gemini_news_scoring_filtering.py`

**Changes**:
- Replaced entire `system_prompt` variable (lines 104-530)
- Old prompt: ~350 lines of mechanical scoring rules
- New prompt: ~430 lines of comprehensive guidance
- Removed redundant sections at the end

**Testing**: 
- Next time the live system runs, it will use the new prompt
- Monitor approval rates (should be ~10%)
- Check quality of approved articles

---

## 📈 **Monitoring**

### What To Watch:
1. **Approval Rate**: Should be around 10% (not 30-40%)
2. **Content Types**: Should be events, not trends/analysis
3. **Age**: Should be recent (<7 days), not old news
4. **Scope**: Should be global/national, not local
5. **Surprise Factor**: Should be interesting, not boring

### Good Signs:
- ✅ "This is actually interesting!"
- ✅ "I would share this"
- ✅ "I didn't know that"
- ✅ "Something actually happened"

### Bad Signs:
- ❌ "This is boring"
- ❌ "This is just analysis"
- ❌ "This is old news"
- ❌ "Who cares about this?"

---

## 🎓 **Key Takeaways**

### The Three Questions Framework:
1. **Did something happen?** → Events, not situations
2. **Would I tell someone?** → Interesting, not boring
3. **Does it matter?** → Global, not local

### The Priority Hierarchy:
- Events > Analysis
- Breaking > Features
- Surprising > Expected
- Global > Local
- News > Trends

### The Curation Mindset:
Think like a friend helping a friend stay informed.
- Show them what matters
- Surprise them with fascinating stuff
- Skip the boring procedural content
- Skip the niche specialist content
- Only the good stuff makes it through

---

## ✅ **Complete!**

The new Gemini scoring prompt is:
- ✅ More comprehensive
- ✅ More human-centered
- ✅ More explicit about filtering
- ✅ Better at catching edge cases
- ✅ Focused on conversation-worthiness
- ✅ Deployed and ready to use

**Next time the live system runs, it will use this new prompt to score articles with much better judgment!** 🎉

---

## 📝 **Notes**

- This is a **major improvement** in news curation quality
- The 10% target is intentional - we want only the best
- The holistic approach gives Gemini better judgment
- The examples help it understand edge cases
- The three questions provide a clear framework

**Result**: Much better news curation! 🚀

