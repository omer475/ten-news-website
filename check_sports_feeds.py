#!/usr/bin/env python3
"""Check all sports RSS feeds for: working, recency, frequency, photos"""

import feedparser
import requests
import re
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import warnings
warnings.filterwarnings('ignore')

FEEDS = {
    # === CURRENT FEEDS (38) ===
    "BBC Sport": "https://feeds.bbci.co.uk/sport/rss.xml",
    "ESPN": "https://www.espn.com/espn/rss/news",
    "Sky Sports": "https://www.skysports.com/rss/11095",
    "Reuters Sports": "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
    "CBS Sports": "https://www.cbssports.com/rss/headlines/",
    "The Athletic": "https://theathletic.com/rss/",
    "Sporting News": "https://www.sportingnews.com/us/rss",
    "Goal.com": "https://www.goal.com/en-us/feeds/news",
    "ESPN Soccer": "https://www.espn.com/espn/rss/soccer/news",
    "Sky Sports Football": "https://www.skysports.com/rss/12040",
    "The Guardian Football": "https://www.theguardian.com/football/rss",
    "BBC Football": "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "FourFourTwo": "https://www.fourfourtwo.com/news/feed",
    "Marca La Liga": "https://www.marca.com/rss/futbol/primera-division.xml",
    "L'Equipe Football": "https://www.lequipe.fr/rss/actu_rss_Football.xml",
    "ESPN NFL": "https://www.espn.com/espn/rss/nfl/news",
    "NFL.com News": "https://www.nfl.com/feeds/rss/news",
    "Sky Sports NFL": "https://www.skysports.com/rss/12118",
    "ESPN NBA": "https://www.espn.com/espn/rss/nba/news",
    "NBA.com News": "https://www.nba.com/news/rss.xml",
    "Sky Sports NBA": "https://www.skysports.com/rss/12124",
    "ESPN Cricinfo": "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
    "Sky Sports Cricket": "https://www.skysports.com/rss/12173",
    "BBC Cricket": "https://feeds.bbci.co.uk/sport/cricket/rss.xml",
    "Sky Sports Tennis": "https://www.skysports.com/rss/12309",
    "BBC Tennis": "https://feeds.bbci.co.uk/sport/tennis/rss.xml",
    "Autosport": "https://www.autosport.com/rss/feed/all",
    "Sky Sports F1": "https://www.skysports.com/rss/12433",
    "BBC Motorsport": "https://feeds.bbci.co.uk/sport/motorsport/rss.xml",
    "ESPN MLB": "https://www.espn.com/espn/rss/mlb/news",
    "MLB Trade Rumors": "https://www.mlbtraderumors.com/feed",
    "ESPN NHL": "https://www.espn.com/espn/rss/nhl/news",
    "NHL.com News": "https://www.nhl.com/news/rss",
    "BBC Rugby Union": "https://feeds.bbci.co.uk/sport/rugby-union/rss.xml",
    "Sky Sports Rugby": "https://www.skysports.com/rss/12511",
    "Sky Sports Golf": "https://www.skysports.com/rss/12176",
    "BBC Boxing": "https://feeds.bbci.co.uk/sport/boxing/rss.xml",
    "MMA Fighting": "https://www.mmafighting.com/rss/current",

    # === NEW FEEDS TO ADD (35+) ===
    "Sportsnet": "https://www.sportsnet.ca/feed/",
    "Sportsnet NHL": "https://www.sportsnet.ca/hockey/nhl/feed/",
    "TSN": "https://www.tsn.ca/datafiles/rss/Stories.xml",
    "CBC Sports": "https://www.cbc.ca/cmlink/rss-sports",
    "Sportsnet CFL": "https://www.sportsnet.ca/football/cfl/feed/",
    "Daily Sabah Sports": "https://www.dailysabah.com/sports/rss",
    "Hurriyet Daily News Sports": "https://www.hurriyetdailynews.com/rss/sports",
    "ESPN College Football": "https://www.espn.com/espn/rss/ncf/news",
    "ESPN College Basketball": "https://www.espn.com/espn/rss/ncb/news",
    "NBC Sports NFL": "https://nbcsports.com/nfl.atom",
    "Yahoo Sports NFL": "https://sports.yahoo.com/nfl/rss",
    "Yahoo Sports NBA": "https://sports.yahoo.com/nba/rss",
    "ESPN Racing": "https://www.espn.com/espn/rss/rpm/news",
    "Motorsport.com NASCAR": "https://www.motorsport.com/rss/nascar-cup/news/",
    "Motorsport.com IndyCar": "https://www.motorsport.com/rss/indycar/news/",
    "ESPN MMA": "https://www.espn.com/espn/rss/mma/news",
    "MMA Junkie": "https://mmajunkie.usatoday.com/feed",
    "ESPN Tennis": "https://www.espn.com/espn/rss/tennis/news",
    "Tennis World USA": "https://www.tennisworldusa.org/rss/",
    "GolfWRX": "https://www.golfwrx.com/feed/",
    "Golf Digest": "https://www.golfdigest.com/feed/rss",
    "Kicker Bundesliga": "https://newsfeed.kicker.de/news/bundesliga",
    "DW Sports": "https://rss.dw.com/rdf/rss-en-sports",
    "Gazzetta dello Sport": "https://www.gazzetta.it/dynamic-feed/rss/section/last24h.xml",
    "Football Italia": "https://www.football-italia.net/feed",
    "AS English": "https://en.as.com/rss/en/home.xml",
    "TalkSport": "https://talksport.com/feed/",
    "L'Equipe General": "https://www.lequipe.fr/rss/actu_rss.xml",
    "Motorsport.com F1": "https://www.motorsport.com/rss/f1/news/",
    "PlanetF1": "https://www.planetf1.com/feed/",
    "The Race": "https://the-race.com/feed/",
    "CyclingNews": "https://www.cyclingnews.com/rss/",
    "Deadspin": "https://deadspin.com/rss",
    "Sportsnet UFC": "https://www.sportsnet.ca/mma/ufc/feed/",
    "Sportsnet Soccer": "https://www.sportsnet.ca/soccer/feed/",
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
}

