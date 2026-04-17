const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE_URL = "https://www.tennews.ai";

// ═══════════════════════════════════════════════════════════════
// V15 REALISTIC PERSONAS
// Each persona has:
//   - primary: specific entities/topics they LOVE (high dwell, engage)
//   - secondary: topics they're casually interested in (moderate dwell)
//   - curiosity: broad topics they'll glance at if interesting
//   - avoids: topics they hard-skip (fast negative signal)
//   - categories: DB categories that map to their interests
//   - dwellProfile: variable dwell by match tier
//   - fatigueThreshold: how many same-topic articles before they get bored
// ═══════════════════════════════════════════════════════════════

const PERSONAS = [
  {
    name: "Alex — AI Startup Founder",
    emoji: "💻",
    primary: ["openai", "anthropic", "chatgpt", "claude", "llm", "sam altman", "series a", "seed round", "y combinator", "venture capital", "silicon valley", "machine learning", "deep learning"],
    secondary: ["cybersecurity", "cloud computing", "semiconductor", "nvidia", "apple", "google", "microsoft", "tech industry"],
    curiosity: ["spacex", "electric vehicles", "bitcoin", "stock market"],
    avoids: ["cricket", "soccer", "football", "k-pop", "celebrity", "fashion", "cooking", "reality tv"],
    categories: ["Tech", "Business"],
    dwellProfile: { primary: 20, secondary: 12, curiosity: 5, skip: 1.2 },
    fatigueThreshold: 5,
  },
  {
    name: "Fatma — Turkish Politics & Middle East",
    emoji: "🇹🇷",
    primary: ["turkiye", "erdogan", "turkish", "istanbul", "ankara", "akp", "chp", "kurdish", "pkk", "turkish lira", "turkish economy"],
    secondary: ["iran", "israel", "hezbollah", "hamas", "gaza", "middle east", "nato", "european union", "syria", "iraq"],
    curiosity: ["galatasaray", "fenerbahce", "besiktas", "turkish food", "cooking", "travel"],
    avoids: ["nfl", "nba", "mlb", "cricket", "k-pop", "gaming", "esports", "bitcoin"],
    categories: ["Politics", "World"],
    dwellProfile: { primary: 25, secondary: 15, curiosity: 6, skip: 1.0 },
    fatigueThreshold: 4,
  },
  {
    name: "Raj — Cricket & Bollywood",
    emoji: "🏏",
    primary: ["ipl", "cricket", "virat kohli", "rohit sharma", "bcci", "test match", "t20", "world cup cricket", "india cricket", "indian premier league"],
    secondary: ["bollywood", "shah rukh khan", "india", "modi", "indian economy", "startups india", "tata", "reliance"],
    curiosity: ["ai", "tech", "space", "nasa"],
    avoids: ["nfl", "american football", "baseball", "mlb", "k-pop", "iran", "israel", "european politics"],
    categories: ["Sports", "Entertainment"],
    dwellProfile: { primary: 18, secondary: 10, curiosity: 4, skip: 0.8 },
    fatigueThreshold: 6,
  },
  {
    name: "Maria — Climate Scientist & EU Politics",
    emoji: "🌍",
    primary: ["climate change", "emissions", "carbon", "paris agreement", "cop", "renewable energy", "solar", "wind power", "ipcc", "global warming", "biodiversity"],
    secondary: ["european union", "eu", "brussels", "macron", "germany", "european politics", "green deal", "electric vehicles"],
    curiosity: ["nasa", "space", "biology", "ocean", "research"],
    avoids: ["nfl", "nba", "cricket", "celebrity gossip", "gaming", "k-pop", "bitcoin", "crypto"],
    categories: ["Science", "Politics"],
    dwellProfile: { primary: 22, secondary: 14, curiosity: 5, skip: 1.5 },
    fatigueThreshold: 4,
  },
  {
    name: "Yuto — Gaming & Anime",
    emoji: "🎮",
    primary: ["playstation", "xbox", "nintendo", "steam", "esports", "league of legends", "valorant", "final fantasy", "zelda", "gaming", "video games"],
    secondary: ["anime", "manga", "japan", "japanese", "k-pop", "korean", "streaming", "twitch", "youtube"],
    curiosity: ["ai", "tech", "movies", "marvel", "star wars", "robotics"],
    avoids: ["politics", "iran", "trump", "congress", "oil", "finance", "banking", "cricket", "real estate"],
    categories: ["Entertainment", "Tech"],
    dwellProfile: { primary: 15, secondary: 10, curiosity: 4, skip: 0.8 },
    fatigueThreshold: 5,
  },
  {
    name: "Chloe — K-Pop & Fashion",
    emoji: "💜",
    primary: ["bts", "blackpink", "k-pop", "k-drama", "korean", "stray kids", "newjeans", "aespa", "twice", "kpop", "hallyu"],
    secondary: ["fashion", "sneakers", "streetwear", "nike", "celebrity style", "met gala", "red carpet", "beauty", "instagram", "tiktok"],
    curiosity: ["netflix", "streaming", "movies", "music", "concert", "tour"],
    avoids: ["politics", "iran", "trump", "congress", "oil", "finance", "war", "military", "cricket", "nfl"],
    categories: ["Entertainment", "Lifestyle"],
    dwellProfile: { primary: 12, secondary: 8, curiosity: 4, skip: 0.5 },
    fatigueThreshold: 6,
  },
  {
    name: "Omar — NFL & Finance Bro",
    emoji: "🏈",
    primary: ["nfl", "chiefs", "patrick mahomes", "super bowl", "quarterback", "touchdown", "fantasy football", "american football", "nfl draft"],
    secondary: ["stock market", "wall street", "sp500", "nasdaq", "cryptocurrency", "bitcoin", "tesla stock", "earnings"],
    curiosity: ["ufc", "boxing", "nba", "lebron", "tech industry", "apple", "elon musk"],
    avoids: ["k-pop", "fashion", "celebrity gossip", "cooking", "gardening", "cricket", "climate change", "poetry"],
    categories: ["Sports", "Finance", "Business"],
    dwellProfile: { primary: 16, secondary: 12, curiosity: 5, skip: 1.0 },
    fatigueThreshold: 5,
  },
  {
    name: "Sena — K-Drama & Korean Culture",
    emoji: "🇰🇷",
    primary: ["k-drama", "kdrama", "korean drama", "netflix korea", "squid game", "korean", "hallyu", "korean food", "kimchi"],
    secondary: ["k-pop", "bts", "blackpink", "korean beauty", "skincare", "travel", "japan", "anime"],
    curiosity: ["streaming", "netflix", "movies", "celebrity", "food", "cooking"],
    avoids: ["politics", "war", "military", "iran", "trump", "oil", "finance", "banking", "cricket", "nfl"],
    categories: ["Entertainment", "Lifestyle"],
    dwellProfile: { primary: 14, secondary: 9, curiosity: 4, skip: 0.5 },
    fatigueThreshold: 5,
  },
  {
    name: "Mike — US Politics & History",
    emoji: "🇺🇸",
    primary: ["trump", "congress", "senate", "republican", "democrat", "white house", "supreme court", "election", "biden", "legislation", "us politics"],
    secondary: ["us military", "pentagon", "china", "nato", "foreign policy", "economy", "federal reserve", "inflation"],
    curiosity: ["nfl", "super bowl", "spacex", "nasa", "history"],
    avoids: ["k-pop", "fashion", "gaming", "anime", "cricket", "bollywood", "cooking", "celebrity gossip"],
    categories: ["Politics"],
    dwellProfile: { primary: 18, secondary: 12, curiosity: 5, skip: 1.5 },
    fatigueThreshold: 4,
  },
  {
    name: "Lina — Health & Wellness Lifestyle",
    emoji: "🧘",
    primary: ["mental health", "anxiety", "meditation", "yoga", "nutrition", "diet", "fitness", "wellness", "sleep", "mindfulness", "therapy"],
    secondary: ["vaccine", "cancer", "clinical trial", "public health", "cdc", "who", "pandemic", "disease"],
    curiosity: ["cooking", "travel", "environment", "climate", "pets", "animals"],
    avoids: ["war", "military", "iran", "trump", "congress", "oil", "crypto", "nfl", "gaming", "esports"],
    categories: ["Health", "Science", "Lifestyle"],
    dwellProfile: { primary: 20, secondary: 14, curiosity: 5, skip: 1.0 },
    fatigueThreshold: 4,
  },
];

