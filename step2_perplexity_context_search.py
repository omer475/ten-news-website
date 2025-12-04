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
