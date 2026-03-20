import requests
import json
import os
from typing import Dict, List, Optional, Tuple


# ==========================================
# COMPONENT-SPECIFIC SEARCH PROMPTS
# ==========================================
# Each prompt section is only included when that component was selected.
# This avoids wasting tokens and grounding queries on components the article doesn't need.

TIMELINE_SEARCH_PROMPT = """
═══════════════════════════════════════════════════════════════
TIMELINE DATA
═══════════════════════════════════════════════════════════════

Find 2-4 KEY EVENTS that led to this story. Help the reader understand "how we got here."

Requirements:
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
"""

DETAILS_SEARCH_PROMPT = """
═══════════════════════════════════════════════════════════════
DETAILS DATA
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
"""

GRAPH_SEARCH_PROMPT = """
═══════════════════════════════════════════════════════════════
GRAPH DATA
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
"""

MAP_SEARCH_PROMPT = """
═══════════════════════════════════════════════════════════════
MAP LOCATION DATA
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

FORMAT:
[EXACT LOCATION NAME] | [CITY] | [COUNTRY] | [WHY USERS WANT TO SEE] | [COORDINATES]

Example:
"Vilnius International Airport | Vilnius | Lithuania | Crash site where UPS cargo plane went down | 54.6341, 25.2858"

If only boring/famous locations available, write: "NO INTERESTING LOCATION"
"""

# Components that do NOT need Google Search grounding
# Scorecard and recipe are generated from the article itself, no web search needed
COMPONENTS_NOT_NEEDING_SEARCH = {'scorecard', 'recipe'}

# Components that need Google Search grounding
COMPONENT_PROMPT_MAP = {
    'timeline': TIMELINE_SEARCH_PROMPT,
    'details': DETAILS_SEARCH_PROMPT,
    'graph': GRAPH_SEARCH_PROMPT,
    'map': MAP_SEARCH_PROMPT,
}


def search_gemini_context(title: str, summary: str, full_text: str = "",
                          selected_components: Optional[List[str]] = None) -> Dict[str, str]:
    """
    Search Gemini for contextual facts using Google Search grounding.
    Only searches for the specific components that were selected in Step 6.

    Args:
        title: Article title from Step 4 synthesis
        summary: Bullet summary from Step 4 synthesis
        full_text: Full article text (optional)
        selected_components: List of components selected by Step 6 (e.g., ['details', 'timeline']).
                            If None, searches for all components (legacy behavior).

    Returns:
        dict with 'results' and 'citations'
    """

    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")

    # Determine which components need search
    if selected_components is not None:
        # Filter out components that don't need Google Search
        components_needing_search = [c for c in selected_components
                                      if c in COMPONENT_PROMPT_MAP]
    else:
        # Legacy fallback: search all
        components_needing_search = list(COMPONENT_PROMPT_MAP.keys())

    # If no components need search, return empty result (saves a grounding query)
    if not components_needing_search:
        print(f"   ⏭️  Skipping context search — no components need web search")
        return {
            'results': '',
            'citations': []
        }

    # Use Gemini 2.0 Flash with Google Search grounding
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"

    # Use full_text if provided, otherwise use summary
    article_text = full_text if full_text else summary

    # Build prompt with ONLY the sections needed
    component_sections = '\n'.join(
        COMPONENT_PROMPT_MAP[comp] for comp in components_needing_search
    )

    component_names = ', '.join(c.upper() for c in components_needing_search)

    prompt = f"""You are gathering data for specific news article components.

ARTICLE TITLE: {title}
BULLET SUMMARY: {summary}
FULL ARTICLE TEXT: {article_text[:3000]}

Gather information for ONLY these components: {component_names}
{component_sections}"""

    # Scale maxOutputTokens based on how many components we're searching for
    # Fewer components = fewer tokens needed = cheaper
    tokens_per_component = 1024
    max_tokens = min(4096, len(components_needing_search) * tokens_per_component)

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
            "maxOutputTokens": max_tokens
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
                        citations = ['Google Search']

                if not citations:
                    citations = ['Google Search via Gemini']

                print(f"   ✅ Gemini context search completed ({len(response_text)} chars, searched: {component_names})")
                return {
                    'results': response_text,
                    'citations': citations
                }

        print("   ⚠️ Empty response from Gemini, using fallback")
        return _get_fallback_context(title, summary)

    except Exception as e:
        print(f"   ⚠️ Gemini search error: {e}, using fallback")
        return _get_fallback_context(title, summary)


def _get_fallback_context(title: str, summary: str) -> Dict[str, str]:
    """Provide minimal fallback context when search fails"""
    fallback_results = f"""CONTEXTUAL DATA POINTS:
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
    if len(results.strip()) < 50:
        errors.append("Results too short - may not contain sufficient context")

    is_valid = len(errors) == 0
    return is_valid, errors


# Example usage and testing
if __name__ == "__main__":
    # Test with sample article — only searching for graph + details
    test_title = "European Central Bank raises interest rates to 4.5 percent"
    test_summary = "The quarter-point increase marks the tenth consecutive rate hike since July 2023, aimed at bringing inflation down from its current 5.3 percent."

    try:
        context_results = search_gemini_context(
            test_title, test_summary,
            selected_components=['graph', 'details']
        )

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
