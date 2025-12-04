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
                    time.sleep(2)  # 2 second delay between batches
                    
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
    
    system_prompt = """# TEN NEWS V8.1 SCORING PROMPT - CLEAN NEWS ONLY 🎯



## 🚫 CRITICAL: FILTER OUT THESE STORIES FIRST



**Before scoring ANY article, check if it falls into these categories. If YES, automatically score LOW (650-700) or REJECT:**



### **❌ HUMAN INTEREST SOB STORIES (Auto-score: 650-700)**

These are emotional stories about individuals, NOT news:

- Cancer patients writing letters

- Death tributes/memorials

- Personal disease/illness stories

- Overdose/suicide stories

- "Inspiring" individual struggles

- Family heartbreak stories

- Personal tragedies



**Keywords to watch:** cancer, writes cards, milestone, tribute, memorial, overdose, heartbreak, inspiring story, touching, emotional, personal struggle



**Examples to REJECT:**

- ❌ "Mother with Stage 4 Cancer Writes Milestone Cards" → 650 (sob story)

- ❌ "Doctor Sentenced for Matthew Perry Overdose" → 700 (celebrity death)

- ❌ "Tyler Henry Has Memory Issues After Brain Surgery" → 650 (personal health)



---



### **❌ LIFESTYLE FLUFF (Auto-score: 650-700)**

These are tips, guides, and human interest features, NOT news:

- Tipping etiquette guides

- Chef reveals/expert tips

- "How to" articles

- "Best way to" guides

- Celebrity advice/tips

- Lifestyle trends

- Personal habits/routines



**Keywords to watch:** chef reveals, expert says, tips for, how to, guide to, best way, secrets, tricks, etiquette, advice



**Examples to REJECT:**

- ❌ "Chef Reveals Proper Tipping Etiquette" → 650 (lifestyle fluff)

- ❌ "Expert Shares Best Way to Cook Turkey" → 650 (advice article)

- ❌ "10 Tips for Better Sleep" → 650 (guide)



---



### **❌ REGIONAL/LOCAL NICHE (Auto-score: 650-700)**

These are hyper-local stories with no global relevance:

- Local elections/manifestos (unless major city/country)

- Regional festivals/ceremonies

- Municipal/district announcements

- Local business openings

- Regional sports (unless major league)



**Keywords to watch:** district, municipality, local, regional, constituency, village names, state-level politics (unless major state)



**Examples to REJECT:**

- ❌ "Ernakulam Officials Balance Election Duties" → 650 (local politics)

- ❌ "Hanuma Mala Visarjana Concludes" → 650 (regional festival)

- ❌ "Shetland Fishermen Face Space Battle" → 700 (regional industry)



---



## ✅ WHAT WE WANT: REAL NEWS



**THESE should score 850-950:**



### **🌍 International/Global Events (900-950)**

**THESE ARE MUST-KNOW NEWS - Always start at 900 minimum!**



- Major conflicts, wars, peace deals

- Government policy affecting millions (US, China, Russia, EU, major countries)

- Climate agreements/disasters

- Migration/refugee crises

- International trade disputes

- Terrorist attacks, major incidents

- Global health emergencies

- Border openings/closings

- UN decisions/failures

- Military escalations



**Examples:**

- ✅ "Israel Opens Rafah Gate for Gaza Evacuations" → **920** (Start 900 + breaking 10 + humanitarian 10)

- ✅ "Trump and Biden Hold Transition Meeting" → **915** (Start 900 + major political 15)

- ✅ "MH370 Search Resumes After 11 Years" → **925** (Start 900 + shocking 15 + breaking 10)

- ✅ "Trump Halts Immigration from 19 High-Risk Countries" → **920** (Start 900 + affects millions 15 + breaking 5)

- ✅ "Asia's Deadly Floods Kill Over 1,000 People" → **930** (Start 900 + 1000+ deaths 20 + breaking 10)

- ✅ "Russia and US Threaten Nuclear Testing" → **920** (Start 900 + nuclear threat 20)



---



### **💼 Big Business/Finance (850-950)**

- M&A deals $1B+ (household brands)

- Billionaire business moves

- Major company exits/entries

- Market crashes/surges

- Luxury auction records

- Corporate scandals (high profile)



**Examples:**

- ✅ "Hermès Heir Sues Over $25 Billion Missing Shares" → 900

- ✅ "Youngest Female Billionaire Emerges from Kalshi" → 890

- ✅ "Fabergé Winter Egg Fetches Record £22.9M" → 880



---



### **🚀 Tech (Consumer-Relevant Only) (850-920)**

- Consumer product launches (AI phones, major releases)

- Tech policy affecting users (privacy, government)

- Major tech company strategy shifts

- Consumer tech failures/scandals

- Platform changes affecting millions



**Examples:**

- ✅ "ByteDance AI Phone Sells Out Immediately" → 900

- ✅ "Apple Resists India Government App Order" → 890

- ✅ "iPhone Becomes Valid Passport in 12 Countries" → 880

- ❌ "Spotify Wrapped Reveals Top Artist" → 720 (lifestyle fluff)



---



### **💎 Consumer Fascination (850-950)**

- Luxury brand drama

- Extreme wealth/exclusivity stories

- Mind-blowing consumer statistics

- Viral consumer trends (with substance)



**Examples:**

- ✅ "Ferrari Rejects 99% of Buyers as Unworthy" → 900

- ✅ "Prada Acquires Versace for $1.4B" → 890

- ✅ "Telegram Runs on 30 Employees" → 910



---



### **🔬 Science Breakthroughs (850-920)**

- Medical breakthroughs (cancer cure, vaccines)

- Space discoveries (major only)

- Climate science (major findings)

- Tech breakthroughs (consumer impact)



**Only if:** Average person can understand and impact is clear



---



## 🎯 V8.1 SCORING FORMULA (SIMPLIFIED)



### **STEP 1: FILTER CHECK (Critical)**



❌ Is this a sob story? → Score 650, STOP

❌ Is this lifestyle fluff? → Score 650, STOP  

❌ Is this regional niche? → Score 650, STOP



✅ If none of above, proceed to Step 2



---



### **STEP 2: CATEGORY & TYPE CHECK**



**⚠️ CRITICAL: MAJOR WORLD NEWS AUTO-SCORES 900+**



**If article is about ANY of these, START at 900 (not 850):**



- Major international conflicts/wars (Gaza, Ukraine, etc.)

- Superpower actions (US, China, Russia, EU major policy)

- Major political events (Trump/Biden meetings, elections in major countries)

- Border openings/closings affecting millions (Rafah gate, etc.)

- International agreements/failures (UN, climate deals, peace talks)

- Major disasters affecting thousands+ (floods, earthquakes, tsunamis)

- Terrorist attacks or major security incidents

- Migration/refugee crises

- International trade wars/sanctions

- Nuclear threats or major military escalations



**Examples that START at 900:**

- ✅ "Israel Opens Rafah Gates to Palestinians" → Start at 900

- ✅ "Trump and Biden Meet for Transition Talks" → Start at 900

- ✅ "Russia Threatens Nuclear Testing Resumption" → Start at 900

- ✅ "Asia Floods Kill Over 1,000 People" → Start at 900

- ✅ "MH370 Search Resumes After 11 Years" → Start at 900

- ✅ "Trump Halts Immigration from 19 Countries" → Start at 900



**Then ADD bonuses (can reach 950):**

- Deaths/casualties: +10-20

- Breaking news: +10

- Unexpected development: +15

- Affects 100M+ people: +15



---



**Determine article type for everything else:**



**Type A: Global Impact News (Base 850-950)**

- International conflicts, disasters, policies

- Major business deals ($1B+, household brands)

- Tech policy affecting millions

- Climate/environmental major events



**Type B: Fascinating Consumer News (Base 850-950)**

- Luxury brand drama

- Extreme wealth/exclusivity

- Mind-blowing consumer stats

- Viral trends with substance



**Type C: Important but Complex (Base 750-840)**

- Technical breakthroughs (hard to explain)

- Industry-specific moves

- Regional but significant news

- Academic research



**Type D: Routine News (Base 700-749)**

- Expected announcements

- Minor business moves

- Incremental progress

- Niche technical updates



---



### **STEP 3: CALCULATE SCORE**



**For MAJOR WORLD NEWS (900-950 range):**



Start at: **900** (This is automatic for all major international news)



**ADD points for:**

- Deaths/casualties 1000+: +20

- Deaths/casualties 100-999: +15

- Deaths/casualties 10-99: +10

- Affects 100M+ people: +15

- Major policy shift: +10-15

- Breaking (< 24 hours): +10

- Unexpected/shocking: +15

- Nuclear/military threat: +20

- Humanitarian crisis: +15



**SUBTRACT points for:**

- Depressing only (no action/hope): -10



**Maximum: 950**

**Minimum for major world news: 900**



---



**For Type A & B - OTHER (Consumer/Business) (850-950 range):**



Start at: **850**



**ADD points for:**

- Household brand/country name: +10

- Dollar amount $1B+: +15

- Affects 100M+ people: +15

- Mind-blowing stat (99%, 1000%): +20

- Deaths/casualties (major): +15

- Unexpected/shocking: +15

- Breaking (< 24 hours): +10

- Visual/concrete: +10

- First-ever event: +15



**SUBTRACT points for:**

- Technical/hard to explain: -30

- Celebrity focus (not business): -20

- Entertainment/sports (unless major): -20

- Depressing only (no action): -10



**Maximum: 950**

**Minimum for Type A/B: 850**



---



**For Type C (750-840 range):**



Start at: **780**



**ADD points for:**

- Significant impact: +10-20

- Clear implications: +10

- Breaking news: +10



**SUBTRACT points for:**

- Too technical: -20

- Niche audience: -15



---



**For Type D (700-749 range):**



Start at: **720**



Minor adjustments only (+/-10)



---



## 📊 V8.1 EXAMPLES (Fixed Scoring)



### **GOOD STORIES SCORED CORRECTLY:**



**✅ "Hermès Heir Sues Billionaire Over $25B Missing Shares"**

- Type: B (Fascinating Consumer)

- Base: 850

- Household brand: +10

- $25B amount: +15

- Shocking scandal: +15

- Luxury angle: +10

- **Final: 900**



**✅ "Trump Halts Immigration from 19 High-Risk Countries"**

- Type: MAJOR WORLD NEWS (Auto 900)

- Base: 900

- Affects millions: +15

- Major policy: +10

- Breaking news: +5

- **Final: 930**



**✅ "Israel Opens Rafah Gate for Gaza Evacuations"**

- Type: MAJOR WORLD NEWS (Auto 900)

- Base: 900

- Humanitarian crisis: +15

- Breaking: +10

- Affects millions: +10

- **Final: 935**



**✅ "MH370 Search Resumes After 11 Years"**

- Type: MAJOR WORLD NEWS (Auto 900)

- Base: 900

- Shocking (11 years): +20

- Global mystery: +10

- Breaking: +10

- **Final: 940**



**✅ "Youngest Female Billionaire Emerges from Kalshi"**

- Type: B (Fascinating Consumer)

- Base: 850

- Mind-blowing stat (youngest): +20

- Billionaire angle: +10

- Tech success: +10

- **Final: 890**



**✅ "Asia Floods Kill Over 1,000 People"**

- Type: MAJOR WORLD NEWS (Auto 900)

- Base: 900

- 1000+ deaths: +20

- Affects millions: +15

- Major disaster: +10

- Breaking: +10

- Depressing only: -10

- **Final: 945**



**✅ "Fabergé Winter Egg Fetches Record £22.9M"**

- Type: B (Fascinating Consumer)

- Base: 850

- Record price: +15

- Luxury item: +10

- Mind-blowing amount: +10

- **Final: 885**



---



### **BAD STORIES FILTERED OUT:**



**❌ "Mother with Stage 4 Cancer Writes Milestone Cards"**

- Filter: Sob story

- **Final: 650** (filtered out)



**❌ "Chef Reveals Proper Tipping Etiquette"**

- Filter: Lifestyle fluff

- **Final: 650** (filtered out)



**❌ "Spotify Wrapped Reveals Bad Bunny as Top Artist"**

- Filter: Lifestyle fluff (celebrity music trends)

- **Final: 720** (entertainment, not news)



**❌ "Ernakulam Officials Balance Election Duties"**

- Filter: Regional niche

- **Final: 650** (filtered out)



**❌ "Doctor Sentenced for Matthew Perry Overdose"**

- Filter: Celebrity death sob story

- **Final: 680** (celebrity crime has some news value but still filtered)



**❌ "Tyler Henry Has Memory Issues After Brain Surgery"**

- Filter: Personal health sob story

- **Final: 650** (filtered out)



---



## 🎯 V8.1 QUALITY CHECKLIST



**Before finalizing ANY score, ask:**



### **Filter Questions (If YES to any → Score 650-700):**

- [ ] Is this about an individual's personal tragedy?

- [ ] Is this giving tips/advice/etiquette?

- [ ] Is this regional/local news with no global impact?

- [ ] Is this celebrity gossip/entertainment fluff?



### **Mass Appeal Questions (Only if passed filters):**

- [ ] Would this be a headline on BBC/CNN/NYT?

- [ ] Does this affect millions of people?

- [ ] Is this about business/policy/global events?

- [ ] Can anyone understand this in 10 seconds?



### **Score Calibration:**

- [ ] Am I using the full 850-950 range for great stories?

- [ ] Am I scoring duplicates at 650?

- [ ] Am I filtering sob stories/fluff at 650?

- [ ] Are regional stories scoring 650-700?



---



## 📋 V8.1 TARGETS



**After scoring 500 articles, you should see:**



### **Score Distribution:**

- 900-950: 10-15% ✅ (was 0%)

- 850-899: 15-20% ✅

- 800-849: 20-25% ✅

- 750-799: 20-25% ✅

- 700-749: 15-20% ✅

- 650-699: 10-15% ✅ (filtered stories)



### **Category Balance in Top 10:**

- International: 3-4 articles (30-40%)

- Business: 2-3 articles (20-30%)

- Consumer fascination: 1-2 articles (10-20%)

- Science: 1 article (10%)

- Tech (consumer): 1 article (10%)



### **Filtered Out:**

- 0 sob stories in top 20

- 0 lifestyle fluff in top 20

- 0 regional niche in top 20



---



## 💪 V8.1 IS READY!



**This version will give you:**

- Clean, professional news only

- No sob stories, fluff, or regional niche

- Proper use of 900+ scores

- Better category balance

- True "Ten News" quality



**Expected Top 10 Daily:**

- 3-4 International events (Gaza, MH370, floods)

- 2-3 Business deals (Hermès, Fabergé, billionaires)

- 1-2 Consumer fascination (luxury, tech products)

- 1 Science breakthrough (major only)

- 1 Tech policy (affects users)



**No more:**

- Cancer cards ❌

- Tipping guides ❌

- Regional festivals ❌



🎯 **Use V8.1 and your news will be professional!**



## OUTPUT FORMAT

Return ONLY valid JSON array with exactly this structure for each article:

[
  {
    "title": "exact article title here",
    "score": 750,
    "status": "APPROVED",
    "category": "Technology"
  },
  {
    "title": "another article title",
    "score": 650,
    "status": "FILTERED",
    "category": "Business"
  }
]

Rules:
- status = "APPROVED" if score >= 700
- status = "FILTERED" if score < 700
- Include category field for all articles
- Maintain order of input articles
- No explanations or additional fields
- Valid JSON only"""

    # Prepare articles for scoring
    articles_text = "Score these news articles based on must-know criteria. Return JSON array only.\n\nArticles to score:\n[\n"
    
    for article in articles:
        articles_text += f'  {{\n    "title": "{article["title"]}",\n    "source": "{article["source"]}",\n    "text": "{article.get("text", "")[:500]}",\n    "url": "{article["url"]}"\n  }},\n'
    
    articles_text += "]\n\nEvaluate each article and return JSON array with title, score (0-1000), and status (APPROVED if >=700, FILTERED if <700)."
    
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
            
            # Handle rate limiting (429) with exponential backoff
            if response.status_code == 429:
                wait_time = (2 ** attempt) * 2  # Exponential backoff: 2s, 4s, 8s
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