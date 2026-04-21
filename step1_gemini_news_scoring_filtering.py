#!/usr/bin/env python3
"""
STEP 1: GEMINI NEWS APPROVAL SYSTEM
==========================================
Purpose: Filter RSS articles into APPROVED or ELIMINATED
Model: Gemini 2.0 Flash
Input: RSS articles with title, source, description, url
Output: Approved articles (with category) or eliminated articles
"""

import requests
import json
import time
import re
from datetime import datetime, timezone
from typing import List, Dict

def _fix_truncated_json(json_text: str) -> Dict:
    """
    Fix truncated JSON responses from Gemini API
    """
    # Clean up the response
    json_text = json_text.strip()
    
    # Look for {"results": [...]} pattern
    start_idx = json_text.find('{')
    if start_idx == -1:
        raise ValueError("No JSON object found in response")
    
    json_text = json_text[start_idx:]
    
    # If it doesn't end with }, try to fix it by closing any open brackets/braces
    if not json_text.rstrip().endswith('}'):
        last_brace = json_text.rfind('}')
        if last_brace > 0:
            json_text = json_text[:last_brace + 1]

            open_brackets = json_text.count('[') - json_text.count(']')
            open_braces = json_text.count('{') - json_text.count('}')

            if open_brackets > 0:
                json_text += ']' * open_brackets
            if open_braces > 0:
                json_text += '}' * open_braces
    
    try:
        return json.loads(json_text)
    except json.JSONDecodeError as e:
        # Try to extract just the results array
        results_match = re.search(r'"results"\s*:\s*\[(.*?)\]', json_text, re.DOTALL)
        if results_match:
            try:
                results_str = '[' + results_match.group(1) + ']'
                results = json.loads(results_str)
                return {"results": results}
            except Exception:
                pass
        raise ValueError(f"Could not parse JSON: {e}")


def score_news_articles_step1(articles: List[Dict], api_key: str, batch_size: int = 50, max_retries: int = 5) -> Dict:
    """
    Step 1: Approve or Eliminate news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
        batch_size: Number of articles to process per API call (default: 50)
        max_retries: Maximum retry attempts for rate limiting (default: 5)
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    # Count articles with/without images for logging
    articles_with_images = sum(1 for a in articles if a.get('image_url') and a.get('image_url').strip())
    articles_without_images = len(articles) - articles_with_images
    
    if articles_without_images > 0:
        print(f"   📷 {articles_without_images} articles without images (Bright Data will fetch later)")
    print(f"   ✅ Filtering {len(articles)} total articles")
    
    # Use gemini-2.5-flash-lite for production
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={api_key}"
    
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
                    time.sleep(4)  # 4 second delay between batches (Gemini Flash handles high RPM)
                    
            except Exception as e:
                print(f"  ❌ Batch {batch_num} failed: {e}")
                # Mark batch articles as filtered on error
                for article in batch:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'ELIMINATED'
                    article['disqualifier'] = 'batch_error'
                all_filtered.extend(batch)
        
        return {
            "approved": all_approved,
            "filtered": all_filtered
        }
    else:
        # Single batch
        result = _process_batch(articles, url, api_key, max_retries)
        return result


def _process_batch(articles: List[Dict], url: str, api_key: str, max_retries: int = 5) -> Dict:
    """
    Process a single batch of articles with retry logic for rate limiting
    """
    
    system_prompt = """# TodayPlus Article Approval System V6

## YOUR ROLE

You are the **Chief Editor of TodayPlus**, a global news app. Your job: decide **APPROVED** or **ELIMINATED** for each article.

We need a **diverse, well-rounded feed** — not just hard news. Users follow Sports, Entertainment, Tech, Science, and Business alongside World affairs. Approve enough variety so every interest category is represented.

---

## CORE PHILOSOPHY

**"Would someone who follows this topic want to see this?"**

We serve users from **15 countries** with personalized interests across many topics. Approve real news that matters — to any of our user segments. A Premier League fan cares about match results. A tech enthusiast cares about product launches. A science reader cares about new discoveries. **Serve all of them.**

**Our 15 countries:** USA, UK, Canada, Australia, India, Germany, France, Spain, Italy, Ukraine, Russia, Türkiye, China, Japan, Israel

---

## DECISION FRAMEWORK

### APPROVE if:
- A real event happened or a real development occurred
- It has significance — globally, for one of our 15 countries, OR for users who follow that topic
- A reader who follows this topic/country would find it interesting
- It adds variety to the feed (sports, entertainment, tech, science are all valuable)

