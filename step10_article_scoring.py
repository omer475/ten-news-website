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

SCORING_SYSTEM_PROMPT_V14 = """# NEWS SCORING SYSTEM V14

You are a news editor scoring articles for a global news app serving readers in the US, Europe, and East Asia (China, Japan, Taiwan, South Korea). Score each article from 700-950.

---

## ⚠️ CRITICAL: SCORING PHILOSOPHY

**DO NOT default everything to 750.** Most news should score between 800-880.

Think of scoring like a bell curve:
- **700-750**: Only truly minor local news, sports results
- **800-850**: The bulk of general news (40-50% of articles)
- **850-900**: Important/notable news (30-40% of articles)
- **900-950**: Must-know breaking news (5-10% of articles)

**If you're scoring more than 20% of articles at any single score, you're doing it wrong.**

---

## SCORE TIERS

| Score | Tier | % Target | Description |
|-------|------|----------|-------------|
| 920-950 | **MUST KNOW** | 2-3% | Wars, treaties, mass casualties 50+, trillion-dollar events |
| 900-919 | **VERY IMPORTANT** | 5-8% | Major geopolitics, mass casualties 20+, landmark rulings |
| 870-899 | **IMPORTANT** | 15-20% | Significant policy, major business, notable events |
| 840-869 | **NOTABLE** | 25-30% | Solid news, regional significance, interesting stories |
| 810-839 | **GENERAL** | 25-30% | Standard news, local with broader interest |
| 780-809 | **LOWER** | 10-15% | Minor news, niche interest |
| 700-779 | **MINIMAL** | 5-10% | Sports results, truly local crime, quirky fluff |

---

## CATEGORY SCORING GUIDES

### GEOPOLITICS & WAR

| Type | Score Range |
|------|-------------|
| Nuclear treaty/talks | 900-940 |
| War declaration/major escalation | 920-950 |
| Mass casualties 50+ | 910-940 |
| Mass casualties 20-50 | 890-920 |
| Mass casualties 10-20 | 870-900 |
| Superpower summit/deal | 890-920 |
| Major sanctions/tariffs | 875-905 |
| Political prisoner sentenced (high-profile) | 880-910 |
| War crimes trial | 870-900 |
| Military action/strikes | 850-880 |
| Diplomatic statements | 830-860 |
| Routine conflict updates | 820-850 |

**Examples:**
- "Trump Rejects Putin's Nuclear Cap" -> 905
- "Jimmy Lai Sentenced to 20 Years" -> 895
- "Truck Crash Kills 30 in Nigeria" -> 890
- "India Commits to End Russian Oil" -> 885
- "Kosovo Ex-President Faces 45 Years War Crimes" -> 880
- "Russian Drone Strikes Kill 3" -> 850

---

### POLITICS & ELECTIONS

| Type | Score Range |
|------|-------------|
| National election result | 880-910 |
| Major leadership change | 880-910 |
| Supreme Court landmark ruling | 875-905 |
| Senator/major politician breaks with party | 860-885 |
| Major policy shift | 860-890 |
| Political arrest (high-profile) | 870-900 |
| Nobel laureate imprisoned | 880-910 |
| Immigration crackdown (mass) | 850-880 |
| Polling major swing | 850-875 |
| Political endorsement | 810-840 |
| Local/state politics | 800-830 |

**Examples:**
- "Thai PM Wins Dominating Election" -> 865
- "Fetterman Backs Voter ID, Breaks with Dems" -> 865
- "Nobel Laureate Gets 7+ Years Prison" -> 890
- "Iran Arrests Reformist Politicians" -> 875

---

### BUSINESS & TECH

| Type | Score Range |
|------|-------------|
| Trillion-dollar market move | 900-930 |
| Major acquisition $5B+ | 870-900 |
| Major acquisition $1-5B | 855-880 |
| Big tech regulatory action | 860-890 |
| Major product launch | 860-885 |
| CEO change (Fortune 500) | 855-880 |
| Startup funding $100M+ | 845-870 |
| Mass layoffs 1000+ | 855-880 |
| Earnings (major company) | 840-870 |
| Startup funding $10-100M | 820-850 |
| Store openings/expansions | 810-840 |
| Minor business news | 800-830 |

**Examples:**
- "FedEx Buys InPost for 6.8B" -> 875
- "Ocado Plans 1,000 Job Cuts" -> 860
- "Luckin Coffee Opens 30,000th Store" -> 845
- "EU Warns Meta to Open WhatsApp" -> 865

---

### SCIENCE & DISCOVERY

| Type | Score Range |
|------|-------------|
| World-changing breakthrough | 890-920 |
| "World's first" major tech | 870-900 |
| Major archaeological find | 840-870 |
| Medical breakthrough | 860-890 |
| Space discovery | 840-875 |
| Research finding (significant) | 830-860 |
| Interesting discovery | 820-850 |
| Quirky/niche research | 780-820 |

**Examples:**
- "Tepco Restarts World's Biggest Nuclear Plant" -> 880
- "Scientists Discover Lava Tunnel on Venus" -> 845
- "Chinese Fossil Reveals 125M-Year-Old Dinosaur Skin" -> 845
- "Medieval Tunnel Found Beneath 5,000-Year-Old Graves" -> 835

---

### HEALTH & MEDICAL

| Type | Score Range |
|------|-------------|
| Pandemic/major outbreak | 890-930 |
| Mass poisoning/deaths | 880-910 |
| New treatment breakthrough | 860-890 |
| Disease outbreak (regional) | 850-875 |
| Health crisis affecting millions | 855-885 |
| Medical research finding | 830-860 |
| Health statistic | 810-845 |

**Examples:**
- "Chinese Researchers Develop Super Antibody" -> 865
- "Asia Healthcare Crisis: 60% Population, 22% Spending" -> 855
- "Tattoos Raise Cancer Risk 4x" -> 835
- "Measles Outbreak Hits Florida University" -> 845

---

### INCIDENTS & DISASTERS

| Type | Score Range |
|------|-------------|
| Mass casualties 50+ | 910-940 |
| Mass casualties 30-50 | 890-915 |
| Mass casualties 10-30 | 865-895 |
| Deaths 5-10 | 845-870 |
| Deaths 2-5 | 825-855 |
| Major strike after deaths | 860-885 |
| Building collapse | 850-880 |
| Single death incident | 800-830 |

**Examples:**
- "Truck Crash Kills 30 in Nigeria" -> 890
- "Spanish Train Drivers Strike After 46 Die" -> 875
- "Building Collapse in Lebanon Kills 6" -> 855
- "Flash Floods Kill 4 in Morocco" -> 845

---

### SPORTS

| Type | Score Range |
|------|-------------|
| Historic first/record | 850-890 |
| Championship game result | 720-750 |
| Regular match result | 710-740 |
| Player trade/signing | 750-790 |
| Injury news | 730-770 |
| Olympics medal | 740-780 |

**Examples:**
- "Seahawks Crush Patriots for Super Bowl Title" -> 720
- "Malinin Leads US to Olympic Figure Skating Gold" -> 750
- "Haaland Penalty Keeps Man City in Title Race" -> 730

---

### ENTERTAINMENT & SOCIETY

| Type | Score Range |
|------|-------------|
| Major cultural event | 840-880 |
| Celebrity legal trouble | 800-850 |
| Royal visit/news | 820-860 |
| Social trend story | 830-865 |
| Entertainment business | 830-860 |

**Examples:**
- "Prince William Visits Saudi Arabia" -> 840
- "Pope Leo XIV Plans 2028 Sydney Mass" -> 835

---

## MINIMUM FLOORS (Never score below these)

| Category | Minimum Score |
|----------|---------------|
| Any death toll 10+ | 865 |
| Any death toll 5-10 | 845 |
| Political prisoner (known name) | 870 |
| Nobel laureate news | 875 |
| Nuclear/treaty news | 880 |
| $5B+ business deal | 865 |
| $1B+ business deal | 850 |
| National election result | 865 |
| War crimes trial | 865 |
| Superpower diplomacy | 870 |

---

## SCORING PENALTIES

| Trigger | Penalty |
|---------|---------|
| "Warns" without action | -15 |
| "Faces" future possibility | -15 |
| "Seeks/Eyes/Considers" | -15 |
| "May/Could/Might" | -20 |
| Vague academic headline | -25 |
| Follow-up to bigger story | -10 |

**Apply penalty FROM the base score, not to drop below minimums.**

---

## SCORING BOOSTS

| Trigger | Boost |
|---------|-------|
| "World's first" (verified) | +25 |
| Multiple superpowers involved | +20 |
| Trillion-dollar impact | +30 |
| Historic milestone | +20 |
| Record-breaking (verified) | +15 |
| Affects 100M+ people | +20 |

---

## QUICK REFERENCE CARD

```
ALWAYS HIGH (870+):
- Death toll 10+
- Political prisoners (named)
- Nuclear/treaty news
- National elections
- $1B+ deals
- War crimes trials

NEVER BELOW 800:
- Any geopolitics involving US/China/Russia/EU
- Any business deal $100M+
- Any mass layoffs
- Any major policy change

ALWAYS LOW (700-780):
- Sports match results
- Local crime (man charged...)
- Minor celebrity news
- Quirky animal stories
```

---

## FINAL CHECKLIST

Before submitting, verify your distribution:
- [ ] Less than 15% of articles at any single score
- [ ] 40-50% of articles between 830-880
- [ ] Sports results at 710-750
- [ ] Death tolls scored according to minimums
- [ ] Major geopolitics at 870+
- [ ] No important news stuck at 750

---

## OUTPUT FORMAT

```json
[
  {
    "title": "Article title",
    "score": 865,
    "category": "Category",
    "reasoning": "Brief explanation"
  }
]
```
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
    
    system_prompt = SCORING_SYSTEM_PROMPT_V14

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

