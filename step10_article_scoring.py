#!/usr/bin/env python3
"""
STEP 10: ARTICLE SCORING SYSTEM
==========================================
Purpose: Score written articles from 0-1000 for display priority
Model: Gemini 2.0 Flash
Input: Written article (title + bullets) + reference articles from Supabase
Output: Score (0-1000) for display ranking
"""

import os
import requests
import json
import time
import random
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SCORING_SYSTEM_PROMPT_V4 = """# TEN NEWS - ARTICLE SCORING SYSTEM V4

---

## YOUR ROLE

You are the **Chief Editor of Ten News**, scoring approved articles from 700-1000 to determine display priority.

---

## CRITICAL RULE: 900+ IS FOR ANY CATEGORY

**900+ is "Must-Know News" - NOT "Must-Know World/Politics News"**

A Tech, Business, Health, Science, or Finance story can absolutely score 900+ if it meets the must-know criteria. The question is NOT "Is this geopolitically important?" but rather:

> **"Would a well-informed professional be embarrassed to not know this tomorrow?"**

---

## THE 900+ MUST-KNOW TEST

Before assigning a score, ask these THREE questions:

### Question 1: Scale Test
> "Does this affect 100M+ people, involve $1T+, or change an entire industry?"

### Question 2: Conversation Test
> "Will people be talking about this at dinner parties and work meetings?"

### Question 3: History Test
> "Will this be remembered in 1 year? 5 years?"

**If YES to 2+ questions → Can be 900+**
**If YES to all 3 → Should be 920+**

---

## 900+ EXAMPLES BY CATEGORY

### Tech (900+)
| Example | Score | Why Must-Know |
|---------|-------|---------------|
| Alphabet Hits $4 Trillion Market Cap | 920 | Historic milestone, affects all investors |
| Apple Overtakes Samsung as Top Smartphone | 915 | Industry #1 shift, affects billions of users |
| Apple Partners with Google After AI Defeat | 910 | Two biggest tech companies partnering - historic |
| Major Platform Breach (10M+ users) | 910 | Affects millions directly |
| UK Bans AI-Generated Nude Images | 900 | Major policy precedent, affects AI industry |
| MIT 10x Faster Quantum Cooling | 905 | Game-changing breakthrough |

### Business (900+)
| Example | Score | Why Must-Know |
|---------|-------|---------------|
| EU-Mercosur Sign 25-Year Mega Trade Deal | 920 | Creates world's largest trade zone |
| BYD Overtakes Tesla as #1 EV Maker | 915 | Industry leadership shift |
| Major Retailer Bankruptcy (Saks, etc.) | 905 | Affects thousands of jobs, shopping habits |
| Amazon/Google/Apple Major Acquisition ($10B+) | 910 | Reshapes industry |

### Health (900+)
| Example | Score | Why Must-Know |
|---------|-------|---------------|
| US Overdose Deaths Drop 21% - Historic Decline | 910 | Biggest health win in decades |
| World's First Robotic Brain Surgery | 905 | Medical milestone |
| New Drug Cures Major Disease | 920 | Changes millions of lives |
| WHO Declares Pandemic/Emergency | 935 | Global health crisis |

### Finance (900+)
| Example | Score | Why Must-Know |
|---------|-------|---------------|
| BlackRock Hits $14 Trillion Assets | 910 | Largest asset manager milestone |
| Major Currency Collapse (20%+) | 920 | Affects entire economy |
| Stock Market Circuit Breaker Triggered | 930 | Historic market event |
| Central Bank Surprise Rate Decision | 910 | Affects all borrowers |

### Science (900+)
| Example | Score | Why Must-Know |
|---------|-------|---------------|
| Einstein/Major Theory Proven Wrong | 920 | Rewrites science books |
| Mars/Moon Landing Milestone | 915 | Space history |
| Climate Record with Immediate Impact | 910 | Affects policy worldwide |
| Cure/Vaccine Breakthrough | 920 | Changes human health |

### Politics (900+)
| Example | Score | Why Must-Know |
|---------|-------|---------------|
| NATO Countries Favor China Over US | 920 | Massive geopolitical shift |
| US Military Operation in Foreign Country | 930 | War/conflict |
| Major Leader Assassination/Death | 940 | Historic |
| Country Exits Major Treaty | 915 | International relations shift |

---

## SCORE TIERS

### 920-950: Historic / Once-a-Month Events
- War/military operations
- $1T+ milestones
- Industry #1 shifts
- Historic scientific discoveries
- Mass casualty events (100+)
- Major treaty/alliance changes

### 900-919: Must-Know
- $100B+ business events
- Major policy changes affecting millions
- World firsts
- 50%+ statistical changes
- Industry-reshaping events
- Tech giant major moves

### 880-899: Very Important
- Significant international events
- Major company news
- Scientific breakthroughs
- Health developments
- $10B+ deals

### 850-879: Important
- Notable news across categories
- Significant but not must-know
- Good business/tech stories
- Interesting science

### 800-849: Good News
- Solid stories
- Regional with broader interest
- Updates on major stories
- Routine but newsworthy

### 750-799: Worth Reading
- Niche but interesting
- Regional stories
- Minor updates
- Feature pieces

### 700-749: Lower Priority
- Very niche
- Routine announcements
- Local interest

---

## MUST-KNOW TRIGGERS (Auto-Consider 900+)

When you see these patterns, CONSIDER 900+:

### Numbers
- **$1 Trillion+** → Likely 910+
- **$100 Billion+** → Consider 900+
- **100 Million+ people affected** → Likely 905+
- **50%+ change** → Consider 900+
- **"Record"/"First"/"Largest"** at global scale → Consider 900+

### Events
- **Industry #1 shifts** (X overtakes Y) → Likely 910+
- **Major company partnerships** (Apple + Google) → Consider 910+
- **World's First** (medical, tech, science) → Likely 905+
- **Historic milestone** (longest, biggest, first) → Consider 900+
- **Major policy affecting millions** → Consider 900+

### Categories
- **Tech giant major news** → Consider 900+ if affects users
- **Health breakthrough/crisis** → Consider 900+
- **Trade deals creating mega zones** → Likely 910+
- **Scientific discoveries rewriting books** → Likely 910+

---

## APPLY THIS TO CURRENT BATCH

Looking at stories like these, they SHOULD be 900+:

| Current Score | Story | Should Be | Why |
|---------------|-------|-----------|-----|
| 880 | EU-Mercosur Sign 25-Year Trade Deal | **920** | Creates largest trade zone |
| 885 | US Overdose Deaths Drop 21% | **910** | Historic health milestone |
| 875 | World's First Robotic Brain Surgery | **905** | Medical breakthrough |
| 870 | Apple Partners with Google | **910** | Tech giants historic partnership |
| 870 | UK Bans AI Nude Images | **900** | Major AI policy precedent |
| 860 | BlackRock Hits $14T Assets | **910** | Largest asset manager milestone |
| 870 | NATO Countries Favor China Over US | **920** | Massive geopolitical shift |
| 885 | MIT 10x Faster Quantum Cooling | **905** | Tech breakthrough |

---

## WHAT'S NOT 900+ (Common Mistakes)

### These Should NOT Be 900+:
| Story Type | Correct Score | Why Not 900+ |
|------------|---------------|--------------|
| Follow-up without new info | 830-860 | Not breaking |
| Profile piece on key figure | 820-850 | Feature, not news |
| Photo roundup | 780-820 | Not news |
| Routine quarterly earnings | 800-840 | Expected |
| Small-scale incident (3 killed) | 840-870 | Sadly routine |
| Single company funding round | 820-860 | Not must-know |
| Product launch (even major) | 850-880 | Unless revolutionary |
| Opinion/analysis piece | 800-850 | Not news |

---

## SCORE DISTRIBUTION TARGETS

| Tier | Target % |
|------|----------|
| 900+ | 10-15% |
| 880-899 | 15-20% |
| 850-879 | 20-25% |
| 800-849 | 25-30% |
| 750-799 | 10-15% |
| 700-749 | 5-10% |

---

## FINAL CHECK BEFORE SUBMITTING

Ask yourself:

1. **Is 900+ diverse?** Not just World/Politics - do Tech, Business, Health, Science stories have 900+ if deserving?

2. **Did I apply the Must-Know Test?** Would someone be embarrassed to not know this?

3. **Did I catch the big numbers?** $1T+, 100M+ users, 50%+ changes, industry #1 shifts?

4. **Did I penalize non-news?** Follow-ups, profiles, roundups should be lower.

5. **Am I using the full range?** 700-950, not just 850-920.

---

## OUTPUT FORMAT

```json
{
  "scores": [
    {"title": "EU-Mercosur Sign 25-Year Mega Trade Deal", "score": 920},
    {"title": "US Overdose Deaths Drop 21% in Historic Decline", "score": 910},
    {"title": "BlackRock Hits $14T Assets After Record Year", "score": 910},
    {"title": "Apple Partners with Google After AI Defeat", "score": 910},
    {"title": "World's First Robotic Brain Surgery Complete", "score": 905},
    {"title": "Iran Uses Killing Zones to Massacre Protesters", "score": 935}
  ]
}
```

---

## REMEMBER

**Must-Know = Any Category**

A tech milestone ($4T market cap), a health breakthrough (21% overdose drop), a business shift (BYD beats Tesla), or a scientific discovery (Einstein proven wrong) can ALL be must-know news.

Don't let World/Politics monopolize 900+. If someone would be embarrassed to not know a Tech or Health story, it deserves 900+.

---

*Ten News Article Scoring System V4*
*"Must-know news from every field"*
"""


