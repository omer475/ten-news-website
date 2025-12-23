#!/usr/bin/env python3
"""
STEP 1: GEMINI NEWS SCORING & FILTERING
==========================================
Purpose: Filter RSS articles down to "must-know" news articles
Model: Gemini 2.5 Flash
Input: RSS articles with title, source, description, url
Output: Approved articles (score ≥700)
"""

import requests
import json
import time
import re
from typing import List, Dict

def _fix_truncated_json(json_text: str) -> List[Dict]:
    """
    Fix truncated JSON responses from Gemini API
    """
    # Clean up the response
    json_text = json_text.strip()
    
    # Remove any leading/trailing non-JSON content
    start_idx = json_text.find('[')
    if start_idx == -1:
        raise ValueError("No JSON array found in response")
    
    json_text = json_text[start_idx:]
    
    # If it doesn't end with ], try to find the last complete object
    if not json_text.endswith(']'):
        # Find the last complete object by looking for }, patterns
        last_complete_idx = -1
        brace_count = 0
        in_string = False
        escape_next = False
        
        for i, char in enumerate(json_text):
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Found end of an object
                        last_complete_idx = i
        
        if last_complete_idx > 0:
            # Find the end of this object (including any trailing comma)
            end_idx = last_complete_idx + 1
            while end_idx < len(json_text) and json_text[end_idx] in ', \n\t':
                end_idx += 1
            
            json_text = json_text[:end_idx] + ']'
        else:
            # If we can't find complete objects, just close the array
            json_text = json_text.rstrip(', \n\t') + ']'
    
    # Try to parse the fixed JSON
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        # Last resort: try to extract individual objects using regex
        objects = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', json_text)
        if objects:
            parsed_objects = []
            for obj_str in objects:
                try:
                    parsed_objects.append(json.loads(obj_str))
                except json.JSONDecodeError:
                    continue
            return parsed_objects
        else:
            raise ValueError(f"Could not extract any valid JSON objects: {e}")

