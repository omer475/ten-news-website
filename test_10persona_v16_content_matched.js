const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE_URL = "https://www.tennews.ai";

// ═══════════════════════════════════════════════════════════════
// CONTENT-MATCHED PERSONAS
// These personas' interests are built from ACTUAL content in the DB.
// If scores are still low, problem is algorithm. If high, problem was content coverage.
// ═══════════════════════════════════════════════════════════════

const PERSONAS = [
  {
    name: "Amir — Iran & Middle East Hawk",
    emoji: "🕊️",
    primary: ["iran", "strait of hormuz", "tehran", "hezbollah", "lebanon", "saudi arabia", "idf", "iran war", "middle east conflict"],
    secondary: ["israel", "united states", "military", "war", "nato", "oil prices", "defense"],
    curiosity: ["russia", "china", "european union", "stock market"],
    avoids: ["gaming", "playstation", "anime", "k-pop", "cricket", "fashion"],
    categories: ["World", "Politics"],
    dwellProfile: { primary: 25, secondary: 15, curiosity: 5, skip: 1.0 },
    fatigueThreshold: 6,
  },
  {
    name: "Jake — US Politics Junkie",
    emoji: "🇺🇸",
    primary: ["donald trump", "congress", "supreme court", "republican", "democrat", "white house", "senate", "legislation", "marco rubio", "immigration"],
    secondary: ["government shutdown", "department of homeland security", "national security", "election", "policy"],
    curiosity: ["iran", "china", "nato", "stock market", "spacex"],
    avoids: ["gaming", "k-pop", "anime", "cricket", "fashion", "yoga"],
    categories: ["Politics"],
    dwellProfile: { primary: 20, secondary: 14, curiosity: 5, skip: 1.5 },
    fatigueThreshold: 5,
  },
  {
    name: "Olena — Ukraine & Russia Watcher",
    emoji: "🇺🇦",
    primary: ["ukraine", "russia", "volodymyr zelenskyy", "vladimir putin", "ukraine war", "crimea", "kyiv", "donbas"],
    secondary: ["nato", "european union", "germany", "france", "sanctions", "diplomacy", "g7"],
    curiosity: ["iran", "china", "united nations", "human rights", "war crimes"],
    avoids: ["gaming", "cricket", "k-pop", "fashion", "bitcoin", "nfl"],
    categories: ["World", "Politics"],
    dwellProfile: { primary: 25, secondary: 16, curiosity: 6, skip: 1.0 },
    fatigueThreshold: 5,
  },
  {
    name: "Priya — AI & Tech Insider",
    emoji: "🤖",
    primary: ["artificial intelligence", "meta", "apple", "google", "cybersecurity", "social media", "machine learning", "openai", "chatgpt"],
    secondary: ["consumer electronics", "drones", "electric vehicles", "spacex", "tesla"],
    curiosity: ["cryptocurrency", "bitcoin", "stock market", "climate change"],
    avoids: ["iran", "military", "war", "hezbollah", "cricket", "nfl", "soccer"],
    categories: ["Tech"],
    dwellProfile: { primary: 18, secondary: 12, curiosity: 5, skip: 1.2 },
    fatigueThreshold: 5,
  },
  {
    name: "Marcus — NFL & American Sports",
    emoji: "🏈",
    primary: ["nfl", "american football", "quarterback", "super bowl", "touchdown", "wide receiver", "nfl draft", "nfl trade"],
    secondary: ["nba", "basketball", "soccer", "champions league", "sports"],
    curiosity: ["stock market", "bitcoin", "apple", "spacex"],
    avoids: ["iran", "ukraine", "politics", "hezbollah", "climate change", "fashion", "k-pop"],
    categories: ["Sports"],
    dwellProfile: { primary: 16, secondary: 10, curiosity: 5, skip: 1.0 },
    fatigueThreshold: 6,
  },
  {
    name: "Linda — Markets & Crypto",
    emoji: "📈",
    primary: ["stock market", "oil prices", "inflation", "bitcoin", "cryptocurrency", "finance", "economics", "trade", "economy"],
    secondary: ["energy", "oil", "sanctions", "china", "european union", "business"],
    curiosity: ["artificial intelligence", "electric vehicles", "spacex"],
    avoids: ["gaming", "anime", "k-pop", "fashion", "yoga", "cricket"],
    categories: ["Finance", "Business"],
    dwellProfile: { primary: 20, secondary: 14, curiosity: 5, skip: 1.5 },
    fatigueThreshold: 5,
  },
  {
    name: "Neil — Space & Science Nerd",
    emoji: "🚀",
    primary: ["nasa", "space exploration", "astronomy", "moon", "mars", "spacex", "rocket", "satellite", "artemis"],
    secondary: ["climate change", "renewable energy", "electric vehicles", "physics", "science"],
    curiosity: ["artificial intelligence", "google", "apple", "drones"],
    avoids: ["iran", "trump", "politics", "military", "war", "soccer", "nfl", "fashion"],
    categories: ["Science", "Tech"],
    dwellProfile: { primary: 22, secondary: 14, curiosity: 5, skip: 1.0 },
    fatigueThreshold: 4,
  },
  {
    name: "Greta — Climate & Green Energy",
    emoji: "🌱",
    primary: ["climate change", "renewable energy", "electric vehicles", "oil", "energy", "emissions", "carbon", "environment", "sustainability"],
    secondary: ["european union", "china", "germany", "united nations", "g7", "trade"],
    curiosity: ["spacex", "nasa", "artificial intelligence", "tesla"],
    avoids: ["gaming", "anime", "k-pop", "nfl", "cricket", "fashion", "bitcoin"],
    categories: ["Science", "Business"],
    dwellProfile: { primary: 20, secondary: 14, curiosity: 5, skip: 1.5 },
    fatigueThreshold: 4,
  },
  {
    name: "Hans — EU & European Politics",
    emoji: "🇪🇺",
    primary: ["european union", "germany", "friedrich merz", "france", "nato", "spain", "united kingdom", "europe", "brexit"],
    secondary: ["diplomacy", "trade", "sanctions", "g7", "immigration", "human rights"],
    curiosity: ["iran", "ukraine", "china", "climate change"],
    avoids: ["gaming", "anime", "k-pop", "nfl", "cricket", "fashion", "bitcoin"],
    categories: ["Politics", "World"],
    dwellProfile: { primary: 22, secondary: 14, curiosity: 6, skip: 1.0 },
    fatigueThreshold: 4,
  },
  {
    name: "Wei — China & Asia Geopolitics",
    emoji: "🇨🇳",
    primary: ["china", "india", "japan", "trade", "south china sea", "taiwan", "xi jinping", "asia"],
    secondary: ["united states", "sanctions", "diplomacy", "economy", "technology", "semiconductor"],
    curiosity: ["artificial intelligence", "spacex", "electric vehicles", "stock market"],
    avoids: ["gaming", "anime", "k-pop", "nfl", "cricket", "fashion", "yoga"],
    categories: ["World", "Business", "Politics"],
    dwellProfile: { primary: 22, secondary: 14, curiosity: 5, skip: 1.0 },
    fatigueThreshold: 5,
  },
];