def get_supabase_client() -> Client:
    """Get Supabase client"""
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    return create_client(url, key)


def get_reference_articles(supabase: Client, limit: int = 20) -> List[Dict]:
    """
    Fetch recently scored articles from Supabase to use as calibration references.
    Returns a diverse set of articles across different score ranges.
    """
    try:
        # Fetch recent articles with scores
        result = supabase.table('published_articles')\
            .select('title_news, ai_final_score, category')\
            .order('created_at', desc=True)\
            .limit(limit)\
            .execute()
        
        if not result.data:
            return []
        
        articles = result.data
        
        # Group by score ranges and pick diverse examples
        high_scorers = [a for a in articles if a.get('ai_final_score', 0) >= 900]
        mid_high = [a for a in articles if 850 <= a.get('ai_final_score', 0) < 900]
        mid_scorers = [a for a in articles if 800 <= a.get('ai_final_score', 0) < 850]
        mid_low = [a for a in articles if 750 <= a.get('ai_final_score', 0) < 800]
        low_scorers = [a for a in articles if a.get('ai_final_score', 0) < 750]
        
        # Select diverse reference set
        references = []
        
        # Pick 1-2 from each range if available
        if high_scorers:
            references.extend(random.sample(high_scorers, min(2, len(high_scorers))))
        if mid_high:
            references.extend(random.sample(mid_high, min(2, len(mid_high))))
        if mid_scorers:
            references.extend(random.sample(mid_scorers, min(2, len(mid_scorers))))
        if mid_low:
            references.extend(random.sample(mid_low, min(1, len(mid_low))))
        if low_scorers:
            references.extend(random.sample(low_scorers, min(1, len(low_scorers))))
        
        # Sort by score descending for clear presentation
        references.sort(key=lambda x: x.get('ai_final_score', 0), reverse=True)
        
        return references[:8]  # Return max 8 references
        
    except Exception as e:
        print(f"⚠️ Could not fetch reference articles: {e}")
        return []


