# PROPOSED SCORING PROMPT V19 — Changes from V18

## Key Philosophy Change

**OLD (V18):** "Would a busy, smart person stop scrolling to read this?"
- Scored on: Surprise, Impact breadth, Consequence magnitude, Timeliness
- = Pure news value

**NEW (V19):** "Would someone interested in this topic stop scrolling to engage with this?"
- Scored on: **Engagement potential**, **Quality/Depth**, **Freshness**, **Shareability**
- = Content value for its audience

---

## What Changes

### 1. SCORING PHILOSOPHY (replaces the 4 factors)

```
Score based on four factors:
1. **Engagement potential** — Would someone interested in this topic want to read/share this? (Boring = low, compelling = high)
2. **Quality & Depth** — Is this well-crafted with real substance? (Thin/generic = low, rich/expert = high)
3. **Freshness** — Is this timely and current? (Stale/evergreen = lower, trending/breaking = higher)
4. **Shareability** — Would someone send this to a friend? (Forgettable = low, "you need to see this" = high)
```

### 2. SCORE TIERS (replaces news-centric tiers)

```
| Score | Tier | What belongs here |
|-------|------|-------------------|
| 920-1000 | **MUST SEE** | World-changing events, viral moments, once-in-a-decade stories across ANY category |
| 850-919 | **TOP TIER** | Best-in-class content for its category — major events, exceptional quality, high engagement |
| 750-849 | **GREAT** | Strong content that most people interested in this topic would want to see |
| 600-749 | **GOOD** | Solid content, real substance, worth reading if you follow this topic |
| 400-599 | **STANDARD** | Average content, routine updates, nothing special but legitimate |
| 200-399 | **LOW** | Thin content, very niche, or low effort — only with personalization boost |
| 0-199 | **SKIP** | Barely any value, extremely niche, poor quality |
```

### 3. CATEGORY SCORING GUIDELINES (adds new categories, reframes existing ones)

**Keep existing:** Geopolitics, Politics, Business/Tech, Science, Health, Sports, Entertainment
**ADD these new sections:**

```
### FOOD & COOKING

| Type | Score Range |
|------|-------------|
| Celebrity chef major announcement / restaurant empire news | 800-870 |
| Viral recipe / food trend millions are trying | 780-850 |
| Expert cooking technique / kitchen hack with real value | 750-830 |
| Restaurant review (notable / destination) | 700-780 |
| Seasonal recipe with quality content | 650-750 |
| Standard recipe / cooking tip | 500-650 |
| Generic listicle ("10 easy dinners") | 350-500 |

### TRAVEL

| Type | Score Range |
|------|-------------|
| Major travel disruption (airline collapse, border closures) | 850-920 |
| Destination that just opened / major new route | 800-870 |
| Expert travel guide with insider knowledge | 750-830 |
| Hotel/resort review (notable property) | 700-780 |
| Travel hack / deal with real savings | 650-750 |
| Standard destination feature | 500-650 |
| Generic travel listicle | 350-500 |

### LIFESTYLE & HOME

| Type | Score Range |
|------|-------------|
| Cultural moment / viral social trend | 800-870 |
| Royal family major event | 780-860 |
| Expert home/design content with real utility | 750-830 |
| Product review / comparison with depth | 700-780 |
| Interesting human interest story | 650-750 |
| Standard lifestyle tip / advice | 500-650 |
| Generic listicle / thin content | 350-500 |

### FASHION & BEAUTY

| Type | Score Range |
|------|-------------|
| Major fashion week show (Chanel, Dior, LV) | 800-870 |
| Celebrity style moment (A-list, viral) | 780-850 |
| Trend report with expert analysis | 750-830 |
| Brand collaboration / major launch | 700-780 |
| Product review / style guide with depth | 650-750 |
| Standard fashion/beauty update | 500-650 |
| Generic "X items under $50" | 350-500 |
```

### 4. SCORE ANCHORS (update to include all categories equally)

**Replace the old anchors with:**
```
| Article Type | Anchor Score |
|-------------|-------------|
| Major country declares war on another | **960** |
| Super Bowl / World Cup Final result | **910** |
| Prime Minister calls snap election | **870** |
| Major fashion week show (Chanel Fall Collection) | **820** |
| Major tech acquisition ($5B+) | **820** |
| Celebrity chef opens game-changing restaurant | **780** |
| Viral recipe everyone is making | **770** |
| Expert travel guide to trending destination | **750** |
| Startup raises $50M in Series B | **620** |
| Regular season Premier League match (mid-table) | **520** |
| Standard recipe with no special angle | **500** |
| Generic "10 best hotels" listicle | **400** |
| Man arrested for stabbing family member | **300** |
| Person dies in house fire in small town | **280** |
| Local council approves parking regulations | **150** |
```

### 5. PENALTIES (remove anti-lifestyle penalties)

**REMOVE these penalties:**
- ~~Profile piece / feature (not breaking): -40~~ → Features ARE the content for lifestyle/food/fashion
- ~~Photo roundup / listicle format: -60~~ → Change to: "Low-effort listicle with no substance: -40"

**KEEP these penalties:**
- "Warns/Faces" without concrete action: -30
- "Seeks/Eyes/Considers" (speculation): -30
- "May/Could/Might" without event: -40
- Follow-up without significant new info: -50
- Vague academic headline: -40

### 6. TOPIC RELEVANCE (add missing topics)

**Add to available topics:**
`food, cooking, recipes, fashion, beauty, lifestyle, home_design, fitness, wellness`

**Updated full list:**
`economics, stock_markets, banking, startups, ai, tech_industry, consumer_tech, cybersecurity, space, science, climate, health, biotech, politics, geopolitics, conflicts, human_rights, football, american_football, basketball, tennis, f1, cricket, combat_sports, olympics, golf, winter_sports, ice_hockey, rugby, swimming, entertainment, music, gaming, travel, food, cooking, fashion, beauty, lifestyle, home_design, fitness, wellness`

### 7. CRITICAL RULES (update)

**CHANGE rule 4 from:**
> "Any category can reach 900+" — A massive tech breach or science breakthrough can outscore routine political news.

**TO:**
> "Every category scores on its own scale" — A Chanel fashion show IS an 820 for fashion fans. A viral sourdough recipe IS a 770. Don't compare them to wars — compare them to other content in their category.

**ADD rule 7:**
> "Content quality matters more than topic importance" — A brilliantly written food article should outscore a generic political press release. Judge the CONTENT, not just the TOPIC.

---

## Expected Impact

With these changes:
- Food articles: avg 307 → **~600-650** (quality recipes score 650-780)
- Fashion articles: avg 350 → **~650-700** (Chanel show scores 820)
- Lifestyle articles: avg 452 → **~600-700** (Royal family events score 780-860)
- Travel articles: avg 519 → **~650-750** (expert guides score 750+)
- Traditional categories: stay roughly the same (800+ for major events, 600-780 for standard)

The gap closes from **351 points to ~100 points**, which is appropriate — major world events SHOULD still score highest, but lifestyle content should compete fairly within its tier.
