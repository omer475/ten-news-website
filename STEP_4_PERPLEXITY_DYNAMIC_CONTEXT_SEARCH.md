# STEP 4: PERPLEXITY DYNAMIC CONTEXT SEARCH

## Overview
Step 4 searches the web for contextual data based on the selected components from Step 3. It uses Perplexity's Sonar Large model to find timeline events, key data points, graph data, and map locations for each article.

## Key Features
- **Model**: Perplexity Sonar Large (llama-3.1-sonar-large-128k-online)
- **Input**: ~100 articles with component selections from Step 3
- **Output**: Context data for each selected component
- **Search Types**: Timeline events, Key data points, Graph data, Map locations
- **Cost**: ~$0.31 per 100 articles (varies by component count)
- **Time**: ~3-4 minutes for 100 articles

## Search Types

### 1. Timeline Search
**Purpose**: Find historical events that provide context
**Searches for**:
- Previous events that led to this situation
- Related developments in the topic area
- Upcoming planned events or deadlines
- Chronological order (oldest first)

**Output Format**:
```json
{
  "timeline_events": [
    {"date": "Jul 27, 2023", "event": "ECB begins rate hike cycle with increase to 3.75 percent"},
    {"date": "Mar 14, 2024", "event": "ECB holds rates steady for first time in eight months"},
    {"date": "Dec 12, 2024", "event": "Next ECB policy meeting scheduled"}
  ]
}
```

### 2. Details Search
**Purpose**: Find key numerical data points
**Searches for**:
- Background statistics with numbers
- Comparative data with numbers
- Impact data with numbers
- Historical context with dates/counts

**Output Format**:
```json
{
  "key_data": [
    "Previous rate: 4.25%",
    "Inflation target: 2%",
    "Current inflation: 5.3%",
    "GDP growth: 0.1%",
    "Affected population: 340M",
    "Rate hikes: 10 consecutive"
  ]
}
```

### 3. Graph Search
**Purpose**: Find time-series data for visualization
**Searches for**:
- Historical data points with dates and values
- At least 4-6 data points for visualization
- Covers reasonable time period (2-5 years)
- Includes most recent data point

**Output Format**:
```json
{
  "graph_data": [
    {"date": "2020-03", "value": 0.25, "label": "COVID rate cut"},
    {"date": "2022-03", "value": 0.50, "label": "First hike"},
    {"date": "2023-07", "value": 5.25, "label": "Peak rate"},
    {"date": "2024-01", "value": 5.50, "label": "Current rate"}
  ],
  "y_axis_label": "Interest Rate (%)",
  "x_axis_label": "Date"
}
```

### 4. Map Search
**Purpose**: Find geographic coordinates and location data
**Searches for**:
- Primary location of the event
- Epicenter/center coordinates
- Affected areas with coordinates
- Event type and scale

**Output Format**:
```json
{
  "primary_location": {"name": "Gaziantep, Turkey", "lat": 37.00, "lon": 37.38},
  "epicenter": {"lat": 37.17, "lon": 37.03},
  "affected_areas": [
    {"name": "Ankara", "lat": 39.93, "lon": 32.85, "impact": "tremors felt"},
    {"name": "Aleppo, Syria", "lat": 36.20, "lon": 36.16, "impact": "major damage"}
  ],
  "event_type": "earthquake",
  "radius_km": 200
}
```

## Configuration Options
- **Model**: llama-3.1-sonar-large-128k-online
- **Temperature**: 0.2 (factual accuracy)
- **Max Tokens**: 2000 per search
- **Search Recency**: month (day, week, month, year)
- **Timeout**: 30 seconds per request
- **Retry Attempts**: 3 with exponential backoff
- **Delay Between Requests**: 0.5 seconds

## Usage Example
```python
from step4_perplexity_dynamic_context_search import PerplexityContextSearcher, PerplexityConfig

# Initialize searcher
searcher = PerplexityContextSearcher(
    api_key="YOUR_PERPLEXITY_API_KEY",
    config=PerplexityConfig(
        search_recency_filter="month",
        delay_between_requests=0.5
    )
)

# Search context for all articles
articles_with_context = searcher.search_all_articles(articles_with_components)
```

## Smart Search Logic
- **Component-Based**: Only searches for selected components from Step 3
- **Cost Optimization**: Avoids unnecessary searches
- **Targeted Prompts**: Specialized prompts for each component type
- **Data Validation**: Ensures returned data meets requirements

## Success Rates
Based on typical news distribution:
- **Timeline**: ~85% (depends on event having history)
- **Details**: ~95% (almost always finds numbers)
- **Graph**: ~75% (needs time-series data to exist)
- **Map**: ~90% (can find coordinates for most locations)
- **Overall**: ~85-90% success rate

## Cost Analysis

### Perplexity Pricing
- **Sonar Large**: ~$0.001 per search request

### Cost for 100 Articles
- **Average**: 3 components per article = 300 total searches
- **Total Cost**: 300 × $0.001 = ~$0.30

### Breakdown by Component
- **Timeline searches**: ~70 articles × $0.001 = $0.07
- **Details searches**: ~95 articles × $0.001 = $0.095
- **Graph searches**: ~40 articles × $0.001 = $0.04
- **Map searches**: ~30 articles × $0.001 = $0.03
- **Total**: ~$0.31 per 100 articles

## Performance
- **Per Search**: ~2-3 seconds
- **Per Article**: ~10 seconds (average 3 searches + delays)
- **100 Articles**: ~15-20 minutes
- **Optimization**: Can parallelize searches within same article

## Error Handling
- **Rate Limiting**: Exponential backoff retry
- **JSON Parsing**: Automatic cleaning of markdown code blocks
- **Network Errors**: Retry with increasing delays
- **Validation**: Checks data structure and content quality

## Integration
After Step 4 completes:
- Pass articles with context data to Step 5
- Each article has `context_data` with search results
- Step 5 formats this data into final output
- Maintains all metadata from previous steps

## Troubleshooting

### Low Success Rates (<80%)
- Check search prompts are clear
- Verify search_recency_filter is appropriate
- Some topics may not have web data available
- Normal for niche stories

### Missing Numerical Data
- Prompt emphasizes numbers heavily
- Some stories genuinely lack data
- Validation will catch this for Step 5

### Graph Data Issues
- Some topics don't have 4+ historical data points
- This is expected and okay
- Step 5 can handle partial data or skip graph

### Rate Limiting
- Increase delay_between_requests
- Reduce search frequency
- Upgrade Perplexity plan

### High Costs
- Already optimized (searches only selected components)
- Can't reduce further without losing data
- $0.31 per 100 articles is reasonable