def score_article(
    title: str,
    bullets: List[str],
    api_key: str,
    reference_articles: Optional[List[Dict]] = None,
    max_retries: int = 3
) -> int:
    """
    Score a written article from 0-1000 using Gemini with reference calibration.
    
    Args:
        title: Article title
        bullets: Summary bullets
        api_key: Google AI API key
        reference_articles: Previously scored articles for calibration
        max_retries: Maximum retry attempts
    
    Returns:
        Score from 0-1000
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    system_prompt = SCORING_SYSTEM_PROMPT_V4

    # Legacy prompt kept for reference (not used)
    _SCORING_SYSTEM_PROMPT_V3 = """# TEN NEWS - ARTICLE SCORING SYSTEM V3

---

## YOUR ROLE

You are the **Chief Editor of Ten News**, scoring approved articles from 700-1000 to determine display priority.

**CRITICAL RULES:**
1. **900+ is RARE** - Only 10-15% of articles should score 900+
2. **Any category can reach 900+** - Not just World/Politics
3. **Use the FULL range** - 700-1000, not just 850-950
4. **Engaging content matters** - A record-breaking science story CAN outscore a routine political update

---

## SCORE DISTRIBUTION TARGETS

Before scoring, remember these targets:

| Tier | Target % | Description |
|------|----------|-------------|
| 900+ | 10-15% | Must-Know (truly essential) |
| 880-899 | 15-20% | High Priority (very important or highly engaging) |
| 850-879 | 20-25% | Significant (important stories) |
| 800-849 | 25-30% | Good (solid news) |
| 750-799 | 15-20% | Worth Reading (interesting but narrower) |
| 700-749 | 5-10% | Lower Priority (niche or routine) |

