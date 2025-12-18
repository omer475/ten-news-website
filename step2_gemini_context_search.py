import requests
import json
import os
from typing import Dict, Tuple

def search_gemini_context(claude_title: str, claude_summary: str) -> Dict[str, str]:
    """
    Search Gemini for contextual facts using Google Search grounding
    
    Args:
        claude_title: str, title written by Claude in Step 1
        claude_summary: str, summary written by Claude in Step 1
    
    Returns:
        dict with 'results' and 'citations'
    """
    
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    # Use Gemini 2.0 Flash with Google Search grounding
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    prompt = f"""You are gathering structured data for news article components.

ARTICLE TITLE: {claude_title}
ARTICLE SUMMARY: {claude_summary}

Search for and organize information into these FOUR categories:

═══ 1. TIMELINE DATA ═══
Find 4-6 dated events related to this story:
- Historical precedents (similar past events)
- Key developments leading to this event
- Scheduled future events or deadlines
- Policy changes or decisions in this domain

FORMAT EACH AS: [DATE] - [WHAT HAPPENED]
Example: "Mar 15, 2024 - Fed held rates at 5.25% for fifth consecutive meeting"

═══ 2. STATISTICAL DATA (for Details component) ═══
Find 5-8 specific numbers related to this story:
- Quantities (deaths, attendees, units sold)
- Percentages (growth rates, approval ratings, changes)
- Money figures (costs, revenues, damages)
- Comparisons (previous values, averages, records)

FORMAT EACH AS: [LABEL]: [NUMBER WITH UNIT]
Example: "Previous death toll: 340" or "Market share: 23.5%"

═══ 3. TREND DATA (for Graph component) ═══
Find time-series data if this story involves:
- Economic indicators (rates, prices, GDP)
- Polling/election data over time
- Growth/decline metrics
- Any measurable change over time

FORMAT AS: List of (date, value) pairs
Example: "Interest rates: Jan 2022: 0.25%, Mar 2022: 0.50%, Jul 2023: 5.25%"

If no clear trend data exists, write: "NO TREND DATA AVAILABLE"

═══ 4. GEOGRAPHIC DATA (for Map component) ═══
Find specific locations central to this story:
- Exact cities, regions, or countries where events occurred
- Areas directly affected or impacted
- Locations of key stakeholders or decisions

FORMAT EACH AS: [CITY, COUNTRY] - [WHY RELEVANT]
Example: "Gaza City, Palestine - main conflict zone" or "Brussels, Belgium - EU headquarters where decision announced"

If no specific locations are central to story, write: "NO GEOGRAPHIC DATA AVAILABLE"

═══ RULES ═══
- Include ONLY verifiable facts with specific numbers/dates/locations
- Prioritize recent data (last 2-3 years)
- Skip vague statements without concrete data
- If a category has no relevant data, write "NO DATA AVAILABLE"
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


