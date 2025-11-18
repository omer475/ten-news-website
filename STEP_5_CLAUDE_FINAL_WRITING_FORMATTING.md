# STEP 5: CLAUDE FINAL WRITING & FORMATTING

## Overview
Step 5 is the final step that writes everything in one comprehensive Claude call. It takes articles with context data from Step 4 and creates complete, publication-ready articles with all components formatted perfectly.

## Key Features
- **Model**: Claude Sonnet 4.5 (best quality for writing)
- **Input**: ~100 articles with context data from Step 4
- **Output**: Complete formatted articles ready for users
- **Writes**: Title, Summary (paragraph + bullets), Timeline, Details, Graph, Map
- **Cost**: ~$1.80 per 100 articles
- **Time**: ~5-7 minutes for 100 articles

## What Gets Written

### 1. Title (≤12 words)
- Declarative statement (never a question)
- Include geographic/entity context
- Complete main point of article
- Active voice, sentence case
- No clickbait, questions, exclamation marks

**Examples**:
✓ "European Central Bank raises interest rates to 4.5 percent"
✓ "Magnitude 7.8 earthquake strikes Turkey near Syrian border"
✓ "Donald Trump wins 2024 presidential election with 312 electoral votes"

### 2. Summary Paragraph (35-42 words)
- Flowing prose, natural narrative
- Add NEW information beyond title
- Never repeat exact title wording
- Geographic specificity
- Use past tense for completed events
- Include impact, consequences, key numbers

### 3. Summary Bullets (exactly 4 bullets, 10-17 words each, MAX 60 words total)
**Critical**: Bullets must tell COMPLETE story independently.

**Rules**:
- Exactly 4 bullets (no more, no less)
- 10-17 words per bullet
- MAXIMUM 60 words total across ALL bullets combined
- Each bullet is complete, standalone thought
- Start directly with key information (no "The" or "This")
- No periods at end
- Include specific details (numbers, names, locations)
- Active voice

**Structure**:
1. First bullet: Full main event with key details (WHO + WHAT + KEY NUMBER)
2. Second bullet: Context or background (WHY, historical comparison)
3. Third bullet: Impact/consequences (WHO affected, HOW MANY)
4. Fourth bullet: Additional key detail
5. Fifth bullet (optional): Final important detail

**Examples**:
✓ "ECB raises interest rates to 4.5%, tenth consecutive increase since July 2023"
✓ "Current inflation at 5.3%, well above the 2% target rate"
✓ "Decision affects 340 million people across 20 eurozone countries"
✓ "Higher borrowing costs expected for mortgages and business loans"

### 4. Timeline (if selected, 2-4 events)
- Chronological order (oldest first)
- Use context data from Perplexity
- Each event: date + description (≤14 words)
- Focus on contextual events (background, related developments, upcoming)
- Do NOT include main news event from title

**Date formats**:
- Different days: "Oct 14, 2024"
- Same day recent: "14:30, Oct 14"
- Month only: "Oct 2024"
- Future: "Dec 2024"

### 5. Details (if selected, exactly 3 data points)
- Format: "Label: Value"
- Label: 1-3 words, Value: specific number/data
- Total per detail: under 8 words
- EVERY detail MUST contain a NUMBER

**Examples**:
✓ "Previous rate: 4.25%"
✓ "Inflation target: 2%"
✓ "GDP growth: 0.1%"

❌ "Platform: Social media" - no number
❌ "Status: Ongoing" - no number

### 6. Graph (if selected)
Formats graph data from Perplexity context with:
- Type: line, bar, area, column
- Title and axis labels
- At least 4 data points
- Dates in YYYY-MM format
- Values as numbers only

### 7. Map (if selected)
Formats map data from Perplexity context with:
- Center coordinates and zoom level
- Markers with coordinates, labels, colors
- Affected regions with radius
- Color coding (red: critical, orange: significant, yellow: minor, blue: general)

