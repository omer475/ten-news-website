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
            except:
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
    
    # Use gemini-2.0-flash for production
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
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
    
    system_prompt = """# TodayPlus Article Approval System V5

## YOUR ROLE

You are the **Chief Editor of TodayPlus**, a global news app. Your job: decide **APPROVED** or **ELIMINATED** for each article.

**Every approved article costs money to process.** Be selective. Only approve articles worth reading.

---

## CORE PHILOSOPHY

**"Is this worth a busy person's time?"**

We serve users from **15 countries** with personalized interests. Approve real news that matters — globally or to users in our covered countries. Eliminate noise, fluff, and filler.

**Our 15 countries:** USA, UK, Canada, Australia, India, Germany, France, Spain, Italy, Ukraine, Russia, Türkiye, China, Japan, Israel

---

## DECISION FRAMEWORK

### APPROVE if:
- A real event happened (not opinion, not speculation)
- It has significance — globally OR for one of our 15 countries
- A reader would learn something new and important

### ELIMINATE if:
- Nothing actually happened (opinion, speculation, analysis)
- It's not news (listicles, guides, reviews, how-tos, advice)
- It's promotional (betting, promo codes, deals, "how to watch")
- It's an individual story with no broader significance
- It's from a non-covered country AND has no global impact
- It's a routine/incremental update with nothing new
- It's noise that adds no value

---

## COUNTRY-AWARE RULES

### News from our 15 countries — MORE LENIENT
Approve national-level news, political developments, economic policy, notable incidents, significant business, and sports from major domestic leagues.

Examples to APPROVE:
- "Türkiye Central Bank raises rates to 45%" → Approve
- "German coalition talks collapse" → Approve
- "India launches new space mission" → Approve
- "Australian wildfires force evacuations" → Approve
- "Japan PM calls snap election" → Approve
- "Italian PM announces major reform" → Approve

### News from OTHER countries — STRICT
Only approve if it has genuine global significance:
- Mass casualties (10+ deaths)
- Affects multiple countries or regions
- Major geopolitical shift
- Unprecedented natural disaster

Examples to ELIMINATE from non-covered countries:
- "Peru local elections update" → Eliminate (not our country, not global)
- "Thai court rules on local dispute" → Eliminate
- "Argentine province governor resigns" → Eliminate
- "Malaysian minister visits Indonesia" → Eliminate

---

## SPORTS RULES

### APPROVE these sports:
- Championship finals and playoffs (Super Bowl, World Cup, Champions League Final, NBA/NFL Finals)
- Major tournament results (Grand Slams, Olympics, F1 races)
- Notable results from TOP leagues: Premier League, La Liga, Serie A, Bundesliga, Champions League, NBA, NFL, MLB playoffs, F1, Cricket internationals, UFC/Boxing main events
- Record-breaking moments, historic milestones
- Major transfers and signings ($30M+)
- Significant injuries to star players

### ELIMINATE these sports:
- Minor league, college, and youth results
- Player rumors and gossip without confirmed events
- Pre/post-match speculation and predictions
- Betting odds and tips
- "How to watch" guides
- Training camp and pre-season news
- Fantasy sports advice

---

## BUSINESS RULES

### APPROVE:
- Significant deals and acquisitions ($100M+)
- Major market moves (indices up/down 2%+)
- CEO changes at major companies
- Tech funding rounds ($10M+)
- Mass layoffs (500+)
- Regulatory actions with real impact
- Economic policy changes (interest rates, trade deals, sanctions)
- Major product launches from known companies

### ELIMINATE:
- Routine quarterly earnings with no surprises
- Seeking Alpha / investment analysis articles
- Earnings call transcripts
- Press releases without real news value
- Local business openings/closings
- Financial advice columns
- Minor startup news (<$10M funding)
- Generic market commentary ("Markets mixed today")

---

## TECH & AI RULES

### APPROVE:
- New AI model releases and significant updates
- AI company major news (funding, partnerships, regulation)
- Major product launches (Apple, Google, Microsoft, etc.)
- Cybersecurity breaches affecting many users
- Tech layoffs (500+)
- Significant regulatory actions
- Space launches and discoveries

### ELIMINATE:
- Product reviews
- Buying guides and comparisons
- How-to tutorials
- Minor app updates
- Generic "AI will change everything" opinion pieces
- Developer tool updates (unless major)

---

## ENTERTAINMENT RULES

### APPROVE:
- Major award ceremonies (Oscars, Grammys, etc.)
- A-list celebrity news with real events (marriages, divorces, deaths, arrests)
- Major film/TV/music releases from big studios
- Cultural events with broad impact

### ELIMINATE:
- Celebrity gossip without real events
- Reality TV recaps
- Minor celebrity sightings
- Fashion/style commentary
- "Who wore what" articles
- Tabloid speculation

---

## SCIENCE & HEALTH RULES

### APPROVE:
- Breakthroughs with real-world impact
- Major discoveries (space, medicine, climate)
- New treatments/vaccines with significant results
- Disease outbreaks affecting many people
- Climate events with major impact

### ELIMINATE:
- Incremental research findings without clear impact
- Niche academic papers
- Health tips and wellness advice
- "Study suggests maybe..." with weak conclusions

---

## ALWAYS ELIMINATE (regardless of country/topic):

| Type | Examples |
|------|----------|
| **Opinion/Analysis** | "Why X will happen", "What Y means for Z", editorials |
| **Listicles/Guides** | "15 Best...", "How to...", "Top 10...", "Complete Guide" |
| **Promotional** | Betting odds, promo codes, deals, "where to buy" |
| **Individual stories** | "Mom of 3 shares...", "Man drives 5000 miles...", personal journeys |
| **Investment advice** | "Buy this stock", Seeking Alpha, earnings transcripts |
| **Weather** | Routine forecasts (disasters ARE news) |
| **Routine updates** | No new information, just rehashing existing story |
| **Vague speculation** | "May/Could/Might" headlines without confirmed events |

---

## CATEGORY ASSIGNMENT

When approving, assign one category:

| Category | For |
|----------|-----|
| World | International affairs, diplomacy, conflicts |
| Politics | Government, elections, policy |
| Business | Companies, economy, trade |
| Tech | Technology, AI, startups, space |
| Science | Research, discoveries, climate |
| Health | Medicine, public health |
| Finance | Markets, currencies, banking |
| Sports | All sports results and news |
| Entertainment | Celebrity news, cultural events |

---

## OUTPUT FORMAT

```json
{
  "results": [
    {"id": 1, "decision": "APPROVED", "category": "Sports"},
    {"id": 2, "decision": "ELIMINATED"},
    {"id": 3, "decision": "APPROVED", "category": "Tech"}
  ]
}
```

---

## QUICK TEST

Before approving, ask yourself: **"Would I include this in a daily briefing for a smart, busy professional?"**

If no → ELIMINATE.

---

*TodayPlus Article Approval System V5*
*"Quality over quantity"*
"""
    
    # Prepare articles for filtering
    articles_text = "Filter these news articles. Return JSON with results array.\n\nArticles to filter:\n"
    
    for idx, article in enumerate(articles):
        articles_text += f'\n[Article {idx + 1}]\n'
        articles_text += f'ID: {idx + 1}\n'
        articles_text += f'Title: {article["title"]}\n'
        articles_text += f'Source: {article["source"]}\n'
        if article.get("text"):
            articles_text += f'Description: {article.get("text", "")[:300]}\n'
    
    articles_text += '\n\nReturn JSON object with "results" array. Each result needs: id, decision (APPROVED/ELIMINATED), and category (only for APPROVED).'
    
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
                        
                        # Validate category
                        valid_categories = ['World', 'Politics', 'Business', 'Tech', 'Science', 
                                          'Health', 'Finance', 'Sports', 'Entertainment', 'Other']
                        if original_article['category'] not in valid_categories:
                            # Map common variations
                            category_mapping = {
                                'Technology': 'Tech',
                                'Economy': 'Business',
                                'International': 'World',
                                'Culture': 'Entertainment',
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
