# STEP 2: PERPLEXITY CONTEXT SEARCH

## Purpose
After Claude writes the title and summary, Perplexity searches for RELATED/CONNECTED facts that ADD CONTEXT. Perplexity must find information that is NOT already mentioned in Claude's written content - focusing on background, historical context, and related data.

---

## API Configuration

**Endpoint:** `POST https://api.perplexity.ai/chat/completions`

**Model:** `llama-3.1-sonar-large-128k-online`

**Headers:**
```json
{
  "Authorization": "Bearer YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

---

## Complete API Request Body

```json
{
  "model": "llama-3.1-sonar-large-128k-online",
  "messages": [
    {
      "role": "system",
      "content": "You are a news research assistant. Your job is to find RELATED and CONTEXTUAL information that ADDS VALUE to a news article. DO NOT search for or return facts that are already mentioned in the provided article. Focus on background, historical events, related statistics, and contextual data that helps readers understand the bigger picture."
    },
    {
      "role": "user",
      "content": "Search for related contextual information about this news article. Find facts that are NOT already mentioned in the article below.\n\nARTICLE WRITTEN BY CLAUDE:\nTitle: {claude_title}\nSummary: {claude_summary}\n\nSEARCH INSTRUCTIONS:\n\n1. TIMELINE EVENTS (Background & Context):\nFind 2-4 historical or related events that provide context to this news.\n- Search for PREVIOUS events that led to this situation\n- Search for RELATED developments in this topic area\n- If this is an ongoing story, find UPCOMING planned events or deadlines\n- DO NOT include the main event from the title/summary\n- Focus on: what happened before, what's happening around this, what's coming next\n- For recent developments, include specific times with timezone\n- Return: exact dates/times and what happened\n\n2. KEY DATA POINTS (Related Statistics & Context):\nFind 3 pieces of data that provide CONTEXT to this story.\n- Search for BACKGROUND statistics and numbers\n- Search for COMPARATIVE data (previous rates, historical benchmarks, industry averages)\n- Search for IMPACT data (affected populations, scale, scope)\n- DO NOT return data that is already mentioned in the title or summary\n- Prioritize: historical comparisons, scale indicators, related metrics, contextual numbers\n- Examples: \"Previous rate before this\", \"Historical average\", \"Last time this happened\", \"Total affected population\", \"Market size\", \"Industry benchmark\"\n- Return: the most relevant contextual data\n\n3. FOCUS AREAS:\n- Historical background: What led to this? What's the pattern?\n- Comparative context: How does this compare to past similar events?\n- Scale and impact: Who and how many are affected?\n- Related developments: What else is happening in this space?\n- Future implications: What's scheduled next?\n\nIMPORTANT: Your search results should help readers understand the CONTEXT and BACKGROUND of the news, NOT repeat what they already know from the title and summary.\n\nReturn ALL raw facts found in a comprehensive format."
    }
  ],
  "temperature": 0.2,
  "max_tokens": 2000,
  "return_citations": true,
  "search_recency_filter": "month"
}
```

---

## Prompt Explanation

**Key Differences from Original:**
- **Searches AFTER Claude writes** - Uses Claude's title/summary as input
- **Focuses on CONTEXT** - Not the main story facts
- **Avoids repetition** - Explicitly told NOT to return facts already in title/summary
- **Background-oriented** - Historical events, comparative data, related developments

**What Perplexity searches for:**
1. **Timeline:** Events BEFORE and AROUND this news (not the news itself)
2. **Details:** Contextual data, comparisons, scale (not the main facts)
3. **Value-add:** Information that helps understand WHY and HOW this matters

---

## Python Implementation

```python
import requests
import json

def search_perplexity_context(claude_title, claude_summary):
    """
    Search Perplexity for contextual facts after Claude writes
    
    Args:
        claude_title: str, title written by Claude in Step 1
        claude_summary: str, summary written by Claude in Step 1
    
    Returns:
        dict with 'results' and 'citations'
    """
    
    url = "https://api.perplexity.ai/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    user_prompt = f"""Search for related contextual information about this news article. Find facts that are NOT already mentioned in the article below.

ARTICLE WRITTEN BY CLAUDE:
Title: {claude_title}
Summary: {claude_summary}

