# TEN NEWS - RESEARCH ENHANCER
# Uses Perplexity API to add research, citations, timelines, and bold markup
# Works with both Daily Digest and Live News systems

import os
import json
import time
from datetime import datetime
from openai import OpenAI
import pytz

# ==================== API CONFIGURATION ====================
PERPLEXITY_API_KEY = os.environ.get('PERPLEXITY_API_KEY', 'your-perplexity-key-here')

# Perplexity models
PERPLEXITY_MODEL_STANDARD = "sonar"  # Standard research model
PERPLEXITY_MODEL_PRO = "sonar-pro"   # Premium research model (better quality)

# Choose which model to use
PERPLEXITY_MODEL = PERPLEXITY_MODEL_STANDARD  # Change to PERPLEXITY_MODEL_PRO for premium

# Initialize Perplexity client (uses OpenAI SDK)
perplexity_client = OpenAI(
    api_key=PERPLEXITY_API_KEY,
    base_url="https://api.perplexity.ai"
)

# ==================== UTILITY FUNCTIONS ====================
def clean_text_for_json(text):
    """Clean text to be JSON-safe"""
    if not text:
        return ""
    
    text = str(text)
    text = text.replace('\n', ' ')
    text = text.replace('\r', ' ')
    text = text.replace('\t', ' ')
    text = ' '.join(text.split())  # Normalize whitespace
    
    return text.strip()

def parse_json_response(response_text):
    """Parse JSON from API response with fallback"""
    if not response_text:
        return None
    
    response_text = response_text.strip()
    
    # Remove markdown code blocks if present
    if response_text.startswith('```json'):
        response_text = response_text[7:]
    if response_text.startswith('```'):
        response_text = response_text[3:]
    if response_text.endswith('```'):
        response_text = response_text[:-3]
    response_text = response_text.strip()
    
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        if start_idx >= 0 and end_idx > start_idx:
            try:
                return json.loads(response_text[start_idx:end_idx])
            except:
                pass
        
        # Try array format
        start_idx = response_text.find('[')
        end_idx = response_text.rfind(']') + 1
        if start_idx >= 0 and end_idx > start_idx:
            try:
                return json.loads(response_text[start_idx:end_idx])
            except:
                pass
    
    return None

