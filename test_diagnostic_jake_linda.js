const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "/Users/omersogancioglu/Ten News Website/.env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BASE_URL = "https://www.tennews.ai";

// Just Jake and Linda for deep diagnostics
const PERSONAS = [
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
        return { action: "engaged", dwell: dwell.primary * 1.5 * noise, tier, score };
      return { action: "glance", dwell: dwell.curiosity * noise, tier, score };
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
      if (attempt < 2) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
      return { articles: [], next_cursor: null, has_more: false };
    }
  }
}

async function runDiagnostic(persona, personaIndex) {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`DEEP DIAGNOSTIC: ${persona.emoji} ${persona.name}`);
  console.log(`Primary: ${persona.primary.join(", ")}`);
  console.log(`Categories: ${persona.categories.join(", ")}`);
  console.log(`${"=".repeat(100)}`);

  const engagedIds = [], skippedIds = [], seenIds = [];
  let cursor = null;
  const recentTopicWindow = [];

  // Simulate bandit state tracking (mirroring what the server does)
  const simBanditState = {};
  const simEntityBanditState = {};

  // Track all engaged articles for Q4/Q5
  const allEngagedArticles = [];

  for (let page = 1; page <= 5; page++) {
    const feedData = await fetchFeedPage(engagedIds, skippedIds, seenIds, cursor);
    const articles = feedData.articles || [];
    if (articles.length === 0) break;
    cursor = feedData.next_cursor;

    console.log(`\n── PAGE ${page} ──────────────────────────────────────────────────`);

    // Q1/Q2: Per-category breakdown
    const catStats = {};
    const pageEngagedArticles = [];

    for (const article of articles) {
      const reaction = simulateReaction(article, persona, recentTopicWindow);
      const cat = article.category || "Other";
      const tags = safeParseJson(article.interest_tags).map(t => t.toLowerCase());

      if (!catStats[cat]) catStats[cat] = { shown: 0, engaged: 0, skipped: 0, glanced: 0 };
      catStats[cat].shown++;

      seenIds.push(article.id);

      if (reaction.action === "engaged" || reaction.action === "source_click") {
        engagedIds.push(article.id);
        catStats[cat].engaged++;
        for (const tag of tags.slice(0, 3)) recentTopicWindow.push(tag);
        while (recentTopicWindow.length > 15) recentTopicWindow.shift();

        // Track for Q4/Q5
        pageEngagedArticles.push({
          title: (article.title_news || "").substring(0, 65),
          category: cat,
          tier: reaction.tier,
          dwell: reaction.dwell.toFixed(1),
          aiScore: article.ai_final_score,
          tags: tags.slice(0, 5).join(", "),
        });
        allEngagedArticles.push({ page, ...pageEngagedArticles[pageEngagedArticles.length - 1] });

        // Simulate bandit updates (Q3)
        if (!simBanditState[cat]) simBanditState[cat] = { alpha: 1, beta: 1 };
        simBanditState[cat].alpha += 2;
        for (const t of tags.slice(0, 4)) {
          if (!simEntityBanditState[t]) simEntityBanditState[t] = { alpha: 1, beta: 1 };
          simEntityBanditState[t].alpha += 2;
        }
      } else if (reaction.action === "glance") {
        catStats[cat].glanced++;
      } else {
        skippedIds.push(article.id);
        catStats[cat].skipped++;

        if (!simBanditState[cat]) simBanditState[cat] = { alpha: 1, beta: 1 };
        simBanditState[cat].beta += 1;
        for (const t of tags.slice(0, 4)) {
          if (!simEntityBanditState[t]) simEntityBanditState[t] = { alpha: 1, beta: 1 };
          simEntityBanditState[t].beta += 1;
        }
      }
    }

    // Print Q1/Q2: category breakdown
    const sortedCats = Object.entries(catStats).sort((a, b) => b[1].shown - a[1].shown);
    for (const [cat, s] of sortedCats) {
      const engBar = "E".repeat(s.engaged) + "g".repeat(s.glanced) + ".".repeat(s.skipped);
      console.log(`  ${cat.padEnd(15)} shown=${String(s.shown).padStart(2)} | engaged=${s.engaged} glanced=${s.glanced} skipped=${s.skipped} [${engBar}]`);
    }

    const pageEng = articles.length > 0 ? (pageEngagedArticles.length / articles.length * 100).toFixed(0) : 0;
    console.log(`  → Page ${page} engagement: ${pageEng}%`);

    // Q4/Q5: Engaged articles with details
    if (pageEngagedArticles.length > 0) {
      console.log(`  ENGAGED ARTICLES:`);
      for (const a of pageEngagedArticles) {
        const dwellTier = a.dwell >= 15 ? "DEEP" : a.dwell >= 8 ? "READ" : a.dwell >= 4 ? "GLANCE" : "QUICK";
        console.log(`    [${a.tier}] ${dwellTier} ${a.dwell}s | score=${a.aiScore} | "${a.title}"`);
        console.log(`      tags: ${a.tags}`);
      }
    }

    // Q3: Bandit state after this page
    console.log(`  BANDIT STATE after page ${page}:`);
    const sortedBandit = Object.entries(simBanditState).sort((a, b) => {
      const rateA = a[1].alpha / (a[1].alpha + a[1].beta);
      const rateB = b[1].alpha / (b[1].alpha + b[1].beta);
      return rateB - rateA;
    });
    for (const [cat, state] of sortedBandit.slice(0, 6)) {
      const rate = (state.alpha / (state.alpha + state.beta) * 100).toFixed(0);
      console.log(`    ${cat.padEnd(15)} α=${String(state.alpha).padStart(3)} β=${String(state.beta).padStart(3)} → rate=${rate}%`);
    }

    // Q9: Entity blocklist check
    const entitySkipCounts = {};
    for (const id of skippedIds) {
      // We don't have article data for all skipped IDs here, but we can count from this page
      // Actually, the server builds the blocklist. Let's check what SHOULD be blocked
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Q6: Entity bandit state after all pages
  console.log(`\n── ENTITY BANDIT STATE (top 15) ──`);
  const sortedEntityBandit = Object.entries(simEntityBanditState)
    .sort((a, b) => (b[1].alpha / (b[1].alpha + b[1].beta)) - (a[1].alpha / (a[1].alpha + a[1].beta)));
  for (const [entity, state] of sortedEntityBandit.slice(0, 15)) {
    const rate = (state.alpha / (state.alpha + state.beta) * 100).toFixed(0);
    const label = persona.primary.some(p => entity.includes(p) || p.includes(entity)) ? "PRIMARY" :
                  persona.secondary.some(s => entity.includes(s) || s.includes(entity)) ? "SECONDARY" :
                  persona.curiosity.some(c => entity.includes(c) || c.includes(entity)) ? "CURIOSITY" :
                  persona.avoids.some(a => entity.includes(a) || a.includes(entity)) ? "AVOID" : "other";
    console.log(`  ${entity.padEnd(25)} α=${String(state.alpha).padStart(3)} β=${String(state.beta).padStart(3)} → rate=${rate}% [${label}]`);
  }

  // Q4 summary: All engaged articles across all pages
  console.log(`\n── ALL ENGAGED ARTICLES (${allEngagedArticles.length} total) ──`);
  const tierCounts = {};
  let curiosityEngagements = 0;
  let primaryEngagements = 0;
  let irrelevantEngagements = 0;
  for (const a of allEngagedArticles) {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
    if (a.tier === "curiosity") curiosityEngagements++;
    if (a.tier.startsWith("primary")) primaryEngagements++;
    if (a.tier === "irrelevant") irrelevantEngagements++;
  }
  console.log(`  Tier breakdown: ${Object.entries(tierCounts).sort((a,b)=>b[1]-a[1]).map(([t,n])=>`${t}:${n}`).join(", ")}`);
  console.log(`  PRIMARY engagements: ${primaryEngagements} | CURIOSITY engagements: ${curiosityEngagements} | IRRELEVANT engagements: ${irrelevantEngagements}`);
  console.log(`  → Curiosity pollution ratio: ${allEngagedArticles.length > 0 ? ((curiosityEngagements + irrelevantEngagements) / allEngagedArticles.length * 100).toFixed(0) : 0}% of engagements are NOT from primary/secondary interest`);

  // Q9: Would entity blocklist have triggered?
  console.log(`\n── ENTITY BLOCKLIST ANALYSIS ──`);
  // Check which entities got 3+ skips
  const entitySkipsFromEngaged = {};
  // We need to check from the skippedIds — but we only have IDs, not article data
  // The server-side blocklist uses articleMap. Let's approximate from the entity bandit
  for (const [entity, state] of Object.entries(simEntityBanditState)) {
    if (state.beta >= 4) { // beta starts at 1, so 4+ means 3+ skips
      console.log(`  WOULD BLOCK: "${entity}" (skipped ~${state.beta - 1} times)`);
    }
  }

  // Q12: Recency decay check
  console.log(`\n── Q12: RECENCY DECAY ──`);
  console.log(`  Currently: NO recency decay. Page 1 engagements count equally to page 5.`);
  console.log(`  A curiosity click on page 1 permanently biases the entire session.`);
}

// Q8: Category composition analysis
async function analyzePoolComposition() {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`Q8: CATEGORY COMPOSITION — What % of each category is Iran/war content?`);
  console.log(`${"=".repeat(100)}`);

  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString();
  const categories = ['Politics', 'World', 'Business', 'Sports', 'Entertainment', 'Tech', 'Science', 'Health', 'Finance', 'Lifestyle'];

  for (const cat of categories) {
    const { data } = await supabase.from('published_articles')
      .select('id, interest_tags, title_news')
      .eq('category', cat)
      .gte('created_at', cutoff)
      .gte('ai_final_score', 300)
      .order('ai_final_score', { ascending: false })
      .limit(60);

    if (!data || data.length === 0) { console.log(`  ${cat}: 0 articles`); continue; }

    let iranCount = 0, trumpCount = 0, ukraineCount = 0;
    for (const a of data) {
      const tags = safeParseJson(a.interest_tags).map(t => t.toLowerCase());
      const title = (a.title_news || "").toLowerCase();
      if (tags.some(t => t.includes("iran")) || title.includes("iran")) iranCount++;
      if (tags.some(t => t.includes("trump") || t.includes("donald")) || title.includes("trump")) trumpCount++;
      if (tags.some(t => t.includes("ukraine") || t.includes("russia")) || title.includes("ukrain") || title.includes("russia")) ukraineCount++;
    }

    console.log(`  ${cat.padEnd(15)} ${String(data.length).padStart(3)} articles | Iran: ${(iranCount/data.length*100).toFixed(0)}% | Trump: ${(trumpCount/data.length*100).toFixed(0)}% | Ukraine/Russia: ${(ukraineCount/data.length*100).toFixed(0)}%`);
  }
}