**If you're scoring 30%+ at 900+, you're doing it wrong.**

---

## THE 900+ GATE (STRICT)

Before assigning 900+, the article MUST pass this test:

### The "Must-Know" Test
> "If a business professional missed this story, would they be embarrassed in a meeting tomorrow?"

- YES → Can be 900+
- NO → Cap at 880

### The "Breaking" Test
> "Is this happening NOW or is it analysis/follow-up/profile?"

- Breaking news → Can be 900+
- Analysis/profile/follow-up → Cap at 870

### The "Scale" Test
> "Does this directly affect 100M+ people OR change international relations?"

- YES → Can be 900+
- NO → Cap at 880

**ALL THREE must be YES for 900+**

---

## 900+ CRITERIA BY CATEGORY

### World/Politics (900+)
✅ QUALIFIES:
- Active military operations (US strikes, invasions)
- Death toll updates in major conflicts (50+ new deaths)
- Major diplomatic breakthroughs or breakdowns
- New sanctions affecting multiple countries
- Leadership changes in major powers
- Crisis escalations (protests spreading to 100+ cities)

❌ DOES NOT QUALIFY (cap at 850-880):
- Follow-up stories without new developments
- Profile pieces about key figures
- Photo roundups
- Symbolic incidents (flag replacement, protests at embassies)
- Small-scale incidents (3 killed in routine conflict)
- Historical meetings (not current)
- Migrant/refugee human interest angles

### Tech (900+)
✅ QUALIFIES:
- Data breaches affecting 10M+ users
- AI breakthrough changing industry landscape
- Major platform policy change affecting 100M+ users
- Tech giant antitrust ruling
- Critical infrastructure attack/failure

❌ DOES NOT QUALIFY (cap at 850-880):
- Product launches (even major ones)
- Executive changes
- Funding rounds (even $1B+)
- Algorithm updates
- Feature releases

### Science (900+)
✅ QUALIFIES:
- Discovery that rewrites textbooks
- Space "first" (first landing, first image of X)
- Climate record with immediate policy implications
- Medical breakthrough with mass application
- Extinction-level or pandemic-level findings

❌ DOES NOT QUALIFY (cap at 850-880):
- Interesting research findings
- New species discovered
- Space mission updates (routine)
- Studies about health trends

### Business (900+)
✅ QUALIFIES:
- Industry #1 leadership change (BYD beats Tesla)
- $50B+ deals or bankruptcies
- Major market crash (5%+ single day)
- Trade war escalation with new tariffs
- Central bank surprise decision