# ==================== PERPLEXITY RESEARCH ====================
def research_article_with_perplexity(article, article_num, total_articles):
    """
    Use Perplexity API to research an article and add:
    - Bold markup (3-6 key terms)
    - 3 verified details with citations
    - 2-4 timeline events with dates
    - Source citations
    """
    print(f"\n🔍 Article {article_num}/{total_articles}: Researching '{article.get('title', '')[:60]}...'")
    
    if not PERPLEXITY_API_KEY or PERPLEXITY_API_KEY == 'your-perplexity-key-here':
        print("   ❌ Perplexity API key not configured!")
        return None
    
    # Extract article data
    title = article.get('title', '')
    summary = article.get('summary', '')
    url = article.get('url', '')
    source = article.get('source', 'Unknown')
    category = article.get('category', 'World News')
    
    # Create research prompt
    prompt = f"""You are a research assistant for a news platform. Your task is to enhance this article with verified facts, timeline, and formatting.

**ARTICLE TO RESEARCH:**
Title: {title}
Summary: {summary}
Source URL: {url}
Source: {source}
Category: {category}

**YOUR TASKS:**

1. **BOLD MARKUP** (Do NOT change words, only add **bold**):
   - Keep the summary text EXACTLY as provided
   - Add **bold** around 3-6 key terms: names, numbers, places, organizations, dates
   - Example: "Apple announced iPhone 16" → "**Apple** announced **iPhone 16**"
   - DO NOT add, remove, or change any words
   - Only add ** markers around existing words

2. **FIND 3 DETAILS** (Must be NEW information NOT in summary):
   - Search the web for verified facts about this story
   - Each detail must be "Label: Value" format
   - Label: 1-3 words (e.g., "Revenue", "Market cap", "Countries affected")
   - Value: Must start with NUMBER or DATE, maximum 7 words total
   - Examples: "Revenue: $89.5B", "Deaths: 142 confirmed", "Launch date: March 2026"
   - Each detail must be COMPLETELY NEW (not mentioned in summary)
   - Each must be verifiable with reputable sources

3. **CREATE TIMELINE** (2-4 events, chronological):
   - Each event needs: date (YYYY-MM-DD or Month YYYY) and event (≤8 words)
   - Include: Past event → Today's development → Future event (if any)
   - All events must be verifiable with sources
   - Example: {{"date": "January 2023", "event": "Company founded in Silicon Valley"}}

4. **PROVIDE CITATIONS** (2-6 URLs):
   - List actual URLs used for research
   - Prioritize: Reuters, AP, AFP, BBC, Bloomberg, WSJ, Guardian, official sites
   - Format: {{"url": "https://...", "publisher": "Reuters"}}

**CRITICAL RULES:**
- Only use REPUTABLE sources: Reuters, AP, AFP, BBC, Bloomberg, WSJ, FT, Guardian, CNN, official sites
- NO speculation - only verified facts
- Details must be NEW (not in summary)
- Timeline events must be ≤8 words each
- Summary words must remain unchanged (only add ** markers)

**RETURN THIS JSON ONLY:**
{{
  "summary_with_bold": "Summary with **bold** markup (same words, just added ** around 3-6 terms)",
  "details": [
    "Label: Value starting with number",
    "Label: Value starting with number", 
    "Label: Value starting with number"
  ],
  "timeline": [
    {{"date": "YYYY-MM-DD or Month YYYY", "event": "Past event (≤8 words)"}},
    {{"date": "Today or Month YYYY", "event": "Current development (≤8 words)"}},
    {{"date": "Month YYYY", "event": "Future event if any (≤8 words)"}}
  ],
  "citations": [
    {{"url": "https://...", "publisher": "Source Name"}},
    {{"url": "https://...", "publisher": "Source Name"}}
  ],
  "research_status": "ok"
}}

If you cannot find enough verified facts:
{{
  "research_status": "insufficient_sources",
  "summary_with_bold": "Summary with **bold** markup",
  "details": ["INSUFFICIENT", "INSUFFICIENT", "INSUFFICIENT"],
  "timeline": [],
  "citations": []
}}"""

    try:
        # Call Perplexity API
        response = perplexity_client.chat.completions.create(
            model=PERPLEXITY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a research assistant that finds verified facts from reputable news sources. Always provide citations. Return only valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,  # Low temperature for factual accuracy
            max_tokens=2000
        )
        
        # Extract response
        response_text = response.choices[0].message.content
        print(f"   📡 Received response from Perplexity")
        
        # Parse JSON
        parsed = parse_json_response(response_text)
        
        if not parsed:
            print(f"   ⚠️ Failed to parse JSON response")
            return None
        
        # Validate response
        if parsed.get('research_status') == 'insufficient_sources':
            print(f"   ⚠️ Insufficient sources found")
            return parsed
        
        # Check required fields
        if not all(key in parsed for key in ['summary_with_bold', 'details', 'timeline', 'citations']):
            print(f"   ⚠️ Missing required fields in response")
            return None
        
        # Validate details count
        details = parsed.get('details', [])
        if len(details) < 3:
            print(f"   ⚠️ Only {len(details)} details found (need 3)")
        
        # Validate timeline
        timeline = parsed.get('timeline', [])
        if len(timeline) < 2:
            print(f"   ⚠️ Only {len(timeline)} timeline events (recommended 2-4)")
        
        # Show what was found
        citations = parsed.get('citations', [])
        print(f"   ✅ Details: {len(details)}, Timeline: {len(timeline)} events, Citations: {len(citations)} sources")
        
        return parsed
        
    except Exception as e:
        print(f"   ❌ Error calling Perplexity API: {str(e)}")
        return None

# ==================== ARTICLE ENHANCEMENT ====================
def enhance_article(article, research_result):
    """Merge research results back into article"""
    if not research_result:
        return article
    
    # Create enhanced article
    enhanced = article.copy()
    
    # Update summary with bold markup
    if research_result.get('summary_with_bold'):
        enhanced['summary'] = research_result['summary_with_bold']
    
    # Add details
    if research_result.get('details') and research_result['details'][0] != 'INSUFFICIENT':
        enhanced['details'] = research_result['details']
    
    # Add timeline
    if research_result.get('timeline'):
        enhanced['timeline'] = research_result['timeline']
    
    # Add citations
    if research_result.get('citations'):
        enhanced['citations'] = research_result['citations']
    
    # Add research status
    enhanced['research_status'] = research_result.get('research_status', 'ok')
    
    return enhanced

