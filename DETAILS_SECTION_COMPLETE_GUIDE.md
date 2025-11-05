# 📊 DETAILS SECTION - COMPLETE GUIDE
## For Ten News Generator (Daily 10 Articles System)

---

## 📋 TABLE OF CONTENTS
1. [Overview](#overview)
2. [Quantity Per Article](#quantity-per-article)
3. [Writing Rules](#writing-rules)
4. [Format Structure](#format-structure)
5. [Visual Styling](#visual-styling)
6. [Length Guidelines](#length-guidelines)
7. [Label Rules](#label-rules)
8. [Value Rules](#value-rules)
9. [Examples by Story Type](#examples-by-story-type)
10. [Validation Checklist](#validation-checklist)

---

## 📌 OVERVIEW

The **Details Section** is a critical component of each news article that provides 3 additional data points NOT mentioned in the summary. These appear as quick-scan facts in a glassmorphism card below each article.

**Purpose:** Give readers instant access to supplementary metrics, numbers, and facts without reading full paragraphs.

---

## 🔢 QUANTITY PER ARTICLE

### STRICT REQUIREMENT:
- **Exactly 3 details per article**
- No more, no less
- Each detail must be unique and non-redundant
- Each must provide NEW information not in the summary

### JSON Structure:
```json
{
  "details": [
    "Label: Value",
    "Label: Value", 
    "Label: Value"
  ]
}
```

---

## ✍️ WRITING RULES

### CORE REQUIREMENTS

1. **NEW INFORMATION ONLY**
   - Details MUST NOT repeat anything from the summary
   - Each detail adds something completely new
   - No paraphrasing of summary content
   - Compare word-for-word against summary before including

2. **"LABEL: VALUE" FORMAT**
   - Single colon separator
   - Label before colon (1-3 words)
   - Value after colon (main metric + optional context)
   - No other format accepted

3. **CONCISENESS**
   - Keep total length under 6-7 words per detail
   - Short is better than long
   - Use fragments, not full sentences
   - Remove unnecessary words

4. **DATA-DRIVEN**
   - Prefer hard numbers and metrics
   - Include dates, percentages, amounts
   - Use specific figures, not vague descriptions
   - Quantify whenever possible

---

## 📐 FORMAT STRUCTURE

### Basic Format
```
"Label: Value"
```

### Anatomy of a Detail
```
[LABEL: 1-3 words] : [NUMBER/METRIC] [optional context 2-4 words]
     ↑                      ↑                    ↑
  Capitalize         Primary info        Adds clarity
  first word           first              if needed
```

---

## 🎨 VISUAL STYLING

### Container Styling (Glassmorphism Card)

**CSS Class:** `.news-meta`

```css
.news-meta {
  display: flex;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px 20px;
  margin-top: 20px;
  gap: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
}
```

**Visual Properties:**
- **Background:** Semi-transparent white with blur effect
- **Border Radius:** 16px (rounded corners)
- **Padding:** 12px vertical, 20px horizontal
- **Border:** 1px solid white with 20% opacity
- **Shadow:** Soft shadow for depth
- **Layout:** Horizontal flexbox (3 items side by side)

---

### Individual Detail Item Styling

**CSS Class:** `.news-detail-item`

```css
.news-detail-item {
  flex: 1;                    /* Equal width distribution */
  text-align: center;         /* Center-aligned content */
  padding: 0 15px;            /* Horizontal spacing */
  border-right: 1px solid #e2e8f0;  /* Divider between items */
  display: flex;
  flex-direction: column;     /* Label above value */
  justify-content: center;
  min-height: 38px;
}

/* Remove border on last item */
.news-detail-item:last-child,
.news-detail-item:nth-child(3) {
  border-right: none;
}
```

**Visual Properties:**
- **Layout:** Vertical stack (label on top, value below)
- **Alignment:** Center-aligned text
- **Spacing:** 15px horizontal padding
- **Dividers:** 1px border between items (not on last item)
- **Min Height:** 38px for consistent sizing

---

### Label Styling

**CSS Class:** `.news-detail-label`

```css
.news-detail-label {
  font-size: 10px;
  color: #6b7280;              /* Gray-500 */
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;            /* Semi-bold */
  margin-bottom: 1px;
}
```

**Visual Properties:**
- **Font Size:** 10px
- **Color:** #6b7280 (medium gray)
- **Transform:** UPPERCASE
- **Letter Spacing:** 1px (spread out)
- **Weight:** 600 (semi-bold)
- **Margin Bottom:** 1px

**Examples:**
```
MARKET CAP
GROWTH RATE
CASUALTIES
```

---

### Value Styling

**CSS Class:** `.news-detail-value`

```css
.news-detail-value {
  font-size: 20px;
  font-weight: 800;            /* Extra bold */
  color: #111827;              /* Near black (light mode) */
  color: #f9fafb;              /* Near white (dark mode) */
  line-height: 1.2;
  margin: 0;
}
```

**Visual Properties:**
- **Font Size:** 20px (large and prominent)
- **Color:** 
  - Light Mode: #111827 (near black)
  - Dark Mode: #f9fafb (near white)
- **Weight:** 800 (extra bold)
- **Line Height:** 1.2 (tight spacing)

**Examples:**
```
$2.8T
12% YoY
450 confirmed
```

---

### Subtitle Styling (Optional Context)

**CSS Class:** `.news-detail-subtitle`

```css
.news-detail-subtitle {
  font-size: 11px;
  color: #6b7280;              /* Gray-500 */
  font-weight: 500;            /* Medium weight */
  margin-top: 0;
}
```

**Visual Properties:**
- **Font Size:** 11px (smaller than value)
- **Color:** #6b7280 (medium gray)
- **Weight:** 500 (medium)
- **Margin Top:** 0px

**Examples:**
```
annually
of global
deployed
```

---

### Mobile Responsive Styling

**Breakpoint:** `@media (max-width: 768px)`

```css
@media (max-width: 768px) {
  .news-detail-item {
    padding: 0 10px;           /* Reduced padding */
  }
  
  .news-detail-label {
    font-size: 9px;            /* Smaller labels */
  }
  
  .news-detail-value {
    font-size: 16px;           /* Smaller values */
  }
  
  .news-detail-subtitle {
    font-size: 10px;           /* Smaller subtitles */
  }
}
```

**Changes on Mobile:**
- Labels: 10px → 9px
- Values: 20px → 16px
- Subtitles: 11px → 10px
- Padding: 15px → 10px

---

## 📏 LENGTH GUIDELINES

### SHORT FORMAT (3-4 words total)
**Best for:** Simple metrics without context needed

**Examples:**
```
Stock drop: 91%
Debt owed: $3.3B
Countries: 47
Temperature: 45°C
Deaths: 142
Distance: 500km
```

**Structure:**
```
[Label 1-2 words] : [Number + Unit]
```

---

### MEDIUM FORMAT (5-6 words total)
**Best for:** Metrics needing scope or timeframe

**Examples:**
```
Market share: 28% of global
Aid blocked: 4,000 trucks daily
Previous fine: €8.2B total
Revenue growth: $450M quarterly
Staff cuts: 12,000 jobs worldwide
```

**Structure:**
```
[Label 1-3 words] : [Number] [Context 2-3 words]
```

---

### DESCRIPTIVE FORMAT (6-7 words max)
**Best for:** When specificity is crucial

**Examples:**
```
Advertisers affected: 2 million businesses
Recovery timeline: 18-24 months estimated
Competitor position: #3 globally ranked
Warning time: 6 minutes before impact
Emergency aid: $2B package approved
```

**Structure:**
```
[Label 2-3 words] : [Number] [Descriptive context 2-4 words]
```

---

## 🏷️ LABEL RULES

### LENGTH
- **Minimum:** 1 word
- **Maximum:** 3 words
- **Optimal:** 2 words

### CAPITALIZATION
- **Capitalize:** First word only
- **Don't capitalize:** Subsequent words (unless proper noun)

**✅ CORRECT:**
```
Market cap
Growth rate
EU fines
Stock price
```

**❌ INCORRECT:**
```
MARKET CAP        (all caps)
Market Cap        (title case)
market cap        (lowercase)
```

### SPECIFICITY
- Be specific, not generic
- Add context when needed
- Avoid vague labels

**✅ GOOD:**
```
EU fines          (not just "Fines")
Annual revenue    (not just "Revenue")
Q3 earnings       (not just "Earnings")
Staff reduction   (not just "Jobs")
```

**❌ BAD:**
```
Total             (too vague)
Amount            (too generic)
Number            (which number?)
Data              (what data?)
```

### NO COLONS IN LABEL
- The colon is the separator
- Only ONE colon per detail
- Place it between label and value

**✅ CORRECT:**
```
Investigation duration: 3 years
```

**❌ INCORRECT:**
```
Investigation: duration: 3 years
```

---

## 💎 VALUE RULES

### PRIMARY NUMBER FIRST
- Start with the key metric
- Number comes before explanation
- Most important info up front

**✅ CORRECT:**
```
$2.8T global market
47 countries affected
92% approval rate
```

**❌ INCORRECT:**
```
Global market worth $2.8T
Countries affected totaling 47
Approval rate of 92%
```

---

### CONTEXT AFTER
- Add clarifying text AFTER the number
- Keep context brief (2-4 words max)
- Only add if genuinely needed

**✅ GOOD CONTEXT:**
```
$2B annually          (timeframe needed)
28% of global         (scope needed)
45,000 civilians      (category needed)
3x previous record    (comparison needed)
```

**❌ UNNECESSARY CONTEXT:**
```
45°C hot              ("hot" is obvious)
142 people            ("people" is obvious for deaths)
500km far             ("far" is redundant)
$2B dollars           ("dollars" is in $)
```

---

### KEEP CONCISE
- Maximum 4-5 words after the number
- No full sentences
- Use fragments only
- Every word must add value

**✅ CONCISE:**
```
$450M quarterly revenue
12,000 jobs cut
3 years investigation
```

**❌ TOO WORDY:**
```
$450M in quarterly revenue results
12,000 jobs were cut from workforce
Investigation lasted for 3 years total
```

---

### NO FULL SENTENCES
- Use noun phrases, not sentences
- No verbs or complete thoughts
- Fragment style only

**✅ FRAGMENTS:**
```
Revenue: $89.5B
Growth: 12% YoY
Launch: March 2025
```

**❌ SENTENCES:**
```
Revenue: The company earned $89.5B
Growth: It grew by 12% YoY
Launch: Will launch in March 2025
```

---

## 🎯 GOOD vs BAD EXAMPLES

### Example 1: Tech Company Story

**❌ TOO LONG:**
```
Investigation duration spanning multiple jurisdictions: 3 years across 12 countries
```

**✅ PROPERLY FORMATTED:**
```
Investigation duration: 3 years
Jurisdictions involved: 12 countries
```

**Why it's better:**
- Split one complex detail into two simpler ones
- Easier to scan and understand
- Fits space constraints
- More visual impact

---

### Example 2: Advertiser Story

**❌ REDUNDANT:**
```
Total number of affected advertisers: 2 million advertisers
```

**✅ CLEAN:**
```
Advertisers affected: 2 million
```

**Why it's better:**
- "Total number" is redundant
- "advertisers" repeated twice
- Shorter = more impactful
- Easier to read at a glance

---

### Example 3: Financial Story

**❌ POORLY STRUCTURED:**
```
The company's market capitalization: valued at $1.2 trillion dollars
```

**✅ WELL STRUCTURED:**
```
Market cap: $1.2T
```

**Why it's better:**
- "The company's" is unnecessary
- "valued at" is implied
- "trillion dollars" → "$1.2T" (standard abbreviation)
- 4x shorter with same information

---

### Example 4: Crisis Story

**❌ VAGUE:**
```
Duration: Several months
Impact: Many people
Response: Quick action
```

**✅ SPECIFIC:**
```
Duration: 8 months ongoing
Impact: 45,000 civilians
Response: 6 hours deployment
```

**Why it's better:**
- Specific numbers instead of vague words
- Quantifiable metrics
- More informative
- Builds credibility

---

## 📊 HIERARCHY OF INFORMATION

### Priority 1: PRIMARY DETAILS (Use First)

**Type:** Hard numbers with brief context

**When to use:** When you have concrete data available

**Examples:**
```
Revenue loss: $450M quarterly
Staff reduction: 12,000 jobs
Market share: 28% global
Death toll: 142 confirmed
Aid delivered: $2.5B total
Investment round: $150M Series C
```

**Why prioritize:**
- Most informative
- Most credible
- Easiest to verify
- Most newsworthy

---

### Priority 2: SECONDARY DETAILS (Use if Primary Exhausted)

**Type:** Comparisons and rankings

**When to use:** When primary metrics are in summary or unavailable

**Examples:**
```
Industry rank: #2 worldwide
Growth rate: -23% YoY
Previous incident: 2019
Competitor comparison: 3x larger
Historical context: Since 2010
Market position: Overtook rival
```

**Why secondary:**
- Less immediate impact
- Requires context to understand
- Comparative rather than absolute
- Still valuable but not critical

---

### Priority 3: TERTIARY DETAILS (Last Resort)

**Type:** Projections and estimates

**When to use:** When no hard data available, or as 3rd detail

**Examples:**
```
Recovery estimate: Q3 2026
Analysts surveyed: 47
Confidence level: 78%
Projected impact: $2B
Expected timeline: 6-8 months
Forecast range: 15-20%
```

**Why last resort:**
- Not confirmed facts
- May change over time
- Less reliable than actuals
- Use only when necessary

---

## 📚 EXAMPLES BY STORY TYPE

### Tech/Business Story

**Article:** Apple Reports Record Quarter

**Summary mentions:**
- iPhone 15 sales exceeded expectations
- Revenue up from last year
- Services division growth
- CEO's statement

**✅ GOOD DETAILS (NEW INFO):**
```json
{
  "details": [
    "Market cap: $1.2T",
    "Patent portfolio: 50,000+",
    "R&D budget: 18% revenue"
  ]
}
```

**Why these work:**
- None mentioned in summary
- All hard numbers
- Different aspects of company
- Concise format

**❌ BAD DETAILS (Redundant):**
```json
{
  "details": [
    "iPhone sales: Strong",
    "Revenue: Increased",
    "CEO: Made statement"
  ]
}
```

**Why these fail:**
- Repeat summary content
- Vague ("strong", "increased")
- No new information
- No specific numbers

---

### Disaster/Crisis Story

**Article:** Hurricane Hits Gulf Coast

**Summary mentions:**
- Category 4 hurricane
- Coastal evacuations ordered
- Expected landfall Thursday
- Emergency declared

**✅ GOOD DETAILS (NEW INFO):**
```json
{
  "details": [
    "Warning time: 6 minutes",
    "Shelters opened: 200",
    "Aid workers: 5,000 deployed"
  ]
}
```

**Why these work:**
- Specific response metrics
- Not in summary
- Quantifies preparation
- Shows scale of response

**❌ BAD DETAILS (Redundant):**
```json
{
  "details": [
    "Category: 4 hurricane",
    "Location: Gulf Coast",
    "Timing: Thursday landfall"
  ]
}
```

**Why these fail:**
- All in summary already
- Repeats headline info
- Zero new value
- Wastes detail slots

---

### Political/Diplomatic Story

**Article:** US-China Trade Talks Resume

**Summary mentions:**
- Trade negotiations restarted
- Tariffs on the table
- Beijing and Washington officials met
- Optimism from both sides

**✅ GOOD DETAILS (NEW INFO):**
```json
{
  "details": [
    "Bilateral trade: $340B",
    "Embassy staff: 1,200",
    "Previous summit: 2018"
  ]
}
```

**Why these work:**
- Context not in summary
- Scale of relationship
- Historical perspective
- All quantified

**❌ BAD DETAILS (Redundant):**
```json
{
  "details": [
    "Topic: Trade negotiations",
    "Location: Beijing meeting",
    "Mood: Optimistic outlook"
  ]
}
```

**Why these fail:**
- Summary already says this
- No numbers or metrics
- Subjective descriptions
- No added value

---

### Medical/Health Story

**Article:** New Alzheimer's Drug Approved

**Summary mentions:**
- FDA approved new treatment
- Clinical trials showed promise
- First approval in 10 years
- Targets brain protein

**✅ GOOD DETAILS (NEW INFO):**
```json
{
  "details": [
    "Trial participants: 3,200",
    "Efficacy rate: 73%",
    "Annual cost: $28,000"
  ]
}
```

**Why these work:**
- Specific trial data
- Treatment effectiveness
- Practical cost info
- All new metrics

**❌ BAD DETAILS (Redundant):**
```json
{
  "details": [
    "Status: FDA approved",
    "Testing: Clinical trials",
    "First in: 10 years"
  ]
}
```

**Why these fail:**
- Repeats summary exactly
- No new data
- Vague descriptions
- Wasted opportunity

---

### Economic Story

**Article:** Fed Raises Interest Rates

**Summary mentions:**
- Federal Reserve increased rates
- 0.25% hike announced
- Inflation concerns cited
- Markets reacted negatively

**✅ GOOD DETAILS (NEW INFO):**
```json
{
  "details": [
    "New rate: 5.5%",
    "Previous hikes: 11 total",
    "Inflation target: 2% goal"
  ]
}
```

**Why these work:**
- Absolute rate level
- Historical context
- Policy objective
- All quantified

**❌ BAD DETAILS (Redundant):**
```json
{
  "details": [
    "Increase: 0.25%",
    "Reason: Inflation concerns",
    "Market: Negative reaction"
  ]
}
```

**Why these fail:**
- Summary mentions 0.25%
- Summary cites inflation
- Summary notes markets
- Zero new content

---

## 🚫 SPACE OPTIMIZATION

### When a Detail Seems Too Long → SPLIT IT

**Instead of:**
```
Government response: Emergency $2B aid package approved by 310-95 vote
```

**Use ONE of these:**
```
Emergency aid: $2B
Senate vote: 310-95
Approval margin: 215 votes
```

**Strategy:**
- One concept = one detail
- Break complex info into pieces
- Use as separate details
- Keeps each detail scannable

---

### When to Combine Elements

**Combine when:**
- Context is essential for understanding
- Number alone is meaningless
- Adding 2-3 words clarifies significantly

**Good combinations:**
```
Market share: 28% of global        (scope needed)
Aid delivery: 4,000 trucks daily   (timeframe needed)
Recovery time: 18-24 months        (range important)
```

**Don't combine when:**
- Elements are independent facts
- Each could stand alone
- It makes detail too long
- Info can be split cleanly

---

## ➕ CONTEXT ADDITIONS

### When TO Add Context After Number

**Percentages need scope:**
```
✅ 28% of global
✅ 15% year-over-year
✅ 92% approval rate
❌ 28% (what is 28% of?)
```

**Money needs timeframe:**
```
✅ $2B annually
✅ $450M quarterly
✅ $15M per month
❌ $2B (over what period?)
```

**People need category:**
```
✅ 45,000 civilians
✅ 12,000 employees
✅ 200 medical staff
❌ 45,000 (45,000 what?)
```

**Comparisons need baseline:**
```
✅ 3x previous record
✅ 50% higher than 2023
✅ Double competitor size
❌ 3x (3x what?)
```

---

### When NOT to Add Context

**Obvious units:**
```
✅ Temperature: 45°C
❌ Temperature: 45°C hot
```

**Clear metrics:**
```
✅ Deaths: 142
❌ Deaths: 142 people
```

**Standard measures:**
```
✅ Distance: 500km
❌ Distance: 500km far
```

**Self-evident:**
```
✅ Market cap: $2.8T
❌ Market cap: $2.8T total value
```

**Rule of thumb:** If removing context doesn't reduce clarity, remove it.

---

## ✅ VALIDATION CHECKLIST

### Before Submitting ANY Detail, Check:

#### Content Validation
- [ ] **NEW information?** Not mentioned anywhere in summary
- [ ] **Quantified?** Uses numbers, not vague descriptions
- [ ] **Relevant?** Directly relates to the story
- [ ] **Accurate?** Can be verified from article content
- [ ] **Valuable?** Adds meaningful context for readers

#### Format Validation
- [ ] **Label length?** 1-3 words maximum
- [ ] **Single colon?** Only one : separator
- [ ] **Number first?** Value starts with metric/number
- [ ] **Context brief?** Maximum 4-5 words after number
- [ ] **Total length?** Under 6-7 words per detail
- [ ] **No sentences?** Uses fragments only

#### Style Validation
- [ ] **Capitalization?** First word of label only
- [ ] **No redundancy?** Doesn't repeat label in value
- [ ] **Clarity?** Instantly understandable at a glance
- [ ] **Consistency?** Matches format of other details

#### Technical Validation
- [ ] **JSON safe?** Properly quoted in JSON
- [ ] **No special chars?** No unescaped quotes or breaks
- [ ] **Spacing?** Proper space after colon
- [ ] **Completeness?** All 3 details present

---

## 🎓 THE FINAL RULE

### If a detail needs more than 5-6 words after the colon, it's probably:

**1. TOO COMPLEX** → Split into multiple details
```
❌ Government response: Emergency $2B aid package approved by 310-95 vote

✅ Emergency aid: $2B
✅ Senate vote: 310-95
```

**2. TOO VAGUE** → Make it more specific
```
❌ Timeline: Several months of negotiations

✅ Timeline: 8 months ongoing
```

**3. WRONG INFORMATION TYPE** → Replace with better metric
```
❌ Reaction: Markets experienced turbulence

✅ Market drop: 2.3%
```

---

## 🎯 THE ULTIMATE GOAL

> **Someone scanning the details section should instantly grasp 3 key supplementary facts without reading full sentences.**

### Success Metrics:
- ⚡ **Scan time:** Under 3 seconds to read all 3
- 📊 **Information density:** Maximum value, minimum words
- 🎨 **Visual impact:** Clean, organized, easy to parse
- 💡 **Value add:** Each detail teaches something new
- ✅ **Accuracy:** Every number can be verified

### The Perfect Detail:
```
Market cap: $2.8T
           ↑    ↑
        Clear   Specific
        label   number
```

**Characteristics:**
- 2 words in label
- 1 specific number
- Optional 1-2 word context
- Total: 3-4 words
- Instantly understandable
- Adds genuine value
- Not in summary
- Properly formatted

---

## 📱 DISPLAY BEHAVIOR

### Desktop View
- 3 details displayed side-by-side
- Equal width columns
- Vertical dividers between items
- Full font sizes (10px label, 20px value)
- Glassmorphism card with blur effect

### Mobile View
- Same 3 details, smaller sizing
- Still side-by-side layout
- Reduced padding and fonts
- 9px label, 16px value
- Maintains glassmorphism

### Interaction
- No hover effects on details
- Static display (not interactive)
- Part of news article card
- Scrolls with content
- Always visible when article is shown

---

## 🔧 IMPLEMENTATION NOTES

### For AI Generators:
1. Always generate exactly 3 details
2. Cross-check against summary word-for-word
3. Prioritize hard numbers and metrics
4. Use hierarchy: Primary → Secondary → Tertiary
5. Validate format before returning
6. Keep under 6-7 words per detail
7. Test in JSON structure

### For Developers:
1. Parse "Label: Value" format
2. Split at first colon only
3. Detect subtitle by matching pattern
4. Apply proper CSS classes
5. Handle mobile responsiveness
6. Maintain glassmorphism styling
7. Equal-width layout for 3 items

### For Content Reviewers:
1. Check for summary duplication
2. Verify all numbers are accurate
3. Ensure proper formatting
4. Test scannability
5. Validate JSON structure
6. Confirm exactly 3 details
7. Check mobile display

---

## 📖 QUICK REFERENCE

### Format Template
```
"[Label 1-3 words]: [Number] [context 2-4 words]"
```

### Word Count Targets
- **Label:** 1-3 words
- **Value:** 1-5 words  
- **Total:** 3-7 words max

### Font Sizes
- **Label:** 10px (desktop), 9px (mobile)
- **Value:** 20px (desktop), 16px (mobile)
- **Subtitle:** 11px (desktop), 10px (mobile)

### Colors
- **Label:** #6b7280 (gray-500)
- **Value Light:** #111827 (near black)
- **Value Dark:** #f9fafb (near white)
- **Subtitle:** #6b7280 (gray-500)

### Priority Order
1. Hard numbers + context
2. Comparisons + rankings
3. Projections + estimates

---

## 💡 PRO TIPS

1. **Think like a reader:** What would YOU want to know that the summary doesn't tell?

2. **Number everything:** If it can be quantified, quantify it.

3. **Be specific:** "47 countries" beats "many countries" every time.

4. **Front-load value:** Put the number first, context second.

5. **Split when stuck:** One long detail → two short details.

6. **Cut ruthlessly:** Every word must earn its place.

7. **Test scannability:** Can you understand it in 1 second?

---

## 🚀 READY TO WRITE?

### Your Process:
1. ✅ Read the summary carefully
2. ✅ Identify what's NOT mentioned
3. ✅ Find 3 quantifiable facts
4. ✅ Format as "Label: Value"
5. ✅ Keep under 6-7 words each
6. ✅ Run validation checklist
7. ✅ Double-check no duplication

### Remember:
- 3 details per article
- New information only
- Numbers over descriptions  
- Concise over verbose
- Scannable over readable
- Facts over opinions

---

## 📞 TROUBLESHOOTING

**Problem:** Detail is too long
**Solution:** Split into 2 separate details or cut unnecessary words

**Problem:** Can't find new information
**Solution:** Look for: dates, amounts, comparisons, background facts, future projections

**Problem:** Detail repeats summary
**Solution:** Find different aspect of story or use secondary/tertiary hierarchy

**Problem:** No hard numbers available
**Solution:** Use comparisons, rankings, or historical context instead

**Problem:** Value needs lots of context
**Solution:** Keep main number in value, move extended context to subtitle

---

## ✨ FINAL CHECKLIST

Before submitting your details array:

```json
{
  "details": [
    "Label: Value",    ← Under 7 words, has number, not in summary
    "Label: Value",    ← Under 7 words, has number, not in summary  
    "Label: Value"     ← Under 7 words, has number, not in summary
  ]
}
```

- [ ] Exactly 3 details
- [ ] All under 6-7 words
- [ ] All include numbers/metrics
- [ ] None repeat summary
- [ ] Proper "Label: Value" format
- [ ] Labels 1-3 words
- [ ] Values number-first
- [ ] No full sentences
- [ ] JSON-safe formatting
- [ ] Visually scannable

---

**YOU'RE READY TO CREATE PERFECT DETAILS! 🎉**

