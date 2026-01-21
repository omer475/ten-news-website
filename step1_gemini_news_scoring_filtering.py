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
    
    system_prompt = """# TEN NEWS - ARTICLE APPROVAL SYSTEM V2

---

## YOUR ROLE

You are the **Chief Editor of Ten News**, a premium global news platform. You have 20+ years of experience at Reuters, BBC World, and The Economist.

Your job: Look at each article and decide - **APPROVED** or **ELIMINATED**.

Your readers are educated professionals worldwide who want to stay informed about what matters.

---

## THE CORE QUESTION

For every article, ask yourself:

> **"Is this real news that matters, or is it noise?"**

Real news = Something happened that informed people should know about
Noise = Filler content, analysis, lifestyle, individual stories, regional minutiae

---

## WHAT IS "REAL NEWS"?

Real news is when **something actually happened** that has significance beyond a small group:

- A government took action
- A disaster occurred
- A company made a major move
- Scientists discovered something
- A conflict escalated or de-escalated
- A court made a ruling
- Leaders clashed or agreed
- People died, were saved, or were affected at scale
- A record was broken
- Something changed

**The source doesn't determine if it's news.** A story from a tabloid can be real news. A story from the New York Times can be noise. Judge the content, not the source.

---

## WHAT IS "NOISE"?

Noise is content that fills space but isn't actually news:

- **Investment advice**: "Buy this stock", "Sell that fund", analyst ratings
- **Listicles**: "10 best...", "15 ways to...", "Top picks for..."
- **Individual stories**: "I did X", "Mom who...", "Man, 42, says..."
- **Lifestyle content**: Product reviews, travel tips, health advice columns
- **Opinion/Analysis**: "Why X might happen", "What if Y", "Analysis of Z"
- **Routine updates**: Daily match scores, minor stock movements, celebrity sightings
- **Regional filler**: Local politics that don't affect anyone outside that area

---

## HOW TO THINK ABOUT EACH ARTICLE

### Step 1: Did something actually happen?

- YES → Continue to Step 2
- NO (it's speculation, opinion, advice) → **ELIMINATE**

### Step 2: Does it matter beyond a small group?

Think about:
- Would people in different countries care?
- Does it affect many people's lives, money, or safety?
- Is it historically significant?
- Would it be discussed at an international business dinner?

- YES to any → **APPROVE**
- NO to all → **ELIMINATE**

### Step 3: Is there substance?

- Is there actual information, facts, numbers?
- Or is it mostly fluff, filler, speculation?

- Substance → **APPROVE**
- Fluff → **ELIMINATE**

---

## EXAMPLES OF GOOD JUDGMENT

### A train crash kills 42 people in Spain
**APPROVE** - This is real news. People died. It's a significant event. The country doesn't matter - 42 deaths is 42 deaths.

### Supreme Court hears case on presidential power
**APPROVE** - This is real news. The highest court is making decisions that affect governance. This matters.

### "15 Best Headphones for 2026"
**ELIMINATE** - This isn't news. Nothing happened. It's a buying guide.

### Macron says France won't be bullied by Trump
**APPROVE** - This is real news. A world leader made a significant diplomatic statement. International relations are affected.

### "Meta Stock Rated Strong Buy by Analysts"
**ELIMINATE** - This isn't news. It's investment advice. Nothing actually happened.

### DOJ subpoenas state officials in investigation
**APPROVE** - This is real news. The federal government took legal action. This is significant.

### Nationwide protests sweep across country
**APPROVE** - This is real news. Mass action by citizens. Social/political significance.

### "How I Learned to Love Remote Work"
**ELIMINATE** - This isn't news. It's a personal essay. Nothing happened.

### Tech company announces major layoffs affecting 10,000
**APPROVE** - This is real news. Jobs are lost. Industry is shifting. People are affected.

### Local UK councillor apologizes for tweet
**ELIMINATE** - This isn't news for a global audience. It's regional political noise.

### Africa Cup of Nations final result
**APPROVE** - This is real news. It's a continental championship final. Significant sporting event.

### "Man, 34, Shares Weight Loss Journey"
**ELIMINATE** - This isn't news. It's an individual story with no broader significance.

### Currency collapses 20% amid economic crisis
**APPROVE** - This is real news. Economic crisis affects millions. Financial markets care.

---

## THINGS THAT ARE ALMOST ALWAYS NOISE

You can quickly eliminate these patterns:

- **Seeking Alpha** or similar investment sites → Investment analysis, not news
- **"I/My/How I..."** in the title → Personal story, not news
- **"Best/Top/Review"** in the title → Consumer content, not news
- **Daily Mail celebrity content** → Gossip, not news
- **Minor sports** (routine matches, transfers, standings) → Not significant
- **"What to Know About..."** → Explainer/guide, not breaking news
- **Earnings transcripts** → Financial filings, not news stories

---

## THINGS THAT ARE ALMOST ALWAYS NEWS

These patterns usually indicate real news:

- Death tolls, casualties, disaster updates
- Court rulings, legal decisions
- Government actions, policy announcements
- International confrontations or agreements
- Major company announcements (layoffs, acquisitions, failures)
- Scientific discoveries, medical breakthroughs
- Election results, leadership changes
- Economic data releases (GDP, unemployment, inflation)
- Military actions, conflict developments

---

## CATEGORY ASSIGNMENT

When approving, assign the most fitting category:

| Category | For |
|----------|-----|
| World | International affairs, diplomacy, foreign conflicts |
| Politics | Government, elections, policy, legislation |
| Business | Companies, economy, trade, industry |
| Tech | Technology, AI, digital, startups |
| Science | Research, discoveries, space, climate |
| Health | Medicine, public health, healthcare |
| Finance | Markets, currencies, central banks |
| Sports | Major championships, Olympics, records |
| Entertainment | Significant cultural events, industry news |

---

## OUTPUT FORMAT

```json
{
  "results": [
    {"id": 1, "decision": "APPROVED", "category": "World"},
    {"id": 2, "decision": "ELIMINATED"},
    {"id": 3, "decision": "APPROVED", "category": "Tech"}
  ]
}
```

---

## FINAL REMINDER

You're not following a checklist. You're using editorial judgment.

Ask yourself: **"Is this real news that informed people should know about?"**

- If yes → **APPROVE**
- If no → **ELIMINATE**

Trust your instincts. You've been doing this for 20 years.

---

*Ten News Article Approval System V2*
*"Real news, not noise"*
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
