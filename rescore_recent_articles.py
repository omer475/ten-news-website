#!/usr/bin/env python3
"""
Re-score recent articles with V19 scoring prompt.
Updates ai_final_score, topic_relevance, country_relevance, and category.
"""

import os
import json
import time
from dotenv import load_dotenv
from supabase import create_client
from step10_article_scoring import score_article, SCORING_SYSTEM_PROMPT_V19, get_reference_articles

load_dotenv('.env.local')

def rescore_recent(hours=15, batch_size=5):
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    gemini_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_AI_KEY')

    if not all([url, key, gemini_key]):
        print("Missing env vars")
        return

    supabase = create_client(url, key)

    # Fetch articles from last N hours
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

    result = supabase.table('published_articles')\
        .select('id, title_news, summary_bullets_news, ai_final_score, category')\
        .gte('created_at', cutoff)\
        .order('created_at', desc=True)\
        .execute()

    articles = result.data or []
    print(f"Found {len(articles)} articles from last {hours}h to re-score")

    if not articles:
        return

    # Get reference articles for calibration
    references = get_reference_articles(supabase)

    valid_categories = ['Politics', 'Sports', 'Business', 'Entertainment', 'Tech',
                       'Science', 'Health', 'Finance', 'Crypto', 'Food', 'Travel',
                       'Lifestyle', 'Fashion']

    updated = 0
    errors = 0
    score_changes = []
    category_fixes = []

    for i, article in enumerate(articles):
        title = article.get('title_news', '')
        bullets = article.get('summary_bullets_news', [])
        old_score = article.get('ai_final_score', 0)
        old_category = article.get('category', 'Other')
        article_id = article['id']

        if not title:
            continue

        print(f"\n[{i+1}/{len(articles)}] {title[:80]}...")
        print(f"  Old: score={old_score}, category={old_category}")

        try:
            result = score_article(title, bullets, gemini_key, references)
            new_score = result.get('score', old_score)
            new_category = result.get('category', '')
            topic_relevance = result.get('topic_relevance', {})
            country_relevance = result.get('country_relevance', {})

            update_data = {
                'ai_final_score': new_score,
                'topic_relevance': topic_relevance,
                'country_relevance': country_relevance,
            }

            # Fix category if V19 returned a valid one
            if new_category and new_category in valid_categories:
                update_data['category'] = new_category
                if old_category != new_category:
                    category_fixes.append(f"  {old_category} → {new_category}: {title[:60]}")

            supabase.table('published_articles')\
                .update(update_data)\
                .eq('id', article_id)\
                .execute()

            diff = new_score - old_score
            direction = "↑" if diff > 0 else "↓" if diff < 0 else "="
            cat_str = f" [{old_category}→{new_category}]" if new_category and old_category != new_category else ""
            print(f"  New: score={new_score} ({direction}{abs(diff)}){cat_str}")

            score_changes.append(diff)
            updated += 1

        except Exception as e:
            print(f"  ERROR: {e}")
            errors += 1

        # Rate limit: ~10 requests per minute for Gemini
        if (i + 1) % batch_size == 0:
            print(f"\n  --- Batch pause (rate limit) ---")
            time.sleep(6)

    # Summary
    print(f"\n{'='*60}")
    print(f"RE-SCORING COMPLETE")
    print(f"{'='*60}")
    print(f"Updated: {updated}/{len(articles)}")
    print(f"Errors: {errors}")

    if score_changes:
        avg_change = sum(score_changes) / len(score_changes)
        increases = sum(1 for d in score_changes if d > 0)
        decreases = sum(1 for d in score_changes if d < 0)
        unchanged = sum(1 for d in score_changes if d == 0)
        print(f"Avg score change: {avg_change:+.1f}")
        print(f"Increases: {increases}, Decreases: {decreases}, Unchanged: {unchanged}")

    if category_fixes:
        print(f"\nCategory fixes ({len(category_fixes)}):")
        for fix in category_fixes:
            print(fix)

if __name__ == '__main__':
    import sys
    hours = int(sys.argv[1]) if len(sys.argv) > 1 else 15
    rescore_recent(hours=hours)
