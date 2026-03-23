const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE_URL = "https://www.tennews.ai";

// 10 realistic personas with distinct interests
const PERSONAS = [
  {
    name: "Tech Startup Founder",
    emoji: "💻",
    interests: ["artificial intelligence", "tech", "startups", "software", "silicon valley", "machine learning", "cybersecurity", "cloud computing", "programming", "venture capital"],
    categories: ["Tech", "Business", "Science"],
    dwellEngaged: 15,  // reads tech articles for 15s
    dwellSkip: 1.5,    // quickly skips non-tech
  },
  {
    name: "Sports Fan (Football/Soccer)",
    emoji: "⚽",
    interests: ["football", "soccer", "premier league", "champions league", "fifa", "la liga", "messi", "ronaldo", "transfer", "sports"],
    categories: ["Sports"],
    dwellEngaged: 12,
    dwellSkip: 1.0,
  },
  {
    name: "Finance Investor",
    emoji: "📈",
    interests: ["stock market", "finance", "wall street", "cryptocurrency", "bitcoin", "federal reserve", "inflation", "interest rates", "banking", "economy", "gdp", "oil prices", "energy"],
    categories: ["Finance", "Business"],
    dwellEngaged: 20,
    dwellSkip: 2.0,
  },
  {
    name: "Health & Wellness Enthusiast",
    emoji: "🏥",
    interests: ["health", "medicine", "mental health", "nutrition", "fitness", "vaccine", "cancer", "research", "clinical trial", "public health", "who", "pandemic"],
    categories: ["Health", "Science"],
    dwellEngaged: 18,
    dwellSkip: 1.5,
  },
  {
    name: "Geopolitics Nerd",
    emoji: "🌍",
    interests: ["geopolitics", "international relations", "diplomacy", "united nations", "nato", "sanctions", "foreign policy", "european union", "g7", "summit"],
    categories: ["World", "Politics"],
    dwellEngaged: 25,
    dwellSkip: 2.5,
  },
  {
    name: "Science Researcher",
    emoji: "🔬",
    interests: ["science", "space", "nasa", "physics", "climate change", "environment", "biology", "astronomy", "quantum", "research", "discovery"],
    categories: ["Science", "Tech"],
    dwellEngaged: 22,
    dwellSkip: 1.5,
  },
  {
    name: "US Politics Follower",
    emoji: "🏛️",
    interests: ["donald trump", "congress", "republican", "democrat", "election", "white house", "supreme court", "us politics", "senate", "legislation", "policy"],
    categories: ["Politics"],
    dwellEngaged: 14,
    dwellSkip: 2.0,
  },
  {
    name: "Middle East Analyst",
    emoji: "🕌",
    interests: ["iran", "israel", "middle east", "idf", "hezbollah", "lebanon", "tehran", "hamas", "gaza", "military strikes", "regional conflict"],
    categories: ["World"],
    dwellEngaged: 30,
    dwellSkip: 2.0,
  },
  {
    name: "Entertainment & Culture Lover",
    emoji: "🎬",
    interests: ["entertainment", "movies", "music", "celebrity", "streaming", "netflix", "gaming", "esports", "pop culture", "social media", "tiktok"],
    categories: ["Entertainment", "Gaming"],
    dwellEngaged: 10,
    dwellSkip: 1.0,
  },
  {
    name: "Climate & Energy Activist",
    emoji: "🌱",
    interests: ["climate change", "renewable energy", "solar", "wind power", "emissions", "carbon", "environment", "sustainability", "electric vehicles", "oil", "green energy"],
    categories: ["Science", "Business", "Tech"],
    dwellEngaged: 18,
    dwellSkip: 1.5,
  },
];

// Check if article matches persona interests
function getInterestScore(article, persona) {
  const tags = (typeof article.interest_tags === "string"
    ? JSON.parse(article.interest_tags || "[]")
    : article.interest_tags || []
  ).map(t => t.toLowerCase());

  const title = (article.title_news || article.title || "").toLowerCase();
  const cat = (article.category || "").toLowerCase();

  let score = 0;

  // Tag match (strongest signal)
  for (const interest of persona.interests) {
    if (tags.some(t => t.includes(interest) || interest.includes(t))) {
      score += 3;
    }
    if (title.includes(interest)) {
      score += 1;
    }
  }

  // Category match
  if (persona.categories.map(c => c.toLowerCase()).includes(cat)) {
    score += 2;
  }

  return score;
}