async function main() {
  console.log("DIAGNOSTIC TEST — Answering all 12 questions from the professor");
  console.log("=".repeat(100));

  // Q8 first — pool composition
  await analyzePoolComposition();

  // Q7: How the test decides engagement
  console.log(`\n${"=".repeat(100)}`);
  console.log(`Q7: HOW THE TEST PERSONA DECIDES TO ENGAGE/SKIP`);
  console.log(`${"=".repeat(100)}`);
  console.log(`  NOT using AI/LLM. Using keyword matching + probabilistic simulation:`);
  console.log(`  1. Match article tags against persona's primary/secondary/curiosity/avoid lists`);
  console.log(`  2. Determine tier: primary_strong, primary, secondary, curiosity, irrelevant, avoid`);
  console.log(`  3. Each tier has a BASE probability of engagement:`);
  console.log(`     primary_strong: 90% | primary: 75% | secondary_strong: 65% | secondary: 45%`);
  console.log(`     curiosity: 30% | category_related: 20% | irrelevant: 0% (but 45% if score>=950)`);
  console.log(`  4. Quality bonus multiplies probability: score>=950 → 2.0x, >=900 → 1.6x`);
  console.log(`  5. CRITICAL: "irrelevant" articles with score >= 950 get 45% engage chance`);
  console.log(`     This creates CURIOSITY POLLUTION — high-quality off-topic content gets engaged`);
  console.log(`     and teaches the bandit the WRONG signal`);

  // Run diagnostics for Jake and Linda
  for (let i = 0; i < PERSONAS.length; i++) {
    await runDiagnostic(PERSONAS[i], i);
  }

  // Q11: Pool exhaustion
  console.log(`\n${"=".repeat(100)}`);
  console.log(`Q11: POOL EXHAUSTION`);
  console.log(`${"=".repeat(100)}`);
  console.log(`  Each API call rebuilds pools from scratch (30 articles per category).`);
  console.log(`  seen_ids parameter excludes previously shown articles.`);
  console.log(`  After 3 pages (60 articles), smaller categories start running out.`);
  console.log(`  Finance has only 32 articles in 48h — exhausted by page 2.`);
  console.log(`  Politics has 138 — enough for 4-5 pages.`);
  console.log(`  This FORCES the bandit into other categories on later pages.`);

  // Q12: Recency decay
  console.log(`\n${"=".repeat(100)}`);
  console.log(`Q12: RECENCY DECAY ON BANDIT SIGNALS`);
  console.log(`${"=".repeat(100)}`);
  console.log(`  Currently: NONE. All session signals have equal weight.`);
  console.log(`  engaged_ids and skipped_ids are cumulative arrays sent to the API.`);
  console.log(`  The server rebuilds bandit state from ALL signals each request.`);
  console.log(`  A curiosity click on page 1 has the SAME weight as a primary click on page 4.`);
  console.log(`  This means early noise permanently biases the session.`);
}

main().catch(console.error);