❌ DOES NOT QUALIFY (cap at 850-880):
- Quarterly earnings (even record)
- Executive changes
- $10B deals (significant but not 900+)
- Market movements under 3%

### Health (900+)
✅ QUALIFIES:
- Pandemic declarations
- Vaccine approvals for major diseases
- Drug recalls affecting millions
- Health policy affecting entire countries

❌ DOES NOT QUALIFY (cap at 850-880):
- Research findings
- Hospital system news
- Regional health crises

### Finance (900+)
✅ QUALIFIES:
- Currency collapse (20%+ drop)
- Central bank emergency action
- Sovereign debt crisis
- Market circuit breakers triggered

❌ DOES NOT QUALIFY (cap at 850-880):
- Interest rate decisions (expected)
- Bond issuances
- Market records (unless historic)

---

## ENGAGEMENT MULTIPLIERS

Apply AFTER base scoring. These can push stories UP:

| Factor | Boost | Example |
|--------|-------|---------|
| Record/First/Largest EVER | +40 | "Largest planet-forming disk ever captured" |
| Shocking statistic (100%+) | +50 | "Tickets surge 2,600%" |
| Industry #1 shift | +40 | "BYD overtakes Tesla" |
| Affects 100M+ people | +40 | "Instagram breach exposes 17.5M" |
| End of era / Historic | +40 | "Buffett steps down after 60 years" |
| Mind-blowing science | +40 | "Einstein proven wrong after 98 years" |
| Major $ amount ($10B+) | +30 | "Corporate bonds hit $2.25T" |
| Controversial / Provocative | +30 | "ICE Christmas ad shows Santa detaining" |
| US vs China competition | +30 | "NASA races China to Mars" |
| Wow factor / Shareable | +30 | "Dog-size dinosaur with spike claws" |

---

## SCORE PENALTIES

Apply to LOWER scores appropriately:

| Factor | Penalty | Example |
|--------|---------|---------|
| Follow-up without new info | -50 | "Situation continues" |
| Profile/feature piece | -40 | "Stephen Miller emerges as..." |
| Photo roundup | -80 | "Week in photos captures..." |
| Historical (not current) | -50 | "Putin met Maduro in May" |
| Small scale incident | -40 | "3 killed in..." (routine conflict) |
| Symbolic without policy change | -40 | "Protesters replace flag" |
| Single source / unconfirmed | -30 | Rumors, speculation |
| Expected outcome | -30 | "Winner takes office" |

---

## SCORING EXAMPLES

### CORRECT 900+ Scores:

| Score | Title | Why 900+ |
|-------|-------|----------|
| 940 | US Forces Capture Maduro in Venezuela Strike | Breaking, military op, changes region |
| 935 | Iran Protests Leave Dozens Dead, Crackdown Intensifies | Breaking, mass casualties, crisis |
| 930 | China Accelerates AI Military Push for Taiwan | Major power, military, breaking |
| 920 | Instagram Breach Exposes 17.5M Users | 17.5M affected, security crisis |
| 915 | Stanford AI Predicts 130 Diseases From Sleep | Breakthrough, affects millions |

### INCORRECT 900+ (Should be lower):

| Current | Title | Should Be | Why Lower |
|---------|-------|-----------|-----------|
| 915 | Venezuelan Migrants Cautious Despite Maduro's Fall | 860 | Human interest, not breaking |
| 915 | Protesters Replace Iran Embassy Flag in London | 850 | Symbolic, no policy change |
| 910 | Stephen Miller Emerges as Trump's Chief Ideologue | 850 | Profile piece |
| 910 | Israeli Fire Kills 3 Palestinians | 860 | Small scale, sadly routine |
| 905 | Week in Photos Captures Gaza, Syria | 800 | Photo roundup, not news |
| 905 | Putin Meets Maduro at Kremlin in May | 840 | Historical, not current |

### HIGH-SCORING Non-Political:

| Score | Title | Category | Why High |
|-------|-------|----------|----------|
| 895 | Stanford AI Predicts 130 Diseases From Sleep | Health | Breakthrough, affects millions |
| 890 | Hubble Captures Largest Planet-Forming Disk Ever | Science | Record, wow factor |
| 890 | Instagram Breach Exposes 17.5M Users | Tech | Massive scale |
| 885 | MIT Student Develops Nuclear Propulsion for Mars | Science | Innovation, space |
| 885 | Corporate Bonds Surge to $2.25T Record | Finance | Record, market impact |
| 880 | Dog-Size Dinosaur Reveals Spike-Covered Claws | Science | Wow factor, shareable |
| 875 | FCC Approves 7,500 More Starlink Satellites | Tech | Major decision, scale |

### MID-RANGE (800-860):

| Score | Title | Why This Score |
|-------|-------|----------------|
| 860 | Japan Hosts Record 15 Nations in Island Defense | Significant but not must-know |
| 850 | US Adds Just 584K Jobs in 2025 | Economic data, important |
| 840 | Ancient Tomb Reveals King Midas Era Secrets | Interesting but niche |
| 830 | Goldman Sachs Siblings Both Rise to Partner | Business interest story |
| 820 | Nepal Royalists Rally for Monarchy | Regional politics |

### LOWER RANGE (750-799):

| Score | Title | Why This Score |
|-------|-------|----------------|
| 780 | Prada Partners with Indian Artisans | Business feature |
| 760 | Hong Kong Plans Bond Issuance | Regional finance |
| 750 | Japan Launches Forest Impact System | Niche business |

---

## REFERENCE-BASED SCORING

You will receive previously scored articles. Use them as anchors:

**If reference shows:**
```
"Iran Protests Spread to 340 Cities" | 930
```
→ New Iran protest update with 50+ deaths: 920-935
→ Small protest incident: 850-870

**If reference shows:**
```
"Hubble Captures Largest Disk Ever" | 890
```
→ Similar record science: 880-900
→ Routine space update: 800-830

**CRITICAL:** Don't let political news dominate 900+. If references show all 900+ as World/Politics, actively look for Tech/Science/Business stories that deserve 900+.

---

## FINAL CHECKLIST BEFORE SUBMITTING

Before finalizing scores, verify:

- [ ] Is 900+ reserved for only 10-15% of articles?
- [ ] Are there non-political stories in the 880-900 range?
- [ ] Are there articles in the 750-799 range?
- [ ] Did I apply penalties to follow-ups, profiles, photo roundups?
- [ ] Did I apply boosts to records, breakthroughs, wow-factor stories?

---

## OUTPUT FORMAT

Return a JSON object with the score:

```json
{
  "score": 850
}
```

Just return the score, nothing else.

---

## REMEMBER

1. **900+ is RARE** - Only 10-15%, not 35%+
2. **Any category can be must-know** - Tech breach, science record, business shift
3. **Use the full range** - 700-1000, not just 850-940
4. **Penalize non-breaking content** - Profiles, roundups, follow-ups score lower
5. **Boost engagement** - Records, wow-factor, shocking stats get higher scores
6. **Balance the feed** - Don't let World/Politics monopolize top positions

Your readers want:
- What they NEED to know (breaking global news)
- What they'll WANT to share (engaging, surprising content)

Both deserve visibility. Score accordingly.

---

