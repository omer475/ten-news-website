"""
Content Generator v3 — Human-quality articles that feel like the best tweets/Reddit posts.
No emojis in titles. No ALL CAPS. No clickbait. Just genuinely interesting content.

Usage:
  python3 services/generate_deep_dives.py --all --count 10
  python3 services/generate_deep_dives.py --publisher atlas --count 5
"""

import os, sys, json, time, random, hashlib, argparse, urllib.request, urllib.parse, ssl
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

try:
    from supabase import create_client
except ImportError:
    sys.exit("pip install supabase python-dotenv")
try:
    import google.generativeai as genai
except ImportError:
    sys.exit("pip install google-generativeai")

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
GEMINI_KEY = os.getenv('GEMINI_API_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

# ============================================================
# PUBLISHER DEFINITIONS
# ============================================================

PUBLISHERS = {
    "atlas": {
        "beat": "History, civilizations, the past",
        "voice": "A sharp observer of history who finds the human stories inside big events.",
        "topics": [
            "empires, ancient civilizations, historical turning points",
            "wars that started for absurd reasons, cities that vanished",
            "historical figures — the real story behind the myth",
            "archaeological discoveries, ancient engineering, lost technology",
        ],
    },
    "thebackstory": {
        "beat": "Origins of companies, brands, products, inventions",
        "voice": "Obsessed with how things started. Finds the weird, accidental, unlikely origin story.",
        "topics": [
            "companies that almost failed, products invented by accident",
            "the real story behind famous brand names, logos, slogans",
            "founders who got fired, pivots that saved everything",
            "everyday things with bizarre origin stories",
        ],
    },
    "howitworks": {
        "beat": "Tech and science — the fascinating details behind things",
        "voice": "Notices the insane engineering behind everyday things. Makes you see the world differently.",
        "topics": [
            "the engineering inside your phone, car, fridge, airplane",
            "how massive systems work — internet, GPS, power grid, shipping",
            "numbers that put technology in perspective",
            "the infrastructure nobody thinks about that keeps everything running",
        ],
    },
    "thekitchen": {
        "beat": "Food — restaurants, ingredients, dishes, food culture",
        "voice": "Knows food deeply. Specific about prices, places, ingredients. Not a food blogger — a food obsessive.",
        "topics": [
            "restaurants with insane waiting lists or prices, legendary dishes",
            "street food taking over cities, food trends spreading globally",
            "ingredients that cost absurd amounts, food industry secrets",
            "food culture differences between countries, dishes with wild backstories",
        ],
    },
    "greatestgames": {
        "beat": "Sports — stats, records, moments, athletes",
        "voice": "Lives and breathes sports. Always names the player, the team, the exact stat. Makes you feel like you were there.",
        "topics": [
            "head-to-head stat comparisons between GOATs",
            "records that still stand, performances that defied logic",
            "transfers, spending, the money side of sports",
            "moments that changed seasons, careers, entire sports",
        ],
    },
    "trailnotes": {
        "beat": "Travel — places, airports, hotels, countries, geography",
        "voice": "Has been everywhere. Specific about costs, details, what makes a place special. Not a guidebook — an insider.",
        "topics": [
            "airports, hotels, trains with features that seem unreal",
            "countries compared on cost, food, safety, quality of life",
            "places most people don't know about that are extraordinary",
            "the economics and logistics of travel — what things actually cost",
        ],
    },
    "theprimer": {
        "beat": "Finance and money — translated into real consequences",
        "voice": "Cuts through financial jargon. Always translates into what it means for a normal person. Specific with numbers.",
        "topics": [
            "what economic events actually mean for your wallet",
            "investment returns over time — the numbers that matter",
            "cost of living compared across cities and countries",
            "how money works — the stuff nobody explains clearly",
        ],
    },
    "underthehood": {
        "beat": "How tech companies and products really work behind the scenes",
        "voice": "An insider who knows what's actually happening. Specific data. No PR spin.",
        "topics": [
            "what tech companies actually spend their money on",
            "the real numbers behind apps, platforms, services you use daily",
            "how tech products are made — the supply chain, the factories, the scale",
            "data, infrastructure, the boring stuff that actually matters",
        ],
    },
    "fieldguide": {
        "beat": "The world — geography, nature, countries, cultures, laws",
        "voice": "Collects the most fascinating facts about the world. Every fact is real, specific, and makes you want to tell someone.",
        "topics": [
            "bizarre laws that actually exist in real countries",
            "natural phenomena, extremes, records — the wildest things on earth",
            "country facts that change how you see the world",
            "cultural differences that seem unbelievable but are real",
        ],
    },
    "builtfromzero": {
        "beat": "Startups, business stories, company trajectories",
        "voice": "Studies how businesses really get built. Not motivational — specific. The numbers, the decisions, the lucky breaks.",
        "topics": [
            "startups that were weeks from dying before making it",
            "business decisions that looked insane but worked",
            "the real numbers behind famous companies — revenue, losses, growth",
            "acquisitions, deals, bets that shaped entire industries",
        ],
    },
    "thecraft": {
        "beat": "Skills, hobbies, making things, niche worlds",
        "voice": "Fascinated by the world of making and doing. Knows the specific costs, tools, and details that make each craft real.",
        "topics": [
            "handmade things that cost absurd amounts and why",
            "world records in niche skills — speed, precision, endurance",
            "the economics of hobbies — what things actually cost",
            "subcultures and communities built around specific skills",
        ],
    },
    "pantrynotes": {
        "beat": "Ingredients, food science, the details of what we eat",
        "voice": "Knows ingredients at a molecular level but talks about them like a friend. Specific about quality, price, origin.",
        "topics": [
            "why some ingredients cost 100x more than others",
            "food production at scale — the numbers are staggering",
            "the difference between cheap and expensive versions of the same thing",
            "single ingredients with fascinating stories behind them",
        ],
    },
    "thedynasty": {
        "beat": "Sports history — teams, eras, dynasties, legacies",
        "voice": "Argues about sports history with stats and passion. Always names the team, the era, the specific record.",
        "topics": [
            "dynasty teams compared across eras and sports",
            "coaches and managers who built something from nothing",
            "the most dominant single seasons in any sport",
            "rivalries that defined entire decades",
        ],
    },
    "mindandbody": {
        "beat": "Health, body, brain — the real science, not wellness nonsense",
        "voice": "Reads the actual studies. Translates science into specific, useful facts. Skeptical of trends, respects data.",
        "topics": [
            "what the science actually says about sleep, exercise, diet",
            "body facts that are genuinely surprising — real numbers",
            "health differences between countries and why",
            "the one thing that the data consistently supports",
        ],
    },
    "thesignal": {
        "beat": "AI and tech industry — the real picture, not the hype",
        "voice": "Follows the money, not the press releases. Notices what everyone else misses. Specific with revenue, losses, valuations.",
        "topics": [
            "what AI companies are actually making vs spending",
            "tech trends that are quietly dying or quietly winning",
            "the real numbers behind the biggest tech companies",
            "what's actually changing vs what's just marketing",
        ],
    },
}

# ============================================================
# GENERATION
# ============================================================

PEXELS_KEY = 'GiTjnds1JkExdKDlcjGDEYU9gOJwVVEVg4iu6ibsHGTjibaEWjY2F4s4'

def fetch_image(query):
    """Fetch relevant image from Pexels. Query should be 2-3 words max."""
    import requests as req_lib
    try:
        # Clean the query — max 3 words, no special chars
        words = query.replace('**', '').replace('"', '').split()[:3]
        clean_query = ' '.join(words)

        r = req_lib.get('https://api.pexels.com/v1/search',
            params={'query': clean_query, 'per_page': 1, 'orientation': 'landscape'},
            headers={'Authorization': PEXELS_KEY},
            timeout=10)

        if r.status_code == 200:
            photos = r.json().get('photos', [])
            if photos:
                return photos[0]['src']['large2x']
    except: pass

    # Fallback
    seed = int(hashlib.md5(query.encode()).hexdigest()[:8], 16) % 1000
    return f"https://picsum.photos/seed/{seed}/1200/800"


def generate_article(pub_username, pub_name, existing_titles):
    pub = PUBLISHERS[pub_username]
    topic_area = random.choice(pub["topics"])
    existing_str = "\n".join(f"  - {t}" for t in existing_titles[-20:]) if existing_titles else "  (none)"

    prompt = f"""You are {pub_name}, a content creator covering: {pub['beat']}.
Your voice: {pub['voice']}

Generate ONE article about: {topic_area}

Already published (don't repeat):
{existing_str}

═══════════════════════════════════════════════
TITLE RULES (STRICT):
═══════════════════════════════════════════════
- 6 to 14 words MAX
- NO emojis anywhere in the title
- NO question marks
- NO "Here's why", "Everything you need to know", "X things that..."
- NO passive voice — active, present tense
- NO ALL CAPS words
- Use **bold** for 1-2 key terms only
- The title should read like the best tweet you've ever seen
- Specific > vague. Name the person, team, company, number.

Good titles:
  "**Ronaldo**: 899 Goals. **Messi**: 838. Every Stat Compared."
  "The **Costco** Hot Dog Has Been $1.50 Since 1985. Here's Why."
  "**OpenAI** Lost $5 Billion Last Year. Revenue Was Only $3.4 Billion."
  "**Liverpool** Were 3-0 Down at Half Time. Then This Happened."
  "**Japan** Has 5.5 Million Vending Machines. You Can Buy a Suit."

Bad titles (NEVER write these):
  "🤯 Is This the BEST Thing Ever?!"
  "Here's Why You Should Care About X"
  "Everything You Need to Know About Y"
  "The Ultimate Guide to Z"
  "X Things That Will Blow Your Mind"

═══════════════════════════════════════════════
BODY RULES:
═══════════════════════════════════════════════
- Short sentences. Present tense where possible.
- No academic language. No "furthermore" or "it is important to note."
- Every bullet should be a specific fact, number, or observation.
- End on something that makes the reader feel something or think something — not just a summary.
- Write like the best tweets, not like a textbook.

TOPIC-SPECIFIC:
- Sports: ALWAYS name the player, team, exact stat. Never vague.
- Finance: ALWAYS translate jargon into consequence for a normal person.
- K-pop/Music: Assume reader knows the group names.
- AI/Tech: Assume reader is curious but not technical.
- Food: Name the restaurant, city, price. Be specific.
- Travel: Name the place, the cost, what makes it extraordinary.

PAGES (optional):
- If the topic genuinely benefits from multiple pages, use 2-3 pages.
- Most articles should be single page (pages: null).
- Only use multi-page for rich comparisons, breakdowns, or stories with real depth.

═══════════════════════════════════════════════
OUTPUT (JSON only):
═══════════════════════════════════════════════
{{
  "title": "6-14 word title with **1-2 bold** terms. No emojis. No questions.",
  "category": "Tech|Business|Science|Sports|Health|Food|Travel|Lifestyle|Entertainment|Finance",
  "emoji": "single emoji for the card icon only (not in title)",
  "summary_bullets": [
    "Specific fact or observation with a real number (50-120 chars)",
    "Another angle — something surprising or consequential (50-120 chars)",
    "Third point that makes you think or feel something (50-120 chars)"
  ],
  "interest_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "image_search_query": "2-3 specific words for finding a relevant photo",
  "quality_score": 600-720,
  "pages": null,
  "components": {{}}
}}

BEFORE SUBMITTING — check:
1. Is the title 6-14 words? Count them.
2. Are there any emojis in the title? Remove them.
3. Are there any question marks in the title? Rewrite it.
4. Does every bullet contain a specific number, name, or fact?
5. Would you stop scrolling to read this? If not, start over.
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith('```'): text = text.split('\n', 1)[1] if '\n' in text else text[3:]
        if text.endswith('```'): text = text[:-3]
        if text.startswith('json'): text = text[4:]
        article = json.loads(text.strip())

        # Post-generation cleanup
        title = article.get('title', '')
        # Remove emojis from title
        title = ''.join(c for c in title if ord(c) < 0x1F600 or ord(c) > 0x1FAFF)
        # Remove ? from title
        title = title.replace('?', '.').replace('!', '.').rstrip('.')
        article['title'] = title.strip()

        return article
    except Exception as e:
        print(f"    Generation failed: {e}")
        return None


def publish_article(publisher_id, publisher_name, article_data):
    image_url = fetch_image(article_data.get('image_search_query', article_data['title']))
    cluster_id = random.randint(900000, 999999)

    try:
        supabase.table('clusters').insert({
            'id': cluster_id,
            'main_title': article_data['title'][:200],
            'publish_status': 'published',
        }).execute()
    except: pass

    record = {
        'title_news': article_data['title'],
        'summary_bullets_news': article_data['summary_bullets'],
        'category': article_data.get('category', 'Lifestyle'),
        'emoji': article_data.get('emoji', '📰'),
        'image_url': image_url,
        'image_source': 'Wikimedia Commons',
        'interest_tags': article_data.get('interest_tags', []),
        'shelf_life_days': 30,
        'freshness_category': 'timeless',
        'ai_final_score': article_data.get('quality_score', 680),
        'published_at': datetime.now().isoformat(),
        'author_id': publisher_id,
        'author_name': publisher_name,
        'cluster_id': cluster_id,
        'source': publisher_name,
        'url': f'https://tennews.ai/p/{hashlib.md5(article_data["title"].encode()).hexdigest()[:8]}',
        'num_sources': 1,
        'pages': article_data.get('pages'),
    }

    try:
        result = supabase.table('published_articles').insert(record).execute()
        return result.data[0]['id'] if result.data else None
    except Exception as e:
        print(f"    Publish failed: {e}")
        return None


def get_existing_titles(publisher_id):
    try:
        result = supabase.table('published_articles').select('title_news').eq('author_id', publisher_id).order('created_at', desc=True).limit(50).execute()
        return [r['title_news'] for r in (result.data or [])]
    except: return []


def run(target_publisher=None, count_per_publisher=10):
    result = supabase.table('publishers').select('id, display_name, username, category').eq('is_bot', True).execute()
    all_publishers = result.data or []
    valid = set(PUBLISHERS.keys())
    publishers = [p for p in all_publishers if p['username'] in valid]
    if target_publisher:
        publishers = [p for p in publishers if p['username'] == target_publisher]

    print(f"Content Generator v3")
    print(f"Publishers: {len(publishers)} | Per publisher: {count_per_publisher}\n")

    total_gen = total_fail = 0
    for pub in publishers:
        existing = get_existing_titles(pub['id'])
        print(f"📝 {pub['display_name']} (@{pub['username']}) — {len(existing)} existing")

        generated = attempts = 0
        while generated < count_per_publisher and attempts < count_per_publisher * 3:
            attempts += 1
            article = generate_article(pub['username'], pub['display_name'], existing)
            if not article:
                total_fail += 1; continue

            title = article.get('title', '')
            bullets = article.get('summary_bullets', [])

            # Quality gates
            if len(title.split()) > 16:
                total_fail += 1; continue
            if len(bullets) < 3:
                total_fail += 1; continue
            if title in existing:
                total_fail += 1; continue
            if '?' in title or '!' in title:
                total_fail += 1; continue

            article_id = publish_article(pub['id'], pub['display_name'], article)
            if article_id:
                print(f"   ✅ {title[:65]}")
                existing.append(title)
                generated += 1; total_gen += 1
            else:
                total_fail += 1
            time.sleep(2)
        print()

    print(f"{'='*60}\nDone. Generated: {total_gen}, Failed: {total_fail}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publisher', type=str)
    parser.add_argument('--count', type=int, default=10)
    parser.add_argument('--all', action='store_true')
    args = parser.parse_args()
    run(target_publisher=args.publisher, count_per_publisher=args.count)
