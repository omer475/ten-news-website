#!/usr/bin/env python3
"""
STEP 11: ARTICLE TAGGING SYSTEM
==========================================
Purpose: Tag articles with countries and topics for personalization
Model: Gemini 2.0 Flash
Input: Written article (title + bullets + category)
Output: countries[] and topics[] arrays
"""

import os
import requests
import json
import time
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

TAGGING_PROMPT_V1 = """# ARTICLE TAGGING SYSTEM V1

You are a news tagger. Your job is to tag each article with relevant **countries** and **topics** so we can personalize news feeds for users.

---

## YOUR TASK

For each article, assign:
1. **Countries** (0-3) - Which countries is this article primarily about?
2. **Topics** (1-3) - What topics does this article cover?

Be precise. Only tag what's directly relevant, not tangentially mentioned.

---

## AVAILABLE COUNTRIES

usa, uk, china, russia,
germany, france, spain, italy, ukraine, turkiye, ireland,
india, japan, south_korea, pakistan, singapore,
israel,
canada, brazil,
nigeria, south_africa,
australia

**Tagging Rules:**
- Tag the country the article is ABOUT, not just mentioned
- "Trump announces tariffs on China" -> usa, china
- "French election results" -> france
- "Global climate summit" -> No country tag (it's global)
- "EU announces new regulations" -> Tag specific countries affected, or none if general EU

---

## AVAILABLE TOPICS

**Business & Finance:**
economics, stock_markets, banking, startups

**Technology:**
ai, tech_industry, consumer_tech, cybersecurity, space

**Science & Health:**
science, climate, health, biotech

**Politics & World:**
politics, geopolitics, conflicts, human_rights

**Sports:**
football, american_football, basketball, tennis, f1, cricket, combat_sports, olympics

**Lifestyle:**
entertainment, music, gaming, travel

---

## TAGGING EXAMPLES

| Article | Countries | Topics |
|---------|-----------|--------|
| "Trump slams Bad Bunny's Super Bowl halftime show" | usa | entertainment, politics |
| "Turkiye Central Bank raises interest rates" | turkiye | economics, banking |
| "Seahawks crush Patriots to win Super Bowl" | usa | american_football |
| "China launches new AI chip to rival Nvidia" | china | ai, tech_industry |
| "Germany and France clash over EU budget" | germany, france | politics, economics |
| "Israeli forces conduct raid in West Bank" | israel | conflicts |
| "Tesla stock plunges 15% after earnings miss" | usa | stock_markets, tech_industry |
| "Scientists discover new species in Amazon" | brazil | science |
| "WHO warns of new disease outbreak" | (none) | health |
| "Champions League Final: Real Madrid vs Manchester City" | spain, uk | football |
| "Italy's Meloni announces new immigration policy" | italy | politics |
| "Spanish PM meets French president in Madrid" | spain, france | politics, geopolitics |
| "Kim Kardashian and Lewis Hamilton go public" | usa, uk | entertainment |
| "OpenAI releases GPT-5" | usa | ai, tech_industry |
| "India-Pakistan tensions rise over Kashmir" | india | conflicts, geopolitics |
| "Australian wildfires force evacuations" | australia | climate |
| "Japan's economy enters recession" | japan | economics |
| "UFC 300: Main event results" | (none) | combat_sports |
| "Elon Musk announces Mars mission timeline" | usa | space, tech_industry |
| "Russian drone strikes kill 3 in Ukraine" | russia, ukraine | conflicts |
| "Nigeria overtakes South Africa as largest economy" | nigeria, south_africa | economics |
| "F1 Monaco Grand Prix results" | (none) | f1 |
| "NBA Finals: Lakers beat Celtics" | usa | basketball |
| "Premier League: Chelsea 3-1 Wolves" | uk | football |

---

## EDGE CASES

### Multinational Companies
- "Apple announces new iPhone" -> usa, consumer_tech (Apple is US company)
- "Samsung releases new phone" -> south_korea, consumer_tech
- "BMW recalls vehicles" -> germany, tech_industry

### International Organizations
- "UN Security Council meets on Syria" -> Tag countries directly involved, + geopolitics
- "NATO expands presence in Eastern Europe" -> Tag specific countries if mentioned, + geopolitics
- "IMF warns of global recession" -> No country tag, economics

### Sports
- "Premier League results" -> uk, football
- "La Liga: Barcelona vs Real Madrid" -> spain, football
- "Serie A: Juventus vs AC Milan" -> italy, football
- "World Cup Final" -> Tag the competing countries, football
- "Wimbledon Final" -> uk, tennis
- "Super Bowl" -> usa, american_football

### Wars/Conflicts
- Always tag BOTH countries involved if applicable
- "Russia-Ukraine war update" -> russia, ukraine, conflicts
- "Israel-Hamas conflict" -> israel, conflicts

---

## OUTPUT FORMAT

Return valid JSON (no markdown, no code blocks):

[
  {
    "id": 1,
    "countries": ["usa", "china"],
    "topics": ["economics", "geopolitics"]
  }
]

---

## RULES

1. **Be conservative** - Only tag what's clearly relevant
2. **Max 3 countries** - If more than 3, pick the most important
3. **Max 3 topics** - Pick the most relevant
4. **Min 1 topic** - Every article must have at least 1 topic
5. **Countries can be empty** - Global/general stories may have no country
6. **Use exact tag names** - Use the lowercase versions provided above

---

## QUICK REFERENCE

**Countries (22):**
usa, uk, china, russia, germany, france, spain, italy, ukraine, turkiye, ireland, india, japan, south_korea, pakistan, singapore, israel, canada, brazil, nigeria, south_africa, australia

**Topics (29):**
economics, stock_markets, banking, startups, ai, tech_industry, consumer_tech, cybersecurity, space, science, climate, health, biotech, politics, geopolitics, conflicts, human_rights, football, american_football, basketball, tennis, f1, cricket, combat_sports, olympics, entertainment, music, gaming, travel
"""