# ==================== BATCH PROCESSING ====================
def enhance_articles_batch(articles, delay_seconds=2):
    """
    Enhance multiple articles with research
    
    Args:
        articles: List of article dictionaries
        delay_seconds: Delay between API calls to avoid rate limits
    
    Returns:
        List of enhanced articles
    """
    print(f"🔬 RESEARCH ENHANCEMENT SYSTEM")
    print(f"=" * 60)
    print(f"Using Perplexity API ({PERPLEXITY_MODEL})")
    print(f"Articles to enhance: {len(articles)}")
    print(f"Delay between calls: {delay_seconds} seconds")
    print(f"=" * 60)
    
    enhanced_articles = []
    successful = 0
    failed = 0
    insufficient = 0
    
    for i, article in enumerate(articles, 1):
        # Research the article
        research_result = research_article_with_perplexity(article, i, len(articles))
        
        if research_result:
            if research_result.get('research_status') == 'insufficient_sources':
                insufficient += 1
            else:
                successful += 1
            
            # Enhance article with research
            enhanced = enhance_article(article, research_result)
            enhanced_articles.append(enhanced)
        else:
            failed += 1
            # Keep original article
            enhanced_articles.append(article)
        
        # Delay between API calls
        if i < len(articles):
            time.sleep(delay_seconds)
    
    print(f"\n" + "=" * 60)
    print(f"📊 RESEARCH SUMMARY:")
    print(f"   ✅ Successful: {successful}")
    print(f"   ⚠️ Insufficient sources: {insufficient}")
    print(f"   ❌ Failed: {failed}")
    print(f"   📚 Total enhanced: {len(enhanced_articles)}")
    print(f"=" * 60)
    
    return enhanced_articles

# ==================== FILE PROCESSING ====================
def load_news_file(filename):
    """Load news data from JSON file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"📂 Loaded: {filename}")
        return data
    except Exception as e:
        print(f"❌ Error loading {filename}: {str(e)}")
        return None

def save_enhanced_news(original_data, enhanced_articles, output_filename):
    """Save enhanced news to file"""
    try:
        # Create output data structure
        output_data = original_data.copy()
        output_data['articles'] = enhanced_articles
        output_data['enhanced_at'] = datetime.now().isoformat()
        output_data['enhanced_at_uk'] = datetime.now(pytz.timezone('Europe/London')).isoformat()
        output_data['enhancement_method'] = f'Perplexity API ({PERPLEXITY_MODEL})'
        
        # Save to file
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ SUCCESS! Saved enhanced news to: {output_filename}")
        return True
        
    except Exception as e:
        print(f"❌ Error saving file: {str(e)}")
        return False

# ==================== MAIN FUNCTION ====================
def enhance_news_file(input_filename, output_filename=None):
    """
    Main function to enhance a news file with research
    
    Args:
        input_filename: Input JSON file (daily digest or live news)
        output_filename: Output filename (auto-generated if not provided)
    
    Returns:
        Output filename if successful, None otherwise
    """
    print(f"\n🚀 TEN NEWS - RESEARCH ENHANCER")
    print(f"=" * 60)
    print(f"Input: {input_filename}")
    
    # Load input file
    news_data = load_news_file(input_filename)
    if not news_data:
        return None
    
    # Extract articles
    articles = news_data.get('articles', [])
    if not articles:
        print("❌ No articles found in file")
        return None
    
    print(f"📰 Found {len(articles)} articles to enhance")
    
    # Enhance articles with research
    enhanced_articles = enhance_articles_batch(articles)
    
    # Generate output filename if not provided
    if not output_filename:
        # Extract base name and add _enhanced suffix
        base_name = input_filename.replace('.json', '')
        output_filename = f"{base_name}_enhanced.json"
    
    print(f"Output: {output_filename}")
    
    # Save enhanced news
    success = save_enhanced_news(news_data, enhanced_articles, output_filename)
    
    if success:
        return output_filename
    return None

# ==================== COMMAND LINE INTERFACE ====================
if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("TEN NEWS - RESEARCH ENHANCER")
    print("Powered by Perplexity API")
    print("=" * 60)
    
    # Check API key
    if not PERPLEXITY_API_KEY or PERPLEXITY_API_KEY == 'your-perplexity-key-here':
        print("\n❌ ERROR: Perplexity API key not configured!")
        print("\nPlease set your API key:")
        print("  export PERPLEXITY_API_KEY='your-key-here'")
        print("\nGet your key at: https://www.perplexity.ai/settings/api")
        sys.exit(1)
    
    # Check command line arguments
    if len(sys.argv) < 2:
        print("\n📖 USAGE:")
        print("  python news-research-enhancer.py <input_file.json> [output_file.json]")
        print("\n📝 EXAMPLES:")
        print("  python news-research-enhancer.py tennews_data_2025_10_06.json")
        print("  python news-research-enhancer.py livenews_data_2025_10_06_1430.json")
        print("  python news-research-enhancer.py input.json output_enhanced.json")
        print("\n💡 TIP: Output filename is auto-generated if not provided")
        sys.exit(0)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Enhance the file
    result = enhance_news_file(input_file, output_file)
    
    if result:
        print(f"\n🎉 Enhancement complete!")
        print(f"📄 Enhanced file: {result}")
        print(f"\n✨ Articles now include:")
        print(f"   • Bold markup on key terms")
        print(f"   • 3 verified details with numbers/dates")
        print(f"   • Timeline with 2-4 events")
        print(f"   • Citations from reputable sources")
    else:
        print(f"\n❌ Enhancement failed")
        sys.exit(1)

