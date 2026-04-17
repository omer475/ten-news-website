const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE_URL = "https://www.tennews.ai";

// ═══════════════════════════════════════════════════════════════
// PERSONAS (same as content-matched test)
// ═══════════════════════════════════════════════════════════════
const PERSONAS = [
  {
    name: "Jake — US Politics",
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
    name: "Linda — Markets",
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
    name: "Priya — AI & Tech",
    emoji: "🤖",
    primary: ["artificial intelligence", "meta", "apple", "google", "cybersecurity", "social media", "machine learning", "openai", "chatgpt"],
    secondary: ["consumer electronics", "drones", "electric vehicles", "spacex", "tesla"],
    curiosity: ["cryptocurrency", "bitcoin", "stock market", "climate change"],
    avoids: ["iran", "military", "war", "hezbollah", "cricket", "nfl", "soccer"],
    categories: ["Tech"],
    dwellProfile: { primary: 18, secondary: 12, curiosity: 5, skip: 1.2 },
    fatigueThreshold: 5,
  },
];

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
  if (avoidHits >= 2) return { tier: "AVOID", score: -avoidHits };

  let primaryHits = 0, primaryTerms = [];
  for (const term of persona.primary) {
    if (tags.some(t => t.includes(term) || term.includes(t))) { primaryHits += 2; primaryTerms.push(term); }
    if (title.includes(term)) { primaryHits += 1; if (!primaryTerms.includes(term)) primaryTerms.push(term); }
  }
  let secondaryHits = 0, secondaryTerms = [];
  for (const term of persona.secondary) {
    if (tags.some(t => t.includes(term) || term.includes(t))) { secondaryHits += 2; secondaryTerms.push(term); }
    if (title.includes(term)) { secondaryHits += 1; if (!secondaryTerms.includes(term)) secondaryTerms.push(term); }
  }
  let curiosityHits = 0, curiosityTerms = [];
  for (const term of persona.curiosity) {
    if (tags.some(t => t.includes(term) || term.includes(t))) { curiosityHits += 2; curiosityTerms.push(term); }
    if (title.includes(term)) { curiosityHits += 1; if (!curiosityTerms.includes(term)) curiosityTerms.push(term); }
  }
  const catMatch = persona.categories.map(c => c.toLowerCase()).includes(cat);

  if (primaryHits >= 4) return { tier: "PRIMARY_STRONG", score: primaryHits, matches: primaryTerms };
  if (primaryHits >= 2) return { tier: "PRIMARY", score: primaryHits, matches: primaryTerms };
  if (secondaryHits >= 4) return { tier: "SECONDARY_STRONG", score: secondaryHits, matches: secondaryTerms };
  if (secondaryHits >= 2) return { tier: "SECONDARY", score: secondaryHits, matches: secondaryTerms };
  if (curiosityHits >= 2) return { tier: "CURIOSITY", score: curiosityHits, matches: curiosityTerms };
  if (catMatch && (primaryHits > 0 || secondaryHits > 0)) return { tier: "CAT_RELATED", score: 1 };
  if (catMatch) return { tier: "CAT_ONLY", score: 0.5 };
  if (avoidHits === 1) return { tier: "MILD_AVOID", score: -1 };
  return { tier: "IRRELEVANT", score: 0 };
}

