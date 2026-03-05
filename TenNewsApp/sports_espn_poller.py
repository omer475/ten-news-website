#!/usr/bin/env python3
"""
ALL-SPORTS ESPN POLLER — 16 Leagues
=====================================

Standalone module that polls ESPN Scoreboard + News endpoints for ALL sports leagues.
Generates articles using Gemini Flash at temperature 0 and publishes directly to
published_articles.

Leagues covered:
  Tier 1-2 (team sports): EPL, La Liga, Serie A, Bundesliga, UCL, Europa, MLS,
                           NBA, NHL, NFL, MLB
  Tier 3 (individual/special): F1, ATP Tennis, WTA Tennis, UFC, Golf PGA

Runs alongside the main pipeline (called at the end of each cycle).
"""

import os
import re
import json
import time
import requests
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# ==========================================
# CONFIGURATION — ALL 16 LEAGUES
# ==========================================

ALL_LEAGUES = {
    # ---- FOOTBALL / SOCCER ----
    'epl': {
        'sport_path': 'soccer/eng.1',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news',
        'extractor': 'soccer',
        'default_country': 'uk',
    },
    'la_liga': {
        'sport_path': 'soccer/esp.1',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/news',
        'extractor': 'soccer',
        'default_country': 'spain',
    },
    'serie_a': {
        'sport_path': 'soccer/ita.1',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/news',
        'extractor': 'soccer',
        'default_country': 'italy',
    },
    'bundesliga': {
        'sport_path': 'soccer/ger.1',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/news',
        'extractor': 'soccer',
        'default_country': 'germany',
    },
    'ucl': {
        'sport_path': 'soccer/uefa.champions',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/news',
        'extractor': 'soccer',
    },
    'europa': {
        'sport_path': 'soccer/uefa.europa',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/news',
        'extractor': 'soccer',
    },
    'mls': {
        'sport_path': 'soccer/usa.1',
        'emoji': '⚽',
        'topic': 'football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/news',
        'extractor': 'soccer',
        'default_country': 'usa',
    },
    # ---- AMERICAN SPORTS ----
    'nba': {
        'sport_path': 'basketball/nba',
        'emoji': '🏀',
        'topic': 'basketball',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news',
        'extractor': 'team_sport',
        'default_country': 'usa',
    },
    'nhl': {
        'sport_path': 'hockey/nhl',
        'emoji': '🏒',
        'topic': 'ice_hockey',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news',
        'extractor': 'team_sport',
        'default_country': 'usa',
    },
    'nfl': {
        'sport_path': 'football/nfl',
        'emoji': '🏈',
        'topic': 'american_football',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news',
        'extractor': 'team_sport',
        'default_country': 'usa',
    },
    'mlb': {
        'sport_path': 'baseball/mlb',
        'emoji': '⚾',
        'topic': 'basketball',  # No baseball topic — closest match
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news',
        'extractor': 'team_sport',
        'default_country': 'usa',
    },
    # ---- TIER 3 (INDIVIDUAL SPORTS) ----
    'f1': {
        'sport_path': 'racing/f1',
        'emoji': '🏎️',
        'topic': 'f1',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/news',
        'extractor': 'f1',
        'use_jolpica': True,
    },
    'atp': {
        'sport_path': 'tennis/atp',
        'emoji': '🎾',
        'topic': 'tennis',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/news',
        'extractor': 'tennis',
        'filter': 'finals_semis_only',
    },
    'wta': {
        'sport_path': 'tennis/wta',
        'emoji': '🎾',
        'topic': 'tennis',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/news',
        'extractor': 'tennis',
        'filter': 'finals_semis_only',
    },
    'ufc': {
        'sport_path': 'mma/ufc',
        'emoji': '🥊',
        'topic': 'combat_sports',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news',
        'extractor': 'ufc',
    },
    'pga': {
        'sport_path': 'golf/pga',
        'emoji': '⛳',
        'topic': 'golf',
        'scoreboard_url': 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard',
        'news_url': 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/news',
        'extractor': 'golf',
        'filter': 'tournament_final_only',
    },
}

# Country detection keywords
COUNTRY_MAP = {
    # F1 drivers/constructors
    'verstappen': 'uk', 'hamilton': 'uk', 'norris': 'uk', 'russell': 'uk',
    'leclerc': 'france', 'sainz': 'spain', 'alonso': 'spain',
    'piastri': 'australia', 'ricciardo': 'australia',
    'tsunoda': 'japan', 'perez': 'usa', 'stroll': 'canada',
    'red bull': 'uk', 'mercedes': 'germany', 'ferrari': 'italy',
    'mclaren': 'uk', 'aston martin': 'uk', 'alpine': 'france',
    # Tennis
    'sinner': 'italy', 'djokovic': 'uk', 'alcaraz': 'spain',
    'medvedev': 'russia', 'zverev': 'germany', 'rublev': 'russia',
    'swiatek': 'uk', 'sabalenka': 'russia', 'gauff': 'usa', 'rybakina': 'russia',
    # Golf
    'scheffler': 'usa', 'mcilroy': 'uk', 'rahm': 'spain',
    'koepka': 'usa', 'thomas': 'usa', 'spieth': 'usa',
    'matsuyama': 'japan', 'hovland': 'uk',
}

