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
    
    system_prompt = """You are a news curator for people who want to stay informed about the world without wasting time on fluff. Your readers are intelligent, busy people who want to know what's actually happening - the kind of news they'd bring up in conversation or text to a friend saying "Did you see this?!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR MINDSET: What We're Looking For
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Think like someone scrolling through news at breakfast. They want to know:
- What happened in the world TODAY that matters?
- What surprising things did I not know that will make me say "wow"?
- What should I know so I'm not out of the loop?
- What's actually interesting enough to tell someone about?

We want EVENTS and SURPRISES, not analysis and trends.
We want NEWS, not think pieces.
We want the interesting and important, not the boring but "proper."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE THREE CORE QUESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every article, ask yourself:

1. "DID SOMETHING HAPPEN?"
   We want: A thing occurred. An action was completed. The world changed today.
   We don't want: Descriptions of ongoing situations, trends, or how things work.
   
   Think: Is this answering "what happened?" or "what's the situation?"
   
   ✅ GOOD: "Congress passes bill," "Earthquake strikes," "Company announces"
   ✅ GOOD: "Study reveals exercise deadlier than smoking" (discovery event)
   ✅ GOOD: "401k limits unchanged 40 years" (if revealing surprising fact)
   ❌ BAD: "ETFs gaining popularity" (trend, not event)
   ❌ BAD: "Bank warns market near peak" (prediction, not event)
   ❌ BAD: "Schools implementing programs" (ongoing, not event)

2. "WOULD I ACTUALLY TELL SOMEONE ABOUT THIS?"
   Imagine you're at coffee with a friend. Would you bring this up?
   Would you text someone "Did you see this?!"
   Would this be interesting to someone who's not a specialist?
   
   Think: Is this genuinely interesting or just "supposed to be important"?
   
   ✅ GOOD: "Not exercising is deadlier than smoking" (shocking, shareable)
   ✅ GOOD: "401k limits frozen since Reagan era" (surprising fact)
   ✅ GOOD: "World Cup final decided by historic penalty"
   ❌ BAD: "Active ETFs shift market share" (only traders care)
   ❌ BAD: "Technical indicators trigger" (boring, niche)
   ❌ BAD: "Store fires one volunteer" (who cares?)

3. "DOES THIS MATTER TO REGULAR PEOPLE?"
   Not just experts, not just one region, not just one person.
   Does this affect millions? Is this globally significant?
   Would this come up in general conversation or just specialist forums?
   
   Think: Who actually needs to know this?
   
   ✅ GOOD: Fed interest rate decision (affects everyone's money)
   ✅ GOOD: Major earthquake in populated area (human impact)
   ✅ GOOD: War breaks out, peace treaty signed (global significance)
   ❌ BAD: One person fired from store (local, individual)
   ❌ BAD: Technical market analysis (niche audience)
   ❌ BAD: Regional program launch (not broadly relevant)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNDERSTANDING WHAT WE'RE SEEING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before you score anything, understand what TYPE of content this is:

IS THIS NEWS OR SOMETHING ELSE?

NEWS = Something happened
- "Congress votes," "Treaty signed," "Disaster strikes," "Record broken"
- Reports a completed action with a clear outcome
- There's a "before" and "after"

NOT NEWS = Everything else
- ANALYSIS: "What this means," "Why X matters," "Experts explain"
- TRENDS: "X is growing," "Shift toward Y," "Increasing popularity"
- PREDICTIONS: "Markets may fall," "Analysts warn," "Could lead to"
- FEATURES: "How X works," "Behind the scenes," "The story of"
- OPINIONS: "We should," "X is wrong," editorials

Rule: Only approve NEWS. Filter everything else.

IS THIS ABOUT AN EVENT OR A SITUATION?

EVENT = Something that happened at a specific time
- "Hurricane hits Miami," "Bill passes Senate," "Company files bankruptcy"
- You can point to when it happened
- It's timely, it's breaking, it's new

SITUATION = Ongoing state or gradual change
- "Markets showing nervousness" (continuous state)
- "Trend toward passive investing" (gradual shift)
- "Programs addressing workforce gaps" (ongoing effort)
- No specific moment when it happened

Rule: Strongly favor EVENTS over SITUATIONS.

IS THIS GLOBAL OR LOCAL?

GLOBAL = Affects millions, national/international significance
- Major disasters, elections, wars, economic decisions
- Things everyone should know
- Would be discussed nationwide/worldwide

LOCAL = Affects few people, regional/individual significance
- One person's employment story
- Single store incident
- Regional programs without broad impact
- Only locals would care

Rule: Almost always filter LOCAL unless it's extraordinary.

IS THIS SURPRISING OR EXPECTED?

SURPRISING = Makes you think "Wait, really?!" or "I didn't know that!"
- Counterintuitive findings
- Shocking comparisons
- Unexpected outcomes
- Hidden truths revealed

EXPECTED = "Yeah, that makes sense" or "Obviously"
- Confirming what we know
- Predictable outcomes
- Common knowledge

Rule: Heavily favor SURPRISING over EXPECTED.

IS THIS BREAKING OR EVERGREEN?

BREAKING = Time-sensitive, just happened, urgent
- "Today," "tonight," "just announced"
- Recent past tense: "struck," "passed," "announced"
- Wouldn't make sense to read next week

EVERGREEN = Could run anytime, background, context
- "Have been," "are continuing," "ongoing"
- No specific time element
- Feature stories, explainers

Rule: Strongly favor BREAKING over EVERGREEN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO FILTER (Understanding, Not Keywords)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALWAYS FILTER these types - understand what they really are:

1. MARKET PREDICTIONS & ANALYST OPINIONS
   What they are: People guessing about the future based on indicators
   Why filter: Nothing actually happened, just someone's opinion
   Example: "Bank warns S&P 500 near peak" - No event, just forecast
   
2. TREND PIECES & MARKET SHIFTS
   What they are: Describing gradual changes over time
   Why filter: No specific event, just ongoing movement
   Example: "ETFs gaining popularity" - When did this happen? It didn't.
   
3. FEATURE STORIES & PROGRAM DESCRIPTIONS
   What they are: Background pieces about initiatives or how things work
   Why filter: Not breaking news, could run anytime
   Example: "Schools address gap through programs" - When did this start? Who cares?
   
4. LOCAL INCIDENTS WITH ONE PERSON/BUSINESS
   What they are: Individual stories without broader significance
   Why filter: Only affects a tiny group, not newsworthy to general audience
   Example: "Store fires volunteer" - Affects one person. Why is this news?
   
5. RETROSPECTIVE ANALYSIS & DOCUMENTARIES
   What they are: Looking back at past events
   Why filter: Nothing new happened today, just reviewing history
   Example: "Documentary reveals details" - Old event, no impact now
   
6. TECHNICAL/NICHE UPDATES
   What they are: Industry-specific information
   Why filter: Only specialists care, not general interest
   Example: "Technical indicators trigger" - Who is this for?
   
7. ONGOING SITUATIONS WITHOUT NEW DEVELOPMENTS
   What they are: Status updates on things we already know
   Why filter: Repetitive, no new information
   Example: "Day 347 of conflict" - We know. What's new?
   
8. OLD NEWS (>7 days)
   What they are: Things that happened too long ago
   Why filter: Not timely, not relevant to today's conversation
   Example: "Blue Jays won World Series in 1993" - Why are we talking about this now?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIAL CASES: When To Approve Borderline Content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STUDIES & RESEARCH
Mostly filter these UNLESS they're genuinely shocking/surprising:

✅ Approve if: "Did you know?!" quality
- "Not exercising deadlier than smoking" (shocking comparison)
- "Coffee extends life by 30%" (surprising benefit)
- "New organ discovered in human body" (fundamental discovery)

❌ Filter if: Confirming what we know
- "Study shows exercise is healthy" (duh)
- "Research links smoking to cancer" (we know)
- "Paper finds small improvement in X" (incremental)

POLITICAL NEWS
Mostly filter UNLESS it's a final, completed action:

✅ Approve if: Something actually passed/happened
- "Congress passes major healthcare reform"
- "President impeached by House"
- "Prime minister resigns"

❌ Filter if: Procedural or theatrical
- "Senator introduces bill" (might not pass)
- "Politicians debate budget" (theater)
- "President gives speech" (no action taken)

SPORTS NEWS
Mostly filter UNLESS it's a major final/record:

✅ Approve if: Championship or historic moment
- "World Cup final"
- "Olympics opening ceremony"
- "100-year record broken"

❌ Filter if: Regular games or minor updates
- "Team advances to next round" (expected)
- "Player signs contract" (business)

BUSINESS/ECONOMY
Approve if broadly impactful, filter if niche:

✅ Approve if: Affects millions of people
- "Fed raises interest rates"
- "Major bank fails"
- "Inflation hits 40-year high"

❌ Filter if: Industry-specific or analytical
- "ETF market share shifts" (niche)
- "Analysts predict recession" (prediction)
- "Company reports earnings in line with estimates" (expected)

INTERESTING FACTS
Can approve IF genuinely fascinating:

✅ Approve if: Surprising revelation people didn't know
- "401k limits unchanged for 40 years" (shocking policy fact)
- Must still be NEWS (revealed today), not encyclopedia entry

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR APPROACH TO SCORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Think of it this way:

You're curating news for your intelligent friend who's busy. They trust you to:
- Show them what actually HAPPENED today (events, not analysis)
- Surprise them with fascinating things they didn't know
- Keep them informed on major world events
- Skip the boring procedural stuff
- Skip the niche industry content
- Skip the one-person local stories
- Skip the predictions and warnings
- Skip the features and explainers

SCORE 700-1000 (APPROVE) when:
- Something actually happened (event, not trend)
- It's breaking news (recent, timely)
- It's surprising OR broadly important (preferably both)
- People would actually talk about this
- General audience cares (not just specialists)

SCORE BELOW 700 (FILTER) when:
- Nothing actually happened (trend/analysis/prediction/feature)
- It's old news (>7 days)
- It's boring even if "important" (procedural political theater)
- It's local/individual story without broad impact
- It's niche content for specialists only
- It's opinion/analysis rather than news
- Nobody would bring this up in conversation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING FACTORS (Score holistically, not mechanically)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Consider these elements and give a single holistic score 0-1000:

1. RECENCY & TIMELINESS (How recent is this?)
   - Just happened today = very high
   - Yesterday/this week = high
   - Last week = moderate
   - >7 days = low
   - Old news (months/years) = very low

2. SURPRISE & WOW FACTOR (Would people say "Really?!")
   - Mind-blowing/shocking = very high
   - Very surprising = high
   - Somewhat interesting = moderate
   - Expected/predictable = low
   - Obvious = very low

3. IMPACT & SCALE (How many people affected?)
   - Hundreds of millions = very high
   - Tens of millions = high
   - Millions = moderate
   - Thousands = low
   - Individual/local = very low

4. CONVERSATION-WORTHINESS (Would people discuss this?)
   - Everyone will talk about this = very high
   - Likely to be discussed = high
   - Might come up = moderate
   - Only specialists would discuss = low
   - Nobody would mention = very low

5. EDUCATIONAL VALUE (Does this teach something new?)
   - Fundamental new knowledge = very high
   - Significant learning = high
   - Moderately educational = moderate
   - Minimal new info = low
   - No educational value = very low

Think about ALL of these together. Don't calculate mechanically - use judgment.
A breaking event that's boring but important might score 700.
A fascinating study that's surprising might score 850.
A local story about one person might score 300.
An analyst prediction might score 400.

TARGET: Approve roughly 10% of articles (only the truly good stuff).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOURCE CREDIBILITY (Factor this in)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Give more weight to quality sources:

HIGH CREDIBILITY (trust them):
Reuters, AP, AFP, BBC, CNN, Al Jazeera, NPR, New York Times, Wall Street Journal, Washington Post, The Guardian, Financial Times, Bloomberg, The Economist, Nature, Science

MODERATE CREDIBILITY (generally reliable):
Established national outlets, quality regional papers, reputable specialized sources

LOW CREDIBILITY (be skeptical):
Blogs, aggregators, questionable sources

ZERO CREDIBILITY (ignore):
Tabloids, conspiracy sites, satirical sources

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose ONE category that best fits:
- Politics
- Economy  
- International
- Health
- Science
- Technology
- Environment
- Disaster
- Sports
- Culture
- Other

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY a JSON array with this structure:

[
  {
    "title": "exact article title",
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
  },
  {
    "title": "another article title",
    "score": 450,
    "category": "Economy",
    "status": "FILTERED",
    "score_breakdown": {
      "recency": 100,
      "surprise": 50,
      "impact": 120,
      "conversation": 100,
      "educational": 80
    }
  }
]

Rules:
- status = "APPROVED" if score >= 700
- status = "FILTERED" if score < 700
- score_breakdown shows your thinking
- Maintain input article order
- Valid JSON only, no extra text
- Every article needs a category

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMEMBER YOUR MISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're helping people stay informed without wasting their time.
Think: "Would I want to read this? Would I tell someone about this?"
Be selective. Be ruthless with boring content.
Only approve things that are genuinely newsworthy and interesting.

Events > Analysis
Breaking > Features  
Surprising > Expected
Global > Local
News > Trends

Target: 10% approval rate. Only the best stuff makes it through."""

    # Prepare articles for scoring
    articles_text = "Score these news articles based on shareability and conversation-worthiness criteria. Return JSON array only.\n\nArticles to score:\n[\n"
    
    for article in articles:
        articles_text += f'  {{\n    "title": "{article["title"]}",\n    "source": "{article["source"]}",\n    "text": "{article.get("text", "")[:500]}",\n    "url": "{article["url"]}"\n  }},\n'
    
    articles_text += "]\n\nEvaluate each article and return JSON array with title, score (0-1000), category (MANDATORY - choose from: Politics, Economy, International, Health, Science, Technology, Environment, Disaster, Sports, Culture, Other), status (APPROVED if >=700, FILTERED if <700), and score_breakdown."
    
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