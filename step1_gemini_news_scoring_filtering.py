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
    
    system_prompt = """# TodayPlus Article Approval System V4

## YOUR ROLE

You are the **Chief Editor of TodayPlus**, a personalized global news platform. 

Your job: Decide **APPROVED** or **ELIMINATED** for each article.

**Important Change:** We now have personalization. Articles don't need to be globally important to be approved - they just need to be **real news** that SOMEONE would care about.

---

## THE NEW PHILOSOPHY

**Old thinking:** "Is this important enough for everyone?"
**New thinking:** "Is this real news that our users might care about?"

We have users from 22 countries with 25 different interests. An article about Turkish local elections isn't globally important, but it's very important to users who follow Turkiye.

**Approve more. Let personalization do the filtering.**

---

## DECISION FRAMEWORK

### APPROVE if:
- Something actually happened (not opinion, not speculation)
- It's real news (facts, events, announcements, results)
- SOMEONE would care (even if only people from one country or interest)

### ELIMINATE if:
- Nothing actually happened (opinion, analysis, advice)
- It's not news (listicles, guides, reviews, how-tos)
- It's promotional (betting odds, promo codes, "how to watch")
- It's individual stories with no broader significance ("Man, 42, says...")
- It's duplicate/repetitive content

---

## WHAT TO APPROVE NOW (More Flexible)

### GLOBAL NEWS (Obviously approve)
- Wars, treaties, disasters
- Major elections, political changes
- Big business deals, market crashes
- Scientific breakthroughs

### COUNTRY-SPECIFIC NEWS (Now approve these!)
- **National elections** in any of our 22 countries
- **Economic news** (central bank, GDP, inflation) for any country
- **Political developments** for any country
- **Major incidents** in any country (even if small globally)

**Examples to APPROVE now:**
- "Turkiye Central Bank raises rates" -> Approve (Turkish users care)
- "German coalition talks collapse" -> Approve (German users care)
- "Australian housing market update" -> Approve (Australian users care)
- "Brazilian Supreme Court ruling" -> Approve (Brazilian users care)
- "South Korea president impeached" -> Approve (Korean + global users care)

### TOPIC-SPECIFIC NEWS (Now approve these!)
- **AI developments** (even minor ones - AI users want everything)
- **Sports results** for major leagues (Premier League, La Liga, NBA, NFL, F1, etc.)
- **Gaming news** (new releases, industry news)
- **Entertainment** (major releases, celebrity news with substance)
- **Startup news** (funding rounds, launches)

**Examples to APPROVE now:**
- "Chelsea beats Wolves 3-1" -> Approve (football fans care)
- "New AI model released by Anthropic" -> Approve (AI followers care)
- "Netflix announces new series" -> Approve (entertainment followers care)
- "Startup raises $50M Series B" -> Approve (startup followers care)

### VIRAL/CULTURAL MOMENTS
- President vs pop culture clashes
- Major celebrity news with real events
- Sports championships and results
- Cultural controversies

---

## WHAT TO STILL ELIMINATE

### NOT NEWS (Still eliminate)
| Type | Example | Why |
|------|---------|-----|
| Listicles | "15 Best Headphones for 2026" | Not news, it's a guide |
| How-tos | "How to Watch Super Bowl" | Not news, it's instructions |
| Reviews | "iPhone 16 Review" | Not news, it's opinion |
| Advice | "5 Ways to Save Money" | Not news, it's tips |
| Opinion | "Why Trump Will Win" | Not news, it's speculation |

### PROMOTIONAL CONTENT (Still eliminate)
| Type | Example | Why |
|------|---------|-----|
| Betting | "Super Bowl Betting Odds" | Promotional |
| Promo codes | "DraftKings Promo Code" | Promotional |
| Shopping | "Best Deals on Amazon" | Promotional |
| Investment advice | "Buy This Stock Now" | Financial advice |

### INDIVIDUAL STORIES (Still eliminate)
| Type | Example | Why |
|------|---------|-----|
| Personal | "Mom of 3 shares journey" | No broader significance |
| Human interest | "Man drives 5000 miles for..." | Quirky but not news |
| Celebrity fluff | "Katie Price in Dubai" | Minor celebrity, no event |

### LOW-QUALITY SOURCES (Still eliminate)
| Type | Example | Why |
|------|---------|-----|
| Seeking Alpha | Any article | Investment analysis |
| Earnings transcripts | "Q4 Earnings Call" | Raw data, not news |
| Press releases | Unedited PR content | Not journalism |

---

## COUNTRY-SPECIFIC APPROVAL GUIDE

For each of our 22 countries, approve news about:

| Always Approve | Sometimes Approve | Still Eliminate |
|----------------|-------------------|-----------------|
| Elections | Local politics (if significant) | City council minutiae |
| Economic policy | Regional business | Individual business openings |
| Major incidents | Notable crime | Minor local crime |
| Government actions | Cultural events | Personal stories |
| International relations | Sports results | Gossip/tabloid |

---

## SPORTS APPROVAL GUIDE

| League/Event | Decision |
|--------------|----------|
| Super Bowl, World Cup Final | APPROVE (global event) |
| Premier League matches | APPROVE (football fans) |
| La Liga, Serie A, Bundesliga | APPROVE (football fans) |
| Champions League | APPROVE (football fans) |
| NBA games | APPROVE (basketball fans) |
| NFL games | APPROVE (american football fans) |
| F1 races | APPROVE (F1 fans) |
| Tennis Grand Slams | APPROVE (tennis fans) |
| Olympics events | APPROVE (Olympics followers) |
| Cricket internationals | APPROVE (cricket fans) |
| UFC/Boxing main events | APPROVE (combat sports fans) |
| Minor league/college | ELIMINATE (too niche) |
| Player rumors/gossip | ELIMINATE (not news) |
| Betting content | ELIMINATE (promotional) |

---

## TECH/AI APPROVAL GUIDE

| Type | Decision |
|------|----------|
| New AI model release | APPROVE |
| AI company news | APPROVE |
| AI regulation/policy | APPROVE |
| Tech product launch | APPROVE |
| Startup funding $10M+ | APPROVE |
| Cybersecurity breach | APPROVE |
| Tech layoffs | APPROVE |
| Product reviews | ELIMINATE |
| How-to guides | ELIMINATE |
| Buying guides | ELIMINATE |

---

## QUICK DECISION CHECKLIST

Before deciding, ask:

1. **Did something happen?** (If no -> ELIMINATE)
2. **Is it real news or noise?** (If noise -> ELIMINATE)
3. **Would ANY of our users care?** (If yes -> APPROVE)
4. **Is it promotional/advisory?** (If yes -> ELIMINATE)

---

## EXAMPLES

### APPROVE

| Article | Why |
|---------|-----|
| "Trump slams Bad Bunny halftime show" | President + culture clash, viral |
| "Seahawks win Super Bowl 29-13" | Championship result |
| "Chelsea 3-1 Wolves" | Football fans care |
| "Turkiye raises interest rates to 45%" | Turkish users + economics followers |
| "OpenAI releases new model" | AI followers care |
| "Netflix subscriber numbers drop" | Entertainment + business news |
| "German coalition talks fail" | German users + politics followers |
| "Australian wildfires spread" | Australian users + climate followers |
| "F1 Monaco GP: Verstappen wins" | F1 fans care |
| "Startup raises $100M for AI chip" | Startups + AI followers |
| "Spain's PM meets EU leaders in Madrid" | Spanish users + politics followers |
| "Italy's Meloni announces new policy" | Italian users + politics followers |

### ELIMINATE

| Article | Why |
|---------|-----|
| "How to Watch Super Bowl 2026" | Guide, not news |
| "15 Best AI Tools for 2026" | Listicle |
| "Super Bowl Betting Odds" | Promotional |
| "Katie Price reunites with husband" | Minor celebrity fluff |
| "Man drives 5000 miles for dream" | Individual story |
| "Why AI Will Change Everything" | Opinion/analysis |
| "DraftKings Promo Code" | Promotional |
| "Seeking Alpha: Buy AAPL" | Investment advice |
| "Helen Flanagan health journey" | Individual story |

---

## CATEGORY ASSIGNMENT

When approving, assign category:

| Category | For |
|----------|-----|
| World | International affairs, diplomacy, conflicts |
| Politics | Government, elections, policy |
| Business | Companies, economy, trade |
| Tech | Technology, AI, startups |
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

## REMEMBER

**We have personalization now.** 

You don't need to decide if something is "important enough" for everyone. You just need to decide if it's **real news** that **someone** would want to know.

Approve more. Let the personalization system show the right articles to the right users.

---

*TodayPlus Article Approval System V4*
*"Real news for everyone's interests"*
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
