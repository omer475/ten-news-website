# STEP 3: GEMINI COMPONENT SELECTION

## Overview
Step 3 analyzes full articles from Step 2 and decides which visual components to include for each article. This ensures that only relevant, valuable components are generated, saving costs and improving user experience.

## Key Features
- **Model**: Gemini 2.0 Flash (cheapest option)
- **Input**: ~100 full articles from Step 2
- **Output**: Component selections for each article
- **Components**: Choose 2-4 from: Timeline, Details, Graph, Map
- **Cost**: ~$0.035 per 100 articles
- **Time**: ~2-3 minutes for 100 articles

## Available Components

### 1. Timeline
**Purpose**: Historical events leading to this news
**When to choose**:
- Article mentions previous related events
- Part of ongoing story (negotiations, investigations, crises)
- Policy with historical precedent (rate changes, legislation)
- Series of events over time
- Keywords: "since", "consecutive", "previously", "history of"

### 2. Details
**Purpose**: Key data points with numbers
**When to choose**:
- Article contains important numbers, statistics, metrics
- Impact data (affected populations, financial figures)
- Comparisons, percentages, specific amounts
- Almost always useful - default include

### 3. Graph
**Purpose**: Visual chart of data over time
**When to choose**:
- Article mentions rates, prices, or trends over time
- Historical data that shows progression
- Comparisons across time periods
- Keywords: "increased from X to Y", "over the past N years", "trend", "growth", "decline"

### 4. Map
**Purpose**: Geographic visualization
**When to choose**:
- Geographic event (earthquake, hurricane, conflict, protest)
- Multiple specific locations mentioned
- Location is crucial to understanding
- Keywords: "struck", "affected cities", "border", "region", "epicenter"

## Graph Types
When "graph" component is selected, the system also determines the best graph type:

- **line**: Trends over time (rates, prices, continuous data)
- **bar**: Comparisons between categories (election results, rankings)
- **area**: Volume/magnitude over time (cases, deaths, refugees)
- **column**: Discrete time periods (quarterly earnings, monthly data)

## Configuration Options
- **Min Components**: 2 (minimum per article)
- **Max Components**: 4 (maximum per article)
- **Article Preview**: 2000 characters (to save tokens)
- **Temperature**: 0.2 (consistent decisions)
- **Retry Attempts**: 3 with 2-second delays

## Usage Example
```python
from step3_gemini_component_selection import GeminiComponentSelector, ComponentConfig

# Initialize selector
selector = GeminiComponentSelector(
    api_key="YOUR_GOOGLE_AI_API_KEY",
    config=ComponentConfig(
        min_components=2,
        max_components=4
    )
)

# Select components for all articles
articles_with_components = selector.select_components_batch(full_articles)
```

## Output Format
Each article gets additional fields:
- `selected_components`: List of 2-4 components
- `graph_type`: 'line', 'bar', 'area', 'column' (if graph selected)
- `graph_data_needed`: Description of data to search (if graph selected)
- `map_locations`: List of location names (if map selected)

## Example Selections

### Economy Article
**Article**: "ECB raises interest rates to 4.5%... tenth consecutive increase since July 2023... inflation at 5.3%"
**Selection**: `["timeline", "details", "graph"]`
**Reasoning**: Has history (tenth increase), has numbers (rates, inflation), has trend over time

### Disaster Article
**Article**: "Earthquake strikes Turkey... magnitude 7.8... epicenter near Gaziantep... felt across six countries"
**Selection**: `["map", "details", "timeline"]`
**Reasoning**: Geographic event (map), has numbers (magnitude), has timeline of earthquake events

### Technology Article
**Article**: "Apple announces iPhone 16... $999 starting price... available September 22"
**Selection**: `["timeline", "details"]`
**Reasoning**: Has history (iPhone releases), has numbers (price, date), no graph data, location not relevant

### Election Article
**Article**: "Trump wins election with 312 electoral votes... Harris concedes with 226... key swing states Pennsylvania, Georgia, Arizona"
**Selection**: `["graph", "details", "map"]`
**Reasoning**: Comparison data (bar graph), has numbers, has geographic spread (swing states)

## Validation & Error Handling
- **Automatic Fallback**: If only 1 component chosen, adds "details" as default
- **Component Limits**: Enforces 2-4 components per article
- **Graph Consistency**: Ensures graph_type exists when graph is selected
- **Map Consistency**: Ensures map_locations exists when map is selected
- **JSON Parsing**: Retry logic with fallback to default selection

## Expected Statistics
Based on typical news distribution:
- **Details**: ~95% of articles (almost always useful)
- **Timeline**: ~70% of articles (most news has history)
- **Graph**: ~40% of articles (when time-series data exists)
- **Map**: ~30% of articles (geographic events)
- **Average Components**: ~3.0 per article

## Most Common Combinations
1. Timeline + Details + Graph (35%)
2. Timeline + Details (25%)
3. Map + Details + Timeline (20%)
4. Details + Graph (15%)
5. All four components (5%)

## Cost Analysis
- **Input**: ~2,500 tokens per article (system prompt + article preview)
- **Output**: ~100 tokens per article (component selection JSON)
- **Total Cost**: ~$0.035 per 100 articles
- **Processing Time**: ~2-3 minutes for 100 articles

## Integration
After Step 3 completes:
- Pass articles with component selections to Step 4
- Step 4 will search ONLY for selected components
- Saves costs by avoiding unnecessary searches
- Improves relevance of generated content

## Troubleshooting

### Too Few Components Selected
- Validation automatically adds "details" as fallback
- Adjust min_components in config if needed

### Wrong Component Selections
- Review system prompt for better guidance
- Add more examples in prompt
- Increase temperature slightly (0.2 → 0.3)

### Missing Graph Type
- Validation automatically defaults to "line"
- Can adjust default in validation function

### JSON Parsing Errors
- Retry logic handles this automatically
- Falls back to default selection after 3 attempts
- Default: ["timeline", "details"]