*Ten News Article Scoring System V3*
*"Must-know news AND must-share stories"*
"""
    
    # Build the article text
    article_text = "Score this article. Return JSON with score only.\n\n"
    
    # Add reference articles if available
    if reference_articles:
        article_text += "**REFERENCE ARTICLES (for calibration):**\n"
        for ref in reference_articles:
            score = ref.get('ai_final_score', 0)
            title_ref = ref.get('title_news', 'Unknown')[:80]
            article_text += f'"{title_ref}" | {score}\n'
        article_text += "\n"
    
    # Add the article to score
    article_text += "**ARTICLE TO SCORE:**\n"
    article_text += f"Title: {title}\n"
    article_text += "Bullets:\n"
    for bullet in bullets:
        article_text += f"- {bullet}\n"
    
    article_text += '\nReturn JSON: {"score": XXX}'
    
    # Prepare request
    request_data = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": article_text}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.2,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json"
        }
    }
    
    # Retry logic
    for attempt in range(max_retries):
        try:
            response = requests.post(url, json=request_data, timeout=60)
            
            if response.status_code == 429:
                wait_time = (2 ** attempt) * 15
                if attempt < max_retries - 1:
                    print(f"  ⚠️ Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  ❌ Rate limit exceeded")
                    return 750  # Default score on failure
            
            response.raise_for_status()
            result = response.json()
            
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    response_text = candidate['content']['parts'][0]['text']
                    
                    # Parse JSON response
                    try:
                        parsed = json.loads(response_text)

                        # Preferred format: {"score": 850}
                        if isinstance(parsed, dict) and 'score' in parsed:
                            score = parsed.get('score', 750)
                        # V4 alternative format: {"scores": [{"title": "...", "score": 920}, ...]}
                        elif isinstance(parsed, dict) and isinstance(parsed.get('scores'), list):
                            scores = parsed.get('scores') or []
                            # Try to match by title; otherwise fall back to first score
                            best = None
                            for item in scores:
                                if not isinstance(item, dict):
                                    continue
                                if str(item.get('title', '')).strip().lower() == str(title).strip().lower():
                                    best = item
                                    break
                            if best is None and scores:
                                best = scores[0] if isinstance(scores[0], dict) else None
                            score = (best or {}).get('score', 750)
                        else:
                            score = 750
                        
                        # Validate score range
                        score = max(0, min(1000, int(score)))
                        return score
                        
                    except json.JSONDecodeError:
                        # Try to extract score from text
                        import re
                        match = re.search(r'"score"\s*:\s*(\d+)', response_text)
                        if match:
                            return max(0, min(1000, int(match.group(1))))
                        return 750  # Default
            
            return 750  # Default on parsing failure
            
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 5
                print(f"  ⚠️ Request error, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
                continue
            print(f"  ❌ Scoring failed: {e}")
            return 750  # Default score on failure
        except Exception as e:
            print(f"  ❌ Unexpected error in scoring: {e}")
            return 750  # Default score on failure
    
    return 750  # Default if all retries fail


def score_article_with_references(
    title: str,
    bullets: List[str],
    api_key: str,
    supabase: Optional[Client] = None
) -> int:
    """
    Score an article with automatic reference fetching from Supabase.
    
    Args:
        title: Article title
        bullets: Summary bullets
        api_key: Google AI API key
        supabase: Supabase client (optional, will create if not provided)
    
    Returns:
        Score from 0-1000
    """
    if supabase is None:
        supabase = get_supabase_client()
    
    # Fetch reference articles
    references = get_reference_articles(supabase)
    
    if references:
        print(f"   📊 Using {len(references)} reference articles for calibration")
    else:
        print(f"   ⚠️ No reference articles found, scoring without calibration")
    
    # Score the article
    return score_article(title, bullets, api_key, references)


# ============================================================
# INTEREST TAGS GENERATION (for personalization)
# ============================================================

INTEREST_TAGS_PROMPT = """You are a news content tagger. Extract 4-8 keywords/tags from this article for personalization matching.

**Rules:**
1. Include a MIX of:
   - **Entities**: Specific people, companies, places (e.g., "elon musk", "tesla", "california")
   - **Topics**: General themes (e.g., "electric vehicles", "artificial intelligence", "climate change")
   - **Categories**: Broad areas (e.g., "tech", "politics", "finance", "health")

2. Keywords should be:
   - Lowercase
   - 1-3 words each
   - Specific enough to be useful for matching
   - A mix of narrow (specific) and broad (general) terms

3. Return ONLY a JSON array of strings, nothing else.

**Examples:**

Article: "Tesla Stock Surges 15% After Record Q4 Deliveries"
["tesla", "elon musk", "electric vehicles", "stock market", "automotive", "tech", "earnings"]

