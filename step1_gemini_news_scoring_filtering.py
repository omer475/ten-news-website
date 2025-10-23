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

def score_news_articles_step1(articles: List[Dict], api_key: str) -> Dict:
    """
    Step 1: Score news articles using Gemini API
    
    Args:
        articles: list of dicts with 'title', 'source', 'text' (optional), 'url'
        api_key: Google AI API key
    
    Returns:
        dict with 'approved' and 'filtered' lists
    """
    
    # Use gemini-2.0-flash-exp as gemini-2.5-flash may not be available yet
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    system_prompt = """You are a news curator AI scoring articles 0-1000 for shareability and conversation-worthiness.

CORE MISSION: Surface news people WANT to share - stories that make people say "Did you hear?" Focus on educational, surprising, engaging content.

TARGET: Approve ~10% of articles (only truly shareable news).

CRITICAL "SO WHAT?" TEST: Every article must answer "What changes for me/the world if I know this?"

✅ HAS IMPACT: Real-world consequences happen, something changes NOW, creates forward momentum
❌ NO IMPACT: Documentaries/investigations without outcomes, retrospective analysis, background info only

SCORING CRITERIA (5 factors, total 1000 points):

1. RECENCY & TIMELINESS (0-200):
180-200: Just happened (breaking news, today's events)
140-179: Very recent (yesterday, this week)  
100-139: Recent (within few days)
60-99: Somewhat recent (this week)
0-59: Old news, scheduled events, incremental updates
CRITICAL: Articles >7 days max 100 points, >30 days = 0 points

2. SURPRISE & WOW FACTOR (0-250):
230-250: Mind-blowing discoveries, shocking events
190-229: Very surprising, unexpected
150-189: Interesting, somewhat surprising
100-149: Moderately interesting
50-99: Predictable, expected
0-49: No surprise factor, completely expected

3. IMPACT & SCALE (0-200):
180-200: Affects hundreds of millions globally
140-179: Affects tens of millions or major regions
100-139: Affects millions or important institutions
60-99: Affects thousands or specific communities
20-59: Limited impact or niche audience
0-19: Minimal real-world impact

4. CONVERSATION-WORTHINESS (0-250):
230-250: Instant conversation starter - EVERYONE will talk about this
190-229: Very likely to be discussed
150-189: Worth mentioning in conversation
100-149: Might come up in specific contexts
50-99: Only specialists would discuss
0-49: Nobody would bring this up casually

5. EDUCATIONAL VALUE (0-100):
90-100: Teaches fundamental new knowledge or paradigm shift
70-89: Significant educational content
50-69: Moderately educational
30-49: Minimal new information
0-29: No educational value

AUTOMATIC FILTERS (Score <700):
❌ OLD NEWS: Articles >7 days max 400, >30 days max 200
❌ CLICKBAIT: "You won't believe...", "SHOCKING:", emotional manipulation
❌ MINOR POLITICAL THEATER: "Senator introduces bill...", procedural votes
❌ INCREMENTAL UPDATES: "Day X of conflict...", status quo reports
❌ NO ACTIONABLE IMPACT: Documentaries, investigations without outcomes
❌ OPINION/ANALYSIS: Pure commentary without breaking news
❌ LOW-QUALITY SOURCES: Tabloids, blogs, conspiracy sites
❌ LOCAL CRIME: Single arrests unless major public figure/terrorism
❌ MINOR CELEBRITY: Personal activities, minor awards

STUDIES & RESEARCH:
✅ APPROVE (700+) if "DINNER TABLE TEST": Would you bring this up at dinner?
- Genuinely surprising/counterintuitive findings
- Major health/life implications people care about
- Breakthrough discoveries that change understanding

❌ FILTER (<700): Confirms known facts, incremental findings, purely academic

HIGH-SCORING EXAMPLES:
✅ Politics: "Congress passes historic healthcare reform" (850-1000)
✅ Business: "Federal Reserve makes emergency rate cut" (850-950)
✅ Science: "Scientists cure specific cancer in trial" (850-950)
✅ Sports: "World Cup final decided by historic goal" (800-900)
✅ World: "Historic peace agreement signed" (900-1000)

❌ FILTER: "Senator proposes bill", "Study confirms exercise healthy", "Team advances to next round"

SOURCE CREDIBILITY:
Tier 1 (1.0x): Reuters, AP, BBC, CNN, NYT, WSJ, Guardian, etc.
Tier 2 (0.9x): Established national outlets, Nature, Science
Tier 3 (0.7x): Credible regional outlets
Tier 4 (0.4x): Questionable sources, blogs
Tier 5 (0.0x): Tabloids, conspiracy sites

CATEGORIES (assign ONE - CRITICAL REQUIREMENT):
You MUST assign exactly ONE category to each article. Choose the MOST APPROPRIATE category:

- **World**: International news, global affairs, foreign policy, conflicts, diplomacy
- **Politics**: Government, elections, policy, political developments, legislation
- **Business**: Economy, markets, finance, corporate news, economic indicators
- **Technology**: Tech industry, innovation, digital trends, gadgets, software
- **Science**: Research, discoveries, environmental issues, health studies, space
- **Health**: Medicine, wellness, public health, medical breakthroughs, healthcare
- **Sports**: Athletics, competitions, teams, sporting events, Olympics
- **Lifestyle**: Fashion, food, travel, home, personal interest, entertainment

CRITICAL CATEGORY RULES:
1. EVERY article MUST get exactly ONE category
2. Choose the PRIMARY focus of the article
3. If multiple categories apply, pick the MOST IMPORTANT one
4. NEVER use "Other" or any category not listed above
5. Category assignment is MANDATORY for every article

OUTPUT FORMAT - Return ONLY valid JSON:
[
  {
    "title": "exact article title here",
    "score": 850,
    "category": "Science",
    "status": "APPROVED",
    "score_breakdown": {
      "recency": 180,
      "surprise": 240,
      "impact": 150,
      "conversation": 210,
      "educational": 90
    }
  }
]

Rules:
- status = "APPROVED" if score >= 700, "FILTERED" if < 700
- category MUST be one of: World, Politics, Business, Technology, Science, Health, Sports, Lifestyle
- category is MANDATORY - every article must have exactly one category
- Include score_breakdown for transparency
- Maintain order of input articles
- Valid JSON only"""

    # Prepare articles for scoring
    articles_text = "Score these news articles based on shareability and conversation-worthiness criteria. Return JSON array only.\n\nArticles to score:\n[\n"
    
    for article in articles:
        articles_text += f'  {{\n    "title": "{article["title"]}",\n    "source": "{article["source"]}",\n    "text": "{article.get("text", "")[:500]}",\n    "url": "{article["url"]}"\n  }},\n'
    
    articles_text += "]\n\nEvaluate each article and return JSON array with title, score (0-1000), category (MANDATORY - choose from: World, Politics, Business, Technology, Science, Health, Sports, Lifestyle), status (APPROVED if >=700, FILTERED if <700), and score_breakdown."
    
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
    
    try:
        # Make API request
        response = requests.post(url, json=request_data, timeout=120)
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
                
                # Validate category
                valid_categories = ['World', 'Politics', 'Business', 'Technology', 'Science', 'Health', 'Sports', 'Lifestyle']
                if original_article['category'] not in valid_categories:
                    print(f"⚠️ Invalid category '{original_article['category']}' for article: {original_article['title'][:50]}...")
                    original_article['category'] = 'Other'  # Fallback
                
                if scored_article['status'] == 'APPROVED':
                    approved.append(original_article)
                else:
                    filtered.append(original_article)
        
        return {
            "approved": approved,
            "filtered": filtered
        }
        
    except requests.exceptions.RequestException as e:
        print(f"❌ API request failed: {e}")
        # Assign default categories when API fails
        for article in articles:
            article['category'] = 'Other'  # Default fallback
            article['score'] = 0
            article['status'] = 'FILTERED'
        return {"approved": [], "filtered": articles}
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        # Assign default categories when any error occurs
        for article in articles:
            article['category'] = 'Other'  # Default fallback
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