def has_image(entry, raw_text=""):
    """Check if an RSS entry has an image"""
    # Check media content
    if hasattr(entry, 'media_content') and entry.media_content:
        return True
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        return True
    # Check enclosures
    if hasattr(entry, 'enclosures') and entry.enclosures:
        for enc in entry.enclosures:
            if 'image' in enc.get('type', ''):
                return True
            if any(ext in enc.get('href', '') for ext in ['.jpg', '.png', '.jpeg', '.webp']):
                return True
    # Check content for img tags
    content = ""
    if hasattr(entry, 'content') and entry.content:
        content = entry.content[0].get('value', '')
    if hasattr(entry, 'summary'):
        content += entry.get('summary', '')
    if hasattr(entry, 'description'):
        content += str(entry.get('description', ''))
    if '<img' in content or 'image' in content.lower():
        return True
    # Check in raw text for media tags
    if raw_text and ('<media:' in raw_text or '<enclosure' in raw_text or '<image>' in raw_text):
        return True
    return False

def parse_date(entry):
    """Try to parse date from entry"""
    for field in ['published_parsed', 'updated_parsed']:
        parsed = entry.get(field)
        if parsed:
            try:
                return datetime(*parsed[:6], tzinfo=timezone.utc)
            except:
                pass
    for field in ['published', 'updated', 'dc_date']:
        date_str = entry.get(field, '')
        if date_str:
            try:
                import email.utils
                tt = email.utils.parsedate_to_datetime(date_str)
                return tt.replace(tzinfo=timezone.utc) if tt.tzinfo is None else tt
            except:
                pass
    return None

def check_feed(name, url):
    """Check a single RSS feed"""
    result = {
        'name': name,
        'url': url,
        'status': 'DEAD',
        'articles': 0,
        'latest_date': None,
        'hours_ago': None,
        'has_photos': False,
        'photo_pct': 0,
        'posts_per_day': 0,
        'error': None,
    }

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code != 200:
            result['error'] = f"HTTP {resp.status_code}"
            return result

        raw = resp.text
        feed = feedparser.parse(raw)

        if not feed.entries:
            result['error'] = "No entries"
            return result

        entries = feed.entries[:30]  # Check up to 30 entries
        result['articles'] = len(feed.entries)

        # Check dates
        dates = []
        for e in entries:
            d = parse_date(e)
            if d:
                dates.append(d)

        now = datetime.now(timezone.utc)

        if dates:
            latest = max(dates)
            result['latest_date'] = latest
            result['hours_ago'] = (now - latest).total_seconds() / 3600

            if len(dates) >= 2:
                oldest = min(dates)
                span_days = max((latest - oldest).total_seconds() / 86400, 0.1)
                result['posts_per_day'] = round(len(dates) / span_days, 1)

        # Check photos
        photos = 0
        for e in entries[:15]:
            if has_image(e, raw):
                photos += 1

        result['photo_pct'] = round(photos / min(len(entries), 15) * 100)
        result['has_photos'] = photos > 0
        result['status'] = 'OK'

    except requests.exceptions.Timeout:
        result['error'] = "Timeout"
    except requests.exceptions.ConnectionError:
        result['error'] = "Connection failed"
    except Exception as e:
        result['error'] = str(e)[:60]

    return result

