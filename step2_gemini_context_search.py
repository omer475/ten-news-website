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
    
    prompt = f"""You are a research assistant gathering context for a news article.

ARTICLE TITLE: {claude_title}

ARTICLE SUMMARY: {claude_summary}

Please search for and provide:

1. TIMELINE CONTEXT:
   - Key dates and events related to this story
   - Historical background (what happened before)
   - Recent developments leading to this event
   - Upcoming scheduled events or deadlines

2. CONTEXTUAL DATA POINTS:
   - Relevant statistics and numbers
   - Comparisons (historical, regional, global)
   - Economic/social impact figures
   - Key metrics and measurements

3. ADDITIONAL CONTEXT:
   - Geographic scope and affected regions
   - Key stakeholders and their positions
   - Related policies or regulations
   - Expert opinions or official statements

Format your response with clear sections and numbered points.
Focus on FACTS that would help readers understand the full context of this news story.
Include specific dates, numbers, and verifiable information."""

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


