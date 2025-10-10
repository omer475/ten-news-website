"""
TEN NEWS LIVE - CONFIGURATION
Central configuration for all components
"""

import os

# ============================================================
# DATABASE
# ============================================================
DATABASE_PATH = 'news.db'

# ============================================================
# RSS FETCHER
# ============================================================
RSS_FETCH_INTERVAL_MINUTES = 10  # Fetch every 10 minutes
RSS_MAX_WORKERS = 30  # Parallel threads for fetching

# ============================================================
# AI FILTER
# ============================================================
AI_FILTER_INTERVAL_MINUTES = 5  # Filter every 5 minutes
AI_FILTER_BATCH_SIZE = 100  # Articles per batch
AI_MODEL = "claude-sonnet-4-20250514"  # Claude Sonnet 4

# Category thresholds (minimum AI score to publish)
CATEGORY_THRESHOLDS = {
    'breaking': 55,
    'science': 45,
    'technology': 45,
    'data': 45,
    'environment': 45,
    'business': 50,
    'politics': 50,
    'health': 50,
    'international': 50,
}

# ============================================================
# API SERVER
# ============================================================
API_HOST = '0.0.0.0'
API_PORT = 5000
API_DEBUG = False

# ============================================================
# CLEANUP
# ============================================================
CLEANUP_DAYS = 7  # Remove unpublished articles after X days
CLEANUP_INTERVAL_HOURS = 24  # Run cleanup every 24 hours

# ============================================================
# LOGGING
# ============================================================
LOG_LEVEL = 'INFO'
LOG_FILE = 'tennews.log'

# ============================================================
# API KEYS
# ============================================================
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# ============================================================
# FEATURE FLAGS
# ============================================================
ENABLE_RSS_FETCHER = True
ENABLE_AI_FILTER = True
ENABLE_API_SERVER = True
ENABLE_AUTO_CLEANUP = True