// ═══════════════════════════════════════════════════════════════
// INTEREST SCORING (same as v15 test)
// ═══════════════════════════════════════════════════════════════

const safeParseJson = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
};

function getInterestTier(article, persona) {
  const tags = safeParseJson(article.interest_tags).map(t => t.toLowerCase());
  const title = (article.title_news || article.title || "").toLowerCase();
  const cat = (article.category || "").toLowerCase();

  let avoidHits = 0;
  for (const term of persona.avoids) {
    if (tags.some(t => t.includes(term) || term.includes(t))) avoidHits++;
    if (title.includes(term)) avoidHits++;
  }
  if (avoidHits >= 2) return { tier: "avoid", score: -avoidHits };

  let primaryHits = 0;
  for (const term of persona.primary) {
    if (tags.some(t => t.includes(term) || term.includes(t))) primaryHits += 2;
    if (title.includes(term)) primaryHits += 1;
  }
  let secondaryHits = 0;
  for (const term of persona.secondary) {
    if (tags.some(t => t.includes(term) || term.includes(t))) secondaryHits += 2;
    if (title.includes(term)) secondaryHits += 1;
  }
  let curiosityHits = 0;
  for (const term of persona.curiosity) {
    if (tags.some(t => t.includes(term) || term.includes(t))) curiosityHits += 2;
    if (title.includes(term)) curiosityHits += 1;
  }

  const catMatch = persona.categories.map(c => c.toLowerCase()).includes(cat);

  if (primaryHits >= 4) return { tier: "primary_strong", score: primaryHits };
  if (primaryHits >= 2) return { tier: "primary", score: primaryHits };
  if (secondaryHits >= 4) return { tier: "secondary_strong", score: secondaryHits };
  if (secondaryHits >= 2) return { tier: "secondary", score: secondaryHits };
  if (curiosityHits >= 2) return { tier: "curiosity", score: curiosityHits };
  if (catMatch && (primaryHits > 0 || secondaryHits > 0)) return { tier: "category_related", score: 1 };
  if (catMatch) return { tier: "category_only", score: 0.5 };
  if (avoidHits === 1) return { tier: "mild_avoid", score: -1 };
  return { tier: "irrelevant", score: 0 };
}

