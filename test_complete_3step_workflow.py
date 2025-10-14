import os
import sys
from step1_claude_title_summary import claude_write_title_summary
from step2_perplexity_context_search import search_perplexity_context
from step3_claude_format_timeline_details import claude_format_timeline_details

def generate_complete_news_content(article):
    """
    Complete 3-step workflow: Claude → Perplexity → Claude
    
    Args:
        article: dict with 'title' and 'description'
    
    Returns:
        dict with complete news content
    """
    
    print("🚀 STARTING COMPLETE 3-STEP NEWS GENERATION WORKFLOW")
    print("=" * 60)
    
    # Step 1: Claude writes title and summary
    print("\n📝 STEP 1: Claude writing title and summary...")
    try:
        step1_result = claude_write_title_summary(article)
        title = step1_result['title']
        summary = step1_result['summary']
        print(f"✅ Title: {title}")
        print(f"✅ Summary: {summary}")
    except Exception as e:
        print(f"❌ Step 1 failed: {e}")
        return None
    
    # Step 2: Perplexity searches for context
    print("\n🔍 STEP 2: Perplexity searching for context...")
    try:
        step2_result = search_perplexity_context(title, summary)
        context = step2_result['results']
        citations = step2_result.get('citations', [])
        print(f"✅ Found {len(context)} characters of contextual information")
        print(f"✅ Citations: {len(citations)} sources")
    except Exception as e:
        print(f"❌ Step 2 failed: {e}")
        return None
    
    # Step 3: Claude formats timeline and details
    print("\n📊 STEP 3: Claude formatting timeline and details...")
    try:
        step3_result = claude_format_timeline_details(title, summary, context)
        timeline = step3_result['timeline']
        details = step3_result['details']
        print(f"✅ Timeline: {len(timeline)} events")
        print(f"✅ Details: {len(details)} data points")
    except Exception as e:
        print(f"❌ Step 3 failed: {e}")
        return None
    
    # Combine everything into final result
    final_result = {
        "title": title,
        "summary": summary,
        "timeline": timeline,
        "details": details,
        "citations": citations,
        "workflow": "3-step Claude-Perplexity-Claude"
    }
    
    print("\n🎉 WORKFLOW COMPLETE!")
    print("=" * 60)
    
    return final_result


def display_final_output(result):
    """
    Display the final news content in a formatted way
    """
    if not result:
        print("❌ No result to display")
        return
    
    print("\n📰 FINAL NEWS CONTENT")
    print("=" * 60)
    
    print(f"\n🏷️  TITLE:")
    print(f"   {result['title']}")
    
    print(f"\n📄 SUMMARY:")
    print(f"   {result['summary']}")
    
    print(f"\n⏰ TIMELINE:")
    for i, event in enumerate(result['timeline'], 1):
        print(f"   {i}. {event['date']}: {event['event']}")
    
    print(f"\n📊 DETAILS:")
    for i, detail in enumerate(result['details'], 1):
        print(f"   {i}. {detail}")
    
    if result['citations']:
        print(f"\n🔗 SOURCES:")
        for i, citation in enumerate(result['citations'], 1):
            print(f"   {i}. {citation}")
    
    print(f"\n🔄 WORKFLOW: {result['workflow']}")


# Example usage and testing
if __name__ == "__main__":
    # Test article
    article = {
        "title": "ECB Rate Decision",
        "description": "The European Central Bank announced today that it is raising interest rates by 0.25 percentage points to 4.5%, marking the tenth consecutive increase since July 2023. The decision comes as inflation remains at 5.3%, well above the bank's 2% target. ECB President Christine Lagarde stated that the move is necessary to bring inflation under control, despite concerns about economic growth slowing across the eurozone. The rate increase will affect borrowing costs for mortgages and business loans across all 20 member countries."
    }
    
    print("🧪 TESTING COMPLETE 3-STEP WORKFLOW")
    print("=" * 60)
    
    # Generate complete news content
    result = generate_complete_news_content(article)
    
    # Display the results
    display_final_output(result)
    
    # Calculate costs
    print(f"\n💰 COST ESTIMATION:")
    print(f"   Step 1 (Claude title/summary): ~$0.009")
    print(f"   Step 2 (Perplexity search): ~$0.001")
    print(f"   Step 3 (Claude timeline/details): ~$0.0135")
    print(f"   Total per article: ~$0.0235 (2.35 cents)")
