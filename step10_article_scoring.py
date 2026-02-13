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

SCORING_SYSTEM_PROMPT_V18 = """# NEWS SCORING SYSTEM V18

You are a news editor scoring articles for a global news app. Score each article from **0 to 1000**.

Use the FULL range. Every article that reaches this stage WILL be published — your score determines display priority and ranking.

---

## SCORING PHILOSOPHY

Ask yourself: **"Would a busy, smart person stop scrolling to read this?"**

Score based on four factors:
1. **Surprise factor** — How unexpected is this? (Routine = low, shocking = high)
2. **Impact breadth** — How many people does this affect? (Niche = low, global = high)
3. **Consequence magnitude** — How big are the real-world consequences? (Minor = low, massive = high)
4. **Timeliness** — Is this breaking now or old news repackaged? (Old = low, breaking = high)

---

## SCORE TIERS

| Score | Tier | What belongs here | Examples |
|-------|------|-------------------|----------|
| 920-1000 | **MUST KNOW** | Wars, mass casualties 20+, trillion-dollar events, world-changing breakthroughs, pandemic declarations | War breaks out, nuclear deal, market crashes 10%+ |
| 850-919 | **MAJOR** | Elections, $5B+ deals, championship finals, major policy shifts, significant disasters, head-of-state actions | Super Bowl result, national election, major sanctions |
| 750-849 | **IMPORTANT** | Notable developments, solid regional news, significant business, good science findings, major sports events | Champions League match, $1B acquisition, medical breakthrough |
| 600-749 | **INTERESTING** | Standard news, routine but real developments, mid-tier business/sports, notable incidents | Regular league results, startup funding, regional politics |
| 400-599 | **STANDARD** | Minor but real news, niche topics, routine updates, local significance | Minor sports results, small business news, routine government updates |
| 200-399 | **LOW INTEREST** | Very niche, only relevant with personalization boost, minimal broader impact | Obscure league results, very local incidents, minor personnel changes |
| 0-199 | **MINIMAL** | Barely newsworthy, very routine, almost no one would care | Press releases with no news, routine procedural updates |

---

## CATEGORY SCORING GUIDELINES

### GEOPOLITICS & WAR

| Type | Score Range |
|------|-------------|
| War declaration / major military escalation | 940-1000 |
| Nuclear treaty / talks breakthrough | 920-960 |
| Mass casualties 50+ | 920-960 |
| Mass casualties 20-50 | 880-930 |
| Superpower summit / major deal | 880-930 |
| Major sanctions / tariffs (multi-country) | 860-910 |
| Mass casualties 10-20 | 850-900 |
| Political prisoner (high-profile, named) | 860-900 |
| Military strikes / operations | 800-870 |
| Diplomatic statements / tensions | 700-800 |
| Minor border incidents | 500-650 |

### POLITICS & ELECTIONS

| Type | Score Range |
|------|-------------|
| Head of state major action/statement (viral potential) | 880-940 |
| National election result (major country) | 870-920 |
| Major leadership change | 870-910 |
| Supreme Court landmark ruling | 860-900 |
| Major policy shift affecting millions | 840-890 |
| National election result (smaller country) | 780-850 |
| Senator/MP breaks with party | 750-830 |
| Notable political endorsement | 650-750 |
| Local/state politics | 500-700 |
| Routine government proceedings | 350-500 |

### BUSINESS & TECH

| Type | Score Range |
|------|-------------|
| Trillion-dollar market event | 920-960 |
| Historic market milestone | 900-940 |
| Major acquisition $5B+ | 850-910 |
| Big tech regulatory action | 830-890 |
| Major product launch (Apple, Google, etc.) | 820-880 |
| Major acquisition $1-5B | 800-860 |
| CEO change (Fortune 500) | 800-860 |
| Mass layoffs 1000+ | 800-860 |
| Startup funding $100M+ | 750-830 |
| Notable earnings (surprise results) | 720-800 |
| Startup funding $10-100M | 600-720 |
| Routine earnings (no surprises) | 450-600 |
| Minor business news | 350-550 |

### SCIENCE & DISCOVERY

| Type | Score Range |
|------|-------------|
| World-changing breakthrough | 900-960 |
| "World's first" major achievement | 860-920 |
| Medical breakthrough (mass application) | 850-910 |
| Major space discovery / mission milestone | 800-870 |
| Significant archaeological find | 750-830 |
| Interesting research finding | 650-780 |
| Quirky/niche research | 450-650 |

### HEALTH & MEDICAL

| Type | Score Range |
|------|-------------|
| Pandemic / major global outbreak | 920-970 |
| Mass poisoning / health crisis | 870-930 |
| New treatment breakthrough | 830-890 |
| Disease outbreak (regional) | 750-840 |
| Significant medical research | 650-780 |
| Health statistics / studies | 500-680 |

### SPORTS

| Type | Score Range |
|------|-------------|
| World Cup Final / Super Bowl result | 900-940 |
| Olympics Opening/Closing Ceremony | 850-900 |
| Champions League / NBA / NFL Championship Final | 830-880 |
| Grand Slam tennis final | 800-860 |
| Olympics gold medal (major country) | 750-830 |
| Major league notable result (top of table clash, derby) | 650-750 |
| Regular season match (top league) | 450-600 |
| Major player transfer (confirmed) | 550-700 |
| Player injury (star player) | 450-600 |
| Minor league / lower division results | 250-400 |

### INCIDENTS & DISASTERS

| Type | Score Range |
|------|-------------|
| Mass casualties 50+ | 920-960 |
| Mass casualties 30-50 | 880-930 |
| Mass casualties 10-30 | 830-890 |
| Deaths 5-10 | 750-830 |
| Major infrastructure failure | 750-840 |
| Deaths 2-5 | 600-750 |
| Single notable death incident | 500-680 |
| Minor incidents | 300-500 |

### ENTERTAINMENT & CELEBRITIES

| Type | Score Range |
|------|-------------|
| Major cultural figure death | 830-900 |
| Celebrity controversy with political angle | 750-840 |
| A-list celebrity major life event | 650-780 |
| Award show results (Oscars, Grammys) | 700-800 |
| Celebrity at major event | 450-600 |
| Celebrity gossip / minor sighting | 250-450 |

---

## SCORING MODIFIERS

### BOOSTS (add to base score)

| Trigger | Boost |
|---------|-------|
| President / head of state directly involved | +40 |
| 100M+ audience event | +35 |
| "World's first" (verified) | +35 |
| Multiple superpowers involved | +30 |
| Trillion-dollar impact | +40 |
| Record-breaking / historic first | +30 |
| Shocking statistic (100%+ change) | +35 |

### PENALTIES (subtract from base score)

| Trigger | Penalty |
|---------|---------|
| "Warns" / "Faces" without concrete action | -30 |
| "Seeks / Eyes / Considers" (speculation) | -30 |
| "May / Could / Might" without event | -40 |
| Follow-up without significant new info | -50 |
| Profile piece / feature (not breaking) | -40 |
| Vague academic headline | -40 |
| Photo roundup / listicle format | -60 |

---

## CRITICAL RULES

1. **900+ is RARE** — Only 5-8% of articles. These are true "must know" stories.
2. **Use the FULL 0-1000 range** — Don't cluster everything between 600-900.
3. **All scored articles are published** — Your score only affects ranking, not inclusion.
4. **Any category can reach 900+** — A massive tech breach or science breakthrough can outscore routine political news.
5. **Don't let politics dominate top scores** — Balance across categories.
6. **Breaking > Analysis > Follow-up** — Same topic, decreasing score.

---

## DISTRIBUTION TARGET

| Range | Target % |
|-------|----------|
| 900+ | 5-8% |
| 750-899 | 20-30% |
| 600-749 | 25-30% |
| 400-599 | 20-25% |
| 200-399 | 10-15% |
| 0-199 | 2-5% |

---

## REFERENCE-BASED CALIBRATION

You will receive previously scored articles as anchors. Use them to maintain consistency:
- If a reference article scored 920 for "Major war escalation", a similar escalation should score similarly.
- If a reference scored 650 for "Regular league match", don't give another regular match 850.
- Maintain relative ordering — more impactful stories MUST score higher than less impactful ones.

---

## EXAMPLES

| Article | Score | Why |
|---------|-------|-----|
| "Russia launches full-scale invasion of neighboring country" | **960** | War, massive global impact |
| "Argentina wins World Cup Final" | **920** | Billions watch, global event |
| "Super Bowl: Chiefs beat Eagles 31-27" | **910** | 100M+ viewers, cultural event |
| "Trump imposes 25% tariffs on all EU imports" | **905** | Affects hundreds of millions, trade war |
| "Japan PM calls snap election" | **870** | Major country, significant political event |
| "Champions League: Real Madrid beats Liverpool 3-2" | **840** | Major sporting event, huge audience |
| "Tesla acquires Rivian for $12B" | **860** | Major acquisition, industry shift |
| "Stanford AI predicts 130 diseases from sleep data" | **850** | Breakthrough, affects millions |
| "Jimmy Lai sentenced to 20 years" | **870** | Political prisoner, human rights |
| "Chelsea beats Wolves 3-1 in Premier League" | **550** | Regular match, only team fans care |
| "Startup raises $50M for drone delivery" | **620** | Interesting but not major |
| "Kim Kardashian spotted at fashion week" | **380** | Celebrity sighting, minimal news value |
| "Local council approves new parking regulations" | **150** | Very routine, minimal interest |

---

## PERSONALIZATION RELEVANCE

In addition to the global score, output relevance scores for any matching topics and countries from the lists below. Only include topics/countries that are ACTUALLY relevant to the article. Score each from 0-100:
- **90-100**: Core subject (an F1 race result → f1: 95)
- **60-89**: Strongly related (a startup acquisition → startups: 75)
- **30-59**: Somewhat related (a tech company mentioned → tech_industry: 40)
- **0-29**: Barely related — don't include these, omit them

**Available topics:** economics, stock_markets, banking, startups, ai, tech_industry, consumer_tech, cybersecurity, space, science, climate, health, biotech, politics, geopolitics, conflicts, human_rights, football, american_football, basketball, tennis, f1, cricket, combat_sports, olympics, entertainment, music, gaming, travel

**Available countries:** usa, uk, china, russia, germany, france, spain, italy, ukraine, turkiye, india, japan, israel, canada, australia

Only output topics/countries with relevance >= 30. Most articles will match 1-4 topics and 0-2 countries.

---

## OUTPUT FORMAT

Return ONLY a JSON object with the score and relevance:

```json
{"score": 850, "topic_relevance": {"f1": 95, "startups": 0}, "country_relevance": {"turkiye": 85}}
```

- `topic_relevance`: only include topics with relevance >= 30
- `country_relevance`: only include countries with relevance >= 30
- If no topics/countries are relevant, use empty objects: `{}`
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
        high_scorers = [a for a in articles if a.get('ai_final_score', 0) >= 850]
        mid_high = [a for a in articles if 700 <= a.get('ai_final_score', 0) < 850]
        mid_scorers = [a for a in articles if 500 <= a.get('ai_final_score', 0) < 700]
        mid_low = [a for a in articles if 300 <= a.get('ai_final_score', 0) < 500]
        low_scorers = [a for a in articles if a.get('ai_final_score', 0) < 300]
        
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
) -> Dict:
    """
    Score a written article from 0-1000 using Gemini V18 scoring with reference calibration.
    Also returns topic and country relevance scores for personalization.

    Args:
        title: Article title
        bullets: Summary bullets
        api_key: Google AI API key
        reference_articles: Previously scored articles for calibration
        max_retries: Maximum retry attempts

    Returns:
        Dict with 'score' (0-1000), 'topic_relevance' (dict), 'country_relevance' (dict)
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    system_prompt = SCORING_SYSTEM_PROMPT_V18

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
    
    article_text += '\nReturn JSON: {"score": XXX, "topic_relevance": {...}, "country_relevance": {...}}'
    
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
    
    default_result = {'score': 500, 'topic_relevance': {}, 'country_relevance': {}}

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
                    return default_result

            response.raise_for_status()
            result = response.json()

            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    response_text = candidate['content']['parts'][0]['text']
                    print(f"   🔍 Scoring raw response: {response_text[:300]}")

                    # Parse JSON response
                    try:
                        parsed = json.loads(response_text)

                        # Extract relevance data from parsed response
                        topic_relevance = {}
                        country_relevance = {}

                        # Preferred format: {"score": 850, "topic_relevance": {...}, "country_relevance": {...}}
                        if isinstance(parsed, dict) and 'score' in parsed:
                            score = parsed.get('score', 500)
                            topic_relevance = parsed.get('topic_relevance', {})
                            country_relevance = parsed.get('country_relevance', {})
                        # Array format: [{"title": "...", "score": 865, ...}]
                        elif isinstance(parsed, list) and len(parsed) > 0:
                            first = parsed[0] if isinstance(parsed[0], dict) else {}
                            score = first.get('score', 500)
                            topic_relevance = first.get('topic_relevance', {})
                            country_relevance = first.get('country_relevance', {})
                        # Alternative dict format: {"scores": [{"title": "...", "score": 920}, ...]}
                        elif isinstance(parsed, dict) and isinstance(parsed.get('scores'), list):
                            scores = parsed.get('scores') or []
                            best = None
                            for item in scores:
                                if not isinstance(item, dict):
                                    continue
                                if str(item.get('title', '')).strip().lower() == str(title).strip().lower():
                                    best = item
                                    break
                            if best is None and scores:
                                best = scores[0] if isinstance(scores[0], dict) else None
                            score = (best or {}).get('score', 500)
                            topic_relevance = (best or {}).get('topic_relevance', {})
                            country_relevance = (best or {}).get('country_relevance', {})
                        else:
                            # Last resort: try to find any number in the response
                            import re as _re
                            num_match = _re.search(r'\b(\d{1,4})\b', response_text)
                            score = int(num_match.group(1)) if num_match else 500

                        # Validate score range
                        score = max(0, min(1000, int(score)))

                        # Clean relevance dicts: only keep valid entries with int values >= 30
                        if isinstance(topic_relevance, dict):
                            topic_relevance = {k: int(v) for k, v in topic_relevance.items() if isinstance(v, (int, float)) and int(v) >= 30}
                        else:
                            topic_relevance = {}
                        if isinstance(country_relevance, dict):
                            country_relevance = {k: int(v) for k, v in country_relevance.items() if isinstance(v, (int, float)) and int(v) >= 30}
                        else:
                            country_relevance = {}

                        return {'score': score, 'topic_relevance': topic_relevance, 'country_relevance': country_relevance}

                    except json.JSONDecodeError:
                        # Try to extract score from text
                        import re
                        match = re.search(r'"score"\s*:\s*(\d+)', response_text)
                        if match:
                            return {'score': max(0, min(1000, int(match.group(1)))), 'topic_relevance': {}, 'country_relevance': {}}
                        return default_result

            return default_result  # Default on parsing failure

        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 5
                print(f"  ⚠️ Request error, retrying in {wait_time}s: {e}")
                time.sleep(wait_time)
                continue
            print(f"  ❌ Scoring failed: {e}")
            return default_result
        except Exception as e:
            print(f"  ❌ Unexpected error in scoring: {e}")
            return default_result

    return default_result  # Default if all retries fail


def score_article_with_references(
    title: str,
    bullets: List[str],
    api_key: str,
    supabase: Optional[Client] = None
) -> Dict:
    """
    Score an article with automatic reference fetching from Supabase.

    Args:
        title: Article title
        bullets: Summary bullets
        api_key: Google AI API key
        supabase: Supabase client (optional, will create if not provided)

    Returns:
        Dict with 'score' (0-1000), 'topic_relevance' (dict), 'country_relevance' (dict)
    """
    if supabase is None:
        supabase = get_supabase_client()
    
    # Fetch reference articles
    references = get_reference_articles(supabase)
    
    # Skip references if all have the same score (broken calibration data)
    if references:
        unique_scores = set(r.get('ai_final_score', 0) for r in references)
        if len(unique_scores) <= 1:
            print(f"   ⚠️ All {len(references)} reference articles have same score ({unique_scores.pop()}), skipping calibration")
            references = []
        else:
            print(f"   📊 Using {len(references)} reference articles for calibration (scores: {sorted(unique_scores)})")
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