function simulateReaction(article, persona, recentTopics) {
  const { tier, score } = getInterestTier(article, persona);
  const aiScore = article.ai_final_score || 0;

  let qualityBonus;
  if (aiScore >= 950) qualityBonus = 2.0;
  else if (aiScore >= 900) qualityBonus = 1.6;
  else if (aiScore >= 850) qualityBonus = 1.3;
  else if (aiScore >= 750) qualityBonus = 1.1;
  else qualityBonus = 1.0;

  const tags = safeParseJson(article.interest_tags).map(t => t.toLowerCase());
  let fatigueCount = 0;
  for (const recentTag of recentTopics) { if (tags.includes(recentTag)) fatigueCount++; }
  const fatigued = fatigueCount >= persona.fatigueThreshold;
  const fatiguePenalty = fatigued ? 0.4 : 1.0;

  const dwell = persona.dwellProfile;
  const noise = 0.7 + Math.random() * 0.6;

  switch (tier) {
    case "primary_strong":
      if (Math.random() < 0.9 * fatiguePenalty * Math.min(qualityBonus, 1.3))
        return { action: "source_click", dwell: dwell.primary * 1.5 * noise, tier, score };
      return { action: "engaged", dwell: dwell.primary * noise, tier, score };
    case "primary":
      if (Math.random() < 0.75 * fatiguePenalty * Math.min(qualityBonus, 1.3))
        return { action: "engaged", dwell: dwell.primary * noise, tier, score };
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
    case "secondary_strong":
      if (Math.random() < 0.65 * fatiguePenalty * Math.min(qualityBonus, 1.5))
        return { action: "engaged", dwell: dwell.secondary * noise, tier, score };
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
    case "secondary":
      if (Math.random() < 0.45 * fatiguePenalty * Math.min(qualityBonus, 1.5))
        return { action: "engaged", dwell: dwell.secondary * 0.8 * noise, tier, score };
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
    case "curiosity":
      if (Math.random() < 0.30 * qualityBonus)
        return { action: "engaged", dwell: dwell.curiosity * 1.5 * noise, tier, score };
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
    case "category_related":
      if (Math.random() < 0.20 * qualityBonus)
        return { action: "engaged", dwell: dwell.curiosity * 1.2 * noise, tier, score };
      if (Math.random() < 0.35 * qualityBonus)
        return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
      return { action: "skip", dwell: dwell.skip * 1.5 * noise, tier, score };
    case "category_only":
      if (Math.random() < 0.10 * qualityBonus)
        return { action: "glance", dwell: dwell.curiosity * 0.8 * noise, tier, score };
      return { action: "skip", dwell: dwell.skip * 1.2 * noise, tier, score };
    case "avoid":
      if (aiScore >= 960 && Math.random() < 0.3)
        return { action: "glance", dwell: 4.0 * noise, tier, score };
      return { action: "skip", dwell: dwell.skip * 0.5, tier, score };
    case "mild_avoid":
      if (aiScore >= 900 && Math.random() < 0.2)
        return { action: "glance", dwell: 3.0 * noise, tier, score };
      return { action: "skip", dwell: dwell.skip * 0.8, tier, score };
    default:
      if (aiScore >= 950 && Math.random() < 0.45)
        return { action: "engaged", dwell: dwell.curiosity * 2.0 * noise, tier, score };
      if (aiScore >= 900 && Math.random() < 0.25)
        return { action: "glance", dwell: dwell.curiosity * 1.5 * noise, tier, score };
      if (aiScore >= 800 && Math.random() < 0.10)
        return { action: "glance", dwell: 3.5 * noise, tier, score };
      return { action: "skip", dwell: dwell.skip * noise, tier, score };
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST RUNNER (same structure as v15)
// ═══════════════════════════════════════════════════════════════

async function fetchFeedPage(engagedIds, glancedIds, skippedIds, seenIds, cursor) {
  let url = `${BASE_URL}/api/feed/main?limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (engagedIds.length > 0) url += `&engaged_ids=${engagedIds.join(",")}`;
  if (glancedIds.length > 0) url += `&glanced_ids=${glancedIds.join(",")}`;
  if (skippedIds.length > 0) url += `&skipped_ids=${skippedIds.join(",")}`;
  if (seenIds.length > 0) url += `&seen_ids=${seenIds.slice(-300).join(",")}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return { articles: [], next_cursor: null, has_more: false };
      return await resp.json();
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
      console.log(`  !! Fetch failed after 3 attempts: ${e.message}`);
      return { articles: [], next_cursor: null, has_more: false };
    }
  }
}

