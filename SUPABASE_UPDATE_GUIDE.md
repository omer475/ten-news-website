# 🔧 SUPABASE DATABASE UPDATE REQUIRED

## Problem
The new live news system generates articles with additional fields that don't exist in your Supabase database:
- `summary_bullets` (JSON array of bullet points)
- `graph` (JSON object with chart data)
- `map` (JSON object with map coordinates)

## Solution

### Step 1: Update Supabase Database Schema

1. **Go to your Supabase dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to SQL Editor**
4. **Run this migration script**:

```sql
-- Add new columns for the enhanced live news system
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS summary_bullets JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS graph JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS map JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_summary_bullets ON articles USING GIN (summary_bullets);
CREATE INDEX IF NOT EXISTS idx_articles_graph ON articles USING GIN (graph);
CREATE INDEX IF NOT EXISTS idx_articles_map ON articles USING GIN (map);

-- Update existing articles to have empty JSON for new fields
UPDATE articles 
SET 
    summary_bullets = '[]'::jsonb,
    graph = '{}'::jsonb,
    map = '{}'::jsonb,  
WHERE 
    summary_bullets IS NULL 
    OR graph IS NULL 
    OR map IS NULL;
```

### Step 2: Update Your .env File

Add your actual API keys to `.env`:

```bash
# Edit your .env file
nano .env

# Replace these with your actual values:
SCRAPINGBEE_API_KEY=your_actual_scrapingbee_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_actual_service_key
```

### Step 3: Test the Connection

```bash
# Test Supabase with new format
python3 test_supabase_new_format.py
```

### Step 4: Restart Live System

```bash
# Stop current system (Ctrl+C)
# Then restart:
./RUN_LIVE_CONTINUOUS_SYSTEM.sh
```

## What's Fixed

✅ **New Fields Added**:
- `summary_bullets`: Stores bullet points as JSON array
- `graph`: Stores chart data (type, data points, labels)
- `map`: Stores map data (coordinates, markers, zoom)

✅ **Backward Compatibility**: 
- Old articles will have empty JSON for new fields
- New articles will populate all fields

✅ **Performance**: 
- Added GIN indexes for fast JSON queries

## Expected Result

After these changes, your live system will:
- ✅ Process exactly 5-14 new articles per cycle
- ✅ Generate rich content (timeline, details, graph, map)
- ✅ Successfully publish to Supabase
- ✅ Display properly on your website

## New Article Format

```json
{
  "title": "European Central Bank raises interest rates to 4.5 percent",
  "summary": {
    "paragraph": "The ECB increased rates to 4.5%...",
    "bullets": [
      "ECB raises rates to 4.5%, tenth consecutive increase",
      "Current inflation at 5.3%, above 2% target",
      "Affects 340 million people across eurozone"
    ]
  },
  "timeline": [
    {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle..."}
  ],
  "details": [
    {"label": "Previous rate", "value": "4.25%"}
  ],
  "graph": {
    "type": "line",
    "data": [{"date": "2020-03", "value": 0.25}]
  },
  "map": {
    "center": {"lat": 50.1109, "lon": 8.6821},
    "markers": [{"lat": 50.1109, "lon": 8.6821, "label": "Frankfurt"}]
  }
}
```

This format provides much richer content for your users! 🚀