# Soccer team → country mapping
SOCCER_TEAM_COUNTRIES = {
    # EPL
    'arsenal': 'uk', 'chelsea': 'uk', 'liverpool': 'uk', 'manchester': 'uk',
    'tottenham': 'uk', 'newcastle': 'uk', 'aston villa': 'uk', 'west ham': 'uk',
    'brighton': 'uk', 'wolves': 'uk', 'everton': 'uk', 'fulham': 'uk',
    'crystal palace': 'uk', 'bournemouth': 'uk', 'nottingham': 'uk', 'brentford': 'uk',
    # La Liga
    'barcelona': 'spain', 'real madrid': 'spain', 'atletico': 'spain',
    'athletic bilbao': 'spain', 'real sociedad': 'spain', 'villarreal': 'spain',
    'sevilla': 'spain', 'betis': 'spain', 'valencia': 'spain',
    # Serie A
    'juventus': 'italy', 'inter': 'italy', 'milan': 'italy', 'napoli': 'italy',
    'roma': 'italy', 'lazio': 'italy', 'atalanta': 'italy', 'fiorentina': 'italy',
    # Bundesliga
    'bayern': 'germany', 'dortmund': 'germany', 'leverkusen': 'germany',
    'leipzig': 'germany', 'frankfurt': 'germany', 'wolfsburg': 'germany',
    'stuttgart': 'germany', 'gladbach': 'germany',
    # UCL/Europa additional
    'paris saint': 'france', 'psg': 'france', 'marseille': 'france', 'lyon': 'france',
    'porto': 'uk', 'benfica': 'uk', 'sporting': 'uk',
    'ajax': 'uk', 'psv': 'uk', 'feyenoord': 'uk',
    'celtic': 'uk', 'rangers': 'uk',
    'galatasaray': 'turkiye', 'fenerbahce': 'turkiye', 'besiktas': 'turkiye',
}

VALID_COUNTRIES = [
    'usa', 'uk', 'china', 'russia', 'germany', 'france',
    'spain', 'italy', 'ukraine', 'turkiye', 'ireland',
    'india', 'japan', 'south_korea', 'pakistan', 'singapore',
    'israel', 'canada', 'brazil',
    'nigeria', 'south_africa', 'australia'
]


# ==========================================
# SUPABASE & API CLIENTS
# ==========================================

def get_supabase_client():
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return create_client(url, key)


def get_gemini_key():
    key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not key:
        raise ValueError("GEMINI_API_KEY must be set")
    return key


# ==========================================
# TABLE CREATION (idempotent)
# ==========================================

def ensure_tracking_table(supabase):
    """Create sports_poll_tracking table if it doesn't exist."""
    try:
        supabase.table('sports_poll_tracking').select('id').limit(1).execute()
    except Exception:
        print("   ⚠️ sports_poll_tracking table may not exist. Creating via RPC...")
        try:
            supabase.rpc('exec_sql', {'query': '''
                CREATE TABLE IF NOT EXISTS sports_poll_tracking (
                    id SERIAL PRIMARY KEY,
                    espn_event_id TEXT UNIQUE NOT NULL,
                    sport TEXT NOT NULL,
                    league TEXT NOT NULL,
                    event_name TEXT,
                    processed_at TIMESTAMPTZ DEFAULT NOW(),
                    published_article_id INT
                );
                CREATE INDEX IF NOT EXISTS idx_sports_poll_espn_event
                    ON sports_poll_tracking(espn_event_id);
            '''}).execute()
            print("   ✅ Created sports_poll_tracking table")
        except Exception as e:
            print(f"   ⚠️ Could not auto-create table (create manually): {e}")


# ==========================================
# ESPN API HELPERS
# ==========================================

def fetch_espn_scoreboard(url: str) -> Optional[Dict]:
    """Fetch ESPN scoreboard data."""
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        print(f"   ⚠️ ESPN scoreboard returned {resp.status_code}")
        return None
    except Exception as e:
        print(f"   ⚠️ ESPN scoreboard error: {e}")
        return None