def score_news_articles_step1(articles: List[Dict], api_key: str, batch_size: int = 30, max_retries: int = 3) -> Dict:
    """
    Step 1: Score news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
        batch_size: Number of articles to process per API call (default: 30)
        max_retries: Maximum retry attempts for rate limiting (default: 3)
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    # FILTER OUT ARTICLES WITHOUT IMAGES (User requirement)
    articles_with_images = []
    articles_without_images = []
    
    for article in articles:
        image_url = article.get('image_url')
        if image_url and image_url.strip():  # Has valid image URL
            articles_with_images.append(article)
        else:
            articles_without_images.append(article)
    
    if articles_without_images:
        print(f"   ⚠️  Filtered {len(articles_without_images)} articles WITHOUT images")
    
    if not articles_with_images:
        print(f"   ❌ No articles with images to score!")
        return {
            "approved": [],
            "filtered": articles_without_images
        }
    
    print(f"   ✅ Scoring {len(articles_with_images)} articles WITH images")
    
    # Continue with articles that have images
    articles = articles_with_images
    
    # Use gemini-2.0-flash-exp as gemini-2.5-flash may not be available yet
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    # Process articles in batches to avoid rate limits
    if len(articles) > batch_size:
        print(f"📦 Processing {len(articles)} articles in batches of {batch_size}...")
        all_approved = []
        all_filtered = []
        
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(articles) + batch_size - 1) // batch_size
            
            print(f"  Processing batch {batch_num}/{total_batches} ({len(batch)} articles)...")
            
            try:
                batch_result = _process_batch(batch, url, api_key, max_retries)
                all_approved.extend(batch_result['approved'])
                all_filtered.extend(batch_result['filtered'])
                
                # Delay between batches to avoid rate limits (except for last batch)
                if i + batch_size < len(articles):
                    time.sleep(5)  # 5 second delay between batches to avoid rate limits
                    
            except Exception as e:
                print(f"  ❌ Batch {batch_num} failed: {e}")
                # Mark batch articles as filtered on error
                for article in batch:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'FILTERED'
                all_filtered.extend(batch)
        
        # Add articles without images to filtered list
        all_filtered.extend(articles_without_images)
        
        return {
            "approved": all_approved,
            "filtered": all_filtered
        }
    else:
        # Single batch - use existing logic
        result = _process_batch(articles, url, api_key, max_retries)
        # Add articles without images to filtered list
        result['filtered'].extend(articles_without_images)
        return result


def _process_batch(articles: List[Dict], url: str, api_key: str, max_retries: int = 3) -> Dict:
    """
    Process a single batch of articles with retry logic for rate limiting
    
    Args:
        articles: Batch of articles to process
        url: Gemini API URL
        api_key: Google AI API key
        max_retries: Maximum retry attempts
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    system_prompt = """# TEN NEWS SCORING V11 - GLOBAL + SHAREABLE

## 🎯 CORE PRINCIPLE

**Ten News curates 10 stories daily that are globally important OR universally interesting.**

Two paths to a high score:

```
PATH A: HARD NEWS (Traditional importance)
→ Global entity + International relevance + Newsworthy event

PATH B: SHAREABLE INSIGHTS (Universal interest)  
→ Surprising facts/statistics + Universal topic + "Wow factor"
```

**Both paths require the story to be about GLOBAL topics, not regional issues or unknown individuals.**

---

## 🌟 PATH B: SHAREABLE INSIGHTS (Score 850-950)

These stories may not be "breaking news" but they're **universally interesting** and highly shareable. They make people say "Did you know...?" or "That's crazy!"

### What Makes a Shareable Insight?

| Factor | Description | Example |
|--------|-------------|---------|
| **SURPRISING STATISTIC** | Numbers that shock or change perspective | "Concert tickets up 2,600% since Beatles" |
| **RECORD/MILESTONE** | Historic achievement or first | "Data centers hit $61B record investment" |
| **TREND REVELATION** | Shows how the world is changing | "AI startup valuations tripling in months" |
| **UNIVERSAL TOPIC** | Something everyone can relate to | Concerts, movies, technology, money |
| **QUOTABLE** | People will repeat this fact | "Avatar 3 opens at $345M worldwide" |

### ✅ Examples of HIGH-SCORING Shareable Insights

| Article | Score | Why It Works |
|---------|-------|--------------|
| "Concert Tickets Surge 2,600% Since Beatles Era" | **920** | Shocking statistic + Universal topic (music/prices) + Everyone can relate |
| "Data Centers Hit $61B Investment Record in 2025" | **900** | Record milestone + Global tech trend + AI angle |
| "Avatar 3 Opens with $345M Worldwide Box Office" | **910** | Globally known franchise + Record-level numbers + Entertainment event |
| "Lovable Hits $6.6B Valuation with AI Coding" | **880** | AI industry milestone + Explosive growth story + Tech trend |
| "Trump Renames Kennedy Center, Gulf of Mexico" | **920** | Known entity + Shocking action + Everyone will discuss |
| "90% of Ocean Plastic Comes from 10 Rivers" | **900** | Surprising fact + Changes perspective + Environmental topic |
| "China Built More in 3 Years Than US in 100 Years" | **910** | Mind-blowing comparison + Global powers |
| "Only 8 Men Own Same Wealth as Poorest 50%" | **900** | Shocking inequality stat + Universal relevance |
| "Japan Now Has More People Over 80 Than Under 10" | **890** | Surprising demographic fact + Makes you think |

### ❌ NOT Shareable Insights (Still fails)

| Article | Score | Why It Fails |
|---------|-------|--------------|
| "7-Year-Old Invites Shop Owner to Party" | **100** | Unknown person, not a global insight |
| "62-Year-Old Applies for 900 Jobs" | **150** | Individual story, not a trend or statistic |
| "Liver Disease Shows Silent Symptoms" | **350** | Generic health info, not surprising |
| "UK House Has 44.7m Christmas Tree" | **300** | Quirky local record, not universal interest |

### The KEY Distinction:

**✅ SHAREABLE INSIGHT:** "Concert ticket prices have increased 2,600% since the 1960s" 
→ This is a FACT about the WORLD that surprises people

**❌ HUMAN INTEREST FLUFF:** "62-year-old man applied to 900 jobs"
→ This is a story about ONE UNKNOWN PERSON

---

## 🚫 INSTANT DISQUALIFIERS (Score 0-400)

Before evaluating anything else, check for these automatic failures:

### UNKNOWN INDIVIDUALS = Score 100-300

Stories about **unnamed or unknown private individuals** are NOT news:

| Article | Score | Why |
|---------|-------|-----|
| "7-Year-Old Invites Shop Owner to Birthday Party" | **100** | Unknown child, human interest fluff |
| "62-Year-Old Applies for 900 Jobs After Layoff" | **150** | Anonymous person, not newsworthy |
| "Woman Sells Home, Moves to France at 55" | **100** | Random person lifestyle choice |
| "Deaf Woman Breaks 16-Year Silence on Abuse" | **200** | Personal story, no global impact |
| "Family Ditches Christmas Gifts for Home Projects" | **100** | Random family, lifestyle content |
| "21-Year-Old Student Wins Local Election" | **150** | Unknown person, local politics |

**The rule:** If the headline describes a person by age, gender, occupation, or generic descriptor instead of their NAME → they are unknown → Score 100-300 max.

**Exceptions that CAN score higher:**
- Whistleblowers exposing major scandals (name may be protected)
- Victims in major international incidents
- Statistical studies about demographics (the story is the data, not individuals)

### LIFESTYLE/ENTERTAINMENT FLUFF = Score 200-400

| Article | Score | Why |
|---------|-------|-----|
| "Paris Hilton Transforms Mansion into Pink Wonderland" | **250** | Celebrity home decor, zero importance |
| "Rock Stars' 10 Hard Christmas Alternatives" | **200** | Listicle entertainment filler |
| "Laura Dern Recalls Spielberg's Awkward Dinosaur Roar" | **200** | Old celebrity anecdote |
| "UK House Breaks Record with 44.7m Christmas Tree" | **250** | Quirky local interest |
| "Aaron Paul Partners with Chef on Luxury Caviar" | **200** | Celebrity business venture |
| "The Verge's 13 Top Art Projects from 2025" | **200** | Publication's year-end list |
| "Croatia Expert Reveals 4 Hidden Gems" | **150** | Travel listicle |
| "Pent Audio Unveils $7,200 Speakers" | **200** | Product launch, niche luxury |
| "Sea Devils Return in Doctor Who Spin-Off" | **300** | TV show announcement |

### GENERIC HEALTH/WELLNESS = Score 300-450

| Article | Score | Why |
|---------|-------|-----|
| "Liver Disease Shows Silent Symptoms" | **350** | Generic health education |
| "Orange Juice Cuts Blood Pressure" | **300** | Clickbait health tip |
| "Pain Management Shifts to Control Over Cure" | **350** | Industry trend piece |
| "Holiday Grief Affects 36% Who Skip Celebrations" | **400** | Seasonal psychology piece |

**Exception:** Major medical breakthroughs (cure discovered, pandemic news) can score 900+

---

## 🚨 GATE 1: GLOBAL ENTITY CHECK

**Question: Is the main entity recognized by average people in USA, Europe, AND Asia?**

### ✅ GLOBALLY KNOWN ENTITIES

**World Leaders (everyone knows):**
- Putin, Trump, Biden, Xi Jinping, Zelensky, Modi, Macron, Scholz
- Kim Jong Un, Khamenei, Netanyahu, Pope Francis

**Tech Giants (everyone knows):**
- Apple, Google, Microsoft, Amazon, Meta, Tesla, Netflix
- OpenAI, ChatGPT, Nvidia, Samsung, TikTok

**Global Companies (everyone knows):**
- Disney, Nike, Ferrari, Toyota, McDonald's, Coca-Cola
- Boeing, Airbus, LVMH, Pfizer, SpaceX

**Sports Icons (everyone knows):**
- Messi, Ronaldo, LeBron James
- World Cup, Olympics, Champions League Final

**Entertainment Icons (everyone knows):**
- Taylor Swift, Beyoncé, BTS
- Marvel, Star Wars, major Oscar winners

**Countries/Organizations (everyone knows):**
- USA, China, Russia, EU, UK, NATO, UN, WHO
- Ukraine, Israel, Gaza, North Korea, Iran

### ❌ NOT GLOBALLY KNOWN (Regional/Niche)

**Regional Politicians:**
- Fadnavis, Kejriwal, Mahayuti, Beth Hammack, Todd Blanche
- Any state/provincial level politician
- Cabinet ministers (unless major powers like US Secretary of State)

**Regional Companies:**
- Nippon Steel, Manulife, Xpeng, Pony.ai
- Regional banks, local retailers, B2B companies

**Regional Celebrities:**
- David Walliams (UK only), Lindsey Vonn (sports niche)
- MTV co-founders, regional TV personalities

**Niche Sports:**
- Scottish Premiership (Hearts, Rangers)
- Premier League regular matches
- Regional cricket, AFC Nations League

---

## 🚨 GATE 2: INTERNATIONAL RELEVANCE CHECK

**Question: Would this story matter to people in at least 3 different continents?**

### ❌ REGIONAL NEWS (Score 400-550)

Even if it involves a known entity, regional scope = low score:

| Article | Score | Why |
|---------|-------|-----|
| "Modi Hails Win in Maharashtra Local Polls" | **450** | Indian state politics |
| "Modi Accuses Congress of Settling Migrants" | **450** | Indian domestic politics |
| "BJP Leader at Tamil Nadu Rally" | **350** | Indian regional event |
| "FCI Train Delivers Tonnes to Kashmir" | **300** | Indian logistics |
| "Kashmir Snowfall Revives Tourism" | **350** | Regional weather/tourism |
| "India Faces 543K Consumer Complaints" | **400** | Domestic bureaucracy |
| "Hong Kong Tourists Risk Lives for Selfies" | **400** | Local safety story |
| "Hong Kong Construction Veteran Exposes Bid-Rigging" | **450** | Local corruption |
| "Louisiana Captures Jail Escapee" | **350** | US local crime |
| "Police Sexual Convictions Surge 34% (UK)" | **500** | UK domestic stats |
| "UK Bans Trail Hunting" | **450** | UK domestic policy |
| "Electoral Commission Clears Farage" | **450** | UK domestic politics |
| "Fed's Hammack Signals Rates Steady" | **550** | US monetary (regional Fed official) |
| "Air India Express Issues Notice to Pilot" | **300** | Regional airline HR |

### ✅ INTERNATIONAL RELEVANCE

Stories that DO have international relevance:
- **Wars/Conflicts affecting multiple nations** (Ukraine, Gaza, Thailand-Cambodia)
- **Global economic policy** (Fed Chair Powell, not regional Fed presidents)
- **Climate/Environment affecting planet** (not regional weather)
- **International diplomacy** (treaties, summits, sanctions)
- **Global health crises** (pandemics, not generic health tips)
- **Major tech/science breakthroughs** (AI milestones, space discoveries)

---

## 🚨 GATE 3: NEWS VALUE CHECK

**Question: Is this actual news or filler content?**

### ❌ NOT NEWS (Score 200-450)

| Type | Examples | Score |
|------|----------|-------|
| **Year-end lists** | "Best of 2025", "Top 10 picks" | 200-300 |
| **Celebrity lifestyle** | Home tours, fashion, dating | 200-300 |
| **Travel guides** | "Hidden gems", "Must-visit places" | 150-250 |
| **Product launches** | Luxury items, niche tech | 200-400 |
| **TV/Movie announcements** | Spin-offs, casting news | 300-400 |
| **Seasonal content** | Holiday tips, gift guides | 200-300 |
| **Sports injuries** | Player misses match | 300-400 |
| **Regular matches** | Non-final, non-championship | 300-500 |
| **Corporate holiday videos** | Blackstone holiday video | 200-300 |
| **Human interest fluff** | Heartwarming local stories | 100-300 |

### ✅ ACTUAL NEWS

- Events that JUST HAPPENED with consequences
- Policy changes affecting millions
- Conflicts, crises, emergencies
- Major economic shifts
- Scientific discoveries with applications
- Political developments with global impact

---

## 📊 SCORING MATRIX

### PATH A: Hard News Scoring

| Gate 1: Known? | Gate 2: International? | Gate 3: News? | Score Range |
|----------------|------------------------|---------------|-------------|
| ✅ Yes | ✅ Yes | ✅ Yes + Memorable | **900-950** |
| ✅ Yes | ✅ Yes | ✅ Yes | **800-899** |
| ✅ Yes | ✅ Yes | ⚠️ Routine | **700-799** |
| ✅ Yes | ❌ Regional | ✅ Yes | **500-650** |
| ✅ Yes | ❌ Regional | ❌ No | **400-550** |
| ❌ Unknown | Any | Any | **100-400** |
| Any | Any | ❌ Lifestyle/Fluff | **100-400** |

### PATH B: Shareable Insight Scoring

| Universal Topic? | Surprising/Record? | Quotable? | Score Range |
|------------------|-------------------|-----------|-------------|
| ✅ Yes (global) | ✅ Very surprising | ✅ Yes | **900-950** |
| ✅ Yes (global) | ✅ Somewhat surprising | ✅ Yes | **850-899** |
| ✅ Yes (global) | ✅ Interesting | ⚠️ Maybe | **800-849** |
| ⚠️ Niche topic | ✅ Surprising | ✅ Yes | **750-850** |
| ❌ Regional only | Any | Any | **400-600** |
| ❌ About unknown person | Any | Any | **100-300** |

### Quick Decision Tree

```
Is it about an UNKNOWN INDIVIDUAL? 
  → YES: Score 100-300 (STOP)
  → NO: Continue

Is it REGIONAL news with no global relevance?
  → YES: Score 400-600 (STOP)  
  → NO: Continue

Is it PATH A (Hard News) or PATH B (Shareable Insight)?

PATH A: Does it involve a globally known entity + international event?
  → YES + Very memorable: 900-950
  → YES + Standard news: 800-899
  → YES + Routine: 700-799

PATH B: Does it have surprising stats/facts about a universal topic?
  → YES + Mind-blowing + Quotable: 900-950
  → YES + Interesting + Shareable: 850-899
  → YES + Good insight: 800-849
```

---

## 🎯 MEMORABILITY BONUS (Only for stories passing all gates)

Once a story passes all three gates, add memorability bonus:

| Factor | Description | Bonus |
|--------|-------------|-------|
| **SHOCKING** | Unexpected, "wow" factor | +50-100 |
| **HISTORIC** | First time, record, milestone | +50-100 |
| **IMPACTFUL** | Changes policy, affects millions | +30-80 |
| **QUOTABLE** | People will discuss at dinner | +20-50 |
| **EDUCATIONAL** | Surprising global statistic | +30-60 |

---

## ✅ EXAMPLES OF CORRECT SCORING

### 🔥 Score 900-950 (All gates passed + Very Memorable)

| Article | Score | Reasoning |
|---------|-------|-----------|
| "Russia-Ukraine Sign Peace Treaty" | **950** | Known + International + Historic |
| "OpenAI Releases GPT-5" | **930** | Known + International + Industry-changing |
| "SpaceX Fram2 First Polar Orbit" | **900** | Known (SpaceX) + International + Historic first |
| "China Exports US-Based Surveillance Tech Globally" | **900** | Known (China/US) + International security + Impactful |
| "Thailand-Cambodia Clashes Displace 500,000" | **850** | International conflict + Humanitarian crisis |
| "Concert Tickets Surge 2,600% Since Beatles Era" | **920** | PATH B: Shocking stat + Universal topic |
| "Data Centers Hit $61B Investment Record" | **900** | PATH B: Record + Global tech trend |
| "Avatar 3 Opens with $345M Worldwide" | **910** | PATH B: Global franchise + Record numbers |

### 📰 Score 700-850 (All gates passed)

| Article | Score | Reasoning |
|---------|-------|-----------|
| "Trump Labels Fentanyl Weapon of Mass Destruction" | **850** | Known (Trump) + International drug policy |
| "Israel Approves 19 New West Bank Settlements" | **850** | Known + International flashpoint |
| "Kremlin Denies 3-Way US-Ukraine-Russia Talks" | **820** | Known + International diplomacy |
| "Japan Pledges $6B for AI Development" | **780** | Known (Japan) + International tech race |
| "Macron Visits UAE for Security Talks" | **750** | Known (Macron) + International diplomacy |
| "Lovable Hits $6.6B Valuation with AI Coding" | **880** | PATH B: AI milestone + Growth story |

### ⚠️ Score 500-650 (Known but Regional)

| Article | Score | Reasoning |
|---------|-------|-----------|
| "Modi Hails Win in Maharashtra Polls" | **500** | Known (Modi) but regional election |
| "Fed's Hammack Signals Rates Steady" | **550** | Fed but regional official, not Chair |
| "UK Bans Trail Hunting" | **500** | Known (UK) but domestic policy |
| "803 Migrants Cross Channel" | **550** | Known issue but UK-specific stat |

### ❌ Score 100-400 (Fails one or more gates)

| Article | Score | Reasoning |
|---------|-------|-----------|
| "7-Year-Old Invites Shop Owner to Party" | **100** | Unknown person + Not news |
| "62-Year-Old Applies for 900 Jobs" | **150** | Unknown person + Human interest |
| "Paris Hilton Pink Mansion" | **250** | Known but lifestyle fluff |
| "Liver Disease Silent Symptoms" | **350** | Generic health education |
| "Hearts Beat Rangers 2-1" | **400** | Regional sports |
| "David Walliams Dropped by Publisher" | **450** | Regional celebrity (UK) |
| "The Verge's Best of 2025" | **200** | Year-end list, not news |

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Don't confuse "unknown person story" with "shareable insight"**
   - ❌ "62-Year-Old Applies for 900 Jobs" = Unknown person story (100-300)
   - ✅ "Job applications up 400% among seniors" = Shareable insight about a trend (850+)
   
2. **Don't penalize surprising statistics just because they're not "breaking news"**
   - ✅ "Concert tickets up 2,600%" is HIGHLY valuable even if not a breaking event
   
3. **Don't let famous names override regional scope**
   - Modi is known, but Maharashtra local polls are regional (500)
   
4. **Don't score lifestyle fluff high just because it mentions a celebrity**
   - Paris Hilton's pink mansion = still fluff (250)

5. **Do recognize when a "record" or "milestone" makes something shareable**
   - "$61B data center investment RECORD" = the record makes it notable (900)
   - "Data centers continue to grow" = boring without the hook (700)

6. **Do value the "wow factor" - stories people will talk about**
   - Ask: "Would someone share this at dinner?"
   - Ask: "Would this make someone say 'Did you know...?'"

---

## ✅ THE ULTIMATE TEST

Before assigning a score, ask TWO questions:

**For PATH A (Hard News):**
> "Would this story be discussed in news broadcasts in New York, London, Tokyo, São Paulo, and Lagos?"

**For PATH B (Shareable Insights):**
> "Would someone share this fact with friends and say 'Did you know...?' or 'That's crazy!'?"

If YES to either → Score 800+
If NO to both → Score below 700

---

## 📋 OUTPUT FORMAT

Return ONLY valid JSON array with exactly this structure for each article:

[
  {
    "title": "exact article title here",
    "path": "A_HARD_NEWS",
    "disqualifier": null,
    "gate1_global_entity": {
      "passed": true,
      "entity": "Apple, Tim Cook",
      "reasoning": "Global tech company known worldwide"
    },
    "gate2_international": {
      "passed": true,
      "reasoning": "Affects global tech industry"
    },
    "gate3_news_value": {
      "passed": true,
      "reasoning": "Major product announcement with consequences"
    },
    "for_path_b": null,
    "memorable_factors": ["IMPACTFUL", "QUOTABLE"],
    "score": 900,
    "status": "APPROVED",
    "category": "Technology"
  },
  {
    "title": "Concert Tickets Surge 2,600% Since Beatles Era",
    "path": "B_SHAREABLE_INSIGHT",
    "disqualifier": null,
    "gate1_global_entity": {
      "passed": true,
      "entity": "Music/Entertainment industry",
      "reasoning": "Universal topic everyone relates to"
    },
    "gate2_international": {
      "passed": true,
      "reasoning": "Global trend in entertainment pricing"
    },
    "gate3_news_value": {
      "passed": true,
      "reasoning": "Surprising statistic with wow factor"
    },
    "for_path_b": {
      "universal_topic": true,
      "topic": "Entertainment/Money",
      "surprise_factor": "MIND_BLOWING",
      "quotable": true
    },
    "memorable_factors": ["SHOCKING", "QUOTABLE", "EDUCATIONAL"],
    "score": 920,
    "status": "APPROVED",
    "category": "Entertainment"
  },
  {
    "title": "62-Year-Old Applies for 900 Jobs",
    "path": "DISQUALIFIED",
    "disqualifier": "UNKNOWN_PERSON",
    "gate1_global_entity": {
      "passed": false,
      "entity": "Unknown individual",
      "reasoning": "Person described by age, not name"
    },
    "gate2_international": {
      "passed": false,
      "reasoning": "Personal story, no global relevance"
    },
    "gate3_news_value": {
      "passed": false,
      "reasoning": "Human interest fluff, not news"
    },
    "for_path_b": null,
    "memorable_factors": [],
    "score": 150,
    "status": "FILTERED",
    "category": "Other"
  }
]

Rules:
- status = "APPROVED" if score >= 700
- status = "FILTERED" if score < 700
- path = "A_HARD_NEWS" or "B_SHAREABLE_INSIGHT" or "DISQUALIFIED"
- disqualifier = null or "UNKNOWN_PERSON" or "LIFESTYLE_FLUFF" or "REGIONAL_ONLY" or "GENERIC_HEALTH"
- for_path_b: include only for PATH B stories, null otherwise
- All three gates must be evaluated for each article
- memorable_factors: array of ["SHOCKING", "HISTORIC", "IMPACTFUL", "QUOTABLE", "EDUCATIONAL"] or empty []
- category: Tech, Business, Science, Politics, Finance, Crypto, Health, Entertainment, Sports, World, Other
- Maintain order of input articles
- No explanations outside the JSON
- Valid JSON only

"""
    # Prepare articles for scoring
    articles_text = "Score these news articles based on must-know criteria. Return JSON array only.\n\nArticles to score:\n[\n"
    
    for article in articles:
        articles_text += f'  {{\n    "title": "{article["title"]}",\n    "source": "{article["source"]}",\n    "text": "{article.get("text", "")[:500]}",\n    "url": "{article["url"]}"\n  }},\n'
    
    articles_text += "]\n\nEvaluate each article using the 3-gate system. Return JSON array with title, gates evaluation, score (0-950), and status (APPROVED if >=700, FILTERED if <700)."
    
    # Prepare request
    request_data = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": articles_text
                    }
                ]
            }
        ],
        "systemInstruction": {
            "parts": [
                {
                    "text": system_prompt
                }
            ]
        },
        "generationConfig": {
            "temperature": 0.3,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json"
        }
    }
    
    # Retry logic for rate limiting
    for attempt in range(max_retries):
        try:
            # Make API request
            response = requests.post(url, json=request_data, timeout=120)
            
            # Handle rate limiting (429) with longer exponential backoff
            if response.status_code == 429:
                wait_time = (2 ** attempt) * 15  # Longer backoff: 15s, 30s, 60s
                if attempt < max_retries - 1:
                    print(f"  ⚠️ Rate limited (429), waiting {wait_time}s before retry {attempt + 1}/{max_retries}...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"  ❌ Rate limit exceeded after {max_retries} attempts")
                    raise requests.exceptions.HTTPError(f"429 Too Many Requests after {max_retries} retries")
            
            response.raise_for_status()
            
            # Parse response
            result = response.json()
            
            # Extract text from response
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                
                # Check for safety ratings or blocked content
                if 'finishReason' in candidate:
                    finish_reason = candidate['finishReason']
                    if finish_reason != 'STOP':
                        print(f"⚠️ Gemini response finished with reason: {finish_reason}")
                        if finish_reason in ['SAFETY', 'RECITATION', 'OTHER']:
                            print(f"❌ Content blocked or filtered by Gemini")
                            if 'safetyRatings' in candidate:
                                print(f"Safety ratings: {candidate['safetyRatings']}")
                            return {"approved": [], "filtered": articles}
                
                if 'content' in candidate and 'parts' in candidate['content']:
                    response_text = candidate['content']['parts'][0]['text']
                else:
                    print(f"❌ No content in candidate. Candidate structure: {json.dumps(candidate, indent=2)[:500]}")
                    raise ValueError("No valid content in Gemini response")
            else:
                print(f"❌ No candidates in result. Result structure: {json.dumps(result, indent=2)[:500]}")
                raise ValueError("No valid response from Gemini API")
            
            # Parse JSON response with robust error handling
            scored_articles = None
            
            try:
                scored_articles = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON parse error: {e}")
                print(f"Response text: {response_text[:500]}...")
                
                # Try to fix truncated JSON response
                try:
                    scored_articles = _fix_truncated_json(response_text)
                    print(f"✅ Fixed truncated JSON - recovered {len(scored_articles)} articles")
                except Exception as fix_error:
                    print(f"❌ Could not fix JSON: {fix_error}")
                    print("❌ Could not parse JSON response")
                    return {"approved": [], "filtered": articles}
            
            # Separate approved and filtered articles
            approved = []
            filtered = []
            
            for scored_article in scored_articles:
                # Find original article
                original_article = None
                for article in articles:
                    if article['title'] == scored_article['title']:
                        original_article = article
                        break
                
                if original_article:
                    # Add score, status, and category to original article
                    original_article['score'] = scored_article['score']
                    original_article['status'] = scored_article['status']
                    original_article['category'] = scored_article.get('category', 'Other')
                    
                    # Validate category - update to match actual categories from Gemini
                    valid_categories = ['World', 'Politics', 'Business', 'Economy', 'Technology', 'Science', 'Health', 'Sports', 'Lifestyle', 
                                       'Environment', 'International', 'Culture', 'Disaster', 'Other']
                    if original_article['category'] not in valid_categories:
                        # Map common variations to valid categories (comprehensive mapping)
                        category_mapping = {
                            # Business & Finance
                            'Economy': 'Business',
                            'Economics': 'Business',
                            'Finance': 'Business',
                            'Markets': 'Business',
                            'Companies': 'Business',
                            'Global Economy': 'Business',
                            
                            # Culture & Entertainment
                            'Entertainment': 'Culture',
                            'Art': 'Culture',
                            'Arts': 'Culture',
                            'History': 'Culture',
                            'Religion': 'Culture',
                            
                            # Environment & Climate
                            'Weather': 'Environment',
                            'Climate': 'Environment',
                            'Energy': 'Environment',
                            
                            # Science & Technology
                            'Physics': 'Science',
                            'Biology': 'Science',
                            'Medicine': 'Science',
                            'Space': 'Science',
                            'Social Science': 'Science',
                            
                            # International & World
                            'World Affairs': 'International',
                            'World News': 'International',
                            'Military': 'International',
                            
                            # Lifestyle
                            'Education': 'Lifestyle',
                            'Shopping': 'Lifestyle',
                            'Home Improvement': 'Lifestyle',
                            'Real Estate': 'Lifestyle',
                            
                            # Other
                            'News': 'Other',
                            'General News': 'Other',
                            'Top News': 'Other',
                            'Law': 'Other',
                            'Security': 'Other'
                        }
                        mapped_category = category_mapping.get(original_article['category'], 'Other')
                        print(f"   📝 Mapped '{original_article['category']}' to '{mapped_category}' for: {original_article['title'][:50]}...")
                        original_article['category'] = mapped_category
                    
                    if scored_article['status'] == 'APPROVED':
                        approved.append(original_article)
                    else:
                        filtered.append(original_article)
            
            return {
                "approved": approved,
                "filtered": filtered
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 429:
                # Already handled above, but catch here if it slips through
                if attempt < max_retries - 1:
                    continue
            # Re-raise other HTTP errors or if retries exhausted
            if attempt == max_retries - 1:
                print(f"❌ API request failed after {max_retries} attempts: {e}")
                # Assign default categories when API fails
                for article in articles:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'FILTERED'
                return {"approved": [], "filtered": articles}
            raise
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 1
                print(f"  ⚠️ Request error (attempt {attempt + 1}/{max_retries}): {e}")
                print(f"  Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
                continue
            # After all retries exhausted
            print(f"❌ API request failed after {max_retries} attempts: {e}")
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'FILTERED'
            return {"approved": [], "filtered": articles}
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            # Assign default categories when any error occurs
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'FILTERED'
            return {"approved": [], "filtered": articles}

if __name__ == "__main__":
    # Test the function
    test_articles = [
        {
            "title": "European Central Bank raises interest rates to 4.5 percent",
            "source": "Reuters",
            "text": "The ECB announced Thursday it is raising rates by 0.25 percentage points to combat inflation.",
            "url": "https://www.reuters.com/markets/europe/ecb-rates-2024"
        },
        {
            "title": "Celebrity couple announces divorce",
            "source": "Entertainment Weekly",
            "text": "",
            "url": "https://ew.com/celebrity-divorce"
        }
    ]
    
    api_key = "YOUR_API_KEY_HERE"
    results = score_news_articles_step1(test_articles, api_key)
    print(f"Approved: {len(results['approved'])}")
    print(f"Filtered: {len(results['filtered'])}")