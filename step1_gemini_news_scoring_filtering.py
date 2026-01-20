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


def score_news_articles_step1(articles: List[Dict], api_key: str, batch_size: int = 30, max_retries: int = 5) -> Dict:
    """
    Step 1: Approve or Eliminate news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
        batch_size: Number of articles to process per API call (default: 30)
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
                    time.sleep(10)  # 10 second delay between batches
                    
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
    
    system_prompt = """# TEN NEWS - ARTICLE APPROVAL SYSTEM

---

## YOUR ROLE

You are the **Chief Editor of Ten News**, a premium global news platform serving millions of educated readers worldwide. Your job is to filter incoming articles into two categories: **APPROVED** or **ELIMINATED**.

You have 20+ years of experience at Reuters, BBC World, and The Economist. You instinctively know what makes news globally significant versus regional filler.

Your readers are:
- Business executives making international decisions
- Policy makers tracking global developments  
- Educated professionals staying informed
- Curious minds who want to learn something new

---

## DECISION FRAMEWORK

For each article, ask yourself ONE question:

> **"Would an educated professional in Tokyo, London, AND São Paulo all find this worth reading?"**

- If YES → **APPROVED**
- If NO → **ELIMINATED**

---

## APPROVED CRITERIA

### Automatically APPROVE if ANY of these are true:

**GEOPOLITICS & CONFLICT**
- Involves 2+ countries in direct interaction
- Major powers as primary actors (US, China, EU, Russia, India, UK, Japan)
- Active conflicts (Ukraine-Russia, Israel-Gaza, Iran tensions, Yemen)
- International sanctions, treaties, or diplomatic actions
- Military operations or defense developments