def fetch_espn_news_image(news_url: str) -> Optional[str]:
    """Fetch the best image from ESPN News endpoint."""
    try:
        resp = requests.get(news_url, timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        articles = data.get('articles', [])
        for article in articles:
            images = article.get('images', [])
            for img in images:
                url = img.get('url', '')
                if url and ('1296x729' in url or img.get('width', 0) >= 800):
                    return url
            if images:
                return images[0].get('url')
        return None
    except Exception as e:
        print(f"   ⚠️ ESPN news image error: {e}")
        return None


def fetch_jolpica_f1_results() -> Optional[Dict]:
    """Fetch latest F1 race results from Jolpica (Ergast replacement)."""
    try:
        year = datetime.now().year
        url = f'https://api.jolpi.ca/ergast/f1/{year}/last/results.json'
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        url = f'https://api.jolpi.ca/ergast/f1/{year - 1}/last/results.json'
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception as e:
        print(f"   ⚠️ Jolpica F1 error: {e}")
        return None


# ==========================================
# EVENT EXTRACTORS
# ==========================================

def _is_event_completed(event: Dict) -> bool:
    """Check if an ESPN event is completed."""
    status = event.get('status', {}).get('type', {}).get('name', '')
    if status in ('STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_END'):
        return True
    # Also check state
    state = event.get('status', {}).get('type', {}).get('state', '')
    if state == 'post':
        return True
    return False


def _is_competition_completed(comp: Dict) -> bool:
    """Check if an ESPN competition is completed."""
    status = comp.get('status', {}).get('type', {}).get('name', '')
    if status in ('STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_END'):
        return True
    state = comp.get('status', {}).get('type', {}).get('state', '')
    return state == 'post'


# ---- SOCCER (EPL, La Liga, Serie A, Bundesliga, UCL, Europa, MLS) ----

def extract_soccer_events(scoreboard: Dict, league_key: str) -> List[Dict]:
    """Extract completed soccer match results."""
    events = []
    espn_events = scoreboard.get('events', [])

    for event in espn_events:
        if not _is_event_completed(event):
            continue

        event_id = event.get('id', '')
        event_name = event.get('name', event.get('shortName', ''))
        event_date = event.get('date', '')

        competitions = event.get('competitions', [])
        for comp in competitions:
            competitors = comp.get('competitors', [])
            if len(competitors) != 2:
                continue

            home = None
            away = None
            for c in competitors:
                team = c.get('team', {})
                team_data = {
                    'name': team.get('displayName', team.get('shortDisplayName', 'Unknown')),
                    'abbreviation': team.get('abbreviation', ''),
                    'score': c.get('score', '0'),
                    'winner': c.get('winner', False),
                    'logo': team.get('logo', ''),
                }
                if c.get('homeAway') == 'home':
                    home = team_data
                else:
                    away = team_data

            if home and away:
                events.append({
                    'event_id': f'{league_key}_{event_id}',
                    'event_name': event_name,
                    'event_date': event_date,
                    'sport': league_key,
                    'results': {
                        'home_team': home['name'],
                        'away_team': away['name'],
                        'home_score': home['score'],
                        'away_score': away['score'],
                        'home_winner': home['winner'],
                        'away_winner': away['winner'],
                        'league': league_key.upper().replace('_', ' '),
                    },
                })

    return events


# ---- TEAM SPORTS (NBA, NHL, NFL, MLB) ----

def extract_team_sport_events(scoreboard: Dict, league_key: str) -> List[Dict]:
    """Extract completed team sport game results (NBA, NHL, NFL, MLB)."""
    events = []
    espn_events = scoreboard.get('events', [])

    for event in espn_events:
        if not _is_event_completed(event):
            continue

        event_id = event.get('id', '')
        event_name = event.get('name', event.get('shortName', ''))
        event_date = event.get('date', '')

        competitions = event.get('competitions', [])
        for comp in competitions:
            competitors = comp.get('competitors', [])
            if len(competitors) != 2:
                continue

            home = None
            away = None
            for c in competitors:
                team = c.get('team', {})
                # Get records if available
                records = c.get('records', [])
                record_str = records[0].get('summary', '') if records else ''

                team_data = {
                    'name': team.get('displayName', team.get('shortDisplayName', 'Unknown')),
                    'abbreviation': team.get('abbreviation', ''),
                    'score': c.get('score', '0'),
                    'winner': c.get('winner', False),
                    'record': record_str,
                    'logo': team.get('logo', ''),
                }
                if c.get('homeAway') == 'home':
                    home = team_data
                else:
                    away = team_data

            if home and away:
                # Extract notable details
                details_data = {
                    'home_team': home['name'],
                    'away_team': away['name'],
                    'home_score': home['score'],
                    'away_score': away['score'],
                    'home_winner': home['winner'],
                    'away_winner': away['winner'],
                    'home_record': home['record'],
                    'away_record': away['record'],
                    'league': league_key.upper(),
                }

                # Check for series/playoff info
                notes = comp.get('notes', [])
                if notes:
                    details_data['notes'] = notes[0].get('headline', '')

                # Check for leaders/top performers
                leaders = comp.get('leaders', [])
                if leaders:
                    for leader_cat in leaders[:2]:  # e.g. points, rebounds
                        cat_name = leader_cat.get('shortDisplayName', leader_cat.get('displayName', ''))
                        leader_list = leader_cat.get('leaders', [])
                        if leader_list:
                            top = leader_list[0]
                            athlete = top.get('athlete', {})
                            details_data[f'leader_{cat_name.lower()}'] = {
                                'name': athlete.get('displayName', ''),
                                'value': top.get('displayValue', ''),
                            }

                events.append({
                    'event_id': f'{league_key}_{event_id}',
                    'event_name': event_name,
                    'event_date': event_date,
                    'sport': league_key,
                    'results': details_data,
                })

    return events


# ---- F1 ----

def extract_f1_events(scoreboard: Dict) -> List[Dict]:
    """Extract completed F1 race events from ESPN scoreboard + Jolpica results."""
    events = []
    espn_events = scoreboard.get('events', [])

    for event in espn_events:
        event_id = event.get('id', '')
        event_name = event.get('name', '')
        event_date = event.get('date', '')

        # Check event-level or race-level completion
        if not _is_event_completed(event):
            competitions = event.get('competitions', [])
            has_race = False
            for comp in competitions:
                comp_type = comp.get('type', {}).get('text', '').lower()
                if 'race' in comp_type and _is_competition_completed(comp):
                    has_race = True
                    break
            if not has_race:
                continue

        events.append({
            'event_id': f'f1_{event_id}',
            'event_name': event_name,
            'event_date': event_date,
            'sport': 'f1',
            'results': None,
        })

    # Enrich with Jolpica results
    if events:
        jolpica = fetch_jolpica_f1_results()
        if jolpica:
            try:
                race_table = jolpica['MRData']['RaceTable']
                races = race_table.get('Races', [])
                if races:
                    race = races[0]
                    race_name = race.get('raceName', '')
                    results = race.get('Results', [])
                    result_data = []
                    for r in results[:10]:
                        driver = r.get('Driver', {})
                        constructor = r.get('Constructor', {})
                        result_data.append({
                            'position': r.get('position', ''),
                            'driver': f"{driver.get('givenName', '')} {driver.get('familyName', '')}",
                            'constructor': constructor.get('name', ''),
                            'time': r.get('Time', {}).get('time', ''),
                            'status': r.get('status', ''),
                            'laps': r.get('laps', ''),
                        })

                    for evt in events:
                        if (race_name.lower() in evt['event_name'].lower() or
                                evt['event_name'].lower() in race_name.lower() or
                                not evt['results']):
                            evt['results'] = {
                                'race_name': race_name,
                                'round': race.get('round', ''),
                                'circuit': race.get('Circuit', {}).get('circuitName', ''),
                                'top_results': result_data,
                            }
            except (KeyError, IndexError) as e:
                print(f"   ⚠️ Jolpica parse error: {e}")

    return [e for e in events if e.get('results')]


# ---- TENNIS (ATP, WTA) ----

def extract_tennis_events(scoreboard: Dict, league: str) -> List[Dict]:
    """Extract completed tennis finals/semis from ESPN scoreboard."""
    events = []
    espn_events = scoreboard.get('events', [])

    for event in espn_events:
        event_id = event.get('id', '')
        event_name = event.get('name', '')
        competitions = event.get('competitions', [])

        for comp in competitions:
            if not _is_competition_completed(comp):
                continue

            # Check round — only finals and semifinals
            comp_name = comp.get('type', {}).get('text', '').lower()
            notes = ' '.join(n.get('text', '') for n in comp.get('notes', [])).lower()
            round_info = f"{comp_name} {notes}"

            is_major_round = any(kw in round_info for kw in
                                  ['final', 'semifinal', 'semi-final', 'championship'])

            if not is_major_round:
                competitors = comp.get('competitors', [])
                if len(competitors) == 2:
                    for note in comp.get('notes', []):
                        if any(kw in note.get('text', '').lower() for kw in ['final', 'semi']):
                            is_major_round = True
                            break

            if not is_major_round:
                continue

            competitors = comp.get('competitors', [])
            winner = None
            loser = None
            for c in competitors:
                athlete = c.get('athlete', {})
                name = athlete.get('displayName', c.get('team', {}).get('displayName', 'Unknown'))
                if c.get('winner', False):
                    winner = name
                else:
                    loser = name

            if winner and loser:
                comp_id = comp.get('id', event_id)
                events.append({
                    'event_id': f'{league}_{comp_id}',
                    'event_name': event_name,
                    'event_date': comp.get('date', event.get('date', '')),
                    'sport': league,
                    'results': {
                        'tournament': event_name,
                        'round': round_info.strip(),
                        'winner': winner,
                        'loser': loser,
                    },
                })

    return events


# ---- UFC ----

def extract_ufc_events(scoreboard: Dict) -> List[Dict]:
    """Extract completed UFC fight card results."""
    events = []
    espn_events = scoreboard.get('events', [])

    for event in espn_events:
        event_id = event.get('id', '')
        event_name = event.get('name', '')
        event_date = event.get('date', '')
        competitions = event.get('competitions', [])

        completed_fights = []
        for comp in competitions:
            if not _is_competition_completed(comp):
                continue

            competitors = comp.get('competitors', [])
            winner = None
            loser = None
            for c in competitors:
                athlete = c.get('athlete', {})
                name = athlete.get('displayName', 'Unknown')
                record = c.get('record', '')
                flag = c.get('flag', {}).get('alt', '')
                if c.get('winner', False):
                    winner = {'name': name, 'record': record, 'country': flag}
                else:
                    loser = {'name': name, 'record': record, 'country': flag}

            if winner and loser:
                completed_fights.append({
                    'winner': winner,
                    'loser': loser,
                    'is_main_event': len(completed_fights) == 0,
                })

        if completed_fights:
            events.append({
                'event_id': f'ufc_{event_id}',
                'event_name': event_name,
                'event_date': event_date,
                'sport': 'ufc',
                'results': {
                    'event_name': event_name,
                    'fights': completed_fights,
                    'total_fights': len(completed_fights),
                },
            })

    return events


# ---- GOLF PGA ----

def extract_golf_events(scoreboard: Dict) -> List[Dict]:
    """Extract completed golf tournament results."""
    events = []
    espn_events = scoreboard.get('events', [])

    for event in espn_events:
        event_id = event.get('id', '')
        event_name = event.get('name', '')
        event_date = event.get('date', '')

        if not _is_event_completed(event):
            competitions = event.get('competitions', [])
            tournament_done = any(_is_competition_completed(c) for c in competitions)
            if not tournament_done:
                continue

        competitions = event.get('competitions', [])
        leaderboard = []
        for comp in competitions:
            competitors = comp.get('competitors', [])
            for c in competitors:
                athlete = c.get('athlete', {})
                name = athlete.get('displayName', c.get('team', {}).get('displayName', 'Unknown'))
                score = c.get('score', '')
                if not score and c.get('linescores'):
                    score = c['linescores'][0].get('displayValue', '')
                stats = c.get('statistics', [])
                for s in stats:
                    if s.get('name') == 'totalScore' or s.get('abbreviation') == 'TOT':
                        score = score or s.get('displayValue', '')
                        break
                position = c.get('order', c.get('position', ''))
                flag = c.get('flag', {}).get('alt', '')
                leaderboard.append({
                    'position': position,
                    'name': name,
                    'score': score,
                    'country': flag,
                })

        leaderboard.sort(key=lambda x: int(x['position']) if str(x.get('position', '')).isdigit() else 999)

        if leaderboard:
            events.append({
                'event_id': f'pga_{event_id}',
                'event_name': event_name,
                'event_date': event_date,
                'sport': 'pga',
                'results': {
                    'tournament': event_name,
                    'leaderboard': leaderboard[:10],
                },
            })

    return events


# ==========================================
# GEMINI ARTICLE GENERATION
# ==========================================

GEMINI_PROMPT_TEMPLATE = """You are a sports news writer. Generate a title and 3 bullet points from this match/race result data.

SPORT: {sport}
EVENT: {event_name}
RESULTS: {results_json}
DATE: {date}

Rules:
- Title: factual, under 80 characters, include winner name and event
- Bullets: 3 short factual sentences, each under 120 characters
- Include only facts present in the RESULTS data
- No speculation, no opinions, no predictions
- Use present tense for results ("wins", "defeats", "finishes", "beats")

Output JSON:
{{"title": "...", "bullets": ["...", "...", "..."]}}"""


def generate_article_with_gemini(sport: str, event_name: str, results: Dict,
                                  event_date: str, gemini_key: str) -> Optional[Dict]:
    """Generate title + 3 bullets using Gemini Flash at temperature 0."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"

    prompt = GEMINI_PROMPT_TEMPLATE.format(
        sport=sport,
        event_name=event_name,
        results_json=json.dumps(results, indent=2),
        date=event_date,
    )

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 500,
            "responseMimeType": "application/json"
        }
    }

    for attempt in range(3):
        try:
            resp = requests.post(url, json=payload, timeout=30)
            resp.raise_for_status()
            result = resp.json()
            text = result['candidates'][0]['content']['parts'][0]['text'].strip()

            if text.startswith('```'):
                text = text.split('```')[1]
                if text.startswith('json'):
                    text = text[4:]
                text = text.strip()

            parsed = json.loads(text)
            title = parsed.get('title', '')
            bullets = parsed.get('bullets', [])

            if title and bullets and len(bullets) >= 1:
                return {'title': title[:80], 'bullets': bullets[:3]}

        except Exception as e:
            print(f"      ⚠️ Gemini attempt {attempt + 1}/3 failed: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)

    return None


# ==========================================
# DETAILS COMPONENT GENERATION
# ==========================================

def build_details_component(sport: str, results: Dict) -> Optional[List[Dict]]:
    """Build a details component from structured results."""
    details = []

    if sport == 'f1':
        top = results.get('top_results', [])
        details.append({'label': 'Race', 'value': results.get('race_name', '')})
        details.append({'label': 'Circuit', 'value': results.get('circuit', '')})
        for r in top[:5]:
            pos = r.get('position', '')
            driver = r.get('driver', '')
            constructor = r.get('constructor', '')
            time_val = r.get('time', r.get('status', ''))
            details.append({
                'label': f'P{pos}',
                'value': f"{driver} ({constructor})" + (f" — {time_val}" if time_val else "")
            })

    elif sport in ('atp', 'wta'):
        details.append({'label': 'Tournament', 'value': results.get('tournament', '')})
        details.append({'label': 'Round', 'value': results.get('round', '').title()})
        details.append({'label': 'Winner', 'value': results.get('winner', '')})
        details.append({'label': 'Runner-up', 'value': results.get('loser', '')})

    elif sport == 'ufc':
        details.append({'label': 'Event', 'value': results.get('event_name', '')})
        details.append({'label': 'Fights', 'value': str(results.get('total_fights', ''))})
        for fight in results.get('fights', [])[:5]:
            w = fight.get('winner', {})
            l = fight.get('loser', {})
            label = 'Main Event' if fight.get('is_main_event') else 'Fight'
            details.append({
                'label': label,
                'value': f"{w.get('name', '')} def. {l.get('name', '')}"
            })

    elif sport == 'pga':
        details.append({'label': 'Tournament', 'value': results.get('tournament', '')})
        for p in results.get('leaderboard', [])[:5]:
            pos = p.get('position', '')
            name = p.get('name', '')
            score = p.get('score', '')
            details.append({
                'label': f'#{pos}' if pos else 'Player',
                'value': f"{name} ({score})" if score else name
            })

    elif sport in ('epl', 'la_liga', 'serie_a', 'bundesliga', 'ucl', 'europa', 'mls'):
        # Soccer scorecard
        home = results.get('home_team', '')
        away = results.get('away_team', '')
        hs = results.get('home_score', '0')
        aws = results.get('away_score', '0')
        details.append({'label': 'Home', 'value': f"{home} {hs}"})
        details.append({'label': 'Away', 'value': f"{away} {aws}"})
        details.append({'label': 'Final Score', 'value': f"{hs} - {aws}"})
        league_label = results.get('league', sport.upper())
        details.append({'label': 'Competition', 'value': league_label})

    elif sport in ('nba', 'nhl', 'nfl', 'mlb'):
        # US team sports
        home = results.get('home_team', '')
        away = results.get('away_team', '')
        hs = results.get('home_score', '0')
        aws = results.get('away_score', '0')
        details.append({'label': 'Home', 'value': f"{home} {hs}"})
        details.append({'label': 'Away', 'value': f"{away} {aws}"})
        details.append({'label': 'Final Score', 'value': f"{hs} - {aws}"})
        if results.get('home_record'):
            details.append({'label': f"{home} Record", 'value': results['home_record']})
        if results.get('away_record'):
            details.append({'label': f"{away} Record", 'value': results['away_record']})
        if results.get('notes'):
            details.append({'label': 'Note', 'value': results['notes']})
        # Top performers
        for key, val in results.items():
            if key.startswith('leader_') and isinstance(val, dict):
                cat = key.replace('leader_', '').title()
                details.append({
                    'label': f'Top {cat}',
                    'value': f"{val.get('name', '')} — {val.get('value', '')}"
                })

    return details if details else None


# ==========================================
# COUNTRY DETECTION
# ==========================================

def detect_countries(sport: str, results: Dict, event_name: str,
                     league_config: Dict) -> Tuple[List[str], Dict]:
    """Detect relevant countries from results data."""
    text = json.dumps(results).lower() + ' ' + event_name.lower()
    countries = set()

    # Default country for the league
    default = league_config.get('default_country')
    if default:
        countries.add(default)

    # Keyword-based detection
    for keyword, country in COUNTRY_MAP.items():
        if keyword in text:
            countries.add(country)

    # Soccer team → country
    for keyword, country in SOCCER_TEAM_COUNTRIES.items():
        if keyword in text:
            countries.add(country)

    # Grand Prix locations
    gp_countries = {
        'australian': 'australia', 'british': 'uk', 'italian': 'italy',
        'spanish': 'spain', 'japanese': 'japan', 'canadian': 'canada',
        'brazil': 'brazil', 'singapore': 'singapore',
        'us grand prix': 'usa', 'united states': 'usa', 'las vegas': 'usa',
        'miami': 'usa', 'monaco': 'france',
    }
    for keyword, country in gp_countries.items():
        if keyword in text:
            countries.add(country)

    # Tennis tournament locations
    tennis_locations = {
        'australian open': 'australia', 'french open': 'france',
        'roland garros': 'france', 'wimbledon': 'uk',
        'us open': 'usa', 'indian wells': 'usa', 'miami open': 'usa',
        'rome': 'italy', 'madrid': 'spain', 'barcelona': 'spain',
    }
    for keyword, country in tennis_locations.items():
        if keyword in text:
            countries.add(country)

    valid = [c for c in countries if c in VALID_COUNTRIES][:3]
    relevance = {c: 80 for c in valid}
    return valid, relevance


# ==========================================
# DEDUPLICATION
# ==========================================

def _clean_title(t: str) -> str:
    if not t:
        return ''
    t = re.sub(r'\*\*([^*]+)\*\*', r'\1', t)
    t = re.sub(r'[^\w\s]', '', t.lower())
    return t.strip()


def is_event_already_processed(supabase, event_id: str) -> bool:
    """Check if event was already processed in tracking table."""
    try:
        result = supabase.table('sports_poll_tracking').select('id').eq('espn_event_id', event_id).execute()
        return len(result.data) > 0
    except Exception:
        return False


def is_title_duplicate(supabase, title: str) -> bool:
    """Check against recent published_articles for title similarity (>=65%)."""
    try:
        cutoff = (datetime.now() - timedelta(hours=48)).isoformat()
        result = supabase.table('published_articles').select('title_news').gte('published_at', cutoff).execute()

        clean_new = _clean_title(title)
        for article in result.data:
            existing_title = article.get('title_news', '')
            clean_existing = _clean_title(existing_title)
            similarity = SequenceMatcher(None, clean_new, clean_existing).ratio()
            if similarity >= 0.65:
                return True
        return False
    except Exception as e:
        print(f"      ⚠️ Title dedup check error: {e}")
        return False


# ==========================================
# PUBLISHING
# ==========================================

def publish_sports_article(supabase, league_config: Dict, event: Dict,
                            generated: Dict, image_url: Optional[str],
                            countries: List[str], country_relevance: Dict) -> Optional[int]:
    """Publish a sports article to published_articles table."""
    sport = event['sport']
    results = event['results']
    details = build_details_component(sport, results)

    # Generate embedding for feed personalization (pgvector similarity search)
    article_embedding = None
    try:
        from step1_5_event_clustering import get_embedding
        embed_text = f"{generated['title']} Sports {league_config['topic']} {' '.join(countries)}"
        article_embedding = get_embedding(embed_text)
        if article_embedding:
            print(f"      🧬 Embedding generated ({len(article_embedding)} dims)")
    except Exception as e:
        print(f"      ⚠️ Embedding generation failed: {e}")

    article_data = {
        'url': f"https://www.espn.com/{league_config['sport_path']}",
        'source': 'ESPN',
        'category': 'Sports',
        'title_news': generated['title'],
        'summary_bullets_news': generated['bullets'],
        'emoji': league_config['emoji'],
        'details': details,
        'components_order': ['details'] if details else [],
        'image_url': image_url,
        'image_source': 'ESPN',
        'published_at': datetime.now().isoformat(),
        'ai_final_score': 800,
        'countries': countries,
        'topics': [league_config['topic']],
        'topic_relevance': {league_config['topic']: 100},
        'country_relevance': country_relevance,
        'num_sources': 1,
        'embedding': article_embedding,
    }

    try:
        result = supabase.table('published_articles').insert(article_data).execute()
        if result.data:
            return result.data[0]['id']
    except Exception as e:
        print(f"      ❌ Publish error: {e}")

    return None


def track_processed_event(supabase, event: Dict, published_id: Optional[int]):
    """Record processed event in tracking table."""
    try:
        supabase.table('sports_poll_tracking').insert({
            'espn_event_id': event['event_id'],
            'sport': event['sport'],
            'league': event['sport'],
            'event_name': event['event_name'],
            'published_article_id': published_id,
        }).execute()
    except Exception as e:
        print(f"      ⚠️ Tracking insert error: {e}")


# ==========================================
# MAIN POLLER LOGIC
# ==========================================

def poll_league(supabase, league_key: str, league_config: Dict, gemini_key: str) -> int:
    """Poll a single league and publish any new completed events. Returns count published."""
    print(f"\n   🏟️ Polling {league_key.upper()}...")

    # 1. Fetch scoreboard
    scoreboard = fetch_espn_scoreboard(league_config['scoreboard_url'])
    if not scoreboard:
        print(f"      ⏭️ No scoreboard data for {league_key}")
        return 0

    # 2. Extract completed events based on extractor type
    extractor = league_config.get('extractor', '')
    if extractor == 'soccer':
        events = extract_soccer_events(scoreboard, league_key)
    elif extractor == 'team_sport':
        events = extract_team_sport_events(scoreboard, league_key)
    elif extractor == 'f1':
        events = extract_f1_events(scoreboard)
    elif extractor == 'tennis':
        events = extract_tennis_events(scoreboard, league_key)
    elif extractor == 'ufc':
        events = extract_ufc_events(scoreboard)
    elif extractor == 'golf':
        events = extract_golf_events(scoreboard)
    else:
        events = []

    if not events:
        print(f"      ⏭️ No completed events for {league_key}")
        return 0

    print(f"      📋 Found {len(events)} completed event(s)")

    # 3. Fetch news image (shared across events in same league)
    image_url = fetch_espn_news_image(league_config['news_url'])

    published = 0
    for event in events:
        event_name = event['event_name']
        event_id = event['event_id']

        # 4. Dedup: check tracking table
        if is_event_already_processed(supabase, event_id):
            print(f"      ⏭️ Already processed: {event_name[:60]}")
            continue

        # 5. Generate article with Gemini
        print(f"      ✍️ Generating article for: {event_name[:60]}...")
        generated = generate_article_with_gemini(
            sport=league_key,
            event_name=event_name,
            results=event['results'],
            event_date=event.get('event_date', ''),
            gemini_key=gemini_key,
        )

        if not generated:
            print(f"      ❌ Gemini generation failed for {event_name[:60]}")
            track_processed_event(supabase, event, None)
            continue

        # 6. Title dedup against published_articles
        if is_title_duplicate(supabase, generated['title']):
            print(f"      ⏭️ Title duplicate: {generated['title'][:60]}")
            track_processed_event(supabase, event, None)
            continue

        # 7. Detect countries
        countries, country_relevance = detect_countries(
            league_key, event['results'], event_name, league_config
        )

        # 8. Publish
        article_id = publish_sports_article(
            supabase, league_config, event, generated, image_url,
            countries, country_relevance
        )

        if article_id:
            print(f"      ✅ Published article #{article_id}: {generated['title'][:60]}")
            published += 1

        # 9. Track
        track_processed_event(supabase, event, article_id)

        # Rate limit between articles
        time.sleep(1)

    return published


def run_sports_poller() -> Dict:
    """Run the all-sports poller across all 16 leagues.

    Returns dict with stats: {'total_published': int, 'per_league': {league: count}}
    """
    print(f"\n{'='*60}")
    print(f"🏟️ ALL-SPORTS ESPN POLLER (16 LEAGUES)")
    print(f"{'='*60}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Leagues: {', '.join(ALL_LEAGUES.keys())}")

    stats = {'total_published': 0, 'per_league': {}}

    try:
        supabase = get_supabase_client()
        gemini_key = get_gemini_key()
    except ValueError as e:
        print(f"   ❌ Configuration error: {e}")
        return stats

    # Ensure tracking table exists
    ensure_tracking_table(supabase)

    for league_key, league_config in ALL_LEAGUES.items():
        try:
            count = poll_league(supabase, league_key, league_config, gemini_key)
            stats['per_league'][league_key] = count
            stats['total_published'] += count
        except Exception as e:
            print(f"   ❌ Error polling {league_key}: {e}")
            stats['per_league'][league_key] = 0

        # Rate limit between leagues
        time.sleep(1)

    print(f"\n{'='*60}")
    print(f"🏟️ SPORTS POLLER COMPLETE — Published {stats['total_published']} articles")
    for league, count in stats['per_league'].items():
        if count > 0:
            print(f"   • {league.upper()}: {count} article(s)")
    print(f"{'='*60}")

    return stats


# ==========================================
# STANDALONE ENTRY POINT
# ==========================================

if __name__ == '__main__':
    stats = run_sports_poller()
    print(f"\nDone. Total published: {stats['total_published']}")