async function runPersonaTest(persona, personaIndex) {
  console.log(`\n${"=".repeat(90)}`);
  console.log(`${persona.emoji}  PERSONA ${personaIndex + 1}: ${persona.name}`);
  console.log(`   Primary: ${persona.primary.slice(0, 6).join(", ")}`);
  console.log(`   Secondary: ${persona.secondary.slice(0, 5).join(", ")}`);
  console.log(`${"=".repeat(90)}`);

  const engagedIds = [], glancedIds = [], skippedIds = [], seenIds = [];
  let cursor = null;

  const stats = { totalSeen: 0, engaged: 0, sourceClicked: 0, skipped: 0, glanced: 0, totalDwell: 0,
    tierBreakdown: {}, engagementByPage: [], avoidArticlesShown: [], entityDistribution: {},
    topEngagedArticles: [], contentExhaustedAt: null, maxConsecutiveSkips: 0, consecutiveSkips: 0 };

  const recentTopicWindow = [];
  let consecutiveBoringPages = 0;

  for (let page = 1; page <= 5; page++) {
    const feedData = await fetchFeedPage(engagedIds, glancedIds, skippedIds, seenIds, cursor);
    const articles = feedData.articles || [];
    if (articles.length === 0) { stats.contentExhaustedAt = page; break; }
    cursor = feedData.next_cursor;

    let pageEngaged = 0, pageSkipped = 0, pageGlanced = 0, pageDwell = 0;
    const pageTiers = {};

    for (const article of articles) {
      const reaction = simulateReaction(article, persona, recentTopicWindow);
      seenIds.push(article.id);
      stats.totalSeen++;

      stats.tierBreakdown[reaction.tier] = (stats.tierBreakdown[reaction.tier] || 0) + 1;
      pageTiers[reaction.tier] = (pageTiers[reaction.tier] || 0) + 1;

      const tags = safeParseJson(article.interest_tags);
      for (const tag of tags.slice(0, 3)) stats.entityDistribution[tag.toLowerCase()] = (stats.entityDistribution[tag.toLowerCase()] || 0) + 1;

      if (reaction.tier === "avoid" || reaction.tier === "mild_avoid")
        stats.avoidArticlesShown.push({ title: (article.title_news||"").substring(0,50) });

      if (reaction.action === "source_click" || reaction.action === "engaged") {
        engagedIds.push(article.id);
        if (reaction.action === "source_click") stats.sourceClicked++;
        stats.engaged++; pageEngaged++;
        stats.consecutiveSkips = 0;
        for (const tag of tags.slice(0, 3)) recentTopicWindow.push(tag.toLowerCase());
        while (recentTopicWindow.length > 15) recentTopicWindow.shift();
        if (reaction.score >= 3 || reaction.action === "source_click")
          stats.topEngagedArticles.push({ page, title: (article.title_news||"").substring(0,55), tier: reaction.tier });
      } else if (reaction.action === "glance") {
        glancedIds.push(article.id); // Change 2: send glances to server
        stats.glanced++; pageGlanced++; stats.consecutiveSkips = 0;
      } else {
        skippedIds.push(article.id);
        stats.skipped++; pageSkipped++;
        stats.consecutiveSkips++;
        stats.maxConsecutiveSkips = Math.max(stats.maxConsecutiveSkips, stats.consecutiveSkips);
      }
      stats.totalDwell += reaction.dwell; pageDwell += reaction.dwell;
    }

    const pageEngRate = articles.length > 0 ? (pageEngaged / articles.length * 100) : 0;
    stats.engagementByPage.push(pageEngRate);

    const tierStr = Object.entries(pageTiers).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([t,n])=>`${t}:${n}`).join(" ");
    console.log(`  P${page}: ${articles.length} art | E:${pageEngaged} S:${pageSkipped} G:${pageGlanced} | ${pageEngRate.toFixed(0)}% eng | ${tierStr}`);

    if (pageEngaged === 0) { consecutiveBoringPages++; if (consecutiveBoringPages >= 3) { stats.contentExhaustedAt = page; break; } }
    else consecutiveBoringPages = 0;
    if (!feedData.has_more) { stats.contentExhaustedAt = page; break; }
    await new Promise(r => setTimeout(r, 500));
  }

  const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
  const avgDwell = stats.totalSeen > 0 ? (stats.totalDwell / stats.totalSeen) : 0;
  console.log(`  Summary: ${stats.totalSeen} seen | ${stats.engaged} engaged (${engRate.toFixed(1)}%) | ${avgDwell.toFixed(1)}s dwell | ${stats.avoidArticlesShown.length} avoids`);

  if (stats.topEngagedArticles.length > 0) {
    console.log(`  Top engaged:`);
    for (const a of stats.topEngagedArticles.slice(0, 4))
      console.log(`    p${a.page} [${a.tier}] "${a.title}"`);
  }

  const rates = stats.engagementByPage;
  if (rates.length >= 3) {
    const first = rates.slice(0, 2).reduce((s,v)=>s+v,0) / 2;
    const last = rates.slice(-2).reduce((s,v)=>s+v,0) / 2;
    console.log(`  Trend: ${first.toFixed(0)}% → ${last.toFixed(0)}% (${(last-first) >= 0 ? "+" : ""}${(last-first).toFixed(0)}%)`);
  }

  return stats;
}