// ═══════════════════════════════════════════════════════════════
// IMPROVED INTEREST SCORING
// Separate scoring for primary, secondary, curiosity, avoids
// ═══════════════════════════════════════════════════════════════

function getInterestTier(article, persona) {
  const tags = (typeof article.interest_tags === "string"
    ? JSON.parse(article.interest_tags || "[]")
    : article.interest_tags || []
  ).map(t => t.toLowerCase());

  const title = (article.title_news || article.title || "").toLowerCase();
  const cat = (article.category || "").toLowerCase();

  // Check avoids first (hard skip)
  let avoidHits = 0;
  for (const term of persona.avoids) {
    if (tags.some(t => t.includes(term) || term.includes(t))) avoidHits++;
    if (title.includes(term)) avoidHits++;
  }
  if (avoidHits >= 2) return { tier: "avoid", score: -avoidHits };

  // Check primary interests (strong match)
  let primaryHits = 0;
  for (const term of persona.primary) {
    if (tags.some(t => t.includes(term) || term.includes(t))) primaryHits += 2;
    if (title.includes(term)) primaryHits += 1;
  }

  // Check secondary interests
  let secondaryHits = 0;
  for (const term of persona.secondary) {
    if (tags.some(t => t.includes(term) || term.includes(t))) secondaryHits += 2;
    if (title.includes(term)) secondaryHits += 1;
  }

  // Check curiosity
  let curiosityHits = 0;
  for (const term of persona.curiosity) {
    if (tags.some(t => t.includes(term) || term.includes(t))) curiosityHits += 2;
    if (title.includes(term)) curiosityHits += 1;
  }

  // Category match (weaker signal — prevents Cricket matching for Soccer fan)
  const catMatch = persona.categories.map(c => c.toLowerCase()).includes(cat);

  // Determine tier
  if (primaryHits >= 4) return { tier: "primary_strong", score: primaryHits };
  if (primaryHits >= 2) return { tier: "primary", score: primaryHits };
  if (secondaryHits >= 4) return { tier: "secondary_strong", score: secondaryHits };
  if (secondaryHits >= 2) return { tier: "secondary", score: secondaryHits };
  if (curiosityHits >= 2) return { tier: "curiosity", score: curiosityHits };
  // Category-only match (no specific tag match — e.g., Cricket for Soccer fan)
  if (catMatch && (primaryHits > 0 || secondaryHits > 0)) return { tier: "category_related", score: 1 };
  if (catMatch) return { tier: "category_only", score: 0.5 };
  // Mild avoid (1 avoid hit but not strong enough for hard skip)
  if (avoidHits === 1) return { tier: "mild_avoid", score: -1 };
  return { tier: "irrelevant", score: 0 };
}