def main():
    now = datetime.now(timezone.utc)
    print(f"Checking {len(FEEDS)} RSS feeds at {now.strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 120)

    results = []
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(check_feed, name, url): name for name, url in FEEDS.items()}
        for f in as_completed(futures):
            r = f.result()
            results.append(r)
            status = "OK" if r['status'] == 'OK' else "FAIL"
            hrs = f"{r['hours_ago']:.0f}h ago" if r['hours_ago'] is not None else "no date"
            print(f"  [{status}] {r['name']:<30} {hrs:<12} {r['photo_pct']}% photos  {r.get('error','')}")

    # Sort by category
    current_names = set(list(FEEDS.keys())[:38])
    current = [r for r in results if r['name'] in current_names]
    new = [r for r in results if r['name'] not in current_names]

    for label, group in [("CURRENT FEEDS", current), ("NEW FEEDS TO ADD", new)]:
        print(f"\n{'='*120}")
        print(f" {label}")
        print(f"{'='*120}")

        # Sort: working first, then by recency
        working = sorted([r for r in group if r['status'] == 'OK'],
                        key=lambda x: x['hours_ago'] if x['hours_ago'] is not None else 9999)
        dead = [r for r in group if r['status'] != 'OK']

        print(f"\n{'Name':<30} {'Status':<8} {'Last Post':<14} {'Posts/Day':<10} {'Photos':<10} {'Items':<6}")
        print("-" * 90)

        for r in working + dead:
            status = "OK" if r['status'] == 'OK' else "DEAD"

            if r['hours_ago'] is not None:
                if r['hours_ago'] < 1:
                    recency = "< 1h ago"
                elif r['hours_ago'] < 24:
                    recency = f"{r['hours_ago']:.0f}h ago"
                elif r['hours_ago'] < 48:
                    recency = "yesterday"
                else:
                    recency = f"{r['hours_ago']/24:.0f} days ago"
            else:
                recency = "unknown"

            ppd = f"{r['posts_per_day']}/day" if r['posts_per_day'] else "-"
            photos = f"{r['photo_pct']}%" if r['status'] == 'OK' else "-"
            items = str(r['articles']) if r['articles'] else "-"
            err = f"  ({r['error']})" if r['error'] else ""

            print(f"{r['name']:<30} {status:<8} {recency:<14} {ppd:<10} {photos:<10} {items:<6}{err}")

    # Summary
    all_working = [r for r in results if r['status'] == 'OK']
    all_dead = [r for r in results if r['status'] != 'OK']
    recent = [r for r in all_working if r['hours_ago'] is not None and r['hours_ago'] < 24]
    with_photos = [r for r in all_working if r['photo_pct'] >= 50]

    print(f"\n{'='*120}")
    print(f" SUMMARY")
    print(f"{'='*120}")
    print(f"  Total feeds checked: {len(results)}")
    print(f"  Working:   {len(all_working)}")
    print(f"  Dead:      {len(all_dead)}")
    print(f"  Posted in last 24h:  {len(recent)}")
    print(f"  Has photos (>=50%):  {len(with_photos)}")

    # Recommendation
    print(f"\n{'='*120}")
    print(f" RECOMMENDED FEEDS (working + posted <24h + has photos)")
    print(f"{'='*120}")
    recommended = [r for r in results if r['status'] == 'OK' and r['hours_ago'] is not None and r['hours_ago'] < 48 and r['photo_pct'] >= 30]
    recommended.sort(key=lambda x: (-r['posts_per_day'], x['hours_ago']))
    for r in recommended:
        marker = "NEW" if r['name'] not in current_names else "CURRENT"
        print(f"  [{marker:<7}] {r['name']:<30} {r['hours_ago']:.0f}h ago | {r['posts_per_day']}/day | {r['photo_pct']}% photos")

    print(f"\n{'='*120}")
    print(f" NOT RECOMMENDED (dead / stale / no photos)")
    print(f"{'='*120}")
    not_rec = [r for r in results if r not in recommended]
    for r in sorted(not_rec, key=lambda x: x['name']):
        reason = []
        if r['status'] != 'OK':
            reason.append(f"DEAD: {r['error']}")
        elif r['hours_ago'] is not None and r['hours_ago'] >= 48:
            reason.append(f"STALE ({r['hours_ago']/24:.0f} days)")
        elif r['photo_pct'] < 30:
            reason.append(f"NO PHOTOS ({r['photo_pct']}%)")
        else:
            reason.append("no date info")
        marker = "NEW" if r['name'] not in current_names else "CURRENT"
        print(f"  [{marker:<7}] {r['name']:<30} {', '.join(reason)}")

if __name__ == '__main__':
    main()