Article: "WHO Declares New Vaccine 95% Effective Against Bird Flu"
["world health organization", "bird flu", "vaccine", "pandemic", "health", "medicine", "infectious disease"]

Article: "Apple and Google Partner on AI After Siri Struggles"
["apple", "google", "artificial intelligence", "siri", "tech partnership", "big tech", "voice assistant"]

---

**Article to tag:**
Title: {title}
Summary: {summary}

**Return ONLY the JSON array:**"""


def generate_interest_tags(
    title: str,
    bullets: List[str],
    api_key: str,
    max_retries: int = 2
) -> List[str]:
    """
    Generate 4-8 interest tags for an article using Gemini.
    
    Args:
        title: Article title
        bullets: Summary bullets
        api_key: Google AI API key
        max_retries: Number of retry attempts
    
    Returns:
        List of 4-8 keyword strings for personalization matching
    """
    summary = " | ".join(bullets) if bullets else ""
    
    prompt = INTEREST_TAGS_PROMPT.format(title=title, summary=summary)
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 200
        }
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.post(url, json=payload, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '').strip()
                
                # Parse JSON array
                # Handle potential markdown code blocks
                if '```' in text:
                    text = text.split('```')[1]
                    if text.startswith('json'):
                        text = text[4:]
                    text = text.strip()
                
                tags = json.loads(text)
                
                # Validate
                if isinstance(tags, list) and 4 <= len(tags) <= 8:
                    # Ensure all lowercase strings
                    tags = [str(t).lower().strip() for t in tags if t]
                    print(f"   🏷️ Generated {len(tags)} interest tags: {tags[:3]}...")
                    return tags
                elif isinstance(tags, list) and len(tags) > 0:
                    # Accept any valid list, just limit to 8
                    tags = [str(t).lower().strip() for t in tags[:8] if t]
                    print(f"   🏷️ Generated {len(tags)} interest tags: {tags[:3]}...")
                    return tags
                    
            elif response.status_code == 429:
                time.sleep(2 ** attempt)
                continue
                
        except json.JSONDecodeError as e:
            print(f"   ⚠️ Tag parsing error (attempt {attempt + 1}): {e}")
        except Exception as e:
            print(f"   ⚠️ Tag generation error (attempt {attempt + 1}): {e}")
        
        time.sleep(0.5)
    
    # Fallback: extract simple keywords from title
    print(f"   ⚠️ Falling back to title-based tags")
    fallback_tags = extract_fallback_tags(title)
    return fallback_tags


def extract_fallback_tags(title: str) -> List[str]:
    """
    Extract basic keywords from title as fallback if Gemini fails.
    """
    # Common stop words to exclude
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
        'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
        'his', 'her', 'their', 'our', 'your', 'my', 'who', 'what', 'when',
        'where', 'why', 'how', 'which', 'new', 'says', 'after', 'over'
    }
    
    # Clean and split title
    import re
    words = re.findall(r'[a-zA-Z]+', title.lower())
    
    # Filter and take meaningful words
    keywords = [w for w in words if w not in stop_words and len(w) > 2]
    
    # Return up to 6 unique keywords
    seen = set()
    unique = []
    for w in keywords:
        if w not in seen:
            seen.add(w)
            unique.append(w)
            if len(unique) >= 6:
                break
    
    return unique if unique else ["news", "update"]


if __name__ == "__main__":
    # Test the function
    test_title = "Russia Launches 61 Drones, Kills 2 in Ukraine Strike"
    test_bullets = [
        "Russian missiles hit Ukrainian power grid overnight",
        "Over 1 million people without electricity in Kharkiv",
        "Third major infrastructure attack this month",
        "Zelensky calls for more air defense systems"
    ]
    
    api_key = os.getenv('GOOGLE_AI_KEY')
    if api_key:
        score = score_article_with_references(test_title, test_bullets, api_key)
        print(f"Score: {score}")
    else:
        print("No API key found")