# Valid country codes
VALID_COUNTRIES = [
    'usa', 'uk', 'china', 'russia', 'germany', 'france',
    'spain', 'italy', 'ukraine', 'turkiye', 'ireland',
    'india', 'japan', 'south_korea', 'pakistan', 'singapore',
    'israel', 'canada', 'brazil',
    'nigeria', 'south_africa', 'australia'
]

# Valid topic codes
VALID_TOPICS = [
    'economics', 'stock_markets', 'banking', 'startups',
    'ai', 'tech_industry', 'consumer_tech', 'cybersecurity', 'space',
    'science', 'climate', 'health', 'biotech',
    'politics', 'geopolitics', 'conflicts', 'human_rights',
    'football', 'american_football', 'basketball', 'tennis', 'f1',
    'cricket', 'combat_sports', 'olympics',
    'entertainment', 'music', 'gaming', 'travel'
]


def tag_article(
    title: str,
    bullets: List[str],
    category: str,
    api_key: str,
    max_retries: int = 3
) -> Dict:
    """
    Tag an article with countries and topics using Gemini 2.0 Flash.
    
    Args:
        title: Article title
        bullets: Summary bullets
        category: Article category
        api_key: Google AI API key
        max_retries: Maximum retry attempts
    
    Returns:
        Dict with 'countries' and 'topics' arrays
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    # Build article text for tagging
    bullets_text = "\n".join(f"- {b}" for b in bullets) if bullets else "No bullets available"
    
    article_text = f"""Tag this article. Return JSON array with countries and topics.

Article to tag:
[ID: 1]
Title: {title}
Category: {category}
Summary:
{bullets_text}
"""

    for attempt in range(max_retries):
        try:
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": TAGGING_PROMPT_V1 + "\n\n" + article_text}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 500,
                    "responseMimeType": "application/json"
                }
            }
            
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            
            # Extract text from response
            text = result['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Clean up markdown if present
            if text.startswith('```'):
                text = text.split('```')[1]
                if text.startswith('json'):
                    text = text[4:]
                text = text.strip()
            
            parsed = json.loads(text)
            
            # Handle array response (prompt asks for array)
            if isinstance(parsed, list) and len(parsed) > 0:
                result_item = parsed[0]
            elif isinstance(parsed, dict):
                result_item = parsed
            else:
                raise ValueError(f"Unexpected response format: {type(parsed)}")
            
            # Validate and clean countries
            countries = result_item.get('countries', [])
            if isinstance(countries, list):
                countries = [c.lower().strip() for c in countries if c.lower().strip() in VALID_COUNTRIES]
            else:
                countries = []
            
            # Validate and clean topics
            topics = result_item.get('topics', [])
            if isinstance(topics, list):
                topics = [t.lower().strip() for t in topics if t.lower().strip() in VALID_TOPICS]
            else:
                topics = []
            
            # Enforce limits
            countries = countries[:3]
            topics = topics[:3]
            
            # Ensure at least 1 topic (fallback based on category)
            if not topics:
                topics = _fallback_topic_from_category(category)
            
            return {
                'countries': countries,
                'topics': topics
            }
            
        except Exception as e:
            print(f"   ⚠️ Tagging attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    
    # Fallback: use category-based defaults
    print(f"   ⚠️ All tagging attempts failed, using category fallback")
    return {
        'countries': [],
        'topics': _fallback_topic_from_category(category)
    }


def _fallback_topic_from_category(category: str) -> List[str]:
    """Map article category to default topic(s) as fallback."""
    category_lower = (category or '').lower().strip()
    
    mapping = {
        'world': ['geopolitics'],
        'politics': ['politics'],
        'business': ['economics'],
        'tech': ['tech_industry'],
        'technology': ['tech_industry'],
        'science': ['science'],
        'health': ['health'],
        'finance': ['economics'],
        'sports': ['football'],
        'entertainment': ['entertainment'],
        'other': ['politics'],
    }
    
    return mapping.get(category_lower, ['politics'])


def tag_articles_batch(
    articles: List[Dict],
    api_key: str,
) -> List[Dict]:
    """
    Tag multiple articles. Each article dict should have:
    - 'title': str
    - 'bullets': List[str]
    - 'category': str
    
    Returns list of dicts with 'countries' and 'topics' for each article.
    """
    results = []
    
    for i, article in enumerate(articles):
        print(f"   🏷️ Tagging article {i+1}/{len(articles)}: {article.get('title', 'Unknown')[:60]}...")
        
        result = tag_article(
            title=article.get('title', ''),
            bullets=article.get('bullets', []),
            category=article.get('category', 'Other'),
            api_key=api_key
        )
        
        results.append(result)
        
        # Small delay to avoid rate limiting
        if i < len(articles) - 1:
            time.sleep(0.5)
    
    return results


# Example usage
if __name__ == "__main__":
    api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
    
    test_articles = [
        {
            "title": "Trump slams Bad Bunny's Super Bowl halftime show",
            "bullets": ["President Trump criticized Bad Bunny's performance", "Called it an 'affront to America'"],
            "category": "Entertainment"
        },
        {
            "title": "Chelsea beats Wolves 3-1 in Premier League",
            "bullets": ["Chelsea secured a 3-1 victory", "Goals from Palmer and Jackson"],
            "category": "Sports"
        },
    ]
    
    results = tag_articles_batch(test_articles, api_key)
    for article, tags in zip(test_articles, results):
        print(f"\n{article['title']}")
        print(f"  Countries: {tags['countries']}")
        print(f"  Topics: {tags['topics']}")
