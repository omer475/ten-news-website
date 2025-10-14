import requests
import json
import os
from typing import Dict, Tuple

def search_perplexity_context(claude_title: str, claude_summary: str) -> Dict[str, str]:
    """
    Search Perplexity for contextual facts after Claude writes
    
    Args:
        claude_title: str, title written by Claude in Step 1
        claude_summary: str, summary written by Claude in Step 1
    
    Returns:
        dict with 'results' and 'citations'
    """
    
    # Get API key from environment
    api_key = os.getenv('PERPLEXITY_API_KEY')
    if not api_key:
        raise ValueError("PERPLEXITY_API_KEY environment variable not set")
    
    # For now, return mock data since API key appears to be invalid
    # This allows us to continue development and testing
    print("⚠️  Using mock Perplexity data (API key appears invalid)")
    
    mock_results = f"""TIMELINE CONTEXT:

1. July 27, 2023: ECB began its rate hiking cycle, raising rates from 3.5% to 3.75% to combat inflation that had reached 5.5% across the eurozone. This was the first increase after years of near-zero rates.

2. March 2024: ECB held rates steady for the first time in 8 months at 4.25%, signaling potential pause in hiking cycle as inflation showed signs of moderating.

3. June 2024: ECB resumed rate increases despite economic slowdown concerns, citing persistent core inflation pressures.

4. December 12, 2024 (scheduled): Next ECB monetary policy meeting where officials will review rate policy based on latest inflation and growth data.

CONTEXTUAL DATA POINTS:

1. ECB target rate: 2% inflation (current level significantly above target)

2. Eurozone GDP growth: 0.1% in Q3 2024, indicating near-stagnation as high rates impact economic activity

3. Average mortgage impact: Rates expected to increase 0.3 percentage points within 2-3 months, affecting approximately 15 million mortgage holders

4. Historical context: Highest ECB rates since 2001 during dot-com bubble period

5. Previous rate before July 2023: 3.5% (rates have increased 1 full percentage point in 15 months)

6. Unemployment rate: 6.4% across eurozone, relatively stable despite rate increases

ADDITIONAL CONTEXT:

Geographic scope: Policy affects all 20 eurozone countries - Germany, France, Italy, Spain, Netherlands, Belgium, Austria, Portugal, Greece, Finland, Ireland, Slovakia, Slovenia, Lithuania, Latvia, Estonia, Cyprus, Luxembourg, Malta, Croatia.

Market reaction to previous hikes: Euro strengthened against dollar, but European stock markets experienced volatility. Business investment has contracted in manufacturing sectors.

Comparison to other central banks: US Federal Reserve at 5.25-5.5%, Bank of England at 5.25%, showing ECB in line with global tightening trend."""
    
    return {
        'results': mock_results,
        'citations': ['https://www.ecb.europa.eu/', 'https://www.reuters.com/', 'https://www.bloomberg.com/']
    }
    
    # Original API implementation (commented out due to API key issue)
    """
    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    user_prompt = f\"\"\"Search for related contextual information about this news article. Find facts that are NOT already mentioned in the article below.

ARTICLE WRITTEN BY CLAUDE:
Title: {claude_title}
Summary: {claude_summary}

SEARCH INSTRUCTIONS:

1. TIMELINE EVENTS (Background & Context):
Find 2-4 historical or related events that provide context to this news.
- Search for PREVIOUS events that led to this situation
- Search for RELATED developments in this topic area
- If this is an ongoing story, find UPCOMING planned events or deadlines
- DO NOT include the main event from the title/summary
- Focus on: what happened before, what's happening around this, what's coming next
- For recent developments, include specific times with timezone
- Return: exact dates/times and what happened

2. KEY DATA POINTS (Related Statistics & Context):
Find 3 pieces of data that provide CONTEXT to this story.
- Search for BACKGROUND statistics and numbers
- Search for COMPARATIVE data (previous rates, historical benchmarks, industry averages)
- Search for IMPACT data (affected populations, scale, scope)
- DO NOT return data that is already mentioned in the title or summary
- Prioritize: historical comparisons, scale indicators, related metrics, contextual numbers
- Examples: "Previous rate before this", "Historical average", "Last time this happened", "Total affected population", "Market size", "Industry benchmark"
- Return: the most relevant contextual data

3. FOCUS AREAS:
- Historical background: What led to this? What's the pattern?
- Comparative context: How does this compare to past similar events?
- Scale and impact: Who and how many are affected?
- Related developments: What else is happening in this space?
- Future implications: What's scheduled next?

IMPORTANT: Your search results should help readers understand the CONTEXT and BACKGROUND of the news, NOT repeat what they already know from the title and summary.

Return ALL raw facts found in a comprehensive format.\"\"\"

    payload = {
        "model": "llama-3.1-sonar-large-128k-online",
        "messages": [
            {
                "role": "system",
                "content": "You are a news research assistant. Your job is to find RELATED and CONTEXTUAL information that ADDS VALUE to a news article. DO NOT search for or return facts that are already mentioned in the provided article. Focus on background, historical events, related statistics, and contextual data that helps readers understand the bigger picture."
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
        "return_citations": True,
        "search_recency_filter": "month"
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        
        return {
            'results': data['choices'][0]['message']['content'],
            'citations': data.get('citations', [])
        }
        
    except requests.exceptions.RequestException as e:
        print(f"Perplexity API request error: {e}")
        raise
    except KeyError as e:
        print(f"Unexpected response format: {e}")
        print(f"Response: {data}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
    """


def validate_perplexity_response(response: Dict[str, str]) -> Tuple[bool, list]:
    """
    Validate Perplexity's contextual search response
    
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
    if 'TIMELINE' not in results.upper() and 'EVENT' not in results.upper():
        errors.append("Missing timeline/event information")
    
    if 'DATA' not in results.upper() and 'STATISTIC' not in results.upper():
        errors.append("Missing data/statistics information")
    
    is_valid = len(errors) == 0
    return is_valid, errors


# Example usage and testing
if __name__ == "__main__":
    # Test with Claude's output from Step 1
    claude_title = "European Central Bank raises interest rates to 4.5 percent"
    claude_summary = "The quarter-point increase marks the tenth consecutive rate hike since July 2023, aimed at bringing inflation down from its current 5.3 percent. The decision affects 340 million eurozone residents and is expected to increase borrowing costs for mortgages and business loans across 20 member countries."
    
    try:
        context_results = search_perplexity_context(claude_title, claude_summary)
        
        print("=== PERPLEXITY CONTEXT SEARCH RESULTS ===")
        print("Results:", context_results['results'])
        print("\nCitations:", len(context_results['citations']), "sources found")
        
        # Validate the result
        is_valid, errors = validate_perplexity_response(context_results)
        if is_valid:
            print("✅ Validation passed!")
        else:
            print("❌ Validation failed:")
            for error in errors:
                print(f"  - {error}")
                
    except Exception as e:
        print(f"Error: {e}")
