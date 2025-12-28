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
    
    system_prompt = """# TEN NEWS SCORING V12 - GLOBAL + SHAREABLE + CULTURALLY INTERESTING

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

**All paths require the story to be about GLOBAL topics or entities, not regional issues or unknown individuals.**

---

## 🔥 SCORE THRESHOLD PHILOSOPHY

### 900+ = MUST-KNOW NEWS
Stories that **everyone needs to know**. Breaking developments that will be discussed on every major news network worldwide. Historic moments, major deals between global giants, shocking policy changes by world leaders, significant war developments.

**Examples of 900+ stories:**
- Peace treaties, war escalations, historic firsts in major conflicts
- Billion-dollar deals between globally known companies
- Shocking policy changes by world leaders (Trump renames Gulf of Mexico)
- Major geopolitical shifts (North Korea nuclear developments)

### 850-899 = HIGHLY INTERESTING NEWS
Stories that **everyone wants to know**. Fascinating, shareable, viral-worthy content that people will discuss at dinner or share on social media. Records, milestones, cultural shifts, bizarre events.

**Examples of 850-899 stories:**
- Mind-blowing statistics (Concert tickets up 2,600%)
- Viral government actions (ICE Santa ad)
- Cultural shifts (British alcohol consumption record low)
- Tech milestones (Starlink reaches 9M users)
- Box office records (Avatar 3 opens $345M)

### 800-849 = SOLID NEWS
Good, newsworthy stories worth including but not exceptional.

### Below 800 = FILTERED OUT
Regional news, lifestyle fluff, unknown individuals, routine announcements.

---

## 🚨 INSTANT DISQUALIFIERS (Check First)

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

**The rule:** If the headline describes a person by age, gender, occupation, or generic descriptor instead of their NAME → they are unknown → Score 100-300 max.

### LIFESTYLE/ENTERTAINMENT FLUFF = Score 200-400

| Article | Score | Why |
|---------|-------|-----|
| "Paris Hilton Transforms Mansion into Pink Wonderland" | **250** | Celebrity home decor, zero importance |
| "Rock Stars' 10 Hard Christmas Alternatives" | **200** | Listicle entertainment filler |
| "Laura Dern Recalls Spielberg's Awkward Dinosaur Roar" | **200** | Old celebrity anecdote |
| "UK House Breaks Record with 44.7m Christmas Tree" | **250** | Quirky local interest |
| "The Verge's 13 Top Art Projects from 2025" | **200** | Publication's year-end list |

### GENERIC HEALTH/WELLNESS = Score 300-450

| Article | Score | Why |
|---------|-------|-----|
| "Liver Disease Shows Silent Symptoms" | **350** | Generic health education |
| "Orange Juice Cuts Blood Pressure" | **300** | Clickbait health tip |

**Exception:** Major medical breakthroughs (cure discovered, pandemic news) can score 900+

### REGIONAL NEWS = Score 400-600

| Article | Score | Why |
|---------|-------|-----|
| "Modi Hails Win in Maharashtra Local Polls" | **450** | Indian state politics |
| "BJP Leader at Tamil Nadu Rally" | **350** | Indian regional event |
| "Louisiana Captures Jail Escapee" | **350** | US local crime |
| "UK Bans Trail Hunting" | **450** | UK domestic policy |
| "Fed's Hammack Signals Rates Steady" | **550** | Regional Fed official |

---

## 🚨 GATE 1: GLOBAL ENTITY CHECK

**Question: Is the main entity recognized by average people in USA, Europe, AND Asia?**

### ✅ GLOBALLY KNOWN ENTITIES

**World Leaders:** Putin, Trump, Biden, Xi Jinping, Zelensky, Modi, Macron, Kim Jong Un, Netanyahu, Pope Francis

**Tech Giants:** Apple, Google, Microsoft, Amazon, Meta, Tesla, Netflix, OpenAI, ChatGPT, Nvidia, Samsung, TikTok, SpaceX, Starlink

**Global Companies:** Disney, Nike, Ferrari, Toyota, McDonald's, Coca-Cola, Boeing, Airbus, LVMH, Pfizer

**Entertainment:** Taylor Swift, Beyoncé, BTS, Marvel, Star Wars, Avatar, James Cameron

**Countries/Organizations:** USA, China, Russia, EU, UK, NATO, UN, WHO, Ukraine, Israel, North Korea, Iran, Japan

**Government Agencies (when notable):** ICE, FBI, CIA, Pentagon, NASA

### ❌ NOT GLOBALLY KNOWN

Regional politicians, regional companies, regional celebrities, niche sports figures

---

## 🚨 GATE 2: INTERNATIONAL RELEVANCE CHECK

**Question: Would this story matter to people in at least 3 different continents?**

Stories that DO have international relevance:
- Wars/Conflicts affecting multiple nations
- Global economic policy (Fed Chair Powell, not regional Fed presidents)
- Climate/Environment affecting planet
- International diplomacy (treaties, summits, sanctions)
- Major tech/science breakthroughs
- Cultural shifts in major countries
- Bizarre government actions that spark international discussion

---

## 🌟 PATH A: HARD NEWS (Score 800-950)

Traditional breaking news with global significance.

### Score 900-950: MUST-KNOW Hard News
- Historic events (peace treaties, major escalations)
- Billion-dollar deals between global giants
- Shocking policy changes by world leaders
- Major geopolitical shifts
- Significant war developments with strategic impact

### Score 850-899: Important Hard News
- Notable diplomatic developments
- Significant but not historic military events
- Major corporate announcements
- International flashpoints

### Score 800-849: Solid Hard News
- Routine but newsworthy international events
- Standard diplomatic meetings
- Expected policy announcements

### ✅ Examples

| Article | Score | Reasoning |
|---------|-------|-----------|
| "Russia-Ukraine Sign Peace Treaty" | **950** | Historic, war-ending event |
| "Disney Strikes $1B OpenAI Deal" | **920** | Two global giants + Industry-shaping |
| "Ukraine Strikes Russian Sub with Underwater Drones" | **910** | Historic first + Major war development |
| "Trump Renames Kennedy Center, Gulf of Mexico" | **920** | World leader + Shocking action |
| "North Korea Warns Japan Over Nuclear Weapons Push" | **900** | Nuclear tensions + Major powers |
| "US Intel Warns Putin Seeks Full Ukraine Control" | **880** | Important intel but not breaking action |
| "Israel Approves 19 New West Bank Settlements" | **860** | International flashpoint, ongoing issue |
| "Japan Pledges $6B for AI Development" | **820** | Notable but routine announcement |

---

## 🌟 PATH B: SHAREABLE INSIGHTS (Score 800-899)

Stories with surprising statistics, records, or facts that make people say "Did you know...?"

**Note:** Path B stories max out at 899 because they are fascinating but not "must-know breaking news."

### Score 870-899: Mind-Blowing Insights
- Shocking statistics that change perspective
- Record-breaking milestones
- Data that reveals how the world is changing

### Score 850-869: Very Surprising Insights
- Impressive records and milestones
- Interesting trend data
- Notable achievements

### Score 800-849: Interesting Insights
- Good statistics worth sharing
- Minor records
- Industry milestones

### ✅ Examples

| Article | Score | Reasoning |
|---------|-------|-----------|
| "Concert Tickets Surge 2,600% Since Beatles Era" | **890** | Mind-blowing stat + Universal topic |
| "Data Centers Hit $61B Investment Record in 2025" | **880** | Record milestone + AI angle |
| "Avatar 3 Opens with $345M Worldwide Box Office" | **875** | Big numbers + Global franchise |
| "Starlink Adds 20,000 Users Daily, Reaches 9M" | **870** | Growth milestone + Known entity |
| "Lovable Hits $6.6B Valuation with AI Coding" | **865** | AI milestone + Explosive growth |
| "90% of Ocean Plastic Comes from 10 Rivers" | **880** | Surprising fact + Environmental |
| "Only 8 Men Own Same Wealth as Poorest 50%" | **885** | Shocking inequality stat |
| "Japan Has More People Over 80 Than Under 10" | **870** | Mind-bending demographic fact |

---

## 🌟 PATH C: WATER COOLER STORIES (Score 800-899)

Stories that are culturally fascinating and highly discussable. They make people say "Can you believe this?"

**Note:** Path C stories max out at 899 unless they cross into Path A territory (world leader doing something shocking that IS the news itself, like Trump renaming Gulf of Mexico).

### Score 870-899: Shocking/Bizarre Events
- Bizarre government actions that go viral
- Controversial decisions sparking debate
- Unprecedented actions by known entities

### Score 850-869: Very Unusual Events
- Unusual corporate/government behavior
- Cultural shifts with data
- Highly shareable moments

### Score 800-849: Interesting Cultural Moments
- Notable but less shocking events
- Trend indicators
- Discussable but not viral

### ✅ Examples

| Article | Score | Reasoning |
|---------|-------|-----------|
| "ICE Christmas Ad Shows Santa Detaining Migrants" | **880** | Bizarre government action + Viral |
| "Trump to Co-Lead Navy Ship Design for 'Golden Fleet'" | **865** | Unprecedented action + Quotable |
| "British Alcohol Consumption Falls to Record Low" | **855** | Cultural shift + Surprising trend |
| "China Bans Effeminate Men on Television" | **870** | Major country + Controversial policy |
| "France Bans Short-Haul Flights Where Trains Exist" | **860** | Unusual policy + Climate angle |
| "Pentagon Releases New UFO Footage" | **875** | Government + Mysterious + Viral |

### When Path C Becomes Path A (900+)

If a "bizarre" action is SO significant that it's the news itself (not just interesting), it becomes Path A:

| Article | Score | Why It's Path A, Not C |
|---------|-------|------------------------|
| "Trump Renames Gulf of Mexico" | **920** | This IS major policy news, not just bizarre |
| "China Annexes Taiwan" | **950** | Historic geopolitical event |

---

## 📊 COMPLETE SCORING MATRIX

### Quick Reference

| Score Range | Category | Description |
|-------------|----------|-------------|
| **900-950** | MUST-KNOW | Breaking news everyone needs to know. Historic events, major deals, shocking world leader actions, war developments. |
| **870-899** | HIGHLY INTERESTING | Fascinating stories everyone wants to know. Mind-blowing stats, viral moments, bizarre events. |
| **850-869** | VERY INTERESTING | Strong stories worth attention. Good records, unusual events, notable milestones. |
| **800-849** | SOLID NEWS | Newsworthy stories worth including. |
| **600-799** | BORDERLINE | May or may not make the cut. |
| **400-599** | REGIONAL | Known entity but regional scope. |
| **200-399** | FLUFF | Lifestyle, generic health, entertainment filler. |
| **100-199** | DISQUALIFIED | Unknown individuals, human interest fluff. |

### Path-Specific Ranges

| Path | Score Range | Criteria |
|------|-------------|----------|
| **A: Hard News** | 900-950 | Historic + Global giants + Shocking/Breaking |
| **A: Hard News** | 850-899 | Important + International + Notable |
| **A: Hard News** | 800-849 | Solid + International + Routine |
| **B: Shareable** | 870-899 | Mind-blowing stat + Universal + Quotable |
| **B: Shareable** | 850-869 | Very surprising + Shareable |
| **B: Shareable** | 800-849 | Interesting + Worth sharing |
| **C: Water Cooler** | 870-899 | Bizarre/Shocking + Viral + Discussable |
| **C: Water Cooler** | 850-869 | Very unusual + Shareable |
| **C: Water Cooler** | 800-849 | Interesting cultural moment |

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Don't give 900+ to fascinating-but-not-breaking stories**
   - ❌ "Concert Tickets Up 2,600%" = 890, not 920 (fascinating stat, not must-know)
   - ❌ "ICE Santa Ad" = 880, not 900 (viral, not essential news)
   - ✅ "Disney $1B OpenAI Deal" = 920 (two global giants, industry-shaping)

2. **Don't confuse "bizarre" with "must-know"**
   - "Trump designs Navy ships" = 865 (unusual announcement)
   - "Trump renames Gulf of Mexico" = 920 (this IS significant policy news)

3. **Path B and C cap at 899 unless crossing into Path A**
   - Statistics, no matter how mind-blowing, are 899 max
   - Bizarre events are 899 max unless they ARE major policy/news

4. **Don't undervalue Path B and C stories**
   - They should still score 850-899, making them Top 10 worthy
   - Just not in the "must-know" 900+ tier

5. **Reserve 900+ for stories that would lead every news broadcast**
   - Would CNN/BBC/Al Jazeera all lead with this?
   - If yes → 900+
   - If "interesting segment" → 850-899

---

## ✅ THE ULTIMATE TESTS

**For 900+ (Must-Know):**
> "Would this be the TOP story on CNN, BBC, and Al Jazeera simultaneously?"

**For 850-899 (Highly Interesting):**
> "Would someone share this saying 'Did you know?' or 'Can you believe this?'"

**For 800-849 (Solid News):**
> "Is this newsworthy and relevant to a global audience?"

---

## 📋 FINAL CALIBRATED EXAMPLES

| Article | Path | Score | Key Factor |
|---------|------|-------|------------|
| "Disney Strikes $1B OpenAI Deal" | A | **920** | Two global giants |
| "Trump Renames Gulf of Mexico" | A | **920** | World leader shocking policy |
| "Ukraine Strikes Russian Sub" | A | **910** | Historic first in major war |
| "North Korea Warns Japan Nuclear" | A | **900** | Nuclear tensions |
| "Concert Tickets Up 2,600%" | B | **890** | Mind-blowing stat |
| "Data Centers Hit $61B Record" | B | **880** | Record milestone |
| "ICE Santa Ad Detaining Migrants" | C | **880** | Bizarre + Viral |
| "US Intel: Putin Wants All Ukraine" | A | **880** | Important intel |
| "Avatar 3 Opens $345M" | B | **875** | Big box office |
| "Starlink Reaches 9M Users" | B | **870** | Growth milestone |
| "Lovable Hits $6.6B Valuation" | B | **865** | AI growth |
| "Trump to Design Navy Ships" | C | **865** | Unusual announcement |
| "Israel Approves Settlements" | A | **860** | Ongoing flashpoint |
| "British Alcohol Record Low" | C | **855** | Cultural shift |
| "Japan $6B AI Pledge" | A | **820** | Routine announcement |
| "Modi Wins Maharashtra" | - | **500** | Regional |
| "Paris Hilton Mansion" | - | **250** | Lifestyle fluff |
| "7-Year-Old Invites Shop Owner" | - | **100** | Unknown person |

---

## 📋 OUTPUT FORMAT

Return ONLY valid JSON array with exactly this structure for each article:

[
  {
    "title": "exact article title here",
    "path": "A_HARD_NEWS",
    "disqualifier": null,
    "is_must_know": true,
    "must_know_reason": "GLOBAL_GIANTS_DEAL",
    "for_path_a": {
      "globally_known_entity": true,
      "entity": "Disney, OpenAI",
      "international_relevance": true,
      "historic_or_breaking": true,
      "memorable_factors": ["SHOCKING", "HISTORIC", "IMPACTFUL"]
    },
    "for_path_b": null,
    "for_path_c": null,
    "score": 920,
    "status": "APPROVED",
    "category": "Technology"
  },
  {
    "title": "Concert Tickets Surge 2,600% Since Beatles Era",
    "path": "B_SHAREABLE_INSIGHT",
    "disqualifier": null,
    "is_must_know": false,
    "must_know_reason": null,
    "for_path_a": null,
    "for_path_b": {
      "universal_topic": true,
      "topic": "Entertainment/Money",
      "surprise_factor": "MIND_BLOWING",
      "quotable": true
    },
    "for_path_c": null,
    "score": 890,
    "status": "APPROVED",
    "category": "Entertainment"
  },
  {
    "title": "ICE Christmas Ad Shows Santa Detaining Migrants",
    "path": "C_WATER_COOLER",
    "disqualifier": null,
    "is_must_know": false,
    "must_know_reason": null,
    "for_path_a": null,
    "for_path_b": null,
    "for_path_c": {
      "known_entity": true,
      "entity": "ICE (US Government)",
      "bizarre_factor": "SHOCKING",
      "viral_potential": true,
      "cultural_significance": true
    },
    "score": 880,
    "status": "APPROVED",
    "category": "Politics"
  },
  {
    "title": "62-Year-Old Applies for 900 Jobs",
    "path": "DISQUALIFIED",
    "disqualifier": "UNKNOWN_PERSON",
    "is_must_know": false,
    "must_know_reason": null,
    "for_path_a": null,
    "for_path_b": null,
    "for_path_c": null,
    "score": 150,
    "status": "FILTERED",
    "category": "Other"
  }
]

Rules:
- status = "APPROVED" if score >= 800
- status = "FILTERED" if score < 800
- path = "A_HARD_NEWS" or "B_SHAREABLE_INSIGHT" or "C_WATER_COOLER" or "DISQUALIFIED"
- disqualifier = null or "UNKNOWN_PERSON" or "LIFESTYLE_FLUFF" or "REGIONAL_ONLY" or "GENERIC_HEALTH"
- is_must_know = true only for 900+ scores
- must_know_reason = null or "HISTORIC_EVENT" or "GLOBAL_GIANTS_DEAL" or "WORLD_LEADER_SHOCKING_POLICY" or "MAJOR_WAR_DEVELOPMENT"
- Include only the relevant path object (for_path_a, for_path_b, or for_path_c), set others to null
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