## Configuration Options
- **Model**: claude-sonnet-4-20250514
- **Max Tokens**: 2048 per request
- **Temperature**: 0.3 (consistent quality)
- **Timeout**: 60 seconds per request
- **Retry Attempts**: 3 with 2-second delays
- **Delay Between Requests**: 0.3 seconds

## Usage Example
```python
from step5_claude_final_writing_formatting import ClaudeFinalWriter, WriterConfig

# Initialize writer
writer = ClaudeFinalWriter(
    api_key="YOUR_ANTHROPIC_API_KEY",
    config=WriterConfig(
        temperature=0.3,
        delay_between_requests=0.3
    )
)

# Write all articles
final_articles = writer.write_all_articles(articles_with_context)
```

## Output Format
Each article contains:
- `id`: Unique article identifier
- `title`: Formatted title (≤12 words)
- `summary`: Paragraph + bullets
- `timeline`: Array of events (if selected)
- `details`: Array of 3 data points (if selected)
- `graph`: Graph data object (if selected)
- `map`: Map data object (if selected)
- `original_url`: Source URL
- `source`: News source
- `category`: Article category
- `score`: Quality score from Step 1
- `published_time`: Publication timestamp

## Validation & Quality Control
- **Title Length**: Enforces ≤12 words
- **Paragraph Length**: Enforces 35-42 words
- **Bullet Count**: Enforces exactly 4 bullets
- **Bullet Length**: Enforces 10-17 words each
- **Total Bullet Words**: Enforces MAX 60 words total
- **Bullet Format**: No periods at end
- **Details Count**: Exactly 3 data points
- **Details Numbers**: All must contain numbers
- **Component Presence**: Validates selected components are included

## Cost Analysis

### Claude Sonnet 4.5 Pricing
- **Input**: $3 per 1M tokens
- **Output**: $15 per 1M tokens

### Cost per Article
- **Input**: ~4,000 tokens (system + article + context)
- **Output**: ~400 tokens (all formatted content)
- **Cost**: (4k × $3/1M) + (400 × $15/1M) = ~$0.018 (1.8 cents)

### Cost for 100 Articles
- **Total**: 100 × $0.018 = ~$1.80

## Performance
- **Per Article**: ~3-4 seconds
- **With Delays**: ~4 seconds per article
- **100 Articles**: ~6-7 minutes
- **Cannot Parallelize**: One Claude conversation per article

## Complete Pipeline Cost Summary
**All 5 Steps Combined**:
- Step 1: Gemini scoring = $0.02
- Step 2: ScrapingBee fetching = $0.05
- Step 3: Gemini component selection = $0.035
- Step 4: Perplexity context search = $0.31
- Step 5: Claude final writing = $1.80
- **Total**: ~$2.22 per 100 articles

**Per Article**: ~$0.022 (2.2 cents)

**Summary**: 1000 RSS articles → 100 approved → 100 fully formatted
- **Total Cost**: ~$2.22
- **Total Time**: ~15-20 minutes

## Integration
This is the final step that produces publication-ready articles:
- Takes articles with context data from Step 4
- Writes complete formatted content
- Outputs ready-to-use articles for your website
- Maintains all metadata from previous steps

## Troubleshooting

### JSON Parsing Errors
- Claude usually returns valid JSON
- Markdown code blocks are cleaned automatically
- Retry logic handles most cases

### Title Too Long
- Validation catches this
- Retry will ask Claude to shorten
- Rare with clear prompts

### Paragraph Wrong Length
- Validation catches this
- Usually within 35-42 range
- Can adjust tolerance if needed

### Bullets Ending with Periods
- Validation catches this
- Claude usually follows rules well
- Clean manually if needed

### Details Missing Numbers
- Most common issue
- Perplexity provides numerical data
- Claude usually includes numbers
- Validation catches violations

### Missing Components
- Rare - Claude includes selected components
- May happen if context data was empty
- Acceptable - means no good data available

### High Costs
- $1.80 per 100 articles is reasonable
- Using best model (Sonnet 4.5) for quality
- Could use cheaper model but quality drops