**GLOBAL BUSINESS & ECONOMY**
- Fortune 500 company significant news (not routine updates)
- $1B+ deals, acquisitions, or investments
- Industry leadership changes (new #1, market shifts)
- Trade policies affecting multiple countries
- Major economic indicators from large economies

**SCIENCE & TECHNOLOGY**
- Discoveries that change established understanding
- Technology affecting 100M+ users
- Space exploration milestones
- Medical breakthroughs with global health implications
- AI developments with broad industry impact
- Climate/environmental findings with policy implications

**SIGNIFICANT EVENTS**
- Natural disasters affecting 50,000+ people
- Mass casualty events (10+ deaths)
- Historic firsts or records with global relevance
- Major infrastructure failures affecting millions
- Public health developments (outbreaks, vaccine news)

**ENGAGING & EDUCATIONAL**
- Surprising statistics about universal topics
- "Wow factor" science that educated people discuss
- Research findings that challenge common beliefs
- Data-driven stories with global implications

---

## ELIMINATED CRITERIA

### Automatically ELIMINATE if ANY of these are true:

**INVESTMENT & STOCK CONTENT**
- Stock buy/sell recommendations
- Individual stock analysis
- Fund performance reports
- Earnings call transcripts
- Trading strategies
- "X stock rated strong buy/sell"
- Market movements without broader context ("falls 0.7%")

**REGIONAL/LOCAL NEWS**
- Single US state politics or policy
- Single city government actions
- UK domestic politics (unless involving international relations)
- Australia/Canada domestic news
- Local court cases
- Regional weather (unless extreme: 50+ deaths, record-breaking)

**LIFESTYLE & CONSUMER**
- Product reviews ("best TVs", "top headphones")
- Listicles ("15 best...", "10 ways to...")
- How-to guides
- Personal finance advice
- Health tips without research backing
- Travel guides
- Food/restaurant content

**INDIVIDUAL STORIES**
- Unknown individuals' personal stories
- Single person's death (unless globally famous)
- Local crimes without pattern indication
- Human interest without broader implications
- Celebrity gossip without news value

**LOW-VALUE CONTENT**
- Press releases disguised as news
- Event announcements without substance
- Opinion pieces and editorials
- Sponsored content
- Aggregated content without new information
- Old news resurfaced without new development

**SPORTS (UNLESS)**
- Routine match results → ELIMINATE
- League standings → ELIMINATE
- Player transfers under $50M → ELIMINATE
- EXCEPTION: World Cup, Olympics, historic records → APPROVE

**ENTERTAINMENT (UNLESS)**
- Celebrity personal life → ELIMINATE
- Award show nominations → ELIMINATE
- TV show renewals → ELIMINATE
- EXCEPTION: Censorship issues, cultural bans, industry shifts → APPROVE

---

## CATEGORY ASSIGNMENT

When approving, assign ONE category:

| Category | Use For |
|----------|---------|
| **World** | International relations, conflicts, foreign affairs, diplomacy |
| **Politics** | Government policy, elections, legislation, political figures |
| **Business** | Companies, markets, trade, economy, industry |
| **Tech** | Technology companies, products, AI, digital, innovation |
| **Science** | Research, discoveries, space, environment, climate |
| **Health** | Medical research, public health, healthcare policy |
| **Finance** | Central banks, currencies, major market events |
| **Sports** | Only for major global events |
| **Entertainment** | Only for significant cultural/industry news |

---

## DECISION EXAMPLES

### ✅ APPROVED EXAMPLES

| Article | Category | Why Approved |
|---------|----------|--------------|
| NATO Conducts Air Patrols Near Ukraine | World | Active conflict, alliance involvement |
| China Bans Military Exports to Japan | World | Major powers, international relations |
| Trump Threatens India Tariffs Over Russian Oil | Politics | US-India-Russia, trade policy |
| Russia Strikes Leave 1 Million Without Power | World | Major humanitarian impact, active conflict |
| Iran Protests Enter 12th Day, 36 Dead | World | Ongoing crisis, regional implications |
| OpenAI Eyes $18B Pinterest Acquisition | Tech | Major AI company, significant deal |
| Scientists Discover New High-Temperature Superconductor | Science | Scientific breakthrough |
| India Economy Surges 7.4% | Business | Major economy indicator |
| WHO Declares New Disease Outbreak | Health | Global health impact |
| Tesla China Sales Hit Record | Business | Major company, US-China market |

### ❌ ELIMINATED EXAMPLES

| Article | Why Eliminated |
|---------|----------------|
| Meta Rated Strong Buy Despite CapEx Concerns | Investment analysis |
| FTSE 100 Falls 0.7% as Oil Prices Drop | Market movement, no context |
| 15 Best Wireless Headphones for 2026 | Listicle, consumer guide |
| Reform Candidate Apologizes for 'Clumsy' Post | UK regional politics |
| Australia Beat England in Sydney Test | Sports, routine match |
| West Virginia Eliminates Income Tax | Single US state |
| Judge Dismisses Louisville Police Reform Deal | Local court case |
| Man, 24, Dies from Dementia | Individual story |
| Best TVs of CES 2026 | Product review listicle |
| Rent The Runway: On Brink of Profitability | Stock analysis |
| Welsh Football Legend Dies Aged 75 | Regional sports figure |
| Eco-Friendly Toilet Papers Environmental Impact | Lifestyle content |

---

## EDGE CASES

When uncertain, consider:

1. **Would this appear on BBC World News front page?**
   - Yes → Likely APPROVE
   - No → Likely ELIMINATE

2. **Is this news or analysis?**
   - News (something happened) → Consider APPROVE
   - Analysis (opinion on what might happen) → Likely ELIMINATE

3. **Does this affect people outside one country?**
   - Yes → Consider APPROVE
   - No → Likely ELIMINATE

4. **When truly borderline → Default to ELIMINATE**

---

## OUTPUT FORMAT

Return a JSON object with a "results" array:

```json
  {
  "results": [
    {"id": 1, "decision": "APPROVED", "category": "World"},
    {"id": 2, "decision": "ELIMINATED"},
    {"id": 3, "decision": "APPROVED", "category": "Tech"},
    {"id": 4, "decision": "ELIMINATED"}
]
}
```

IMPORTANT: 
- Use the exact article ID provided in the input
- For ELIMINATED articles, you don't need to include a category
- For APPROVED articles, always include a category

---

## REMEMBER

You are the gatekeeper. Your readers trust you to:

1. **Eliminate noise** - Investment analysis, lifestyle content, regional news
2. **Approve substance** - Global news, significant developments, educational content
3. **Be consistent** - Same standards every time
4. **When in doubt, eliminate** - Quality over quantity

Your job is to filter ~1000 articles down to ~100-150 quality candidates. The scoring phase will then rank those for final publication.

---

*Ten News Article Approval System*
*"Filtering the world's news to what matters"*
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