function computeRating(stats) {
  const totalSeen = stats.totalSeen || 1;
  const engRate = stats.engaged / totalSeen * 100;
  const glanceRate = stats.glanced / totalSeen * 100;
  const avoidRate = stats.avoidArticlesShown.length / totalSeen * 100;
  const skipRate = stats.skipped / totalSeen * 100;

  // "Satisfaction" = engaged + partial credit for glances (they found it mildly interesting)
  // Skip = bad. Avoid = very bad.
  const satisfactionRate = engRate + glanceRate * 0.3;

  // Realistic scale:
  // 10: 80%+ satisfaction (almost everything relevant) — basically impossible on cold-start
  // 9: 70-80% — exceptional, most content lands
  // 8: 60-70% — great feed, majority interesting
  // 7: 50-60% — good, more hits than misses
  // 6: 40-50% — decent, user stays but not delighted
  // 5: 30-40% — mediocre, about 1/3 relevant
  // 4: 20-30% — poor, mostly irrelevant
  // 3: 15-20% — bad, user considering leaving
  // 2: 10-15% — terrible, user wants to uninstall
  // 1: <10% — completely broken
  let rating;
  if (satisfactionRate >= 80) rating = 10;
  else if (satisfactionRate >= 70) rating = 9;
  else if (satisfactionRate >= 60) rating = 8;
  else if (satisfactionRate >= 50) rating = 7;
  else if (satisfactionRate >= 40) rating = 6;
  else if (satisfactionRate >= 30) rating = 5;
  else if (satisfactionRate >= 20) rating = 4;
  else if (satisfactionRate >= 15) rating = 3;
  else if (satisfactionRate >= 10) rating = 2;
  else rating = 1;

  // Penalties for showing actively disliked content
  if (avoidRate > 25) rating -= 2;
  else if (avoidRate > 15) rating -= 1.5;
  else if (avoidRate > 8) rating -= 1;

  // Penalty for high consecutive skips (user frustration)
  if (stats.maxConsecutiveSkips >= 15) rating -= 1;
  else if (stats.maxConsecutiveSkips >= 10) rating -= 0.5;

  return Math.max(1, Math.min(10, Math.round(rating * 10) / 10));
}

