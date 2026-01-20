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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    # Use full_text if provided, otherwise use summary
    article_text = full_text if full_text else claude_summary
    
    prompt = f"""You are gathering data for news article components.

ARTICLE TITLE: {claude_title}
BULLET SUMMARY: {claude_summary}
FULL ARTICLE TEXT: {article_text[:3000]}

Gather information for these FOUR categories:

═══════════════════════════════════════════════════════════════
1. TIMELINE DATA
═══════════════════════════════════════════════════════════════

TIMELINE IS RARELY NEEDED - only about 10% of news stories.

ASK: "Would readers be confused without knowing what happened before?"
- YES → Gather timeline
- NO → Write "TIMELINE NOT NEEDED"

STORIES THAT NEED TIMELINE:
- Ongoing wars/conflicts (Ukraine, Gaza, Syria)
- Multi-year legal cases or investigations (Epstein case)
- Political crises with multiple developments over time
- Complex diplomatic situations

STORIES THAT DON'T NEED TIMELINE (most news):
- Single announcements or statements
- Product launches or tech news
- Entertainment news
- Speeches or remarks
- Policy proposals
- Accidents or incidents (unless part of ongoing pattern)
- Business deals
- Sports news

IF TIMELINE IS NEEDED:

Find 2-4 events that are:
✓ From recent past (last 1-5 years)
✓ Directly relevant to THIS specific story
✓ Help readers understand "how we got here"

Write CLEAR, COMPLETE descriptions (15-25 words each).
Each event should explain WHAT happened AND WHY it matters.

FORMAT:
[FULL DATE] | [CLEAR 15-25 WORD DESCRIPTION]

GOOD EXAMPLES:
✓ "July 2019 | Jeffrey Epstein was arrested on federal sex trafficking charges involving dozens of underage girls, reopening investigations that had been closed for years"
✓ "February 2022 | Russia launched a full-scale military invasion of Ukraine, beginning the largest armed conflict in Europe since World War II"
✓ "January 2024 | William Lai won Taiwan's presidential election with 40% of the vote, securing an unprecedented third consecutive term for the DPP party"

BAD EXAMPLES:
✗ "Jul 2019 | Epstein arrested" - TOO SHORT, unclear
✗ "Ancient Greece | Philosophers create aphorisms" - IRRELEVANT padding
✗ "Late 1970s | North Korea begins missile program" - TOO OLD
✗ "2004 | Facebook launches" - IRRELEVANT to most stories

═══════════════════════════════════════════════════════════════
2. DETAILS DATA
═══════════════════════════════════════════════════════════════

Find interesting facts that are NOT in the bullet summary.

STEP 1: Read BULLET SUMMARY carefully
Write down every number and fact mentioned. These are OFF LIMITS.

STEP 2: Read FULL ARTICLE
Find NEW facts with numbers that bullets didn't mention.

STEP 3: Search internet
Find additional relevant statistics.

RULES:
✓ Must contain a specific number
✓ Must NOT be in bullet summary
✓ Must be relevant to the main story

FORMAT:
[LABEL]: [VALUE] | Source: [article/search] | In bullets: NO

GOOD DETAILS:
✓ Technical specs not mentioned in bullets
✓ Background statistics that add context
✓ Comparisons (previous records, averages)
✓ Relevant numbers from the article body

BAD DETAILS:
✗ ANYTHING already in bullet summary - FORBIDDEN
✗ Irrelevant trivia ("Temple founded 628 AD" for AirPods story)
✗ Facts without numbers
✗ Vague information

If bullets already contain all key facts, write: "NO ADDITIONAL DETAILS"

═══════════════════════════════════════════════════════════════
3. GRAPH DATA
═══════════════════════════════════════════════════════════════

CRITICAL: Graph data must be REAL from verified sources.
DO NOT make up numbers.

WHEN TO GATHER GRAPH DATA:
- Economic news with rate/price history (interest rates, stock prices)
- Scientific data with measurements over time (temperatures, emissions)
- Election polling or results over time
- Statistics that genuinely change over time

REQUIREMENTS:
✓ Data from reliable source (government agency, research institution, major publication)
✓ At least 4 verified data points
✓ Source name must be cited
✓ Numbers must be real, not estimated

FORMAT:
Source: [SOURCE NAME]
[DATE]: [VALUE]
[DATE]: [VALUE]
[DATE]: [VALUE]
[DATE]: [VALUE]

GOOD EXAMPLE:
"Source: Federal Reserve
March 2022: 0.50%
December 2022: 4.25%
July 2023: 5.25%
January 2024: 5.50%"

BAD EXAMPLES:
✗ Numbers that look too clean: 8, 9, 10, 11, 12 (likely fabricated)
✗ Data without source citation
✗ "Estimated" or "projected" numbers
✗ Made-up statistics

If no verified data exists, write: "NO VERIFIED GRAPH DATA"

═══════════════════════════════════════════════════════════════
4. MAP LOCATION DATA
═══════════════════════════════════════════════════════════════

Find the location WHERE THE NEWS ACTUALLY HAPPENED.

THE KEY QUESTION: "Where did this happen?"

ALWAYS FIND LOCATION FOR:

1. INCIDENTS & ACCIDENTS:
   - Plane crash → Find the crash site or airport
   - Car accident → Find the accident location
   - Shooting → Find where it happened
   - Attack → Find the exact venue
   
2. NATURAL DISASTERS:
   - Earthquake → Find epicenter or most affected area
   - Hurricane → Find landfall location
   - Flood → Find affected region
   - Wildfire → Find fire location

3. SPECIFIC EVENTS:
   - "Attack at X" → Find X
   - "Explosion at X" → Find X
   - "Fire at X" → Find X
   - "Protest at X" → Find X

4. DISPUTED TERRITORIES & FACILITIES:
   - South China Sea islands
   - Nuclear facilities
   - Military bases
   - Contested regions

NEVER BOTHER WITH:

✗ Famous government buildings:
  - Kremlin, White House, Capitol Building
  - Parliament buildings, presidential palaces
  - Everyone already knows where these are

✗ TV stations & corporate offices:
  - "Channel 4 headquarters" - nobody cares
  - Generic company offices

✗ Famous landmarks everyone knows:
  - Eiffel Tower, Big Ben, etc.

✗ Just a country or city name:
  - "Lithuania" is useless - find the specific crash site
  - "Moscow" is useless - find the specific venue

EXAMPLES:

"UPS Plane Crash Death Toll Climbs to 15"
→ FIND: Vilnius International Airport crash site
→ Users want to see WHERE the plane crashed

"Earthquake Kills Thousands in Turkey"
→ FIND: Epicenter location or Gaziantep
→ Users want to see WHERE the earthquake hit

"Terrorist Attack at Moscow Concert Hall"
→ FIND: Crocus City Hall exact location
→ Users want to see WHERE the attack happened

"Putin Announces New Policy"
→ DON'T BOTHER: Everyone knows where Kremlin is
→ Write "NO INTERESTING LOCATION"

"Congress Passes New Bill"
→ DON'T BOTHER: Everyone knows where Capitol is
→ Write "NO INTERESTING LOCATION"

FORMAT:
[EXACT LOCATION NAME] | [CITY] | [COUNTRY] | [WHY USERS WANT TO SEE] | [COORDINATES]

Example:
"Vilnius International Airport | Vilnius | Lithuania | Crash site where UPS cargo plane went down | 54.6341, 25.2858"

If only boring/famous locations available, write: "NO INTERESTING LOCATION"
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


