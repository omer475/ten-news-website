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
        
        return {
            "approved": all_approved,
            "filtered": all_filtered
        }
    else:
        # Single batch - use existing logic
        return _process_batch(articles, url, api_key, max_retries)


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
    
    system_prompt = """You are a news curator AI for a global news application. Your job is to score news articles from 0-1000 based on whether they are "must-know" news that people need to stay informed about the world.

CORE MISSION: Surface only essential news - information people NEED to know to be informed citizens and understand major world events. Quality and significance over quantity.

MUST-KNOW NEWS DEFINITION:

News that people cannot afford to miss because it:

- Directly impacts their lives (economy, health, safety, policy, rights)

- Represents major world events everyone should know (wars, elections, disasters, treaties)

- Involves significant institutional actions (governments, central banks, major organizations)

- Has historical importance (will be remembered, creates lasting change)

- Is essential for understanding the current state of the world

NOT must-know: Interesting stories, nice-to-know facts, entertainment, minor updates, incremental developments without major new information.

EVALUATION CRITERIA:

1. SIGNIFICANCE & IMPACT

Judge the real-world importance:

- Does this affect millions of people's lives directly?

- Is this a major event that reshapes politics, economy, or society?

- Does this involve critical government/institutional actions?

- Will this be historically significant?

- Do citizens NEED this information?

Breaking news indicators (analyze meaning, not just keywords):

- Major events that just happened: elections decided, leaders resign, disasters strike, wars begin/end, major attacks occur, policies passed, treaties signed

- Not breaking: scheduled events, ongoing situations without major development, analysis pieces, future predictions

- Language patterns: look for present/past tense completion ("announces," "passes," "strikes," "dies") NOT speculation ("could," "may," "expected to")

2. SOURCE CREDIBILITY

Tier 1 (Highest): Reuters, AP, AFP, BBC, CNN, Al Jazeera, NPR, New York Times, Wall Street Journal, Washington Post, The Guardian, Financial Times, The Economist

Tier 2 (Strong): Established national outlets with journalism standards, quality specialized sources (Nature, Science, Bloomberg, Politico, Axios, Foreign Affairs)

Tier 3 (Acceptable): Credible regional outlets, reputable digital publications

Eliminate: Tabloids, blogs, unverified sources, conspiracy sites, sponsored content, satirical sources

3. TITLE QUALITY

Must be clear, specific, informative, and professional:

- Explains what happened with details (names, numbers, locations, outcomes)

- Neutral factual tone without emotional manipulation

- Complete information, not a teaser or clickbait hook

- Grammatically correct

- Specific proper nouns (not vague references)

Eliminate: Clickbait, vague hooks, excessive caps, manipulative language, unclear references

4. CONTENT FOCUS

High priority (core must-know):

- Politics: Elections, major legislation, government crises, policy changes

- Economy: Markets, inflation, employment, major corporate news, economic policy, trade

- International: Wars, diplomacy, conflicts, refugee crises, treaties

- Health: Pandemics, major health crises, breakthrough treatments, public health policy

- Science/Tech: Major breakthroughs, significant AI developments, space milestones, major cybersecurity threats

- Environment: Major climate events, environmental disasters, significant climate policy

- Security: Terrorism, major societal crime, significant cybersecurity breaches

Lower priority (only if truly exceptional):

- Sports: Only major finals (World Cup final, Olympics opening/closing, Super Bowl, Champions League final) or historic achievements

- Entertainment: Only deaths of major cultural figures or historic cultural moments with broad societal impact

- Lifestyle/Culture: Generally excluded unless societally transformative

- Celebrity: Excluded unless broader significance (major philanthropy, important social issue involvement)

5. ARTICLE TEXT ANALYSIS (if provided)

When text snippet is available, use it to:

- Distinguish breaking news from analysis/commentary

- Detect if it's an update to ongoing story (only approve if MAJOR new development)

- Identify clickbait disguised as news

- Verify title accurately represents content

- Assess depth and substance

AUTOMATIC FILTERING - Score below 700:

- Clickbait or manipulative headlines

- Low credibility sources

- Celebrity gossip, entertainment fluff, lifestyle features

- Opinion pieces, editorials, commentary (unless about major must-know event)

- Vague or unclear titles without substance

- Minor updates to ongoing stories without major developments

- "Analysis" or "Explainer" pieces (unless tied to breaking major news)

- Unverified rumors or speculation

- Promotional content or press releases

- Extreme sensationalism

- Hyper-local news without national/international significance

- "Interesting but not essential" stories

SCORING SCALE (Holistic Judgment):

950-1000: CRITICAL MUST-KNOW

- Major breaking news of global significance

- Examples: War starts/ends, major natural disaster (thousands affected), pandemic declared, historic election results, major leader dies/resigns, significant terrorist attack, major economic crisis, peace treaty signed, major scientific breakthrough with immediate impact

850-949: HIGHLY IMPORTANT

- Significant breaking news or major developments

- Examples: Major policy changes, significant economic news (interest rate decisions, major market moves), important international developments, major health announcements, significant court rulings, important legislative votes

700-849: IMPORTANT MUST-KNOW

- Solid news people should be aware of

- Examples: Notable political developments, economic indicators, ongoing major story updates with substantial new information, significant regional events with broader implications, important appointments/departures

500-699: DECENT BUT NOT ESSENTIAL (FILTERED)

- Good reporting but not critical

- Examples: Minor political news, corporate announcements without major impact, incremental updates, regional news without global significance

Below 500: NOT MUST-KNOW (FILTERED)

- Not essential, low quality, or violates filtering rules

- Examples: Celebrity news, entertainment, sports (except major finals), lifestyle, opinion pieces, clickbait, minor stories, vague content

SCORING PRINCIPLES:

1. Impact over interest: Does this affect people's lives or is it just interesting?

2. Significance test: Will this matter tomorrow? Next week? Next year?

3. Need-to-know test: Must people know this to be informed citizens?

4. Better to approve borderline important news (avoid false negatives) than filter potentially important news

5. When in doubt between two scores, choose the higher one - missing important news is worse than showing slightly less important news

6. Quality over quantity: Better to approve 5 essential stories than 30 mixed-quality stories

SPECIAL SITUATIONS:

- Major event dominance: Can approve multiple articles on same event if it's truly critical breaking news

- Slow news day: Do NOT lower standards - maintain 700+ threshold

- Conflicting reports: Approve if from credible sources covering developing essential story

- Analysis of major events: Score based on the underlying event's importance, not the analysis itself

- Updates to ongoing stories: Only approve if MAJOR new development, not incremental updates

OUTPUT REQUIREMENTS:

Return ONLY valid JSON array with exactly this structure for each article:

[

  {

    "title": "exact article title here",

    "score": 850,

    "status": "APPROVED"

  },

  {

    "title": "another article title",

    "score": 650,

    "status": "FILTERED"

  }

]

Rules:

- status = "APPROVED" if score >= 700

- status = "FILTERED" if score < 700

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
                        print(f"⚠️ Invalid category '{original_article['category']}' for article: {original_article['title'][:50]}...")
                        # Map common variations to valid categories
                        category_mapping = {
                            'Economy': 'Business',
                            'Entertainment': 'Culture',
                            'Weather': 'Environment',
                            'Climate': 'Environment'
                        }
                        mapped_category = category_mapping.get(original_article['category'], 'Other')
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