function simulateReaction(article, persona, recentTopics) {
  const tierResult = getInterestTier(article, persona);
  const { tier, score } = tierResult;
  const aiScore = article.ai_final_score || 0;
  let qualityBonus;
  if (aiScore >= 950) qualityBonus = 2.0;
  else if (aiScore >= 900) qualityBonus = 1.6;
  else if (aiScore >= 850) qualityBonus = 1.3;
  else if (aiScore >= 750) qualityBonus = 1.1;
  else qualityBonus = 1.0;

  const tags = safeParseJson(article.interest_tags).map(t => t.toLowerCase());
  let fatigueCount = 0;
  for (const rt of recentTopics) { if (tags.includes(rt)) fatigueCount++; }
  const fatigued = fatigueCount >= persona.fatigueThreshold;
  const fatiguePenalty = fatigued ? 0.4 : 1.0;
  const dwell = persona.dwellProfile;
  const noise = 0.7 + Math.random() * 0.6;

  let action, dwellTime;
  switch (tier) {
    case "PRIMARY_STRONG":
      action = Math.random() < 0.9 * fatiguePenalty * Math.min(qualityBonus, 1.3) ? "ENGAGED" : "GLANCE";
      dwellTime = action === "ENGAGED" ? dwell.primary * 1.5 * noise : dwell.curiosity * noise;
      break;
    case "PRIMARY":
      action = Math.random() < 0.75 * fatiguePenalty * Math.min(qualityBonus, 1.3) ? "ENGAGED" : "GLANCE";
      dwellTime = action === "ENGAGED" ? dwell.primary * noise : dwell.curiosity * noise;
      break;
    case "SECONDARY_STRONG":
      action = Math.random() < 0.65 * fatiguePenalty * Math.min(qualityBonus, 1.5) ? "ENGAGED" : "GLANCE";
      dwellTime = action === "ENGAGED" ? dwell.secondary * noise : dwell.curiosity * noise;
      break;
    case "SECONDARY":
      action = Math.random() < 0.45 * fatiguePenalty * Math.min(qualityBonus, 1.5) ? "ENGAGED" : "GLANCE";
      dwellTime = action === "ENGAGED" ? dwell.secondary * 0.8 * noise : dwell.curiosity * noise;
      break;
    case "CURIOSITY":
      action = Math.random() < 0.30 * qualityBonus ? "ENGAGED" : "GLANCE";
      dwellTime = action === "ENGAGED" ? dwell.curiosity * 1.5 * noise : dwell.curiosity * noise;
      break;
    case "CAT_RELATED":
      if (Math.random() < 0.20 * qualityBonus) { action = "ENGAGED"; dwellTime = dwell.curiosity * 1.2 * noise; }
      else if (Math.random() < 0.35 * qualityBonus) { action = "GLANCE"; dwellTime = dwell.curiosity * noise; }
      else { action = "SKIP"; dwellTime = dwell.skip * 1.5 * noise; }
      break;
    case "CAT_ONLY":
      action = Math.random() < 0.10 * qualityBonus ? "GLANCE" : "SKIP";
      dwellTime = action === "GLANCE" ? dwell.curiosity * 0.8 * noise : dwell.skip * 1.2 * noise;
      break;
    case "AVOID":
      action = aiScore >= 960 && Math.random() < 0.3 ? "GLANCE" : "SKIP";
      dwellTime = action === "GLANCE" ? 4.0 * noise : dwell.skip * 0.5;
      break;
    case "MILD_AVOID":
      action = aiScore >= 900 && Math.random() < 0.2 ? "GLANCE" : "SKIP";
      dwellTime = action === "GLANCE" ? 3.0 * noise : dwell.skip * 0.8;
      break;
    default: // IRRELEVANT
      if (aiScore >= 950 && Math.random() < 0.45) { action = "ENGAGED"; dwellTime = dwell.curiosity * 2.0 * noise; }
      else if (aiScore >= 900 && Math.random() < 0.25) { action = "GLANCE"; dwellTime = dwell.curiosity * 1.5 * noise; }
      else if (aiScore >= 800 && Math.random() < 0.10) { action = "GLANCE"; dwellTime = 3.5 * noise; }
      else { action = "SKIP"; dwellTime = dwell.skip * noise; }
      break;
  }

  return { action, dwell: dwellTime, tier, score, matches: tierResult.matches || [], fatigued, qualityBonus };
}