### ELIMINATE if:
- It's pure opinion with no news hook (pure editorials, hot takes with no event)
- It's promotional (betting, promo codes, deals, "how to watch")
- It's a trivial individual story with no broader significance
- It's from a non-covered country AND has no global impact AND no topic-interest value
- It's a routine/incremental update with nothing new
- It's noise that adds no value

---

## INTEREST SCORING (1-10)

For each APPROVED article, also output an **interest score from 1-10**. Score from the perspective of **users who follow the article's topic or country** — not the general public.

| Score | Level | Description |
|-------|-------|-------------|
| 9-10 | Must-Know for EVERYONE | Wars, mass casualties 20+, world-changing events |
| 7-8 | Major for topic followers or a covered country | Elections, policy shifts, $1B+ deals, championship results, blockbuster releases |
| 5-6 | Notable and interesting | Regular major-league results, notable tech/science news, economic updates, celebrity events |
| 4 | Niche but real news | Less mainstream sports, minor but real developments, smaller tech/science stories |
| 3 | Borderline | Very niche, routine, or from non-covered country with limited appeal |
| 1-2 | Filler | Barely newsworthy to anyone |

**Key instruction:** A Premier League match result is a 6-7 for sports followers. A notable tech product launch is a 6. A celebrity health diagnosis is a 5-6. Turkish domestic news is a 7 if Türkiye followers would care. Only score 1-3 for truly routine filler or non-covered country local news with zero topic appeal.

---

## COUNTRY-AWARE RULES

### News from our 15 countries — LENIENT
Approve national-level news, political developments, economic policy, notable incidents, significant business, sports, entertainment, and cultural events. **If a reader who selected that country would find it interesting, APPROVE it.**

Examples to APPROVE:
- "Türkiye Central Bank raises rates to 45%" → Approve (major economic policy)
- "German coalition talks collapse" → Approve
- "India launches new space mission" → Approve
- "Australian wildfires force evacuations" → Approve
- "Japan PM calls snap election" → Approve
- "Italian PM announces major reform" → Approve
- "Istanbul metro expansion opens new line" → Approve (notable Türkiye infrastructure)
- "Erdogan meets Saudi Crown Prince in Ankara" → Approve (Türkiye diplomacy)
- "Turkish lira hits new low against dollar" → Approve (Türkiye economy)
- "Major earthquake hits eastern Türkiye" → Approve (significant incident)
- "Türkiye arrests opposition journalist" → Approve (human rights, political)

**Important:** Articles from non-English sources (Turkish, Russian, German, etc.) about our 15 countries should still be evaluated and approved if newsworthy. The language of the source does not matter — only the content.

### News from OTHER countries — MODERATE
Approve if it has global significance OR strong topic appeal:
- Mass casualties (10+ deaths)
- Affects multiple countries or regions
- Major geopolitical shift
- Unprecedented natural disaster
- Major sports results from globally followed events (e.g., Copa Libertadores final, Brazilian football)
- Significant tech/science developments regardless of origin country

Examples to ELIMINATE from non-covered countries:
- "Peru local elections update" → Eliminate (not our country, not global, no topic interest)
- "Thai court rules on local dispute" → Eliminate
- "Argentine province governor resigns" → Eliminate
- "Malaysian minister visits Indonesia" → Eliminate (routine diplomacy)

---

## SPORTS RULES — BE GENEROUS

Sports fans want results. **Approve all real match results and confirmed events from major leagues.**

### APPROVE these sports:
- **ALL match results** from TOP leagues: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, NBA, NFL, NHL, MLB, MLS, F1, MotoGP, Cricket (international + IPL), UFC/Boxing main cards, Tennis (ATP/WTA tour events), Golf (PGA majors)
- Championship finals and playoffs at any level of major sports
- Major tournament results (Grand Slams, Olympics, World Cups)
- Record-breaking moments, historic milestones
- Major transfers and signings ($20M+)
- Significant injuries to star players
- New team entries (e.g., Cadillac joining F1)
- Major coaching changes at top clubs
- Notable esports tournament results (Worlds, Majors)

### ELIMINATE these sports:
- Minor league, college, and youth results (unless historic)
- Player rumors without confirmed events
- Pre-match predictions and betting previews
- Betting odds and tips
- "How to watch" guides
- Fantasy sports advice
- Training camp reports with no real news

---

## BUSINESS RULES

### APPROVE:
- Significant deals and acquisitions ($50M+)
- Major market moves (indices up/down 2%+)
- CEO changes at major or well-known companies
- Tech funding rounds ($10M+)
- Mass layoffs (200+)
- Regulatory actions with real impact
- Economic policy changes (interest rates, trade deals, sanctions)
- Major product launches from known companies
- Notable startup milestones (unicorn status, major pivot, shutdown)

