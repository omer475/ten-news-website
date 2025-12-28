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
    # Using gemini-2.0-flash-exp
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
    
    system_prompt = """# TEN NEWS SCORING V13 - STRICTER CRITERIA + BETTER 900+ IDENTIFICATION

## 🎯 CORE PRINCIPLE

**Ten News curates 10 stories daily that are globally important, universally interesting, OR culturally fascinating.**

Three paths to a high score:

```
PATH A: HARD NEWS (Traditional importance)
→ Global entity + International relevance + Newsworthy event

PATH B: SHAREABLE INSIGHTS (Universal interest)  
→ Surprising facts/statistics + Universal topic + "Wow factor"

PATH C: WATER COOLER STORIES (Culturally fascinating)
→ Bizarre/unusual events + High discussability + Viral potential
```

---

## 🚨 NEW IN V13: ADDITIONAL DISQUALIFIERS

### LISTICLES = Score 300-500

Articles formatted as lists or rankings without breaking news value:

| Article | Score | Why |
|---------|-------|-----|
| "Snowflake CEO's 4 Rules for Effective Meetings" | **400** | Business listicle, not news |
| "Countries Ranked: Reading Proficiency Revealed" | **450** | Ranking/listicle format |
| "Top 10 AI Trends for 2026" | **350** | Year-end listicle |
| "5 Ways to Improve Your Morning Routine" | **200** | Self-help listicle |

**Pattern to detect:** Headlines with numbers followed by "rules", "ways", "tips", "trends", "things", "ranked"

### GENERIC TREND PIECES = Score 400-600

Vague societal trends without hard data or breaking news:

| Article | Score | Why |
|---------|-------|-----|
| "Gen Z and Millennials Embrace Analog Activities" | **500** | Vague trend, no hard news |
| "Open Earbuds Trend Surges" | **450** | Product trend, not news |
| "Customer Survey Fatigue Surges" | **400** | Generic business trend |
| "Remote Work Continues to Grow" | **450** | Vague trend piece |

**Exception:** Trend pieces WITH shocking statistics become Path B (e.g., "Concert Tickets Up 2,600%" = 890)

### CLICKBAIT SCIENCE/TRIVIA = Score 300-500

Quirky science or trivia without real importance:

| Article | Score | Why |
|---------|-------|-----|
| "Human Body: Counting the Holes and Their Purpose" | **350** | Clickbait trivia |
| "Why Do We Yawn?" | **300** | Evergreen trivia |
| "Scientists Discover New Species of Frog" | **450** | Minor discovery |

**Exception:** Major scientific breakthroughs score 850+ (e.g., "Cancer Cure Found" = 920)

### MINOR CULTURAL/LIFESTYLE = Score 400-600

Cultural pieces without global significance:

| Article | Score | Why |
|---------|-------|-----|
| "Japan Celebrates Milestone Birthdays: 60, 77, 88" | **450** | Cultural trivia |
| "How Different Countries Celebrate New Year" | **400** | Seasonal fluff |
| "The History of Pizza" | **350** | Evergreen content |

### RANDOM/QUIRKY STORIES = Score 400-600

Unusual stories about unknown entities:

| Article | Score | Why |
|---------|-------|-----|
| "China Students Use Chalk Dust to Crack Phone Safe" | **500** | Quirky but not important |
| "Man Builds House Entirely from Bottles" | **350** | Human interest quirk |

---

## 🔥 SCORE THRESHOLD PHILOSOPHY (UPDATED)

### 900-950 = MUST-KNOW NEWS
Stories that **everyone needs to know**. These would be the TOP story on CNN, BBC, Al Jazeera simultaneously.

**Automatic 900+ triggers:**
- ✅ Active war developments (attacks, escalations, peace treaties)
- ✅ Billion-dollar deals between global giants
- ✅ World leader summits/meetings with major stakes
- ✅ Deaths of global icons
- ✅ Major geopolitical shifts (nuclear threats, invasions)
- ✅ Historic firsts in major conflicts
- ✅ Government deals worth $5B+ 

**Examples that SHOULD be 900+:**
| Article | Score | Why |
|---------|-------|-----|
| "Russia Launches Air Attack on Kyiv" | **920** | Active war attack |
| "Zelenskyy to Meet Trump" | **910** | Major diplomatic summit |
| "Putin Warns of Escalation if Ukraine Rejects Talks" | **900** | Nuclear power escalation warning |
| "Trump Admin Buys 10% Stake in Intel for $8.8B" | **920** | Massive government deal |
| "Brigitte Bardot Dies at 91" | **900** | Global icon death |
| "Disney Strikes $1B OpenAI Deal" | **920** | Two global giants deal |

### 850-899 = HIGHLY IMPORTANT NEWS
Stories that **everyone should know**. Significant global developments, major policy changes, important milestones.

**Examples:**
| Article | Score | Why |
|---------|-------|-----|
| "South Korea Closes 4,000 Schools Amid Crisis" | **880** | Massive social crisis |
| "Musk Oversees $10B in US Budget Cuts" | **880** | Major policy impact |
| "Chile Forms Giant Lithium Firm with China" | **870** | Major resource deal |
| "Concert Tickets Up 2,600% Since Beatles" | **890** | Mind-blowing stat |
| "Data Centers Hit $61B Record" | **880** | Record milestone |

### 800-849 = NOTABLE NEWS
Good, newsworthy stories with global relevance. Worth including but not exceptional.

**Examples:**
| Article | Score | Why |
|---------|-------|-----|
| "Taiwan Shaken by 6.6 Magnitude Earthquake" | **830** | Natural disaster, known location |
| "Philippines Accuses China of Water Cannon Attack" | **820** | International incident |
| "Japan's H3 Rocket Fails" | **810** | Tech setback, known entity |

### 700-799 = BORDERLINE
May include on slow news days. Not priority.

### Below 700 = FILTER OUT
Regional news, lifestyle fluff, unknown individuals, listicles, generic trends.

---

## 🚨 INSTANT DISQUALIFIERS (Check First)

### TIER 1: Score 100-300 (Always Filter)

| Type | Score Range | Examples |
|------|-------------|----------|
| **Unknown Individuals** | 100-300 | "62-Year-Old Applies for 900 Jobs" |
| **Lifestyle Fluff** | 200-300 | "Paris Hilton Transforms Mansion" |
| **Self-Help Listicles** | 200-300 | "5 Ways to Improve Your Life" |
| **Clickbait Trivia** | 200-350 | "Why Do We Yawn?" |

### TIER 2: Score 300-500 (Usually Filter)

| Type | Score Range | Examples |
|------|-------------|----------|
| **Business Listicles** | 300-500 | "CEO's 4 Rules for Meetings" |
| **Generic Rankings** | 400-500 | "Countries Ranked by Reading" |
| **Generic Trend Pieces** | 400-500 | "Gen Z Embraces Analog" |
| **Minor Cultural** | 400-500 | "Japan Celebrates Birthdays" |
| **Quirky Stories** | 400-500 | "Students Crack Phone with Chalk" |

### TIER 3: Score 500-700 (Filter Unless Slow Day)

| Type | Score Range | Examples |
|------|-------------|----------|
| **Regional News** | 500-600 | "Modi Wins Maharashtra Polls" |
| **Minor International** | 600-700 | "France Cuts Emissions 30%" |
| **Routine Announcements** | 600-700 | "Japan Pledges $6B for AI" |

---

## 🌟 PATH A: HARD NEWS (Score 700-950)

### Score 900-950: MUST-KNOW Hard News

**Automatic 900+ criteria (ANY of these = 900+):**
1. Active military attacks/operations in major conflicts
2. Peace treaties or major diplomatic breakthroughs
3. World leader summits with high stakes (Trump-Zelenskyy, Xi-Putin)
4. Deaths of globally recognized icons
5. Deals worth $5B+ between global entities
6. Nuclear threats or escalations
7. Major invasions or territorial changes
8. Historic firsts in warfare/diplomacy

| Article | Score | Trigger |
|---------|-------|---------|
| "Russia Launches Air Attack on Kyiv" | **920** | Active military attack |
| "Zelenskyy to Meet Trump Amid Rising Tensions" | **910** | High-stakes summit |
| "Putin Warns of Escalation" | **900** | Nuclear power warning |
| "Trump Admin Buys 10% Intel Stake for $8.8B" | **920** | $8.8B government deal |
| "Brigitte Bardot Dies at 91" | **900** | Global icon death |
| "Ukraine Strikes Russian Sub with Drones" | **910** | Historic first in war |
| "North Korea Warns Japan Over Nuclear Push" | **900** | Nuclear threat |

### Score 850-899: Important Hard News

- Major policy changes affecting millions
- Significant diplomatic developments (not summits)
- Large-scale crises (4,000 schools closing)
- Important military movements (not attacks)
- Major corporate restructuring with global impact

| Article | Score | Reasoning |
|---------|-------|-----------|
| "South Korea Closes 4,000 Schools Amid Crisis" | **880** | Massive social impact |
| "Musk Oversees $10B in US Budget Cuts" | **880** | Major policy impact |
| "Israel Seals Off West Bank Village" | **860** | International flashpoint |
| "Poland Races to Build Bomb Shelters" | **860** | Security escalation |

### Score 800-849: Notable Hard News

- International incidents without escalation
- Natural disasters in known locations
- Routine diplomatic activities
- Policy announcements without immediate impact

| Article | Score | Reasoning |
|---------|-------|-----------|
| "Taiwan 6.6 Magnitude Earthquake" | **830** | Natural disaster |
| "Philippines Accuses China of Attack" | **820** | Incident, not escalation |
| "Syria Protests After Mosque Bombing" | **820** | Regional unrest |

---

## 🌟 PATH B: SHAREABLE INSIGHTS (Score 700-899)

**Note:** Path B caps at 899. Statistics are fascinating but not "must-know breaking news."

### Score 870-899: Mind-Blowing Insights

Must have SHOCKING statistics that change perspective:

| Article | Score | Why It Works |
|---------|-------|--------------|
| "Concert Tickets Up 2,600% Since Beatles" | **890** | Mind-blowing percentage |
| "Only 8 Men Own Same Wealth as Poorest 50%" | **890** | Shocking inequality |
| "Data Centers Hit $61B Record" | **880** | Record + AI trend |
| "90% of Ocean Plastic from 10 Rivers" | **885** | Perspective-changing |

### Score 850-869: Very Surprising Insights

Impressive but not jaw-dropping:

| Article | Score | Why |
|---------|-------|-----|
| "Starlink Reaches 9M Users, 20K/Day" | **865** | Strong growth |
| "Waymo Achieves 14 Million Rides" | **860** | Major milestone |
| "Gold Prices Surge to Record Highs" | **855** | Record but expected |

### Score 800-849: Interesting Insights

Worth noting but not shareable:

| Article | Score | Why |
|---------|-------|-----|
| "Coffee Prices Skyrocket" | **820** | Price news |
| "AI Boom Drives RAM Chip Shortage" | **830** | Tech impact |

### ❌ NOT Path B (Disqualified)

| Article | Score | Why It Fails |
|---------|-------|--------------|
| "Gen Z Embraces Analog Activities" | **500** | No shocking stat, vague trend |
| "Countries Ranked: Reading Proficiency" | **450** | Listicle format |
| "Customer Survey Fatigue Surges" | **400** | Generic business |

---

## 🌟 PATH C: WATER COOLER STORIES (Score 700-899)

**Note:** Path C caps at 899 unless the action IS major policy (then it's Path A).

### Score 870-899: Shocking/Bizarre from Major Entities

| Article | Score | Why |
|---------|-------|-----|
| "ICE Christmas Ad Shows Santa Detaining Migrants" | **880** | US gov + Bizarre + Viral |
| "Pentagon Releases UFO Footage" | **875** | Government + Mystery |
| "China Bans Effeminate Men on TV" | **870** | Major country + Controversial |

### Score 850-869: Unusual Actions

| Article | Score | Why |
|---------|-------|-----|
| "Trump to Design Navy Ships" | **865** | Unusual but announcement |
| "France Bans Short-Haul Flights" | **860** | Unusual policy |
| "British Alcohol Hits Record Low" | **855** | Cultural shift + data |

### When Path C Becomes Path A (900+)

If the bizarre action IS significant policy:

| Article | Score | Why It's Path A |
|---------|-------|-----------------|
| "Trump Renames Gulf of Mexico" | **920** | Actual policy change |

---

## 📊 COMPLETE SCORING MATRIX V13

### Quick Reference

| Score | Category | What Qualifies |
|-------|----------|----------------|
| **900-950** | MUST-KNOW | Active war, major summits, $5B+ deals, icon deaths, nuclear threats |
| **870-899** | HIGHLY IMPORTANT | Major crises, mind-blowing stats, shocking events |
| **850-869** | VERY IMPORTANT | Policy changes, strong milestones, unusual actions |
| **800-849** | NOTABLE | Good international news, interesting insights |
| **700-799** | BORDERLINE | May include on slow days |
| **500-699** | WEAK | Regional, minor international |
| **300-499** | FILTER | Listicles, trends, quirky stories |
| **100-299** | DISQUALIFIED | Unknown people, lifestyle fluff |

---

## ⚠️ COMMON MISTAKES TO AVOID

### 1. Missing 900+ Stories

❌ WRONG: "Zelenskyy to Meet Trump" → 870
✅ CORRECT: "Zelenskyy to Meet Trump" → 910 (high-stakes summit)

❌ WRONG: "Russia Attacks Kyiv" → 860
✅ CORRECT: "Russia Attacks Kyiv" → 920 (active war attack)

❌ WRONG: "Trump Buys Intel Stake for $8.8B" → 800
✅ CORRECT: "Trump Buys Intel Stake for $8.8B" → 920 (massive deal)

### 2. Letting Listicles Score High

❌ WRONG: "CEO's 4 Rules for Meetings" → 800
✅ CORRECT: "CEO's 4 Rules for Meetings" → 400 (listicle = disqualified)

### 3. Letting Generic Trends Score High

❌ WRONG: "Gen Z Embraces Analog Activities" → 800
✅ CORRECT: "Gen Z Embraces Analog Activities" → 500 (generic trend)

### 4. Missing the Difference Between Trends and Stats

❌ "Gen Z Embraces Analog" = Generic trend (500)
✅ "Concert Tickets Up 2,600%" = Mind-blowing stat (890)

The difference: One has a SHOCKING NUMBER, the other doesn't.

---

## ✅ THE ULTIMATE TESTS

**For 900+ (Must-Know):**
> "Would this be BREAKING NEWS on CNN, BBC, and Al Jazeera RIGHT NOW?"

**For 850-899 (Highly Important):**
> "Would this be a LEAD STORY (not breaking) on major networks?"

**For 800-849 (Notable):**
> "Would this get significant coverage on international news?"

**For Disqualification:**
> "Is this a listicle, generic trend, quirky story, or clickbait?"

---

## 📋 FINAL V13 CALIBRATED EXAMPLES

| Article | Path | Score | Key Factor |
|---------|------|-------|------------|
| "Russia Attacks Kyiv" | A | **920** | Active war attack |
| "Trump Buys Intel Stake $8.8B" | A | **920** | Massive deal |
| "Zelenskyy Meets Trump" | A | **910** | High-stakes summit |
| "Brigitte Bardot Dies at 91" | A | **900** | Icon death |
| "Putin Warns Escalation" | A | **900** | Nuclear warning |
| "Concert Tickets Up 2,600%" | B | **890** | Mind-blowing stat |
| "South Korea Closes 4,000 Schools" | A | **880** | Major crisis |
| "ICE Santa Ad" | C | **880** | Bizarre + Viral |
| "Musk $10B Budget Cuts" | A | **880** | Major policy |
| "Data Centers $61B Record" | B | **880** | Record milestone |
| "Starlink Reaches 9M Users" | B | **865** | Growth milestone |
| "Trump Designs Navy Ships" | C | **865** | Unusual action |
| "Israel Seals West Bank" | A | **860** | Flashpoint |
| "British Alcohol Record Low" | C | **855** | Cultural shift |
| "Taiwan 6.6 Earthquake" | A | **830** | Natural disaster |
| "Coffee Prices Skyrocket" | B | **820** | Price news |
| "Gen Z Embraces Analog" | DISQ | **500** | Generic trend |
| "CEO's 4 Rules" | DISQ | **400** | Listicle |
| "Human Body Holes" | DISQ | **350** | Clickbait trivia |
| "Countries Ranked Reading" | DISQ | **450** | Listicle |

---

## 📋 OUTPUT FORMAT

Return ONLY valid JSON array with exactly this structure for each article:

[
  {
    "title": "exact article title here",
    "path": "A_HARD_NEWS",
    "disqualifier": null,
    "is_must_know": true,
    "must_know_trigger": "ACTIVE_WAR_ATTACK",
    "globally_known_entity": true,
    "entity": "Russia, Ukraine",
    "score": 920,
    "status": "APPROVED",
    "category": "World"
  },
  {
    "title": "Concert Tickets Up 2,600% Since Beatles",
    "path": "B_SHAREABLE_INSIGHT",
    "disqualifier": null,
    "is_must_know": false,
    "must_know_trigger": null,
    "globally_known_entity": true,
    "entity": "Entertainment industry",
    "score": 890,
    "status": "APPROVED",
    "category": "Entertainment"
  },
  {
    "title": "CEO's 4 Rules for Meetings",
    "path": "DISQUALIFIED",
    "disqualifier": "LISTICLE",
    "is_must_know": false,
    "must_know_trigger": null,
    "globally_known_entity": false,
    "entity": null,
    "score": 400,
    "status": "FILTERED",
    "category": "Business"
  }
]

Rules:
- status = "APPROVED" if score >= 800
- status = "FILTERED" if score < 800
- path = "A_HARD_NEWS" or "B_SHAREABLE_INSIGHT" or "C_WATER_COOLER" or "DISQUALIFIED"
- disqualifier = null or "UNKNOWN_PERSON" or "LIFESTYLE_FLUFF" or "LISTICLE" or "GENERIC_TREND" or "CLICKBAIT_TRIVIA" or "QUIRKY_RANDOM" or "REGIONAL"
- is_must_know = true only for 900+ scores
- must_know_trigger = null or "ACTIVE_WAR_ATTACK" or "PEACE_TREATY" or "HIGH_STAKES_SUMMIT" or "ICON_DEATH" or "MAJOR_DEAL_5B+" or "NUCLEAR_THREAT" or "HISTORIC_FIRST"
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