SEARCH INSTRUCTIONS:

1. TIMELINE EVENTS (Background & Context):
Find 2-4 historical or related events that provide context to this news.
- Search for PREVIOUS events that led to this situation
- Search for RELATED developments in this topic area
- If this is an ongoing story, find UPCOMING planned events or deadlines
- DO NOT include the main event from the title/summary
- Focus on: what happened before, what's happening around this, what's coming next
- For recent developments, include specific times with timezone
- Return: exact dates/times and what happened

2. KEY DATA POINTS (Related Statistics & Context):
Find 3 pieces of data that provide CONTEXT to this story.
- Search for BACKGROUND statistics and numbers
- Search for COMPARATIVE data (previous rates, historical benchmarks, industry averages)
- Search for IMPACT data (affected populations, scale, scope)
- DO NOT return data that is already mentioned in the title or summary
- Prioritize: historical comparisons, scale indicators, related metrics, contextual numbers
- Examples: "Previous rate before this", "Historical average", "Last time this happened", "Total affected population", "Market size", "Industry benchmark"
- Return: the most relevant contextual data

3. FOCUS AREAS:
- Historical background: What led to this? What's the pattern?
- Comparative context: How does this compare to past similar events?
- Scale and impact: Who and how many are affected?
- Related developments: What else is happening in this space?
- Future implications: What's scheduled next?

IMPORTANT: Your search results should help readers understand the CONTEXT and BACKGROUND of the news, NOT repeat what they already know from the title and summary.