### ELIMINATE:
- Routine quarterly earnings with no surprises
- Seeking Alpha / investment analysis articles
- Earnings call transcripts
- Press releases without real news value
- Local business openings/closings
- Financial advice columns
- Generic market commentary ("Markets mixed today")

---

## TECH & AI RULES — BE GENEROUS

Tech enthusiasts follow this space closely. **Approve real tech news from known companies and platforms.**

### APPROVE:
- New AI model releases and significant updates
- AI company news (funding, partnerships, regulation, leadership)
- Product launches and major updates from known companies (Apple, Google, Microsoft, Samsung, Meta, Amazon, Nintendo, Sony, etc.)
- Cybersecurity breaches and notable hacks
- Tech layoffs (200+)
- Significant regulatory actions (antitrust, data privacy)
- Space launches and discoveries
- Gaming: major game releases, console news, industry deals, showcase events
- Streaming platform news (mergers, major content deals, price changes)
- Notable open-source releases and developer platform changes

### ELIMINATE:
- Product reviews and buying guides
- How-to tutorials
- Truly minor app updates (bug fixes, small UI changes)
- Generic "AI will change everything" opinion pieces with no news hook

---

## ENTERTAINMENT RULES — BE GENEROUS

Entertainment adds variety. **Approve real events involving well-known figures and cultural moments.**

### APPROVE:
- Major award ceremonies and nominations (Oscars, Grammys, Emmys, Golden Globes, etc.)
- Celebrity news with real events: health diagnoses, deaths, marriages, divorces, arrests, legal cases, retirements
- Major film/TV/music releases and announcements from big studios or well-known artists
- Streaming platform mergers and major content deals
- Cultural events with broad appeal (festivals, concerts, tours)
- Gaming industry events and major releases
- Notable viral cultural moments with real-world impact

### ELIMINATE:
- Celebrity gossip without real events ("spotted dating", rumor mills)
- Reality TV recaps
- Pure tabloid speculation

---

## FOOD & COOKING RULES — BE GENEROUS

Food is a major interest. **Approve recipes, restaurant news, food trends, and culinary content from food sources.**

### APPROVE:
- Recipes from established food sources (BBC Good Food, NYT Cooking, Cookie and Kate, Food Republic, TASTE)
- Restaurant openings, closings, and reviews from notable publications
- Food trends and culinary culture stories
- Chef profiles and interviews
- Food safety news and recalls
- Seasonal and holiday cooking features
- Notable cookbook releases

### ELIMINATE:
- Generic "what I ate today" personal blogs
- Pure product promotions ("buy this kitchen gadget")
- Duplicate recipes from low-quality aggregator sites

---

## FASHION & STYLE RULES — BE GENEROUS

Fashion is a key lifestyle interest. **Approve fashion news, designer stories, and style content.**

### APPROVE:
- Fashion week coverage and designer collection news
- Major brand launches and collaborations
- Celebrity style news with substance (not just "who wore what")
- Designer profiles, interviews, and career news
- Fashion industry business news (mergers, new creative directors)
- Seasonal trend reports from established publications (Fashionista, StyleCaster, Vogue)
- Sustainable fashion developments

### ELIMINATE:
- Pure "shop this look" affiliate content
- Low-effort outfit roundups with no editorial value

---

## TRAVEL & LIFESTYLE RULES — BE GENEROUS

Travel and lifestyle content serves users who want inspiration and practical information.

### APPROVE:
- Destination features and travel guides from established sources (Conde Nast Traveler, Nomadic Matt)
- Hotel and airline industry news
- Travel advisories and policy changes (visa rules, border changes)
- Cultural experiences and festival coverage
- Home and interior design features from notable publications
- Wellness and fitness news with substance

### ELIMINATE:
- Pure promotional hotel/resort advertising
- Generic packing lists or "travel hacks" without substance

---

## SCIENCE & HEALTH RULES — BE GENEROUS

Science readers want to stay informed. **Approve real research results and discoveries from credible sources.**

### APPROVE:
- Breakthroughs and significant findings (published research, new discoveries)
- Space discoveries, missions, and launches
- Climate science developments and major environmental events
- New treatments, drug approvals, and vaccine results
- Disease outbreaks affecting many people
- Notable animal/nature discoveries
- Technology-science crossovers (biotech, quantum computing, fusion energy)
- Archaeological discoveries

