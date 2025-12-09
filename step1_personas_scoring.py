"""
Step 1: Personas-Based News Scoring System
==========================================
Replaces the rule-based scoring with 242 AI-simulated personas across 10 interest groups.
Each persona scores articles based on their profile, interests, and preferences.

Persona Distribution (242 total):
- Technology: 55 personas
- Business: 48 personas
- Finance: 28 personas
- Lifestyle: 24 personas
- Entertainment: 22 personas
- Health: 18 personas
- Science: 17 personas
- Politics: 15 personas
- Sports: 12 personas
- World Affairs: 3 personas

Scoring: 0-100 scale, approval threshold: 60
"""

import requests
import json
import time
import re
from typing import List, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# Top 25 countries by population for persona distribution
TOP_25_COUNTRIES = [
    ("China", ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu"]),
    ("India", ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"]),
    ("United States", ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]),
    ("Indonesia", ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang"]),
    ("Pakistan", ["Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Multan"]),
    ("Nigeria", ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt"]),
    ("Brazil", ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza"]),
    ("Bangladesh", ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet"]),
    ("Russia", ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan"]),
    ("Mexico", ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana"]),
    ("Japan", ["Tokyo", "Osaka", "Nagoya", "Yokohama", "Sapporo"]),
    ("Ethiopia", ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Hawassa"]),
    ("Philippines", ["Manila", "Quezon City", "Davao", "Cebu", "Zamboanga"]),
    ("Egypt", ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said"]),
    ("Vietnam", ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho"]),
    ("DR Congo", ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani"]),
    ("Turkey", ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"]),
    ("Iran", ["Tehran", "Mashhad", "Isfahan", "Karaj", "Shiraz"]),
    ("Germany", ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt"]),
    ("Thailand", ["Bangkok", "Chiang Mai", "Pattaya", "Nonthaburi", "Nakhon Ratchasima"]),
    ("United Kingdom", ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool"]),
    ("France", ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"]),
    ("Italy", ["Rome", "Milan", "Naples", "Turin", "Palermo"]),
    ("South Africa", ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"]),
    ("Tanzania", ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya"])
]

# Occupations by interest area for realistic persona generation
OCCUPATIONS_BY_INTEREST = {
    "Technology": [
        "Software Engineer", "Data Scientist", "Product Manager", "UX Designer", 
        "IT Consultant", "Cybersecurity Analyst", "DevOps Engineer", "AI Researcher",
        "Mobile Developer", "Cloud Architect", "Tech Startup Founder", "System Administrator",
        "Frontend Developer", "Backend Developer", "Full Stack Developer", "QA Engineer"
    ],
    "Business": [
        "Marketing Manager", "Business Analyst", "Entrepreneur", "Management Consultant",
        "Operations Manager", "Sales Director", "HR Manager", "Supply Chain Manager",
        "Project Manager", "Business Development Manager", "CEO", "COO",
        "Strategy Consultant", "Brand Manager", "Account Executive", "Retail Manager"
    ],
    "Finance": [
        "Investment Banker", "Financial Analyst", "Portfolio Manager", "Accountant",
        "Risk Analyst", "Hedge Fund Manager", "CFO", "Tax Consultant",
        "Wealth Manager", "Actuary", "Credit Analyst", "Compliance Officer",
        "Equity Research Analyst", "Trader", "Financial Planner", "Auditor"
    ],
    "Lifestyle": [
        "Interior Designer", "Fashion Designer", "Food Blogger", "Travel Writer",
        "Wellness Coach", "Personal Stylist", "Event Planner", "Lifestyle Influencer",
        "Chef", "Yoga Instructor", "Real Estate Agent", "Home Organizer",
        "Wedding Planner", "Personal Trainer", "Beauty Consultant", "Life Coach"
    ],
    "Entertainment": [
        "Film Critic", "Music Producer", "Actor", "Comedian",
        "Video Game Designer", "Content Creator", "Podcast Host", "DJ",
        "Screenwriter", "Talent Agent", "Film Director", "Music Journalist",
        "TV Producer", "Entertainment Lawyer", "Theater Director", "Animator"
    ],
    "Health": [
        "Doctor", "Nurse", "Pharmacist", "Physical Therapist",
        "Nutritionist", "Mental Health Counselor", "Medical Researcher", "Dentist",
        "Public Health Official", "Healthcare Administrator", "Surgeon", "Pediatrician",
        "Epidemiologist", "Health Tech Specialist", "Clinical Psychologist", "Dermatologist"
    ],
    "Science": [
        "Research Scientist", "Professor", "Lab Technician", "Environmental Scientist",
        "Physicist", "Biologist", "Chemist", "Astronomer",
        "Marine Biologist", "Geneticist", "Science Journalist", "Patent Analyst",
        "Climate Scientist", "Neuroscientist", "Geologist", "Mathematician"
    ],
    "Politics": [
        "Political Analyst", "Journalist", "Campaign Manager", "Policy Advisor",
        "Government Official", "Diplomat", "Lobbyist", "Think Tank Researcher",
        "Political Science Professor", "NGO Director", "Civil Rights Lawyer", "Activist",
        "Public Affairs Consultant", "Political Correspondent", "Pollster", "Legislative Aide"
    ],
    "Sports": [
        "Sports Journalist", "Coach", "Professional Athlete", "Sports Agent",
        "Sports Analyst", "Fitness Trainer", "Sports Photographer", "Team Manager",
        "Sports Broadcaster", "Athletic Director", "Sports Nutritionist", "Referee",
        "Sports Medicine Doctor", "Scout", "Sports Marketing Manager", "Esports Manager"
    ],
    "World Affairs": [
        "Foreign Correspondent", "International Relations Professor", "UN Official",
        "Diplomat", "Human Rights Lawyer", "International Development Worker",
        "Global Policy Analyst", "International Trade Specialist", "Peace Negotiator",
        "Humanitarian Aid Worker", "Embassy Official", "Global Risk Consultant"
    ]
}

# News behaviors and preferences
NEWS_BEHAVIORS = [
    "Morning reader, checks news with coffee",
    "Evening browser, prefers in-depth analysis",
    "Throughout the day, quick headline scanner",
    "Weekend deep diver, reads long-form articles",
    "Mobile-first, reads during commute",
    "Social media news consumer",
    "Newsletter subscriber, curated content",
    "Podcast listener, audio news preference",
    "Breaking news follower, real-time updates",
    "Weekend warrior, catches up on Sundays"
]

# What personas care about and skip by interest
CARES_ABOUT = {
    "Technology": ["Innovation", "Product launches", "AI developments", "Startup news", "Tech policy", "Cybersecurity", "Digital transformation"],
    "Business": ["Market trends", "Company earnings", "Leadership changes", "Mergers & acquisitions", "Industry disruption", "Workplace culture"],
    "Finance": ["Stock markets", "Economic indicators", "Interest rates", "Cryptocurrency", "Investment opportunities", "Regulatory changes"],
    "Lifestyle": ["Trends", "Home improvement", "Fashion", "Travel destinations", "Food culture", "Wellness tips", "Sustainable living"],
    "Entertainment": ["Celebrity news", "New releases", "Award shows", "Streaming content", "Gaming", "Pop culture", "Music industry"],
    "Health": ["Medical breakthroughs", "Public health", "Mental wellness", "Fitness", "Nutrition research", "Healthcare policy", "Disease prevention"],
    "Science": ["Research discoveries", "Space exploration", "Climate science", "Technology breakthroughs", "Academic findings", "Scientific debates"],
    "Politics": ["Policy changes", "Elections", "Government decisions", "Political analysis", "Legislation", "Political movements", "Democracy issues"],
    "Sports": ["Game results", "Player transfers", "Team news", "Sports analytics", "Major events", "Athlete stories", "League updates"],
    "World Affairs": ["International relations", "Global conflicts", "Diplomacy", "Human rights", "Trade agreements", "Humanitarian issues", "Geopolitics"]
}

SKIPS = {
    "Technology": ["Celebrity gossip", "Sports scores", "Fashion trends", "Reality TV"],
    "Business": ["Entertainment gossip", "Sports news", "Lifestyle fluff", "Gaming news"],
    "Finance": ["Celebrity news", "Entertainment", "Lifestyle content", "Sports highlights"],
    "Lifestyle": ["Technical jargon", "Political debates", "Financial reports", "Sports statistics"],
    "Entertainment": ["Financial reports", "Political analysis", "Technical documentation", "Academic research"],
    "Health": ["Entertainment gossip", "Sports scores", "Tech product reviews", "Fashion news"],
    "Science": ["Celebrity gossip", "Entertainment news", "Sports", "Fashion trends"],
    "Politics": ["Entertainment fluff", "Celebrity gossip", "Lifestyle content", "Gaming news"],
    "Sports": ["Political debates", "Financial analysis", "Tech reviews", "Fashion content"],
    "World Affairs": ["Celebrity gossip", "Entertainment", "Lifestyle fluff", "Sports scores"]
}

def _generate_personas() -> Dict[str, List[Dict]]:
    """Generate 242 personas distributed across 10 interest groups."""
    import random
    random.seed(42)  # For reproducibility
    
    # Distribution per group
    group_counts = {
        "Technology": 55,
        "Business": 48,
        "Finance": 28,
        "Lifestyle": 24,
        "Entertainment": 22,
        "Health": 18,
        "Science": 17,
        "Politics": 15,
        "Sports": 12,
        "World Affairs": 3
    }
    
    # Secondary interests mapping
    secondary_interests = {
        "Technology": ["Business", "Science", "Finance", "Entertainment"],
        "Business": ["Technology", "Finance", "Politics", "World Affairs"],
        "Finance": ["Business", "Technology", "Politics", "World Affairs"],
        "Lifestyle": ["Entertainment", "Health", "Business", "Technology"],
        "Entertainment": ["Lifestyle", "Technology", "Sports", "Business"],
        "Health": ["Science", "Lifestyle", "Technology", "Sports"],
        "Science": ["Technology", "Health", "World Affairs", "Politics"],
        "Politics": ["World Affairs", "Business", "Finance", "Science"],
        "Sports": ["Entertainment", "Health", "Business", "Lifestyle"],
        "World Affairs": ["Politics", "Business", "Finance", "Science"]
    }
    
    personas_by_group = {}
    persona_id = 1
    
    for interest, count in group_counts.items():
        personas = []
        occupations = OCCUPATIONS_BY_INTEREST[interest]
        
        for i in range(count):
            # Distribute across countries
            country_idx = i % len(TOP_25_COUNTRIES)
            country, cities = TOP_25_COUNTRIES[country_idx]
            city = cities[i % len(cities)]
            
            # Age distribution: 18-65, weighted toward 25-45
            age_weights = [18, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 55, 60, 65]
            age = random.choice(age_weights)
            
            # Gender distribution
            gender = "Female" if i % 3 == 0 else ("Non-binary" if i % 7 == 0 else "Male")
            
            # Occupation
            occupation = occupations[i % len(occupations)]
            
            # Secondary interest
            sec_interest = random.choice(secondary_interests[interest])
            
            # News behavior
            behavior = NEWS_BEHAVIORS[i % len(NEWS_BEHAVIORS)]
            
            # Cares about (2-3 items)
            cares = random.sample(CARES_ABOUT[interest], min(3, len(CARES_ABOUT[interest])))
            
            # Skips (1-2 items)
            skips = random.sample(SKIPS[interest], min(2, len(SKIPS[interest])))
            
            persona = {
                "id": f"P{persona_id:03d}",
                "country": country,
                "city": city,
                "age": age,
                "gender": gender,
                "occupation": occupation,
                "primary_interest": interest,
                "secondary_interest": sec_interest,
                "news_behavior": behavior,
                "cares_about": cares,
                "skips": skips
            }
            
            personas.append(persona)
            persona_id += 1
        
        personas_by_group[interest] = personas
    
    return personas_by_group

# Generate and store all personas
PERSONAS_DATA = _generate_personas()

# Interest groups with their persona counts for reference
INTEREST_GROUPS = {
    "Technology": 55,
    "Business": 48,
    "Finance": 28,
    "Lifestyle": 24,
    "Entertainment": 22,
    "Health": 18,
    "Science": 17,
    "Politics": 15,
    "Sports": 12,
    "World Affairs": 3
}

# Valid categories for article classification
VALID_CATEGORIES = [
    "Technology", "Business", "Finance", "Lifestyle", "Entertainment",
    "Health", "Science", "Politics", "Sports", "World Affairs"
]

# Approval threshold
APPROVAL_THRESHOLD = 60


def _fix_truncated_json(json_text: str) -> List[Dict]:
    """
    Fix truncated JSON arrays by finding complete objects.
    Reused from original implementation for robust JSON parsing.
    """
    if not json_text or not json_text.strip():
        return []
    
    text = json_text.strip()
    
    # Try parsing as-is first
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        elif isinstance(result, dict):
            return [result]
        return []
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON array from response
    array_match = re.search(r'\[\s*\{', text)
    if array_match:
        text = text[array_match.start():]
    
    # Find all complete JSON objects
    objects = []
    depth = 0
    obj_start = None
    in_string = False
    escape_next = False
    
    for i, char in enumerate(text):
        if escape_next:
            escape_next = False
            continue
            
        if char == '\\':
            escape_next = True
            continue
            
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
            
        if in_string:
            continue
            
        if char == '{':
            if depth == 0:
                obj_start = i
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0 and obj_start is not None:
                try:
                    obj_text = text[obj_start:i+1]
                    obj = json.loads(obj_text)
                    objects.append(obj)
                except json.JSONDecodeError:
                    pass
                obj_start = None
    
    return objects


def _score_with_interest_group(articles: List[Dict], group_name: str, 
                                personas: List[Dict], api_key: str,
                                max_retries: int = 3) -> Dict[str, Dict]:
    """
    Score articles using one interest group's personas.
    
    Args:
        articles: List of article dicts with title, description, etc.
        group_name: Name of the interest group (e.g., "Technology")
        personas: List of persona dicts for this group
        api_key: Gemini API key
        max_retries: Number of retry attempts
    
    Returns:
        Dict mapping article titles to scoring results
    """
    if not articles or not personas:
        return {}
    
    # Build persona descriptions for the prompt
    persona_descriptions = []
    for p in personas:
        desc = (f"- {p['id']}: {p['age']}yo {p['gender']} {p['occupation']} from {p['city']}, {p['country']}. "
                f"Cares about: {', '.join(p['cares_about'])}. Skips: {', '.join(p['skips'])}. "
                f"Also interested in {p['secondary_interest']}.")
        persona_descriptions.append(desc)
    
    personas_text = "\n".join(persona_descriptions)
    
    # Build articles section
    articles_text = ""
    for i, article in enumerate(articles, 1):
        title = article.get('title', 'No title')
        description = article.get('description', 'No description')
        source = article.get('source', 'Unknown')
        articles_text += f"\n{i}. Title: {title}\n   Description: {description}\n   Source: {source}\n"
    
    prompt = f"""You are simulating {len(personas)} diverse news readers who are primarily interested in {group_name}.

PERSONAS:
{personas_text}

ARTICLES TO SCORE:
{articles_text}

For each article, simulate how these {len(personas)} personas would rate it on a scale of 0-100:
- 90-100: Must read immediately, highly relevant to my interests
- 70-89: Interesting, would definitely click and read
- 50-69: Might skim, somewhat relevant
- 30-49: Not really my thing, might scroll past
- 0-29: Would skip entirely, not interested

Consider each persona's interests, what they care about, and what they typically skip.
Calculate the average score across all {len(personas)} personas.

Return ONLY a valid JSON array with this exact format (no markdown, no explanation):
[
  {{"title": "exact article title", "avg_score": 75, "high_scorer": "P001", "low_scorer": "P050", "engagement_reason": "brief reason"}}
]

Important:
- Use the EXACT article titles from the input
- avg_score must be an integer 0-100
- high_scorer and low_scorer should be persona IDs who gave highest/lowest scores
- engagement_reason should explain why this group found it interesting (or not)
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4096
        }
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'candidates' in data and data['candidates']:
                    text = data['candidates'][0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    
                    # Clean response
                    text = text.strip()
                    if text.startswith('```json'):
                        text = text[7:]
                    if text.startswith('```'):
                        text = text[3:]
                    if text.endswith('```'):
                        text = text[:-3]
                    text = text.strip()
                    
                    results = _fix_truncated_json(text)
                    
                    # Convert to dict keyed by title
                    scores_by_title = {}
                    for result in results:
                        title = result.get('title', '')
                        if title:
                            scores_by_title[title] = {
                                'group': group_name,
                                'avg_score': result.get('avg_score', 50),
                                'high_scorer': result.get('high_scorer', ''),
                                'low_scorer': result.get('low_scorer', ''),
                                'engagement_reason': result.get('engagement_reason', '')
                            }
                    
                    return scores_by_title
            
            elif response.status_code == 429:
                wait_time = (2 ** attempt) * 2
                print(f"    Rate limited on {group_name}, waiting {wait_time}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"    API error for {group_name}: {response.status_code}")
                
        except Exception as e:
            print(f"    Exception scoring with {group_name}: {e}")
            time.sleep(1)
    
    # Return default scores on failure
    return {article.get('title', ''): {
        'group': group_name,
        'avg_score': 50,
        'high_scorer': '',
        'low_scorer': '',
        'engagement_reason': 'API call failed'
    } for article in articles}


def _aggregate_scores(group_results: Dict[str, Dict[str, Dict]], 
                      articles: List[Dict]) -> Dict[str, Dict]:
    """
    Combine scores from all groups into final scores with cross-appeal bonus.
    
    Args:
        group_results: Dict mapping group names to their scoring results
        articles: Original article list
    
    Returns:
        Dict mapping article titles to aggregated scoring data
    """
    # Total personas per group for weighting
    total_personas = sum(INTEREST_GROUPS.values())  # 242
    
    aggregated = {}
    
    for article in articles:
        title = article.get('title', '')
        if not title:
            continue
        
        weighted_sum = 0
        total_weight = 0
        group_scores = {}
        high_scoring_groups = []
        
        for group_name, group_count in INTEREST_GROUPS.items():
            if group_name in group_results:
                group_data = group_results[group_name]
                if title in group_data:
                    score = group_data[title].get('avg_score', 50)
                    group_scores[group_name] = score
                    
                    # Weighted by group size
                    weight = group_count / total_personas
                    weighted_sum += score * weight
                    total_weight += weight
                    
                    # Track high-scoring groups for cross-appeal bonus
                    if score >= 70:
                        high_scoring_groups.append(group_name)
        
        # Calculate base weighted average
        if total_weight > 0:
            base_score = weighted_sum / total_weight
        else:
            base_score = 50
        
        # Cross-appeal bonus: articles scoring well across multiple groups get a boost
        cross_appeal_bonus = 0
        if len(high_scoring_groups) >= 3:
            cross_appeal_bonus = min(10, len(high_scoring_groups) * 2)
        elif len(high_scoring_groups) == 2:
            cross_appeal_bonus = 3
        
        final_score = min(100, base_score + cross_appeal_bonus)
        
        # Find best and worst performing groups
        best_group = max(group_scores.items(), key=lambda x: x[1])[0] if group_scores else None
        worst_group = min(group_scores.items(), key=lambda x: x[1])[0] if group_scores else None
        
        aggregated[title] = {
            'final_score': round(final_score, 1),
            'base_score': round(base_score, 1),
            'cross_appeal_bonus': cross_appeal_bonus,
            'high_scoring_groups': high_scoring_groups,
            'best_group': best_group,
            'worst_group': worst_group,
            'group_scores': group_scores
        }
    
    return aggregated


def _assign_categories(articles: List[Dict], api_key: str, 
                       max_retries: int = 3) -> Dict[str, str]:
    """
    Explicitly assign category to each article via Gemini.
    
    Args:
        articles: List of article dicts
        api_key: Gemini API key
        max_retries: Number of retry attempts
    
    Returns:
        Dict mapping article titles to categories
    """
    if not articles:
        return {}
    
    # Build articles list for prompt
    articles_text = ""
    for i, article in enumerate(articles, 1):
        title = article.get('title', 'No title')
        description = article.get('description', 'No description')
        articles_text += f"\n{i}. Title: {title}\n   Description: {description}\n"
    
    categories_list = ", ".join(VALID_CATEGORIES)
    
    prompt = f"""Classify each article into exactly ONE of these categories:
{categories_list}

ARTICLES:
{articles_text}

Return ONLY a valid JSON array with this exact format (no markdown, no explanation):
[
  {{"title": "exact article title", "category": "Technology"}}
]

Rules:
- Use the EXACT article titles from the input
- category must be EXACTLY one of the valid categories listed above
- Choose the single most appropriate category for each article
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={api_key}"
    
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048
        }
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'candidates' in data and data['candidates']:
                    text = data['candidates'][0].get('content', {}).get('parts', [{}])[0].get('text', '')
                    
                    # Clean response
                    text = text.strip()
                    if text.startswith('```json'):
                        text = text[7:]
                    if text.startswith('```'):
                        text = text[3:]
                    if text.endswith('```'):
                        text = text[:-3]
                    text = text.strip()
                    
                    results = _fix_truncated_json(text)
                    
                    # Convert to dict keyed by title
                    categories_by_title = {}
                    for result in results:
                        title = result.get('title', '')
                        category = result.get('category', 'World Affairs')
                        
                        # Validate category
                        if category not in VALID_CATEGORIES:
                            category = 'World Affairs'
                        
                        if title:
                            categories_by_title[title] = category
                    
                    return categories_by_title
            
            elif response.status_code == 429:
                wait_time = (2 ** attempt) * 2
                print(f"    Rate limited on category assignment, waiting {wait_time}s...")
                time.sleep(wait_time)
                continue
            else:
                print(f"    API error for categories: {response.status_code}")
                
        except Exception as e:
            print(f"    Exception assigning categories: {e}")
            time.sleep(1)
    
    # Return default category on failure
    return {article.get('title', ''): 'World Affairs' for article in articles}


def _score_batch_with_personas(articles: List[Dict], api_key: str) -> Tuple[List[Dict], List[Dict]]:
    """
    Score a batch of articles using all 10 persona groups in parallel.
    
    Args:
        articles: List of article dicts
        api_key: Gemini API key
    
    Returns:
        Tuple of (approved_articles, filtered_articles)
    """
    if not articles:
        return [], []
    
    print(f"  Scoring {len(articles)} articles with 10 persona groups in parallel...")
    
    # Submit scoring tasks for all 10 groups in parallel
    group_results = {}
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_group = {}
        
        for group_name, personas in PERSONAS_DATA.items():
            future = executor.submit(
                _score_with_interest_group,
                articles, group_name, personas, api_key
            )
            future_to_group[future] = group_name
        
        # Collect results as they complete
        for future in as_completed(future_to_group):
            group_name = future_to_group[future]
            try:
                result = future.result()
                group_results[group_name] = result
                print(f"    ✓ {group_name} group completed")
            except Exception as e:
                print(f"    ✗ {group_name} group failed: {e}")
                group_results[group_name] = {}
    
    # Aggregate scores from all groups
    aggregated_scores = _aggregate_scores(group_results, articles)
    
    # Assign categories via separate API call
    print("  Assigning categories...")
    categories = _assign_categories(articles, api_key)
    
    # Separate approved and filtered articles
    approved = []
    filtered = []
    
    for article in articles:
        title = article.get('title', '')
        
        if title in aggregated_scores:
            score_data = aggregated_scores[title]
            final_score = score_data['final_score']
            
            # Add scoring metadata to article
            article['score'] = int(final_score)
            article['score_details'] = {
                'base_score': score_data['base_score'],
                'cross_appeal_bonus': score_data['cross_appeal_bonus'],
                'high_scoring_groups': score_data['high_scoring_groups'],
                'best_group': score_data['best_group'],
                'worst_group': score_data['worst_group']
            }
            
            # Add category
            article['category'] = categories.get(title, 'World Affairs')
            
            # Apply threshold
            if final_score >= APPROVAL_THRESHOLD:
                article['approval_status'] = 'approved'
                approved.append(article)
            else:
                article['approval_status'] = 'filtered'
                article['filter_reason'] = f'Score {final_score} below threshold {APPROVAL_THRESHOLD}'
                filtered.append(article)
        else:
            # No score data - filter by default
            article['score'] = 0
            article['approval_status'] = 'filtered'
            article['filter_reason'] = 'No scoring data available'
            article['category'] = 'World Affairs'
            filtered.append(article)
    
    return approved, filtered


def score_news_articles_step1(articles: List[Dict], api_key: str, 
                               batch_size: int = 30, 
                               max_retries: int = 3) -> Dict[str, List[Dict]]:
    """
    Main entry point for Step 1 personas-based scoring.
    Maintains the same interface as the original function.
    
    Args:
        articles: List of article dicts from RSS feeds
        api_key: Gemini API key
        batch_size: Number of articles per batch
        max_retries: Number of retry attempts per API call
    
    Returns:
        Dict with 'approved' and 'filtered' article lists
    """
    print(f"\n{'='*60}")
    print("STEP 1: PERSONAS-BASED NEWS SCORING")
    print(f"{'='*60}")
    print(f"Total articles received: {len(articles)}")
    print(f"Using {sum(INTEREST_GROUPS.values())} personas across {len(INTEREST_GROUPS)} interest groups")
    print(f"Approval threshold: {APPROVAL_THRESHOLD}/100")
    
    if not articles:
        return {'approved': [], 'filtered': []}
    
    # FILTER OUT ARTICLES WITHOUT IMAGES (preserved from original)
    articles_with_images = []
    articles_without_images = []
    
    for article in articles:
        image_url = article.get('image_url')
        if image_url and image_url.strip():
            articles_with_images.append(article)
        else:
            article['score'] = 0
            article['approval_status'] = 'filtered'
            article['filter_reason'] = 'No image URL'
            article['category'] = 'Unknown'
            articles_without_images.append(article)
    
    print(f"Articles with images: {len(articles_with_images)}")
    print(f"Articles without images (auto-filtered): {len(articles_without_images)}")
    
    if not articles_with_images:
        return {'approved': [], 'filtered': articles_without_images}
    
    # Process in batches
    all_approved = []
    all_filtered = list(articles_without_images)  # Start with no-image articles
    
    num_batches = (len(articles_with_images) + batch_size - 1) // batch_size
    
    for batch_num in range(num_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(articles_with_images))
        batch = articles_with_images[start_idx:end_idx]
        
        print(f"\n--- Processing Batch {batch_num + 1}/{num_batches} ({len(batch)} articles) ---")
        
        approved, filtered = _score_batch_with_personas(batch, api_key)
        
        all_approved.extend(approved)
        all_filtered.extend(filtered)
        
        print(f"  Batch results: {len(approved)} approved, {len(filtered)} filtered")
        
        # Rate limiting between batches
        if batch_num < num_batches - 1:
            print("  Waiting between batches...")
            time.sleep(2)
    
    # Sort approved by score (highest first)
    all_approved.sort(key=lambda x: x.get('score', 0), reverse=True)
    
    print(f"\n{'='*60}")
    print("STEP 1 COMPLETE")
    print(f"{'='*60}")
    print(f"Total approved: {len(all_approved)}")
    print(f"Total filtered: {len(all_filtered)}")
    
    if all_approved:
        scores = [a.get('score', 0) for a in all_approved]
        print(f"Score range: {min(scores)} - {max(scores)}")
        print(f"Average score: {sum(scores)/len(scores):.1f}")
    
    return {
        'approved': all_approved,
        'filtered': all_filtered
    }


# For testing purposes
if __name__ == "__main__":
    print("Personas-Based Scoring System")
    print(f"Total personas: {sum(len(p) for p in PERSONAS_DATA.values())}")
    print("\nPersona distribution by interest group:")
    for group, personas in PERSONAS_DATA.items():
        print(f"  {group}: {len(personas)} personas")
    
    print("\nSample personas:")
    for group in ["Technology", "Business", "Lifestyle"]:
        print(f"\n{group}:")
        for persona in PERSONAS_DATA[group][:2]:
            print(f"  {persona['id']}: {persona['age']}yo {persona['occupation']} from {persona['city']}, {persona['country']}")