// ═══════════════════════════════════════════════════════════════
// REALISTIC REACTION SIMULATION
// Includes: topic fatigue, variable dwell, quality awareness
// ═══════════════════════════════════════════════════════════════

function simulateReaction(article, persona, recentTopics) {
  const { tier, score } = getInterestTier(article, persona);
  const aiScore = article.ai_final_score || 0;

  // Quality scaling — humans genuinely stop for incredible content
  // A 950-score article ("Alien Life Discovered") grabs ANYONE
  // A 500-score article ("Local Council Meeting Update") only interests niche followers
  let qualityBonus;
  if (aiScore >= 950) qualityBonus = 2.0;      // once-in-a-year stories grab everyone
  else if (aiScore >= 900) qualityBonus = 1.6;  // major world events, high curiosity
  else if (aiScore >= 850) qualityBonus = 1.3;  // important but not earth-shattering
  else if (aiScore >= 750) qualityBonus = 1.1;  // notable
  else qualityBonus = 1.0;                       // standard

  // Topic fatigue: check how many recent articles share tags with this one
  const tags = (typeof article.interest_tags === "string"
    ? JSON.parse(article.interest_tags || "[]")
    : article.interest_tags || []
  ).map(t => t.toLowerCase());

  let fatigueCount = 0;
  for (const recentTag of recentTopics) {
    if (tags.includes(recentTag)) fatigueCount++;
  }
  const fatigued = fatigueCount >= persona.fatigueThreshold;
  const fatiguePenalty = fatigued ? 0.4 : 1.0;

  const dwell = persona.dwellProfile;
  const noise = 0.7 + Math.random() * 0.6; // 0.7-1.3x human variance

  switch (tier) {
    case "primary_strong":
      if (Math.random() < 0.9 * fatiguePenalty * Math.min(qualityBonus, 1.3)) {
        return { action: "source_click", dwell: dwell.primary * 1.5 * noise, tier, score };
      }
      return { action: "engaged", dwell: dwell.primary * noise, tier, score };

    case "primary":
      if (Math.random() < 0.75 * fatiguePenalty * Math.min(qualityBonus, 1.3)) {
        return { action: "engaged", dwell: dwell.primary * noise, tier, score };
      }
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };

    case "secondary_strong":
      if (Math.random() < 0.65 * fatiguePenalty * Math.min(qualityBonus, 1.5)) {
        return { action: "engaged", dwell: dwell.secondary * noise, tier, score };
      }
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };

    case "secondary":
      if (Math.random() < 0.45 * fatiguePenalty * Math.min(qualityBonus, 1.5)) {
        return { action: "engaged", dwell: dwell.secondary * 0.8 * noise, tier, score };
      }
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };

    case "curiosity":
      if (Math.random() < 0.30 * qualityBonus) {
        return { action: "engaged", dwell: dwell.curiosity * 1.5 * noise, tier, score };
      }
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };

    case "category_related":
      // Same broad category but not specific interest — e.g. Boxing for a Soccer fan
      // High-quality articles within their category DO get attention
      if (Math.random() < 0.20 * qualityBonus) {
        return { action: "engaged", dwell: dwell.curiosity * 1.2 * noise, tier, score };
      }
      if (Math.random() < 0.35 * qualityBonus) {
        return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
      }
      return { action: "skip", dwell: dwell.skip * 1.5 * noise, tier, score };

    case "category_only":
      // Category match but no tag overlap at all
      if (Math.random() < 0.10 * qualityBonus) {
        return { action: "glance", dwell: dwell.curiosity * 0.8 * noise, tier, score };
      }
      return { action: "skip", dwell: dwell.skip * 1.2 * noise, tier, score };

    case "avoid":
      // Strong avoid — but even here, a once-in-a-decade story breaks through
      // "Iran" is avoided by K-Pop fan, but "World War 3 Begins" (score 990) gets read
      if (aiScore >= 960 && Math.random() < 0.3) {
        return { action: "glance", dwell: 4.0 * noise, tier, score };
      }
      return { action: "skip", dwell: dwell.skip * 0.5, tier, score };

    case "mild_avoid":
      if (aiScore >= 900 && Math.random() < 0.2) {
        return { action: "glance", dwell: 3.0 * noise, tier, score };
      }
      return { action: "skip", dwell: dwell.skip * 0.8, tier, score };

    default: // irrelevant — no interest match at all
      // This is where "human serendipity" lives
      // Real humans DO read interesting off-topic content
      if (aiScore >= 950 && Math.random() < 0.45) {
        // "Scientists Discover Alien Life" — almost everyone reads this
        return { action: "engaged", dwell: dwell.curiosity * 2.0 * noise, tier, score };
      }
      if (aiScore >= 900 && Math.random() < 0.25) {
        // Major world event — many people at least glance
        return { action: "glance", dwell: dwell.curiosity * 1.5 * noise, tier, score };
      }
      if (aiScore >= 800 && Math.random() < 0.10) {
        // Good quality article — occasional serendipitous discovery
        return { action: "glance", dwell: 3.5 * noise, tier, score };
      }
      return { action: "skip", dwell: dwell.skip * noise, tier, score };
  }
}