async function main() {
  console.log("V16 CONTENT-MATCHED TEST — 10 Personas Built From Actual DB Content");
  console.log("=".repeat(90));
  console.log("Purpose: FULL 30-page test — isolate algorithm quality from content coverage gaps");
  console.log("=".repeat(90));

  const allStats = [];
  for (let i = 0; i < PERSONAS.length; i++) {
    const stats = await runPersonaTest(PERSONAS[i], i);
    allStats.push({ persona: PERSONAS[i], stats });
  }

  console.log("\n\n" + "=".repeat(90));
  console.log("GRAND SUMMARY — CONTENT-MATCHED TEST");
  console.log("=".repeat(90));

  console.log("\n+--------------------------+------+------+--------+---------+--------+");
  console.log("| Persona                  | Seen | Eng  | EngRate| Avoids  | Rating |");
  console.log("+--------------------------+------+------+--------+---------+--------+");

  let totalRating = 0;
  for (const { persona, stats } of allStats) {
    const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
    const glanceRate = stats.totalSeen > 0 ? (stats.glanced / stats.totalSeen * 100) : 0;
    const satRate = engRate + glanceRate * 0.3;
    const avoidCount = stats.avoidArticlesShown.length;
    const rating = computeRating(stats);
    totalRating += rating;
    const name = `${persona.emoji} ${persona.name}`.substring(0, 24).padEnd(24);
    console.log(`| ${name} | ${String(stats.totalSeen).padStart(4)} | ${String(stats.engaged).padStart(4)} | ${engRate.toFixed(0).padStart(3)}%+${glanceRate.toFixed(0).padStart(2)}%g | ${String(avoidCount).padStart(7)} | ${String(rating).padStart(4)}/10 |`);
  }

  const avgRating = totalRating / PERSONAS.length;
  console.log("+--------------------------+------+------+--------+---------+--------+");
  console.log(`| AVERAGE                  |      |      |        |         | ${avgRating.toFixed(1).padStart(4)}/10 |`);
  console.log("+--------------------------+------+------+--------+---------+--------+");

  console.log("\nRating Summary (satisfaction = engaged% + glanced%×0.3):");
  for (const { persona, stats } of allStats) {
    const engRate = stats.totalSeen > 0 ? (stats.engaged / stats.totalSeen * 100) : 0;
    const glanceRate = stats.totalSeen > 0 ? (stats.glanced / stats.totalSeen * 100) : 0;
    const satRate = engRate + glanceRate * 0.3;
    const rating = computeRating(stats);
    const ratingInt = Math.round(rating);
    const bar = "#".repeat(ratingInt) + ".".repeat(10 - ratingInt);
    console.log(`  ${persona.emoji} ${persona.name.padEnd(32)} [${bar}] ${rating}/10 (sat:${satRate.toFixed(0)}%)`);
  }
  console.log(`\nAverage: ${avgRating.toFixed(1)}/10`);

  // Entity flooding check
  console.log("\nTop entity % per persona:");
  for (const { persona, stats } of allStats) {
    const top = Object.entries(stats.entityDistribution).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const total = stats.totalSeen || 1;
    console.log(`  ${persona.emoji} ${persona.name.substring(0,25).padEnd(25)}: ${top.map(([e,n])=>`${e}:${(n/total*100).toFixed(0)}%`).join(" ")}`);
  }
}

main().catch(console.error);