### ELIMINATE:
- "Study suggests maybe..." with truly weak or preliminary conclusions
- Niche academic papers with no real-world relevance
- Alternative medicine promotion

---

## DATE AWARENESS

You will be told today's date in the user message. Use it to:
- ELIMINATE articles about events that clearly happened months or years ago (stale news)
- ELIMINATE articles with future dates that have already passed (e.g., "targets 2024 launch" when we're in 2026)
- Articles should describe RECENT events (within the last 48 hours ideally)

## ALWAYS ELIMINATE (regardless of country/topic):

| Type | Examples |
|------|----------|
| **Pure opinion with no news hook** | Pure editorials, hot takes not tied to any event |
| **Non-lifestyle Listicles/Guides** | "15 Best...", "How to...", "Top 10..." — BUT approve if it's a recipe, travel guide, or fashion feature from an established lifestyle source |
| **Promotional** | Betting odds, promo codes, deals, "where to buy", "how to watch" |
| **Trivial individual stories** | "Mom of 3 shares...", "Man drives 5000 miles...", personal journeys |
| **Investment advice** | "Buy this stock", Seeking Alpha, earnings transcripts |
| **Weather** | Routine forecasts (disasters ARE news) |
| **Routine updates** | No new information, just rehashing existing story |
| **Pure speculation** | Headlines that are entirely "May/Could/Might" with zero confirmed facts |

**Note:** An article that reports a real event but includes some analysis is NOT "opinion" — it's news with context. Approve it. Only eliminate pure opinion pieces with no news hook.

---

## CATEGORY ASSIGNMENT

When approving, assign one category:

| Category | For |
|----------|-----|
| World | International affairs, diplomacy, conflicts |
| Politics | Government, elections, policy |
| Business | Companies, economy, trade |
| Tech | Technology, AI, startups, space, gaming |
| Science | Research, discoveries, climate |
| Health | Medicine, public health |
| Finance | Markets, currencies, banking |
| Sports | All sports results and news |
| Entertainment | Celebrity news, cultural events, music, film/TV |
| Food | Recipes, restaurants, cooking, culinary culture |
| Fashion | Style, designers, fashion industry, beauty |
| Travel | Destinations, travel guides, hotel/airline news |
| Lifestyle | Home, wellness, fitness, personal development |

---

## OUTPUT FORMAT

```json
{
  "results": [
    {"id": 1, "decision": "APPROVED", "category": "Sports", "interest": 8},
    {"id": 2, "decision": "ELIMINATED"},
    {"id": 3, "decision": "APPROVED", "category": "Tech", "interest": 6}
  ]
}
```

For APPROVED articles, include `"interest"` (1-10 score). Omit for ELIMINATED articles.

---

## QUICK TEST

Before eliminating, ask yourself: **"Would a user who follows this topic be interested?"**

If yes → APPROVE it.

---

*TodayPlus Article Approval System V6*
*"Diverse, quality news for every interest"*
"""
    
    # Prepare articles for filtering
    today = datetime.now(timezone.utc).strftime('%B %d, %Y')
    articles_text = f"TODAY'S DATE: {today}\n\nFilter these news articles. Return JSON with results array.\n\nArticles to filter:\n"
    
    for idx, article in enumerate(articles):
        articles_text += f'\n[Article {idx + 1}]\n'
        articles_text += f'ID: {idx + 1}\n'
        articles_text += f'Title: {article["title"]}\n'
        articles_text += f'Source: {article["source"]}\n'
        if article.get("source_country"):
            articles_text += f'Source Country: {article["source_country"]}\n'
        if article.get("text"):
            articles_text += f'Description: {article.get("text", "")[:300]}\n'
    
    articles_text += '\n\nReturn JSON object with "results" array. Each result needs: id, decision (APPROVED/ELIMINATED), category (only for APPROVED), and interest score 1-10 (only for APPROVED).'
    
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
            "temperature": 0.2,
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
                wait_time = (2 ** attempt) * 30
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
                            return {"approved": [], "filtered": articles}
                
                if 'content' in candidate and 'parts' in candidate['content']:
                    response_text = candidate['content']['parts'][0]['text']
                else:
                    print(f"❌ No content in candidate")
                    raise ValueError("No valid content in Gemini response")
            else:
                print(f"❌ No candidates in result")
                raise ValueError("No valid response from Gemini API")
            
            # Parse JSON response
            parsed_response = None
            
            try:
                parsed_response = json.loads(response_text)
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON parse error: {e}")
                print(f"Response text: {response_text[:500]}...")
                
                # Try to fix truncated JSON response
                try:
                    parsed_response = _fix_truncated_json(response_text)
                    print(f"✅ Fixed truncated JSON")
                except Exception as fix_error:
                    print(f"❌ Could not fix JSON: {fix_error}")
                    return {"approved": [], "filtered": articles}
            
            # Get results array
            results_array = parsed_response.get('results', [])
            if not results_array and isinstance(parsed_response, list):
                results_array = parsed_response
            
            # Separate approved and filtered articles
            approved = []
            filtered = []
            
            for result_item in results_array:
                article_id = result_item.get('id', 0) - 1  # Convert to 0-indexed
                
                if 0 <= article_id < len(articles):
                    original_article = articles[article_id].copy()
                    decision = result_item.get('decision', 'ELIMINATED').upper()
                    
                    if decision == 'APPROVED':
                        original_article['status'] = 'APPROVED'
                        original_article['category'] = result_item.get('category', 'Other')
                        original_article['score'] = 750  # Default score, will be updated after writing
                        original_article['path'] = 'A'  # Default path
                        original_article['interest_score'] = result_item.get('interest', 5)
                        
                        # Validate category
                        valid_categories = ['World', 'Politics', 'Business', 'Tech', 'Science',
                                          'Health', 'Finance', 'Sports', 'Entertainment',
                                          'Food', 'Fashion', 'Travel', 'Lifestyle', 'Other']
                        if original_article['category'] not in valid_categories:
                            # Map common variations
                            category_mapping = {
                                'Technology': 'Tech',
                                'Economy': 'Business',
                                'International': 'World',
                                'Culture': 'Entertainment',
                                'Cooking': 'Food',
                                'Recipe': 'Food',
                                'Recipes': 'Food',
                                'Style': 'Fashion',
                                'Beauty': 'Fashion',
                                'Wellness': 'Lifestyle',
                                'Fitness': 'Lifestyle',
                                'Home': 'Lifestyle',
                            }
                            original_article['category'] = category_mapping.get(
                                original_article['category'], 'Other'
                            )
                        
                        approved.append(original_article)
                    else:
                        original_article['status'] = 'ELIMINATED'
                        original_article['category'] = 'Other'
                        original_article['score'] = 0
                        original_article['path'] = 'DISQUALIFIED'
                        original_article['disqualifier'] = 'not_globally_relevant'
                        filtered.append(original_article)
            
            # Handle any articles not in results (mark as filtered)
            processed_ids = set()
            for result_item in results_array:
                article_id = result_item.get('id', 0) - 1
                if 0 <= article_id < len(articles):
                    processed_ids.add(article_id)
            
            for idx, article in enumerate(articles):
                if idx not in processed_ids:
                    article_copy = article.copy()
                    article_copy['status'] = 'ELIMINATED'
                    article_copy['category'] = 'Other'
                    article_copy['score'] = 0
                    article_copy['path'] = 'DISQUALIFIED'
                    article_copy['disqualifier'] = 'not_in_response'
                    filtered.append(article_copy)
            
            return {
                "approved": approved,
                "filtered": filtered
            }
            
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 429:
                if attempt < max_retries - 1:
                    continue
            if attempt == max_retries - 1:
                print(f"❌ API request failed after {max_retries} attempts: {e}")
                for article in articles:
                    article['category'] = 'Other'
                    article['score'] = 0
                    article['status'] = 'ELIMINATED'
                return {"approved": [], "filtered": articles}
            raise
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 1
                print(f"  ⚠️ Request error (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(wait_time)
                continue
            print(f"❌ API request failed after {max_retries} attempts: {e}")
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'ELIMINATED'
            return {"approved": [], "filtered": articles}
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            for article in articles:
                article['category'] = 'Other'
                article['score'] = 0
                article['status'] = 'ELIMINATED'
            return {"approved": [], "filtered": articles}


if __name__ == "__main__":
    # Test the function
    test_articles = [
        {
            "title": "NATO Conducts Air Patrols Near Ukraine Border",
            "source": "Reuters",
            "text": "NATO forces conducted extensive air patrols near the Ukrainian border.",
            "url": "https://www.reuters.com/world/nato-patrols"
        },
        {
            "title": "15 Best Wireless Headphones for 2026",
            "source": "TechRadar",
            "text": "Our comprehensive guide to the best wireless headphones this year.",
            "url": "https://techradar.com/headphones"
        }
    ]
    
    api_key = "YOUR_API_KEY_HERE"
    results = score_news_articles_step1(test_articles, api_key)
    print(f"Approved: {len(results['approved'])}")
    print(f"Filtered: {len(results['filtered'])}")