// ═══════════════════════════════════════════════════════════════
// FEED FETCHING & TEST RUNNER
// ═══════════════════════════════════════════════════════════════

async function fetchFeedPage(engagedIds, skippedIds, seenIds, cursor) {
  let url = `${BASE_URL}/api/feed/main?limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (engagedIds.length > 0) url += `&engaged_ids=${engagedIds.join(",")}`;
  if (skippedIds.length > 0) url += `&skipped_ids=${skippedIds.join(",")}`;
  if (seenIds.length > 0) url += `&seen_ids=${seenIds.slice(-300).join(",")}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    console.log("  API error:", resp.status, await resp.text().catch(() => ""));
    return { articles: [], next_cursor: null, has_more: false };
  }
  return resp.json();
}

async function runPersonaTest(persona, personaIndex) {
  console.log(`\n${"=".repeat(90)}`);
  console.log(`${persona.emoji}  PERSONA ${personaIndex + 1}: ${persona.name}`);
  console.log(`   Primary: ${persona.primary.slice(0, 6).join(", ")}...`);
  console.log(`   Secondary: ${persona.secondary.slice(0, 5).join(", ")}...`);
  console.log(`   Avoids: ${persona.avoids.slice(0, 5).join(", ")}...`);
  console.log(`${"=".repeat(90)}`);

  const engagedIds = [];
  const skippedIds = [];
  const seenIds = [];
  let cursor = null;

  const stats = {
    totalSeen: 0,
    engaged: 0,
    sourceClicked: 0,
    skipped: 0,
    glanced: 0,
    totalDwell: 0,
    byPage: [],
    categoryBreakdown: {},
    tierBreakdown: { primary_strong: 0, primary: 0, secondary_strong: 0, secondary: 0, curiosity: 0, category_related: 0, category_only: 0, avoid: 0, mild_avoid: 0, irrelevant: 0 },
    engagedByTier: {},
    topEngagedArticles: [],
    engagementByPage: [],
    bucketBreakdown: {},
    engagedByBucket: {},
    consecutiveSkips: 0,
    maxConsecutiveSkips: 0,
    contentExhaustedAt: null,
    avoidArticlesShown: [], // track articles from avoid list shown
    topicFatigueEvents: 0,
    entityDistribution: {},
  };

  // Track recent topic tags for fatigue detection
  const recentTopicWindow = []; // rolling window of engaged article tags
  const FATIGUE_WINDOW = 15; // last 15 engaged tags

  let consecutiveBoringPages = 0;
  const MAX_PAGES = 5; // 5 pages = 100 articles, realistic session
  const MAX_BORING_PAGES = 3;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const feedData = await fetchFeedPage(engagedIds, skippedIds, seenIds, cursor);
    const articles = feedData.articles || [];

    if (articles.length === 0) {
      console.log(`\n  No more articles available`);
      stats.contentExhaustedAt = page;
      break;
    }

    cursor = feedData.next_cursor;

    let pageEngaged = 0;
    let pageSkipped = 0;
    let pageGlanced = 0;
    let pageSourceClicked = 0;
    let pageDwell = 0;
    const pageCategories = {};
    const pageBuckets = {};
    const pageTiers = {};

    for (const article of articles) {
      const reaction = simulateReaction(article, persona, recentTopicWindow);
      const articleId = article.id;
      seenIds.push(articleId);
      stats.totalSeen++;

      const cat = article.category || "Other";
      stats.categoryBreakdown[cat] = (stats.categoryBreakdown[cat] || 0) + 1;
      pageCategories[cat] = (pageCategories[cat] || 0) + 1;

      const bucket = article.bucket || "unknown";
      stats.bucketBreakdown[bucket] = (stats.bucketBreakdown[bucket] || 0) + 1;
      pageBuckets[bucket] = (pageBuckets[bucket] || 0) + 1;

      // Track tier
      stats.tierBreakdown[reaction.tier] = (stats.tierBreakdown[reaction.tier] || 0) + 1;
      pageTiers[reaction.tier] = (pageTiers[reaction.tier] || 0) + 1;

      // Track top entities shown
      const tags = (typeof article.interest_tags === "string"
        ? JSON.parse(article.interest_tags || "[]")
        : article.interest_tags || []
      );
      for (const tag of tags.slice(0, 3)) {
        const t = tag.toLowerCase();
        stats.entityDistribution[t] = (stats.entityDistribution[t] || 0) + 1;
      }

      // Track avoids
      if (reaction.tier === "avoid" || reaction.tier === "mild_avoid") {
        stats.avoidArticlesShown.push({
          page,
          title: (article.title_news || "").substring(0, 50),
          category: cat,
          tier: reaction.tier,
        });
      }

      if (reaction.action === "source_click") {
        engagedIds.push(articleId);
        stats.sourceClicked++;
        pageSourceClicked++;
        stats.engaged++;
        pageEngaged++;
        stats.engagedByBucket[bucket] = (stats.engagedByBucket[bucket] || 0) + 1;
        stats.engagedByTier[reaction.tier] = (stats.engagedByTier[reaction.tier] || 0) + 1;
        stats.consecutiveSkips = 0;
        // Update fatigue window
        for (const tag of tags.slice(0, 3)) {
          recentTopicWindow.push(tag.toLowerCase());
        }
        while (recentTopicWindow.length > FATIGUE_WINDOW) recentTopicWindow.shift();
        stats.topEngagedArticles.push({
          page, title: (article.title_news || "").substring(0, 55),
          category: cat, bucket, tier: reaction.tier, score: reaction.score, action: "SRC_CLICK",
        });
      } else if (reaction.action === "engaged") {
        engagedIds.push(articleId);
        stats.engaged++;
        pageEngaged++;
        stats.engagedByBucket[bucket] = (stats.engagedByBucket[bucket] || 0) + 1;
        stats.engagedByTier[reaction.tier] = (stats.engagedByTier[reaction.tier] || 0) + 1;
        stats.consecutiveSkips = 0;
        for (const tag of tags.slice(0, 3)) {
          recentTopicWindow.push(tag.toLowerCase());
        }
        while (recentTopicWindow.length > FATIGUE_WINDOW) recentTopicWindow.shift();
        if (reaction.score >= 3) {
          stats.topEngagedArticles.push({
            page, title: (article.title_news || "").substring(0, 55),
            category: cat, bucket, tier: reaction.tier, score: reaction.score, action: "ENGAGED",
          });
        }
      } else if (reaction.action === "glance") {
        stats.glanced++;
        pageGlanced++;
        stats.consecutiveSkips = 0;
      } else {
        skippedIds.push(articleId);
        stats.skipped++;
        pageSkipped++;
        stats.consecutiveSkips++;
        stats.maxConsecutiveSkips = Math.max(stats.maxConsecutiveSkips, stats.consecutiveSkips);
      }

      stats.totalDwell += reaction.dwell;
      pageDwell += reaction.dwell;
    }

    const pageEngRate = articles.length > 0 ? ((pageEngaged + pageSourceClicked) / articles.length * 100) : 0;
    stats.engagementByPage.push(pageEngRate);
    stats.byPage.push({
      page, articles: articles.length, engaged: pageEngaged, sourceClicked: pageSourceClicked,
      skipped: pageSkipped, glanced: pageGlanced, engRate: pageEngRate.toFixed(1),
    });

    // Print page summary
    const catStr = Object.entries(pageCategories).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${c}:${n}`).join(" ");
    const bucketStr = Object.entries(pageBuckets).sort((a,b)=>b[1]-a[1]).map(([b,n])=>`${b}:${n}`).join(" ");
    const tierStr = Object.entries(pageTiers).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([t,n])=>`${t}:${n}`).join(" ");
    console.log(`  P${String(page).padStart(2)}: ${articles.length} art | ` +
      `E:${pageEngaged} S:${pageSkipped} G:${pageGlanced} | ` +
      `${pageEngRate.toFixed(0)}% eng | ` +
      `[${bucketStr}] | ${catStr} | ${tierStr}`);

    // Stop conditions
    if (pageEngaged + pageSourceClicked === 0) {
      consecutiveBoringPages++;
      if (consecutiveBoringPages >= MAX_BORING_PAGES) {
        console.log(`  !! ${MAX_BORING_PAGES} boring pages in a row — user leaves`);
        stats.contentExhaustedAt = page;
        break;
      }
    } else {
      consecutiveBoringPages = 0;
    }

    if (!feedData.has_more) {
      stats.contentExhaustedAt = page;
      break;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // Print persona summary
  const overallEngRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
  const avgDwell = stats.totalSeen > 0 ? (stats.totalDwell / stats.totalSeen) : 0;

  console.log(`\n  ── ${persona.name} Summary ──`);
  console.log(`  Seen: ${stats.totalSeen} | Engaged: ${stats.engaged} (${overallEngRate.toFixed(1)}%) | Skipped: ${stats.skipped} | Glanced: ${stats.glanced}`);
  console.log(`  Avg dwell: ${avgDwell.toFixed(1)}s | Max consecutive skips: ${stats.maxConsecutiveSkips}`);

  // Tier breakdown
  const tiers = Object.entries(stats.tierBreakdown).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
  console.log(`  Match tiers: ${tiers.map(([t,n])=>`${t}:${n}`).join(", ")}`);

  // Top entities shown
  const topEntities = Object.entries(stats.entityDistribution).sort((a,b)=>b[1]-a[1]).slice(0,8);
  console.log(`  Top entities: ${topEntities.map(([e,n])=>`${e}(${n})`).join(", ")}`);

  // Avoid violations
  if (stats.avoidArticlesShown.length > 0) {
    console.log(`  !! Avoid violations: ${stats.avoidArticlesShown.length} articles from avoid list shown`);
  }

  if (stats.topEngagedArticles.length > 0) {
    console.log(`  Top engaged:`);
    for (const a of stats.topEngagedArticles.slice(0, 5)) {
      console.log(`    p${a.page} [${a.tier}] "${a.title}"`);
    }
  }

  // Engagement trend
  const rates = stats.engagementByPage;
  if (rates.length >= 4) {
    const firstHalf = rates.slice(0, Math.ceil(rates.length/2));
    const secondHalf = rates.slice(Math.ceil(rates.length/2));
    const first = firstHalf.reduce((s,v)=>s+v,0) / firstHalf.length;
    const second = secondHalf.reduce((s,v)=>s+v,0) / secondHalf.length;
    const trend = second - first;
    console.log(`  Trend: ${first.toFixed(1)}% → ${second.toFixed(1)}% (${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%)`);
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════
// SCORING: Convert engagement rate to 1-10 rating
// ═══════════════════════════════════════════════════════════════

function engRateToRating(engRate, avoidViolations, totalSeen) {
  // Base rating from engagement
  let rating;
  if (engRate >= 50) rating = 9;
  else if (engRate >= 40) rating = 8;
  else if (engRate >= 30) rating = 7;
  else if (engRate >= 22) rating = 6;
  else if (engRate >= 15) rating = 5;
  else if (engRate >= 10) rating = 4;
  else if (engRate >= 5) rating = 3;
  else rating = 2;

  // Penalty for showing avoided content
  const avoidRate = totalSeen > 0 ? (avoidViolations / totalSeen * 100) : 0;
  if (avoidRate > 30) rating -= 2;
  else if (avoidRate > 15) rating -= 1;

  return Math.max(1, Math.min(10, rating));
}

async function main() {
  console.log("V15 ALGORITHM TEST — 10 REALISTIC PERSONAS");
  console.log("=".repeat(90));
  console.log("Fixes tested: entity cap, normalized pools, embedding MMR, entity bandit, proper Beta");
  console.log("Test: 5 pages (100 articles) per persona, cold-start (no user_id)");
  console.log("=".repeat(90));

  const allStats = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const stats = await runPersonaTest(PERSONAS[i], i);
    allStats.push({ persona: PERSONAS[i], stats });
  }

  // ═══════════════════════════════════════════════════════════════
  // GRAND SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log("\n\n" + "=".repeat(90));
  console.log("GRAND SUMMARY — V15 TEST RESULTS");
  console.log("=".repeat(90));

  console.log("\n+-----------------------+------+------+--------+--------+---------+--------+--------+");
  console.log("| Persona               | Seen | Eng  | EngRate| AvgDwl | Avoids  | Rating | Grade  |");
  console.log("+-----------------------+------+------+--------+--------+---------+--------+--------+");

  let totalRating = 0;
  const ratings = [];

  for (const { persona, stats } of allStats) {
    const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
    const avgDwell = stats.totalSeen > 0 ? (stats.totalDwell / stats.totalSeen) : 0;
    const avoidCount = stats.avoidArticlesShown.length;
    const rating = engRateToRating(engRate, avoidCount, stats.totalSeen);
    ratings.push(rating);
    totalRating += rating;

    const grade = rating >= 8 ? "A" : rating >= 6 ? "B" : rating >= 5 ? "C" : rating >= 3 ? "D" : "F";
    const name = `${persona.emoji} ${persona.name}`.substring(0, 21).padEnd(21);

    console.log(`| ${name} | ${String(stats.totalSeen).padStart(4)} | ${String(stats.engaged).padStart(4)} | ${engRate.toFixed(1).padStart(5)}% | ${avgDwell.toFixed(1).padStart(5)}s | ${String(avoidCount).padStart(7)} | ${String(rating).padStart(4)}/10 | ${grade.padStart(6)} |`);
  }

  const avgRating = totalRating / PERSONAS.length;
  console.log("+-----------------------+------+------+--------+--------+---------+--------+--------+");
  console.log(`| AVERAGE               |      |      |        |        |         | ${avgRating.toFixed(1).padStart(4)}/10 |        |`);
  console.log("+-----------------------+------+------+--------+--------+---------+--------+--------+");

  // Rating comparison table
  console.log("\nRating Summary:");
  for (const { persona, stats } of allStats) {
    const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
    const rating = engRateToRating(engRate, stats.avoidArticlesShown.length, stats.totalSeen);
    const bar = "#".repeat(rating) + ".".repeat(10 - rating);
    console.log(`  ${persona.emoji} ${persona.name.padEnd(35)} [${bar}] ${rating}/10`);
  }

  console.log(`\nAverage Rating: ${avgRating.toFixed(1)}/10`);

  // Category diversity analysis
  console.log("\nCategory Distribution Per Persona:");
  for (const { persona, stats } of allStats) {
    const cats = Object.entries(stats.categoryBreakdown).sort((a,b) => b[1]-a[1]);
    const total = stats.totalSeen || 1;
    const catStr = cats.slice(0,5).map(([c, n]) => `${c}:${(n/total*100).toFixed(0)}%`).join(" ");
    console.log(`  ${persona.emoji} ${persona.name.substring(0,25).padEnd(25)}: ${catStr}`);
  }

  // Top entity flooding check
  console.log("\nEntity Flooding Check (top entity % of feed per persona):");
  for (const { persona, stats } of allStats) {
    const topEntities = Object.entries(stats.entityDistribution).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const total = stats.totalSeen || 1;
    const entStr = topEntities.map(([e,n]) => `${e}:${(n/total*100).toFixed(0)}%`).join(" ");
    console.log(`  ${persona.emoji} ${persona.name.substring(0,25).padEnd(25)}: ${entStr}`);
  }
}

main().catch(console.error);