async function fetchFeedPage(engagedIds, skippedIds, seenIds, cursor) {
  let url = `${BASE_URL}/api/feed/main?limit=20`;
  if (cursor) url += `&cursor=${cursor}`;
  if (engagedIds.length > 0) url += `&engaged_ids=${engagedIds.join(",")}`;
  if (skippedIds.length > 0) url += `&skipped_ids=${skippedIds.join(",")}`;
  if (seenIds.length > 0) url += `&seen_ids=${seenIds.slice(-300).join(",")}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return { articles: [], next_cursor: null, has_more: false };
      return await resp.json();
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return { articles: [], next_cursor: null, has_more: false };
    }
  }
}

async function main() {
  console.log("═".repeat(120));
  console.log("FULL DETAIL V20 TEST — EVERY ARTICLE, EVERY REACTION, EVERY SIGNAL");
  console.log("═".repeat(120));
  console.log("");
  console.log("HOW THE ALGORITHM WORKS (V20):");
  console.log("  1. User opens app → API called with NO user_id (cold start)");
  console.log("  2. Server builds candidate pools: top 30 articles PER CATEGORY (subtopic-diverse)");
  console.log("     Categories: Politics, World, Business, Sports, Entertainment, Tech, Science, Health, Finance, Lifestyle");
  console.log("  3. Scores normalized: 0.7 × within-category-rank + 0.3 × global-quality");
  console.log("  4. Entity blocklist: if user skipped 3+ articles with entity X → X is hard-blocked");
  console.log("  5. Global topic cap: no entity can exceed 15% of total pool");
  console.log("  6. Thompson Sampling bandit picks which CATEGORY to draw from (proper Beta distribution)");
  console.log("  7. Within category: articles scored by entity engagement rate × confidence");
  console.log("     entityScore = 0.5 + (engagementRate - 0.5) × confidence");
  console.log("     confidence = 1 - 1/(1+timesShown) → smooth, no hard thresholds");
  console.log("  8. MMR selection with embedding cosine similarity prevents duplicate stories");
  console.log("  9. Entity frequency cap: dominant entities limited to 2-4 per page");
  console.log("  10. Result: 20 articles sent to user");
  console.log("  11. User reactions (engaged/skipped IDs) sent back as URL params on next request");
  console.log("");
  console.log("HOW THE TEST SIMULATES USERS:");
  console.log("  - Each persona has: primary interests (90% engage), secondary (45%), curiosity (30%)");
  console.log("  - Also has AVOID list (hard skip) and category preferences");
  console.log("  - Article tags are matched against these lists to determine tier");
  console.log("  - Engagement probability = base_rate × quality_bonus × fatigue_penalty × random_noise");
  console.log("  - Quality bonus: score≥950 → 2.0x, ≥900 → 1.6x, ≥850 → 1.3x");
  console.log("  - CRITICAL: 'irrelevant' articles with score≥950 get 45% engage chance (curiosity)");
  console.log("  - Dwell times: primary=20s, secondary=14s, curiosity=5s, skip=1.5s");
  console.log("");
  console.log("RATING SCALE (honest):");
  console.log("  satisfaction = engaged% + glanced% × 0.3");
  console.log("  10=80%+ | 9=70% | 8=60% | 7=50% | 6=40% | 5=30% | 4=20% | 3=15% | 2=10% | 1=<10%");
  console.log("  Penalties: avoids>25% → -2, >15% → -1.5, >8% → -1");
  console.log("");

  for (let pi = 0; pi < PERSONAS.length; pi++) {
    const persona = PERSONAS[pi];
    console.log("\n" + "═".repeat(120));
    console.log(`${persona.emoji} PERSONA: ${persona.name}`);
    console.log("═".repeat(120));
    console.log(`  Primary interests:   ${persona.primary.join(", ")}`);
    console.log(`  Secondary interests: ${persona.secondary.join(", ")}`);
    console.log(`  Curiosity:           ${persona.curiosity.join(", ")}`);
    console.log(`  Avoids:              ${persona.avoids.join(", ")}`);
    console.log(`  Preferred categories: ${persona.categories.join(", ")}`);

    const engagedIds = [], skippedIds = [], seenIds = [];
    let cursor = null;
    const recentTopicWindow = [];
    let totalEngaged = 0, totalSkipped = 0, totalGlanced = 0, totalSeen = 0;
    let totalAvoids = 0;

    for (let page = 1; page <= 5; page++) {
      const feedData = await fetchFeedPage(engagedIds, skippedIds, seenIds, cursor);
      const articles = feedData.articles || [];
      if (articles.length === 0) break;
      cursor = feedData.next_cursor;

      console.log(`\n  ┌─ PAGE ${page} ────────────────────────────────────────────────────────────────────────────────────┐`);
      console.log(`  │ API called with: engaged_ids=${engagedIds.length}, skipped_ids=${skippedIds.length}, seen_ids=${seenIds.length}`);
      console.log(`  │ Server returned: ${articles.length} articles, has_more=${feedData.has_more}`);
      console.log(`  │`);
      console.log(`  │  #  │ ACTION  │ TIER           │ CATEGORY      │ SCORE │ DWELL │ TITLE`);
      console.log(`  │─────┼─────────┼────────────────┼───────────────┼───────┼───────┼────────────────────────────────────────────`);

      let pageEngaged = 0, pageSkipped = 0, pageGlanced = 0;

      for (let ai = 0; ai < articles.length; ai++) {
        const article = articles[ai];
        const reaction = simulateReaction(article, persona, recentTopicWindow);
        const tags = safeParseJson(article.interest_tags).map(t => t.toLowerCase());

        seenIds.push(article.id);
        totalSeen++;

        if (reaction.action === "ENGAGED") {
          engagedIds.push(article.id);
          totalEngaged++; pageEngaged++;
          for (const tag of tags.slice(0, 3)) recentTopicWindow.push(tag);
          while (recentTopicWindow.length > 15) recentTopicWindow.shift();
        } else if (reaction.action === "GLANCE") {
          totalGlanced++; pageGlanced++;
        } else {
          skippedIds.push(article.id);
          totalSkipped++; pageSkipped++;
        }

        if (reaction.tier === "AVOID" || reaction.tier === "MILD_AVOID") totalAvoids++;

        const actionIcon = reaction.action === "ENGAGED" ? "✅ READ" : reaction.action === "GLANCE" ? "👀 PEEK" : "❌ SKIP";
        const title = (article.title_news || "").substring(0, 50);
        const matchInfo = reaction.matches && reaction.matches.length > 0 ? ` [matched: ${reaction.matches.join(",")}]` : "";
        const fatigueInfo = reaction.fatigued ? " ⚠️FATIGUED" : "";

        console.log(`  │ ${String(ai+1).padStart(2)}  │ ${actionIcon} │ ${reaction.tier.padEnd(14)} │ ${(article.category||"?").padEnd(13)} │ ${String(article.ai_final_score||0).padStart(5)} │ ${reaction.dwell.toFixed(1).padStart(5)}s │ ${title}${matchInfo}${fatigueInfo}`);
      }

      const pageEngRate = articles.length > 0 ? (pageEngaged / articles.length * 100) : 0;
      console.log(`  │`);
      console.log(`  │ PAGE ${page} RESULT: ${pageEngaged} engaged, ${pageGlanced} glanced, ${pageSkipped} skipped → ${pageEngRate.toFixed(0)}% engagement`);
      console.log(`  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘`);

      await new Promise(r => setTimeout(r, 500));
    }

    const engRate = totalSeen > 0 ? (totalEngaged / totalSeen * 100) : 0;
    const glanceRate = totalSeen > 0 ? (totalGlanced / totalSeen * 100) : 0;
    const satRate = engRate + glanceRate * 0.3;

    console.log(`\n  PERSONA SUMMARY: ${persona.name}`);
    console.log(`  Total seen: ${totalSeen} | Engaged: ${totalEngaged} (${engRate.toFixed(1)}%) | Glanced: ${totalGlanced} (${glanceRate.toFixed(1)}%) | Skipped: ${totalSkipped}`);
    console.log(`  Satisfaction: ${satRate.toFixed(1)}% | Avoid violations: ${totalAvoids}`);
    console.log(`  Cumulative signals sent to server: ${engagedIds.length} engaged_ids, ${skippedIds.length} skipped_ids`);
  }
}

main().catch(console.error);
