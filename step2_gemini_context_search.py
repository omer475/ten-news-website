import requests
import json
import os
from typing import Dict, Tuple

def search_gemini_context(claude_title: str, claude_summary: str, full_text: str = "") -> Dict[str, str]:
    """
    Search Gemini for contextual facts using Google Search grounding
    
    Args:
        claude_title: str, title written by Claude in Step 1
        claude_summary: str, summary written by Claude in Step 1
        full_text: str, full article text (optional)
    
    Returns:
        dict with 'results' and 'citations'
    """
    
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    # Use Gemini 2.0 Flash with Google Search grounding
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    # Use full_text if provided, otherwise use summary
    article_text = full_text if full_text else claude_summary
    
    prompt = f"""You are gathering structured data for news article components.

ARTICLE TITLE: {claude_title}
BULLET SUMMARY: {claude_summary}
FULL ARTICLE TEXT: {article_text[:3000]}

Search for and organize information into these FOUR categories:

═══════════════════════════════════════════════════════════════
1. TIMELINE DATA
═══════════════════════════════════════════════════════════════

IMPORTANT: Only gather timeline data if this story REQUIRES historical context to understand.

Stories that NEED timeline:
- Ongoing conflicts with complex history (wars, diplomatic crises)
- Multi-stage investigations or trials
- Policy changes that reverse previous decisions
- Events that are part of a longer sequence

Stories that DO NOT need timeline:
- Single announcements or statements
- Entertainment news (TV shows, movies, celebrities)
- Simple policy proposals
- Breaking news without complex backstory
- Speeches or remarks

If timeline IS needed, find 3-5 dated events:
- Key events that led to this moment
- Previous similar incidents
- Important turning points

FORMAT: [DATE] - [WHAT HAPPENED]

If timeline is NOT needed, write: "TIMELINE NOT REQUIRED - Story is self-contained"

═══════════════════════════════════════════════════════════════
2. DETAILS DATA
═══════════════════════════════════════════════════════════════

Find interesting facts NOT already in the bullet summary.

STEP A - Extract from FULL ARTICLE TEXT:
Read carefully and find specific facts/numbers NOT in bullets:
- Numbers, measurements, quantities
- Technical specifications
- Names, titles, ages
- Costs, amounts, percentages
- Historical comparisons

STEP B - Search internet for additional context:
- Background statistics
- Comparative data
- Related metrics

FORMAT: [LABEL]: [VALUE] | Source: [article/search]

CRITICAL: Do NOT include facts already in BULLET SUMMARY.

═══════════════════════════════════════════════════════════════
3. TREND DATA (for Graph)
═══════════════════════════════════════════════════════════════

Find time-series data only if story involves measurable trends:
- Economic indicators over time
- Poll numbers over time
- Casualty/case counts over time
- Price changes over time

FORMAT: List of (date, value) pairs with at least 4 points

If no trend data exists, write: "NO TREND DATA AVAILABLE"

═══════════════════════════════════════════════════════════════
4. EXACT LOCATION DATA (for Map)
═══════════════════════════════════════════════════════════════

Find the MOST INTERESTING and SPECIFIC location related to this story.

LOCATION PRIORITY (choose the most relevant):

1. WHERE THE EVENT ACTUALLY HAPPENED:
   - "Studio 8H, 30 Rockefeller Plaza" for SNL sketch
   - "Mar-a-Lago" for Florida meetings
   - "Oval Office" for presidential announcements

2. WHERE THE SUBJECT IS LOCATED:
   - "Yongbyon Nuclear Complex" for North Korea nuclear news
   - "Zaporizhzhia Nuclear Plant" for Ukraine nuclear news
   - "Kremlin" for Russian government decisions

3. WHERE THE IMPACT WILL BE FELT:
   - Specific affected facility or site
   - Target location mentioned in threats

SEARCH STRATEGY:
1. Read article for ANY specific place names (buildings, facilities, bases)
2. If article says "talks in Florida" - find the EXACT venue
3. If article mentions nuclear weapons - find the specific facility
4. If article is about a TV show - find the studio location
5. If article is about government action - find the specific building

WHAT TO LOOK FOR:
- Venue names: "Mar-a-Lago", "Studio 8H", "Crocus City Hall"
- Government buildings: "The Kremlin", "Pentagon", "Capitol Building"
- Military sites: "Yongbyon Nuclear Complex", "Novorossiysk Naval Base"
- Facilities: "Zaporizhzhia Nuclear Plant", "Tesla Gigafactory"
- Studios/Offices: "30 Rockefeller Plaza", "Apple Park"

FORMAT:
[EXACT LOCATION] | [CITY] | [COUNTRY] | [WHY THIS LOCATION] | [COORDINATES]

GOOD EXAMPLES:
✓ "Studio 8H, 30 Rockefeller Plaza | New York | USA | Where SNL is filmed and broadcast | 40.7593, -73.9794"
✓ "Mar-a-Lago | Palm Beach | USA | Trump's residence where meetings held | 26.6777, -80.0367"
✓ "Yongbyon Nuclear Complex | Yongbyon | North Korea | Main nuclear weapons facility | 39.7947, 125.7553"
✓ "The Kremlin | Moscow | Russia | Russian government headquarters | 55.7520, 37.6175"
✓ "Capitol Building | Washington DC | USA | Where legislation is passed | 38.8899, -77.0091"

BAD EXAMPLES (REJECTED):
✗ "Seoul, South Korea" - Not even relevant to North Korea/Japan story
✗ "Ukraine" - Just a country, no specific location
✗ "United States" - Completely useless
✗ "Florida" - State only, need exact venue
✗ "New York" - City only, need exact building

SPECIAL CASES:

For GOVERNMENT/POLICY news:
- Find the specific building (White House, Capitol, Kremlin, etc.)

For ENTERTAINMENT news:
- Find the studio, theater, or venue

For MILITARY/WEAPONS news:
- Find the specific base, facility, or installation

For DIPLOMATIC news:
- Find the exact meeting location (hotel, resort, government building)

If NO specific location can be found, write:
"NO SPECIFIC LOCATION - Only general areas mentioned, map not recommended"
"""

    request_data = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 4096
        },
        "tools": [{
            "google_search": {}
        }]
    }
    
    try:
        response = requests.post(url, json=request_data, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        # Extract text from response
        if 'candidates' in result and len(result['candidates']) > 0:
            candidate = result['candidates'][0]
            if 'content' in candidate and 'parts' in candidate['content']:
                response_text = candidate['content']['parts'][0]['text']
                
                # Extract citations from grounding metadata if available
                citations = []
                if 'groundingMetadata' in candidate:
                    grounding = candidate['groundingMetadata']
                    if 'groundingChunks' in grounding:
                        for chunk in grounding['groundingChunks']:
                            if 'web' in chunk:
                                citations.append(chunk['web'].get('uri', ''))
                    elif 'webSearchQueries' in grounding:
                        # Fallback - just note that search was used
                        citations = ['Google Search']
                
                if not citations:
                    citations = ['Google Search via Gemini']
                
                print(f"   ✅ Gemini context search completed ({len(response_text)} chars)")
                return {
                    'results': response_text,
                    'citations': citations
                }
        
        print("   ⚠️ Empty response from Gemini, using fallback")
        return _get_fallback_context(claude_title, claude_summary)
        
    except Exception as e:
        print(f"   ⚠️ Gemini search error: {e}, using fallback")
        return _get_fallback_context(claude_title, claude_summary)


def _get_fallback_context(title: str, summary: str) -> Dict[str, str]:
    """Provide minimal fallback context when search fails"""
    fallback_results = f"""TIMELINE CONTEXT:
This is a developing story. Please check official sources for the latest updates.

CONTEXTUAL DATA POINTS:
- Story topic: {title[:100]}
- Additional details should be verified from primary sources

ADDITIONAL CONTEXT:
This article covers significant current events. For complete context, readers should consult multiple news sources."""
    
    return {
        'results': fallback_results,
        'citations': ['Fallback - primary sources recommended']
    }


def validate_gemini_response(response: Dict[str, str]) -> Tuple[bool, list]:
    """
    Validate Gemini's contextual search response
    
    Returns: (is_valid, errors)
    """
    errors = []
    
    if 'results' not in response:
        errors.append("Missing results in response")
        return False, errors
    
    results = response['results']
    
    # Basic validation
    if len(results.strip()) < 100:
        errors.append("Results too short - may not contain sufficient context")
    
    # Check for key sections
    if 'TIMELINE' not in results.upper() and 'EVENT' not in results.upper() and 'CONTEXT' not in results.upper():
        errors.append("Missing timeline/event information")
    
    if 'DATA' not in results.upper() and 'STATISTIC' not in results.upper() and 'NUMBER' not in results.upper():
        errors.append("Missing data/statistics information")
    
    is_valid = len(errors) == 0
    return is_valid, errors


# Example usage and testing
if __name__ == "__main__":
    # Test with sample article
    test_title = "European Central Bank raises interest rates to 4.5 percent"
    test_summary = "The quarter-point increase marks the tenth consecutive rate hike since July 2023, aimed at bringing inflation down from its current 5.3 percent."
    
    try:
        context_results = search_gemini_context(test_title, test_summary)
        
        print("=== GEMINI CONTEXT SEARCH RESULTS ===")
        print("Results:", context_results['results'][:500], "...")
        print("\nCitations:", context_results['citations'])
        
        # Validate the result
        is_valid, errors = validate_gemini_response(context_results)
        if is_valid:
            print("✅ Validation passed!")
        else:
            print("❌ Validation failed:")
            for error in errors:
                print(f"  - {error}")
                
    except Exception as e:
        print(f"Error: {e}")


