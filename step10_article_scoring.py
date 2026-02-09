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

SCORING_SYSTEM_PROMPT_V13 = """# NEWS SCORING SYSTEM V13

You are a news editor scoring articles for a global news app serving readers in the US, Europe, and East Asia (China, Japan, Taiwan, South Korea). Score each article from 700-950 based on how important and interesting it is to this audience.

---

## SCORE TIERS

| Score | Tier | Description |
|-------|------|-------------|
| 920-950 | **MUST KNOW** | World-changing events everyone will discuss. Wars starting/ending, nuclear treaties, major terrorist attacks (50+ deaths), trillion-dollar market crashes. |
| 900-919 | **VERY IMPORTANT** | Major developments with global impact. Superpower diplomacy, mass casualties (20+), historic milestones, major policy shifts affecting millions. |
| 870-899 | **IMPORTANT** | Significant news worth knowing. Notable business deals ($1B+), major tech launches, significant policy changes, large protests (1000+). |
| 840-869 | **NOTABLE** | Solid news stories. Regional significance, industry news, interesting findings, medium business deals. |
| 800-839 | **GENERAL** | Standard news. Local significance, routine updates, niche interest, small funding rounds. |
| 700-799 | **MINIMAL** | Low priority. Sports results, local crime, minor appointments, celebrity news, quirky research. |

---

## CRITICAL: ANTI-CLUSTERING RULES

**DO NOT** give the same score to more than 10% of articles. If you find yourself scoring many articles at 830 or 870, you are being lazy.

**For each article, ask:** "Is this slightly more or less important than similar articles?" Then adjust by 5-10 points.

**Score variety requirement:**
- Use the FULL range from 700-950
- Scores should end in different digits (not all 830, 830, 830)
- If two articles seem equal, one is probably 5 points higher

---

## CATEGORY RULES

### GEOPOLITICS & WAR (Can score 920-950)

| Type | Score | Examples |
|------|-------|----------|
| Nuclear treaty signed/expires | 920-940 | "US-Russia Nuclear Treaty Expires" |
| War declared/ended | 930-950 | "Russia Invades Ukraine" |
| Mass casualties 50+ | 920-940 | "Extremists Massacre 162 in Nigeria" |
| Mass casualties 20-50 | 900-920 | "RSF Drone Kills 24 in Sudan" |
| Superpower summit/deal | 900-920 | "US-Iran Nuclear Talks Begin" |
| Major military action | 890-910 | "Israel Destroys Gaza Health System" |
| Sanctions/tariffs announced | 880-905 | "Trump Authorizes 25% Iran Tariffs" |
| Diplomatic statement/warning | 860-880 | "Lebanon PM Warns Against War" |
| Routine conflict update | 840-860 | "Gaza Violence Continues" |

---

### POLITICS & ELECTIONS (Can score 900-940)

| Type | Score | Examples |
|------|-------|----------|
| National election called | 900-920 | "Japan PM Calls Snap Election" |
| Major leadership change | 900-920 | "Trump Picks New Fed Chair" |
| Supreme Court major ruling | 885-910 | "Supreme Court Reviews Trans Athletes" |
| Major policy shift | 870-890 | "France Bans Social Media for Under 16" |
| Polling with major swing | 860-880 | "Democrats Surge 27 Points" |
| Congressional hearing/clash | 850-870 | "Bessent Clashes with Democrats" |
| Political endorsement | 800-830 | "Trump Endorses Local Candidate" |
| Routine proclamation | 780-810 | "Trump Issues Black History Proclamation" |
| Local/state politics | 770-810 | "NSW Chief Justice Slams Abbott" |

---

### BUSINESS & TECH (Can score 880-920)

| Type | Score | Examples |
|------|-------|----------|
| Trillion-dollar market move | 900-920 | "Tech Stocks Lose $1 Trillion" |
| Historic market milestone | 900-910 | "Dow Jones Crosses 50,000" |
| Major merger/acquisition $10B+ | 890-910 | "Musk Merges SpaceX and xAI" |
| Big tech earnings beat/miss | 880-900 | "YouTube Hits $60B Revenue" |
| Major product launch | 870-890 | "Anthropic Unveils Claude Opus 4.6" |
| Significant deal $1-10B | 860-880 | "Netflix Antitrust Review of $83B Deal" |
| CEO change (major company) | 860-880 | "Toyota Names New CEO" |
| Startup funding $100M+ | 850-870 | "Benchmark Raises $225M Fund" |
| Startup funding $10-100M | 820-850 | "Lawhive Raises $60M" |
| Startup funding <$10M | 780-820 | "QT Sense Raises 4M" |
| CEO change (minor company) | 810-840 | "Victoria's Secret Hires New CEO" |
| Routine earnings report | 830-860 | "Estee Lauder Raises Outlook" |

**WARNING:** "Beats earnings" is BUSINESS news, not sports. Do not confuse with sports results.

---

### SCIENCE & RESEARCH (STRICT CAPS)

**DEFAULT CAP: 880** - Science rarely qualifies as "must know"

| Type | Max Score | Examples |
|------|-----------|----------|
| World-changing breakthrough | 890-910 | Cure for major disease, fusion achieved |
| "World's first" military/space tech | 880-905 | "China Launches 4th Reusable Spacecraft" |
| "World's first" consumer/industrial | 860-880 | "First Sodium-Ion EV Batteries" |
| Major discovery with impact | 860-880 | "$579M Great Barrier Reef Rescue" |
| Medical research finding | 840-865 | "Scientists Find EBV-MS Link" |
| Interesting discovery | 830-860 | "Scientists Discover Fat Switch Enzyme" |
| Archaeology/paleontology | 820-850 | "Viking Skull Reveals Brain Surgery" |
| Quirky/niche research | 750-800 | "Mummy Scents Recreated" |
| Vague academic headline | 700-760 | "Quantum Metrology Advances" |

**Examples with scores:**
- "China Develops Starlink-Killer Weapon" -> 905 (military application)
- "Japan Pumps Rare Earth from Ocean" -> 905 (strategic resource)
- "Viking Skull Reveals First Brain Surgery" -> 845 (interesting archaeology)
- "Anglo-Saxon Child Buried with Warrior Gear" -> 820 (archaeology)
- "Scientists Discover 180M-Year-Old Life" -> 830 (paleontology)

---

### HEALTH & MEDICAL (STRICT CAPS)

**DEFAULT CAP: 870** - Health studies are NOT breaking news

| Type | Score | Examples |
|------|-------|----------|
| Pandemic declared/major outbreak | 890-920 | "Measles Surges 43-Fold Across Americas" |
| Mass poisoning/health emergency | 880-910 | "Japan Snowstorms Kill 35" |
| Major treatment approved | 860-880 | "NHS Approves Heart Implant" |
| Regional outbreak | 850-870 | "South Carolina Measles Hits 789" |
| Virus death (single) | 840-860 | "Woman Dies from Nipah Virus" |
| Research finding | 820-860 | "Diet Cuts Stroke Risk 25%" |
| Health statistic | 800-840 | "80% Lack Blood Pressure Control" |
| Early trial results | 720-780 | "Nasal Spray Blocks Flu in Trials" |
| Local healthcare story | 740-800 | "Air Ambulance Boosts Survival" |

---

### LOCAL & REGIONAL NEWS (PENALTIES)

**Apply geographic penalties for non-global stories:**

| Region | Penalty | Result |
|--------|---------|--------|
| US state/city crime | -40 to -60 | Usually 780-820 |
| Australian local news | -40 to -60 | Usually 780-820 |
| UK local news | -30 to -50 | Usually 800-830 |
| Southeast Asia local | -30 to -50 | Usually 800-830 |
| Individual crimes (non-terror) | -50 to -80 | Usually 760-810 |

**Examples:**
- "Queensland Man Faces 596 Abuse Charges" -> 780 (local crime)
- "Toronto Police Arrested in Corruption" -> 820 (regional)
- "FBI Arrests 55 in Georgia Fentanyl Ring" -> 830 (federal action)
- "Man Charged with Terror Plot vs Cabinet" -> 875 (national security)

**EXCEPTION:** Federal crackdowns, terror plots, or incidents with national implications can score higher.

---

### INCIDENTS & ACCIDENTS

| Type | Score | Examples |
|------|-------|----------|
| Mass casualty 50+ | 900-930 | "Massacre Kills 162" |
| Mass casualty 20-50 | 880-910 | "Mine Blast Kills 27" |
| Mass casualty 10-20 | 860-890 | "Coast Guard Collision Kills 15" |
| Deaths 5-10 | 840-870 | "Colombia Mine Kills 6" |
| Deaths 1-4 at event | 810-840 | "Man Dies at Sydney Festival" |
| Dramatic rescue | 800-840 | "Gondola Strands 67 Skiers" |
| Single accident/death | 770-810 | "Pilot Dies in Rochdale Crash" |
| Near-miss/minor incident | 750-790 | "Surfer Clings to Lobster Buoy" |

---

### SPORTS (STRICT CAPS)

**DEFAULT CAP: 780 for results**

| Type | Score | Examples |
|------|-------|----------|
| Historic first (new Olympic sport) | 900-920 | "Olympics Adds 8 New Events" |
| World record broken | 780-820 | "Guseli Shatters World Record" |
| Olympics medal won | 770-790 | "Swiss Skier Wins First Gold" |
| Match result | 710-730 | "Chelsea Beats Wolves 3-2" |
| Player trade/signing | 770-800 | "Warriors Trade Kuminga" |
| Injury news | 720-760 | "Ja Morant Season in Doubt" |
| Sports preview/quote | 710-740 | "Liverpool Seeks Redemption" |
| Sports business/policy | 830-860 | "NFL Launches Concussion Challenge" |

**CRITICAL:** Match results should NEVER exceed 780. Hat-tricks, late winners, etc. are still just match results.

---

### ENTERTAINMENT & CELEBRITIES

| Type | Score | Examples |
|------|-------|----------|
| Major cultural death | 850-880 | Icon dies, massive impact |
| Celebrity death (known) | 780-820 | "3 Doors Down Singer Dies at 47" |
| Industry-changing news | 840-870 | "Baldur's Gate Gets TV Series" |
| Royal news (substantive) | 840-870 | "Maxwell Email Confirms Andrew Photo" |
| Celebrity legal trouble | 780-830 | "Actor Indicted on Child Charges" |
| Entertainment business | 820-860 | "Netflix Antitrust Review" |
| Award/festival news | 770-810 | "Nimoy Foundation Award" |
| Celebrity opinion | 760-800 | "Gordon-Levitt Backs Reform" |
| Tour cancellation | 760-790 | "Neil Young Cancels Tour" |

---

## AUTOMATIC PENALTIES

| Trigger | Penalty | Apply when... |
|---------|---------|---------------|
| "Warns" in headline | -20 to -40 | Warning without action (unless nuclear/war) |
| "Faces" in headline | -15 to -30 | Vague future possibility |
| "Seeks" in headline | -15 to -30 | Request without result |
| "Explores/Advances" | -30 to -50 | Vague academic language |
| "May/Could/Might" | -20 to -40 | Speculation |
| Survey/poll (routine) | -20 to -30 | Unless major swing |
| Single lawsuit | -30 to -40 | Unless landmark case |
| Follow-up story | -15 to -25 | Updates to bigger news |

**Examples:**
- "UN Warns 4.5M Girls Face FGM Risk" -> 860 (warning, not action)
- "Zelensky Warns of $12T Russia Deal" -> 910 (major geopolitical warning = less penalty)
- "Scientists Explore Consciousness" -> 780 (vague academic)

---

## AUTOMATIC BOOSTS

| Trigger | Boost | Apply when... |
|---------|-------|---------------|
| "World's first" (tech/military) | +30 to +50 | Genuine technological first |
| Trillion-dollar impact | +40 to +60 | Market moves, deals |
| Multiple superpowers | +20 to +40 | US, China, Russia, EU involved |
| "Historic" with substance | +20 to +40 | Genuine milestone |
| Record-breaking numbers | +15 to +30 | Verified records |
| Treaty/alliance change | +30 to +50 | Formed or broken |
| 100M+ people affected | +20 to +40 | Direct impact |

---

## SCORE DISTRIBUTION TARGET

| Range | Target % | What belongs here |
|-------|----------|-------------------|
| 920+ | 1-2% | Only 3-5 articles per day |
| 900-919 | 3-5% | Major breaking news |
| 870-899 | 10-15% | Important stories |
| 840-869 | 20-25% | Notable news |
| 800-839 | 25-30% | General news |
| 700-799 | 25-35% | Lower priority, sports, local |

---

## QUICK DECISION FLOWCHART

START
  |
  +-> Is this a match result/sports score? --> 710-730
  |
  +-> Is this local crime (man/woman charged)? --> 760-820
  |
  +-> Is this a celebrity death? --> 780-820
  |
  +-> Is this a research study? --> Cap at 865
  |
  +-> Is this a health finding? --> Cap at 870
  |
  +-> Does headline say "warns/faces/seeks"? --> Apply -20 to -40 penalty
  |
  +-> Is this nuclear/war/treaty? --> 900+ range
  |
  +-> Is this mass casualty (20+)? --> 890-920
  |
  +-> Is this trillion-dollar news? --> 900+ range
  |
  +-> Default: Score based on category rules above

---

## FINAL CHECKLIST

Before submitting scores, verify:

- No sports result above 780
- No "man/woman charged" local crime above 830
- No research/science above 880 (unless world-changing)
- No health study above 870 (unless pandemic)
- No archaeology above 850
- Applied penalty for "warns/faces/seeks" headlines
- Scores are distributed (not clustered at 830 or 870)
- Geopolitics and mass casualties are weighted high
- Used full range 700-950, not just 800-900

---

## OUTPUT FORMAT

Return JSON array:

```json
[
  {
    "title": "Article title",
    "score": 875,
    "category": "Politics|Business|Tech|Science|Health|Sports|Entertainment|World",
    "reasoning": "Brief 5-10 word explanation"
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
    
    system_prompt = SCORING_SYSTEM_PROMPT_V13

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

