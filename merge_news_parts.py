# TEN NEWS - ARTICLE MERGER
# Combines Part 1 (Breaking) and Part 2 (Global) outputs
# Sorts all articles by final_score (highest first)
# Minimum threshold: 70 points

import json
import os
from datetime import datetime
import glob

def find_latest_output(pattern):
    """Find the most recent output file matching pattern"""
    files = glob.glob(pattern)
    if not files:
        return None
    # Sort by modification time, get most recent
    latest = max(files, key=os.path.getmtime)
    return latest

def merge_news_parts(part1_file=None, part2_file=None, output_file=None):
    """
    Merge Part 1 and Part 2 outputs, sort by score
    
    Articles are sorted by final_score (highest first) regardless of which part they came from.
    This ensures that a 92-point article from Part 1 appears before an 85-point article from Part 2.
    """
    print("🔀 TEN NEWS - ARTICLE MERGER")
    print("=" * 60)
    print("Combining Part 1 (Breaking) + Part 2 (Global)")
    print("Sorting by final_score (highest first)")
    print("=" * 60)
    
    # Auto-find latest files if not specified
    if not part1_file:
        part1_file = find_latest_output("part1_breaking_*.json")
    if not part2_file:
        part2_file = find_latest_output("part2_global_*.json")
    
    all_articles = []
    part1_count = 0
    part2_count = 0
    
    # Load Part 1 articles
    if part1_file and os.path.exists(part1_file):
        print(f"\n📰 Loading Part 1: {os.path.basename(part1_file)}")
        try:
            with open(part1_file, 'r', encoding='utf-8') as f:
                part1_data = json.load(f)
                part1_articles = part1_data.get('articles', [])
                # Tag source
                for article in part1_articles:
                    article['source_part'] = 1
                all_articles.extend(part1_articles)
                part1_count = len(part1_articles)
                print(f"   ✅ Loaded {part1_count} articles from Part 1")
        except Exception as e:
            print(f"   ⚠️ Error loading Part 1: {str(e)}")
    else:
        print(f"\n⚠️ Part 1 file not found")
    
    # Load Part 2 articles
    if part2_file and os.path.exists(part2_file):
        print(f"\n📰 Loading Part 2: {os.path.basename(part2_file)}")
        try:
            with open(part2_file, 'r', encoding='utf-8') as f:
                part2_data = json.load(f)
                part2_articles = part2_data.get('articles', [])
                # Tag source
                for article in part2_articles:
                    article['source_part'] = 2
                all_articles.extend(part2_articles)
                part2_count = len(part2_articles)
                print(f"   ✅ Loaded {part2_count} articles from Part 2")
        except Exception as e:
            print(f"   ⚠️ Error loading Part 2: {str(e)}")
    else:
        print(f"\n⚠️ Part 2 file not found")
    
    if not all_articles:
        print("\n❌ No articles to merge!")
        print("   This is NORMAL if no articles met the 70-point threshold.")
        print("   The website will show: 'No significant news today'")
        return None
    
    # Sort by final_score (highest first)
    print(f"\n🔢 Sorting {len(all_articles)} articles by final_score...")
    all_articles.sort(key=lambda x: x.get('final_score', 0), reverse=True)
    
    # Show score distribution
    if all_articles:
        highest_score = all_articles[0].get('final_score', 0)
        lowest_score = all_articles[-1].get('final_score', 0)
        avg_score = sum(a.get('final_score', 0) for a in all_articles) / len(all_articles)
        
        print(f"\n📊 SCORE STATISTICS:")
        print(f"   Highest: {highest_score:.0f} points")
        print(f"   Lowest:  {lowest_score:.0f} points")
        print(f"   Average: {avg_score:.1f} points")
        print(f"   Range:   {lowest_score:.0f}-{highest_score:.0f}")
    
    # Show breakdown
    print(f"\n📈 ARTICLE BREAKDOWN:")
    print(f"   Part 1 (Breaking):  {part1_count} articles")
    print(f"   Part 2 (Global):    {part2_count} articles")
    print(f"   ─────────────────────────────")
    print(f"   TOTAL:              {len(all_articles)} articles")
    
    # Show top 10 with sources
    print(f"\n🏆 TOP 10 ARTICLES BY SCORE:")
    for i, article in enumerate(all_articles[:10], 1):
        score = article.get('final_score', 0)
        title = article.get('title', 'Untitled')[:60]
        part = article.get('source_part', '?')
        emoji = article.get('emoji', '📰')
        print(f"   {i:2d}. [{score:3.0f}pts] [Part {part}] {emoji} {title}...")
    
    # Create merged output
    timestamp = datetime.now().strftime('%Y_%m_%d_%H%M')
    if not output_file:
        output_file = f"tennews_data_{timestamp}.json"
    
    merged_data = {
        'generatedAt': datetime.now().isoformat(),
        'displayTimestamp': datetime.now().strftime("%A, %B %d, %Y at %H:%M %Z"),
        'merged': True,
        'part1_count': part1_count,
        'part2_count': part2_count,
        'totalArticles': len(all_articles),
        'score_range': {
            'highest': all_articles[0].get('final_score', 0) if all_articles else 0,
            'lowest': all_articles[-1].get('final_score', 0) if all_articles else 0,
            'average': sum(a.get('final_score', 0) for a in all_articles) / len(all_articles) if all_articles else 0
        },
        'articles': all_articles
    }
    
    # Save
    print(f"\n💾 Saving merged file: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*60}")
    print(f"✅ SUCCESS! Merged output saved")
    print(f"📄 File: {output_file}")
    print(f"📰 Total articles: {len(all_articles)}")
    print(f"📊 From Part 1: {part1_count} | From Part 2: {part2_count}")
    print(f"🏆 Score range: {lowest_score:.0f}-{highest_score:.0f} points")
    print("=" * 60)
    
    return output_file

if __name__ == "__main__":
    print("\n🔀 TEN NEWS - AUTOMATIC MERGER")
    print("Finding latest outputs from Part 1 and Part 2...")
    print()
    
    result = merge_news_parts()
    
    if result:
        print(f"\n🎉 Merge complete!")
        print(f"📄 Output: {result}")
        print(f"\n💡 This file is ready to be used by your website.")
        print(f"   Copy to public/ folder or integrate with your CMS.")
    else:
        print(f"\n⚠️ Merge completed with no articles.")
        print(f"   No articles met the 70-point threshold.")
        print(f"   This is NORMAL and expected on slow news days.")