Return ALL raw facts found in a comprehensive format."""

    payload = {
        "model": "llama-3.1-sonar-large-128k-online",
        "messages": [
            {
                "role": "system",
                "content": "You are a news research assistant. Your job is to find RELATED and CONTEXTUAL information that ADDS VALUE to a news article. DO NOT search for or return facts that are already mentioned in the provided article. Focus on background, historical events, related statistics, and contextual data that helps readers understand the bigger picture."
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
        "return_citations": True,
        "search_recency_filter": "month"
    }
    
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    
    data = response.json()
    
    return {
        'results': data['choices'][0]['message']['content'],
        'citations': data.get('citations', [])
    }

# Example usage
claude_title = "European Central Bank raises interest rates to 4.5 percent"
claude_summary = "The quarter-point increase marks the tenth consecutive rate hike since July 2023, aimed at bringing inflation down from its current 5.3 percent. The decision affects 340 million eurozone residents and is expected to increase borrowing costs for mortgages and business loans across 20 member countries."

perplexity_context = search_perplexity_context(claude_title, claude_summary)
print("Context Results:", perplexity_context['results'])
```

---

## Node.js Implementation

```javascript
const axios = require('axios');

async function searchPerplexityContext(claudeTitle, claudeSummary) {
    const url = 'https://api.perplexity.ai/chat/completions';
    
    const userPrompt = `Search for related contextual information about this news article. Find facts that are NOT already mentioned in the article below.

ARTICLE WRITTEN BY CLAUDE:
Title: ${claudeTitle}
Summary: ${claudeSummary}

SEARCH INSTRUCTIONS:

1. TIMELINE EVENTS (Background & Context):
Find 2-4 historical or related events that provide context to this news.
- Search for PREVIOUS events that led to this situation
- Search for RELATED developments in this topic area
- If this is an ongoing story, find UPCOMING planned events or deadlines
- DO NOT include the main event from the title/summary
- Focus on: what happened before, what's happening around this, what's coming next
- For recent developments, include specific times with timezone
- Return: exact dates/times and what happened

2. KEY DATA POINTS (Related Statistics & Context):
Find 3 pieces of data that provide CONTEXT to this story.
- Search for BACKGROUND statistics and numbers
- Search for COMPARATIVE data (previous rates, historical benchmarks, industry averages)
- Search for IMPACT data (affected populations, scale, scope)
- DO NOT return data that is already mentioned in the title or summary
- Prioritize: historical comparisons, scale indicators, related metrics, contextual numbers
- Examples: "Previous rate before this", "Historical average", "Last time this happened", "Total affected population", "Market size", "Industry benchmark"
- Return: the most relevant contextual data

3. FOCUS AREAS:
- Historical background: What led to this? What's the pattern?
- Comparative context: How does this compare to past similar events?
- Scale and impact: Who and how many are affected?
- Related developments: What else is happening in this space?
- Future implications: What's scheduled next?

IMPORTANT: Your search results should help readers understand the CONTEXT and BACKGROUND of the news, NOT repeat what they already know from the title and summary.

Return ALL raw facts found in a comprehensive format.`;

    const payload = {
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
            {
                role: 'system',
                content: 'You are a news research assistant. Your job is to find RELATED and CONTEXTUAL information that ADDS VALUE to a news article. DO NOT search for or return facts that are already mentioned in the provided article. Focus on background, historical events, related statistics, and contextual data that helps readers understand the bigger picture.'
            },
            {
                role: 'user',
                content: userPrompt
            }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        return_citations: true,
        search_recency_filter: 'month'
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return {
            results: response.data.choices[0].message.content,
            citations: response.data.citations || []
        };
    } catch (error) {
        console.error('Perplexity API error:', error);
        throw error;
    }
}
```

---

## Expected Output Example

When Claude writes:
- **Title:** "European Central Bank raises interest rates to 4.5 percent"
- **Summary:** "The quarter-point increase marks the tenth consecutive rate hike since July 2023..."

Perplexity should return contextual information like:

```
TIMELINE CONTEXT:

1. July 27, 2023: ECB began its rate hiking cycle, raising rates from 3.5% to 3.75% to combat inflation that had reached 5.5% across the eurozone. This was the first increase after years of near-zero rates.

2. March 2024: ECB held rates steady for the first time in 8 months at 4.25%, signaling potential pause in hiking cycle as inflation showed signs of moderating.

3. June 2024: ECB resumed rate increases despite economic slowdown concerns, citing persistent core inflation pressures.

4. December 12, 2024 (scheduled): Next ECB monetary policy meeting where officials will review rate policy based on latest inflation and growth data.

CONTEXTUAL DATA POINTS:

1. ECB target rate: 2% inflation (current level significantly above target)

2. Eurozone GDP growth: 0.1% in Q3 2024, indicating near-stagnation as high rates impact economic activity

3. Average mortgage impact: Rates expected to increase 0.3 percentage points within 2-3 months, affecting approximately 15 million mortgage holders

4. Historical context: Highest ECB rates since 2001 during dot-com bubble period

5. Previous rate before July 2023: 3.5% (rates have increased 1 full percentage point in 15 months)

6. Unemployment rate: 6.4% across eurozone, relatively stable despite rate increases

ADDITIONAL CONTEXT:

Geographic scope: Policy affects all 20 eurozone countries - Germany, France, Italy, Spain, Netherlands, Belgium, Austria, Portugal, Greece, Finland, Ireland, Slovakia, Slovenia, Lithuania, Latvia, Estonia, Cyprus, Luxembourg, Malta, Croatia.

Market reaction to previous hikes: Euro strengthened against dollar, but European stock markets experienced volatility. Business investment has contracted in manufacturing sectors.

Comparison to other central banks: US Federal Reserve at 5.25-5.5%, Bank of England at 5.25%, showing ECB in line with global tightening trend.
```

**Notice:** This information ADDS CONTEXT without repeating "tenth consecutive hike" or "5.3% inflation" which were already in Claude's summary.

---

## Parameter Settings

**Temperature:** `0.2`
- Low for factual accuracy
- Reduces speculation
- Focuses on verified context

**Max Tokens:** `2000`
- Enough for comprehensive contextual search
- Provides rich background information

**Search Recency Filter:** `month`
- Balances recent context with historical background
- Allows finding both timeline events and current data

---

## Cost Estimation

**Perplexity Pricing:**
- ~$0.001 per search request

**Per Article:**
- Single contextual search: ~$0.001 (0.1 cent)

---

## Integration Notes

This is **Step 2** in the three-step workflow:
1. Claude writes title + summary (Step 1)
2. **Perplexity searches for context (Step 2 - THIS DOCUMENT)**
3. Claude formats timeline + details (Step 3)

The output from this step will be passed to Claude in Step 3 for formatting into the final timeline and details sections.