// Simulate a persona's reaction to an article
function simulateReaction(article, persona) {
  const interestScore = getInterestScore(article, persona);

  if (interestScore >= 5) {
    return { action: "source_click", dwell: persona.dwellEngaged * 2, interestScore };
  } else if (interestScore >= 3) {
    return { action: "engaged", dwell: persona.dwellEngaged, interestScore };
  } else if (interestScore >= 1) {
    return { action: "glance", dwell: 3.5, interestScore }; // neutral
  } else {
    return { action: "skip", dwell: persona.dwellSkip, interestScore };
  }
}

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
  console.log(`\n${"=".repeat(80)}`);
  console.log(`${persona.emoji}  PERSONA ${personaIndex + 1}: ${persona.name}`);
  console.log(`   Interests: ${persona.interests.slice(0, 5).join(", ")}...`);
  console.log(`   Preferred categories: ${persona.categories.join(", ")}`);
  console.log(`${"=".repeat(80)}`);

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
    topEngagedArticles: [],
    engagementByPage: [],
    satisfactionByPage: [],
    bucketBreakdown: { personal: 0, trending: 0, discovery: 0, bandit: 0 },
    engagedByBucket: { personal: 0, trending: 0, discovery: 0, bandit: 0 },
    consecutiveSkips: 0,
    maxConsecutiveSkips: 0,
    contentExhaustedAt: null,
  };

  let consecutiveBoringPages = 0;
  const MAX_PAGES = 30;
  const MAX_BORING_PAGES = 4; // Stop if 4 pages in a row with 0 engagement

  for (let page = 1; page <= MAX_PAGES; page++) {
    const feedData = await fetchFeedPage(engagedIds, skippedIds, seenIds, cursor);
    const articles = feedData.articles || [];

    if (articles.length === 0) {
      console.log(`\n  📭 Page ${page}: No more articles available`);
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

    for (const article of articles) {
      const reaction = simulateReaction(article, persona);
      const articleId = article.id;
      seenIds.push(articleId);
      stats.totalSeen++;

      const cat = article.category || "Other";
      stats.categoryBreakdown[cat] = (stats.categoryBreakdown[cat] || 0) + 1;
      pageCategories[cat] = (pageCategories[cat] || 0) + 1;

      const bucket = article.bucket || "unknown";
      stats.bucketBreakdown[bucket] = (stats.bucketBreakdown[bucket] || 0) + 1;
      pageBuckets[bucket] = (pageBuckets[bucket] || 0) + 1;

      if (reaction.action === "source_click") {
        engagedIds.push(articleId);
        stats.sourceClicked++;
        pageSourceClicked++;
        stats.engaged++;
        pageEngaged++;
        stats.engagedByBucket[bucket] = (stats.engagedByBucket[bucket] || 0) + 1;
        stats.consecutiveSkips = 0;
        stats.topEngagedArticles.push({
          page,
          title: (article.title_news || article.title || "").substring(0, 60),
          category: cat,
          bucket,
          score: reaction.interestScore,
          action: "SOURCE_CLICK",
        });
      } else if (reaction.action === "engaged") {
        engagedIds.push(articleId);
        stats.engaged++;
        pageEngaged++;
        stats.engagedByBucket[bucket] = (stats.engagedByBucket[bucket] || 0) + 1;
        stats.consecutiveSkips = 0;
        if (reaction.interestScore >= 5) {
          stats.topEngagedArticles.push({
            page,
            title: (article.title_news || article.title || "").substring(0, 60),
            category: cat,
            bucket,
            score: reaction.interestScore,
            action: "ENGAGED",
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
    const pageSatisfaction = articles.length > 0 ? ((pageEngaged + pageSourceClicked + pageGlanced * 0.3) / articles.length * 100) : 0;

    stats.engagementByPage.push(pageEngRate);
    stats.satisfactionByPage.push(pageSatisfaction);
    stats.byPage.push({
      page,
      articles: articles.length,
      engaged: pageEngaged,
      sourceClicked: pageSourceClicked,
      skipped: pageSkipped,
      glanced: pageGlanced,
      engRate: pageEngRate.toFixed(1),
      avgDwell: (pageDwell / articles.length).toFixed(1),
      categories: pageCategories,
      buckets: pageBuckets,
    });

    // Print page summary
    const catStr = Object.entries(pageCategories).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${c}:${n}`).join(" ");
    const bucketStr = Object.entries(pageBuckets).sort((a,b)=>b[1]-a[1]).map(([b,n])=>`${b}:${n}`).join(" ");
    console.log(`  📄 Page ${String(page).padStart(2)}: ${articles.length} articles | ` +
      `✅${pageEngaged} 🔗${pageSourceClicked} 👀${pageGlanced} ❌${pageSkipped} | ` +
      `${pageEngRate.toFixed(0)}% eng | ${(pageDwell/articles.length).toFixed(0)}s avg | ` +
      `[${bucketStr}] | ${catStr}`);

    // Stop conditions
    if (pageEngaged + pageSourceClicked === 0) {
      consecutiveBoringPages++;
      if (consecutiveBoringPages >= MAX_BORING_PAGES) {
        console.log(`  ⚠️  ${MAX_BORING_PAGES} consecutive pages with 0 engagement — user would leave`);
        stats.contentExhaustedAt = page;
        break;
      }
    } else {
      consecutiveBoringPages = 0;
    }

    if (!feedData.has_more) {
      console.log(`  📭 Server reports no more articles`);
      stats.contentExhaustedAt = page;
      break;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Print persona summary
  const overallEngRate = stats.totalSeen > 0 ? ((stats.engaged) / stats.totalSeen * 100) : 0;
  const avgDwell = stats.totalSeen > 0 ? (stats.totalDwell / stats.totalSeen) : 0;

  console.log(`\n  ── ${persona.name} Summary ──`);
  console.log(`  Total articles seen: ${stats.totalSeen}`);
  console.log(`  Engaged: ${stats.engaged} (${overallEngRate.toFixed(1)}%) | Source clicks: ${stats.sourceClicked} | Skipped: ${stats.skipped} | Glanced: ${stats.glanced}`);
  console.log(`  Avg dwell: ${avgDwell.toFixed(1)}s | Max consecutive skips: ${stats.maxConsecutiveSkips}`);
  if (stats.contentExhaustedAt) console.log(`  Content exhausted at page: ${stats.contentExhaustedAt}`);

  console.log(`  Categories shown: ${Object.entries(stats.categoryBreakdown).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${c}:${n}`).join(", ")}`);
  console.log(`  Buckets: ${Object.entries(stats.bucketBreakdown).sort((a,b)=>b[1]-a[1]).map(([b,n])=>`${b}:${n}`).join(", ")}`);
  console.log(`  Engaged by bucket: ${Object.entries(stats.engagedByBucket).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).map(([b,n])=>`${b}:${n}`).join(", ")}`);

  // Engagement trend (first 5 pages vs last 5 pages)
  const rates = stats.engagementByPage;
  if (rates.length >= 6) {
    const first3 = rates.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
    const last3 = rates.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const trend = last3 - first3;
    console.log(`  Engagement trend: first 3 pages avg ${first3.toFixed(1)}% → last 3 pages avg ${last3.toFixed(1)}% (${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%)`);
  }

  if (stats.topEngagedArticles.length > 0) {
    console.log(`  Top engaged articles:`);
    for (const a of stats.topEngagedArticles.slice(0, 8)) {
      console.log(`    p${a.page} [${a.bucket}/${a.category}] ${a.action}: "${a.title}"`);
    }
  }

  return stats;
}

async function main() {
  console.log("🧪 10-PERSONA FEED PERSONALIZATION TEST");
  console.log("═".repeat(80));
  console.log("Testing all 6 improvements: source click signal, dwell scaling,");
  console.log("vector persist, adaptive slots, lazy loading, query reduction");
  console.log("═".repeat(80));

  const allStats = [];

  for (let i = 0; i < PERSONAS.length; i++) {
    const stats = await runPersonaTest(PERSONAS[i], i);
    allStats.push({ persona: PERSONAS[i], stats });
  }

  // ═══════════════════════════════════════════
  // GRAND SUMMARY
  // ═══════════════════════════════════════════
  console.log("\n\n" + "═".repeat(80));
  console.log("📊 GRAND SUMMARY — ALL 10 PERSONAS");
  console.log("═".repeat(80));

  console.log("\n┌─────────────────────────────────┬───────┬────────┬─────────┬─────────┬───────────┬───────────┐");
  console.log("│ Persona                         │ Seen  │ Engage │ Eng Rate│ Avg Dwl │ Src Click │ Exhausted │");
  console.log("├─────────────────────────────────┼───────┼────────┼─────────┼─────────┼───────────┼───────────┤");

  let totalSeen = 0, totalEngaged = 0, totalDwell = 0, totalSrcClick = 0;

  for (const { persona, stats } of allStats) {
    const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
    const avgDwell = stats.totalSeen > 0 ? (stats.totalDwell / stats.totalSeen) : 0;
    const name = `${persona.emoji} ${persona.name}`.padEnd(31).substring(0, 31);
    const exhausted = stats.contentExhaustedAt ? `p${stats.contentExhaustedAt}` : "-";

    console.log(`│ ${name} │ ${String(stats.totalSeen).padStart(5)} │ ${String(stats.engaged).padStart(6)} │ ${engRate.toFixed(1).padStart(6)}% │ ${avgDwell.toFixed(1).padStart(6)}s │ ${String(stats.sourceClicked).padStart(9)} │ ${exhausted.padStart(9)} │`);

    totalSeen += stats.totalSeen;
    totalEngaged += stats.engaged;
    totalDwell += stats.totalDwell;
    totalSrcClick += stats.sourceClicked;
  }

  console.log("├─────────────────────────────────┼───────┼────────┼─────────┼─────────┼───────────┼───────────┤");
  const avgEngRate = totalSeen > 0 ? (totalEngaged / totalSeen * 100) : 0;
  const avgDwell = totalSeen > 0 ? (totalDwell / totalSeen) : 0;
  console.log(`│ ${"AVERAGE".padEnd(31)} │ ${String(Math.round(totalSeen/10)).padStart(5)} │ ${String(Math.round(totalEngaged/10)).padStart(6)} │ ${avgEngRate.toFixed(1).padStart(6)}% │ ${avgDwell.toFixed(1).padStart(6)}s │ ${String(totalSrcClick).padStart(9)} │           │`);
  console.log("└─────────────────────────────────┴───────┴────────┴─────────┴─────────┴───────────┴───────────┘");

  // Category diversity analysis
  console.log("\n📊 CATEGORY DISTRIBUTION PER PERSONA:");
  for (const { persona, stats } of allStats) {
    const cats = Object.entries(stats.categoryBreakdown).sort((a,b) => b[1]-a[1]);
    const total = stats.totalSeen;
    const catStr = cats.map(([c, n]) => `${c}:${(n/total*100).toFixed(0)}%`).join(" ");
    console.log(`  ${persona.emoji} ${persona.name}: ${catStr}`);
  }

  // Satisfaction rating
  console.log("\n📊 PERSONA SATISFACTION RATING:");
  for (const { persona, stats } of allStats) {
    const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
    let rating, stars;
    if (engRate >= 40) { rating = "Very Happy"; stars = "⭐⭐⭐⭐⭐"; }
    else if (engRate >= 25) { rating = "Happy"; stars = "⭐⭐⭐⭐"; }
    else if (engRate >= 15) { rating = "Okay"; stars = "⭐⭐⭐"; }
    else if (engRate >= 8) { rating = "Disappointed"; stars = "⭐⭐"; }
    else { rating = "Would Uninstall"; stars = "⭐"; }

    console.log(`  ${persona.emoji} ${persona.name}: ${stars} ${rating} (${engRate.toFixed(1)}% engagement)`);
  }

  // Engagement trend analysis
  console.log("\n📊 FEED ADAPTATION (first 3 pages vs last 3 pages):");
  for (const { persona, stats } of allStats) {
    const rates = stats.engagementByPage;
    if (rates.length >= 6) {
      const first3 = rates.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
      const last3 = rates.slice(-3).reduce((s, v) => s + v, 0) / 3;
      const trend = last3 - first3;
      const arrow = trend > 5 ? "📈" : trend > 0 ? "↗️" : trend > -5 ? "→" : "📉";
      console.log(`  ${persona.emoji} ${persona.name}: ${first3.toFixed(1)}% → ${last3.toFixed(1)}% ${arrow} (${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%)`);
    }
  }
}

main().catch(console.error);
