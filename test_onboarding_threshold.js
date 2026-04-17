/**
 * Onboarding Threshold Test
 *
 * Simulates 5 personas reading through ALL 24h articles.
 * At each engagement milestone, measures:
 *   - Onboarding-only prediction accuracy (country + topic match)
 *   - Tag-profile-only prediction accuracy (built from engagements so far)
 *   - Combined prediction accuracy
 *
 * Finds the crossover point where tag profile alone outperforms onboarding.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdhdylsfngiybvoltoks.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 5 personas — each with onboarding selections AND real interest keywords
const PERSONAS = [
  {
    name: 'Turkish Sports & Politics Fan',
    // Onboarding selections
    homeCountry: 'Turkey',
    followedCountries: ['Turkey', 'Greece', 'Cyprus'],
    followedTopics: ['Sports', 'Politics', 'World'],
    // What they ACTUALLY engage with (keyword-based simulation)
    engageKeywords: ['turkey', 'turkish', 'istanbul', 'ankara', 'erdogan', 'imamoglu',
      'galatasaray', 'fenerbahce', 'football', 'soccer', 'f1', 'formula',
      'cyprus', 'greece', 'aegean', 'women', 'feminist', 'march'],
  },
  {
    name: 'US Tech & AI Worker',
    homeCountry: 'US',
    followedCountries: ['US'],
    followedTopics: ['Tech', 'Science', 'Business'],
    engageKeywords: ['ai', 'openai', 'chatgpt', 'claude', 'llm', 'gpt', 'artificial intelligence',
      'apple', 'google', 'microsoft', 'meta', 'nvidia', 'amazon', 'macbook',
      'spacex', 'nasa', 'robot', 'drone', 'autonomous', 'startup', 'ipo',
      'hack', 'cyber', 'breach', 'privacy', 'copyright'],
  },
  {
    name: 'UK Finance & Markets Trader',
    homeCountry: 'UK',
    followedCountries: ['UK', 'US', 'Japan'],
    followedTopics: ['Finance', 'Business', 'Economy'],
    engageKeywords: ['oil', 'crude', 'opec', 'barrel', 'refinery', 'stock', 'nasdaq', 'dow',
      'wall street', 'bitcoin', 'crypto', 'ethereum', 'fed', 'interest rate',
      'inflation', 'treasury', 'bond', 'market', 'plunge', 'rally', 'investor',
      'housing', 'mortgage', 'tariff', 'trade war', 'shares', 'earnings'],
  },
  {
    name: 'Middle East Conflict Watcher',
    homeCountry: 'US',
    followedCountries: ['Israel', 'Iran', 'Ukraine', 'Russia'],
    followedTopics: ['World', 'Politics'],
    engageKeywords: ['iran', 'tehran', 'khamenei', 'irgc', 'iranian', 'israel', 'idf',
      'netanyahu', 'israeli', 'ukraine', 'zelensky', 'putin', 'russia', 'moscow',
      'military', 'missile', 'airstrike', 'submarine', 'navy', 'pentagon',
      'nato', 'troops', 'gaza', 'hamas', 'hezbollah', 'lebanon', 'ceasefire'],
  },
  {
    name: 'Indian Cricket & Entertainment Fan',
    homeCountry: 'India',
    followedCountries: ['India', 'US', 'UK'],
    followedTopics: ['Sports', 'Entertainment', 'Health'],
    engageKeywords: ['cricket', 't20', 'india', 'ipl', 'innings', 'wicket', 'batting',
      'movie', 'film', 'netflix', 'bollywood', 'disney', 'streaming', 'pixar',
      'nolan', 'celebrity', 'album', 'concert', 'cancer', 'vaccine', 'alzheimer',
      'treatment', 'depression', 'therapy', 'health'],
  },
];

function safeJsonParse(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

// Does this persona engage with this article? (based on title keyword matching)
function wouldEngage(persona, article) {
  const title = (article.title_news || '').toLowerCase();
  return persona.engageKeywords.some(kw => title.includes(kw));
}

// Does onboarding predict this article is relevant?
function onboardingPredicts(persona, article) {
  const countries = safeJsonParse(article.countries);
  const topics = safeJsonParse(article.topics);
  const category = article.category || '';

  // Country match
  const countryMatch = countries.some(c =>
    c === persona.homeCountry || persona.followedCountries.includes(c)
  );

  // Topic match
  const topicMatch = persona.followedTopics.includes(category) ||
    topics.some(t => persona.followedTopics.map(ft => ft.toLowerCase()).includes(t.toLowerCase()));

  return countryMatch || topicMatch;
}

// Does the running tag profile predict this article is relevant?
function tagProfilePredicts(tagProfile, article, threshold = 0.3) {
  const tags = safeJsonParse(article.interest_tags).map(t => t.toLowerCase());
  const category = (article.category || '').toLowerCase();

  if (Object.keys(tagProfile).length === 0) return false;

  let score = 0;
  let count = 0;
  for (const tag of tags) {
    if (tagProfile[tag]) { score += tagProfile[tag]; count++; }
  }
  if (tagProfile[category]) { score += tagProfile[category] * 0.5; count++; }

  return count > 0 && (score / Math.max(count, 1)) >= threshold;
}

// Build/update tag profile from engaged articles
function updateTagProfile(profile, article) {
  const tags = safeJsonParse(article.interest_tags).map(t => t.toLowerCase());
  const category = (article.category || '').toLowerCase();

  for (const tag of tags) {
    profile[tag] = (profile[tag] || 0) + 1.0;
  }
  if (category) {
    profile[category] = (profile[category] || 0) + 0.5;
  }

  // Normalize so max = 1.0
  const maxVal = Math.max(...Object.values(profile), 1);
  for (const key of Object.keys(profile)) {
    profile[key] /= maxVal;
  }

  return profile;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   ONBOARDING THRESHOLD TEST — When does taste vector beat onboarding?  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Fetch ALL articles from last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000).toISOString();
  let allArticles = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('published_articles')
      .select('id, title_news, category, countries, topics, interest_tags, ai_final_score, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('ai_final_score', { ascending: false })
      .range(offset, offset + 999);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allArticles = allArticles.concat(data);
    offset += data.length;
    if (data.length < 1000) break;
  }

  console.log(`Fetched ${allArticles.length} articles from last 24 hours\n`);

  // Milestones to measure at
  const milestones = [3, 5, 8, 10, 15, 20, 25, 30, 40, 50];

  const allResults = [];

  for (const persona of PERSONAS) {
    console.log('═'.repeat(75));
    console.log(`PERSONA: ${persona.name}`);
    console.log(`Onboarding: ${persona.homeCountry} | ${persona.followedCountries.join(',')} | ${persona.followedTopics.join(',')}`);
    console.log('═'.repeat(75));

    // Shuffle articles to simulate random feed order (but keep high-score ones more likely first)
    const shuffled = [...allArticles].sort(() => Math.random() - 0.5);

    let engagementCount = 0;
    let tagProfile = {};
    const milestoneResults = {};
    let totalSeen = 0;

    // Track articles seen vs engaged
    const engagedArticles = [];
    const allSeenArticles = [];

    for (const article of shuffled) {
      totalSeen++;
      allSeenArticles.push(article);

      const engaged = wouldEngage(persona, article);
      if (engaged) {
        engagementCount++;
        engagedArticles.push(article);
        tagProfile = updateTagProfile({ ...tagProfile }, article);
      }

      // At each milestone, measure prediction accuracy on REMAINING articles
      if (milestones.includes(engagementCount) && !milestoneResults[engagementCount]) {
        const remaining = shuffled.slice(totalSeen);
        if (remaining.length < 20) break;

        // Sample next 100 articles for prediction test
        const testSet = remaining.slice(0, 100);

        let onboardingTP = 0, onboardingFP = 0, onboardingFN = 0;
        let tagTP = 0, tagFP = 0, tagFN = 0;
        let combinedTP = 0, combinedFP = 0, combinedFN = 0;
        let actualPositives = 0;

        for (const testArticle of testSet) {
          const actual = wouldEngage(persona, testArticle);
          const onbPred = onboardingPredicts(persona, testArticle);
          const tagPred = tagProfilePredicts(tagProfile, testArticle);
          const combPred = onbPred || tagPred;

          if (actual) actualPositives++;

          if (actual && onbPred) onboardingTP++;
          if (!actual && onbPred) onboardingFP++;
          if (actual && !onbPred) onboardingFN++;

          if (actual && tagPred) tagTP++;
          if (!actual && tagPred) tagFP++;
          if (actual && !tagPred) tagFN++;

          if (actual && combPred) combinedTP++;
          if (!actual && combPred) combinedFP++;
          if (actual && !combPred) combinedFN++;
        }

        const onbPrecision = onboardingTP / Math.max(onboardingTP + onboardingFP, 1);
        const onbRecall = onboardingTP / Math.max(onboardingTP + onboardingFN, 1);
        const onbF1 = 2 * onbPrecision * onbRecall / Math.max(onbPrecision + onbRecall, 0.001);

        const tagPrecision = tagTP / Math.max(tagTP + tagFP, 1);
        const tagRecall = tagTP / Math.max(tagTP + tagFN, 1);
        const tagF1 = 2 * tagPrecision * tagRecall / Math.max(tagPrecision + tagRecall, 0.001);

        const combPrecision = combinedTP / Math.max(combinedTP + combinedFP, 1);
        const combRecall = combinedTP / Math.max(combinedTP + combinedFN, 1);
        const combF1 = 2 * combPrecision * combRecall / Math.max(combPrecision + combRecall, 0.001);

        milestoneResults[engagementCount] = {
          seen: totalSeen,
          remaining: remaining.length,
          testActualPositives: actualPositives,
          onboarding: { precision: onbPrecision, recall: onbRecall, f1: onbF1, tp: onboardingTP, fp: onboardingFP },
          tagProfile: { precision: tagPrecision, recall: tagRecall, f1: tagF1, tp: tagTP, fp: tagFP },
          combined: { precision: combPrecision, recall: combRecall, f1: combF1, tp: combinedTP, fp: combinedFP },
          tagProfileSize: Object.keys(tagProfile).length,
        };
      }
    }

    console.log(`\n  Total seen: ${totalSeen} | Total engaged: ${engagementCount} | Tag profile: ${Object.keys(tagProfile).length} tags`);

    // Print milestone table
    console.log(`\n  Engagements  Seen  │ Onboarding (P/R/F1)      │ Tag Profile (P/R/F1)     │ Combined (P/R/F1)        │ Winner`);
    console.log('  ' + '─'.repeat(110));

    let crossoverPoint = null;

    for (const m of milestones) {
      const r = milestoneResults[m];
      if (!r) continue;

      const onbStr = `${(r.onboarding.precision*100).toFixed(0)}%/${(r.onboarding.recall*100).toFixed(0)}%/${(r.onboarding.f1*100).toFixed(0)}%`.padEnd(22);
      const tagStr = `${(r.tagProfile.precision*100).toFixed(0)}%/${(r.tagProfile.recall*100).toFixed(0)}%/${(r.tagProfile.f1*100).toFixed(0)}%`.padEnd(22);
      const combStr = `${(r.combined.precision*100).toFixed(0)}%/${(r.combined.recall*100).toFixed(0)}%/${(r.combined.f1*100).toFixed(0)}%`.padEnd(22);

      let winner;
      if (r.tagProfile.f1 > r.onboarding.f1 + 0.05) winner = 'TAG PROFILE';
      else if (r.onboarding.f1 > r.tagProfile.f1 + 0.05) winner = 'ONBOARDING';
      else winner = 'TIE';

      if (!crossoverPoint && r.tagProfile.f1 >= r.onboarding.f1) {
        crossoverPoint = m;
      }

      console.log(`  ${String(m).padStart(11)}  ${String(r.seen).padStart(4)}  │ ${onbStr} │ ${tagStr} │ ${combStr} │ ${winner}`);
    }

    console.log(`\n  Crossover point: ${crossoverPoint || 'never reached'} engagements`);
    console.log(`  Top tag profile tags: ${Object.entries(tagProfile).sort((a,b) => b[1]-a[1]).slice(0,10).map(([t,s]) => `${t}(${s.toFixed(2)})`).join(', ')}`);

    allResults.push({
      name: persona.name,
      totalEngaged: engagementCount,
      crossoverPoint,
      milestones: milestoneResults,
    });

    console.log('');
  }

  // ===== AGGREGATE ANALYSIS =====
  console.log('\n' + '█'.repeat(75));
  console.log('  AGGREGATE ANALYSIS — Optimal Threshold');
  console.log('█'.repeat(75));

  // For each milestone, average the F1 scores across all personas
  console.log(`\n  Engagements │ Avg Onboarding F1 │ Avg Tag Profile F1 │ Avg Combined F1 │ Best Strategy`);
  console.log('  ' + '─'.repeat(85));

  let optimalThreshold = null;

  for (const m of milestones) {
    const results = allResults.filter(r => r.milestones[m]);
    if (results.length === 0) continue;

    const avgOnbF1 = results.reduce((s, r) => s + r.milestones[m].onboarding.f1, 0) / results.length;
    const avgTagF1 = results.reduce((s, r) => s + r.milestones[m].tagProfile.f1, 0) / results.length;
    const avgCombF1 = results.reduce((s, r) => s + r.milestones[m].combined.f1, 0) / results.length;

    let best;
    if (avgCombF1 > avgOnbF1 && avgCombF1 > avgTagF1) best = 'COMBINED';
    else if (avgTagF1 > avgOnbF1) best = 'TAG PROFILE ALONE';
    else best = 'ONBOARDING';

    if (!optimalThreshold && avgTagF1 >= avgOnbF1) {
      optimalThreshold = m;
    }

    const marker = m === optimalThreshold ? ' ← CROSSOVER' : '';
    console.log(`  ${String(m).padStart(12)} │ ${(avgOnbF1*100).toFixed(1).padStart(16)}% │ ${(avgTagF1*100).toFixed(1).padStart(17)}% │ ${(avgCombF1*100).toFixed(1).padStart(14)}% │ ${best}${marker}`);
  }

  // Per-persona crossover points
  console.log(`\n  Per-persona crossover points:`);
  for (const r of allResults) {
    console.log(`    ${r.name.padEnd(35)} → ${r.crossoverPoint || 'N/A'} engagements`);
  }

  const crossoverPoints = allResults.map(r => r.crossoverPoint).filter(Boolean);
  const avgCrossover = crossoverPoints.length > 0
    ? Math.round(crossoverPoints.reduce((a,b) => a+b, 0) / crossoverPoints.length)
    : null;
  const medianCrossover = crossoverPoints.length > 0
    ? crossoverPoints.sort((a,b) => a-b)[Math.floor(crossoverPoints.length/2)]
    : null;

  console.log(`\n  ═══════════════════════════════════════`);
  console.log(`  RECOMMENDED THRESHOLD`);
  console.log(`  ═══════════════════════════════════════`);
  console.log(`  Average crossover:  ${avgCrossover || 'N/A'} engagements`);
  console.log(`  Median crossover:   ${medianCrossover || 'N/A'} engagements`);
  console.log(`  Aggregate crossover: ${optimalThreshold || 'N/A'} engagements`);
  console.log(`\n  Strategy:`);
  console.log(`    engagements < threshold  →  Use COMBINED (onboarding + tag profile)`);
  console.log(`    engagements >= threshold →  Use TAG PROFILE only (onboarding fades out)`);

  if (optimalThreshold) {
    console.log(`\n  Suggested implementation:`);
    console.log(`    const ONBOARDING_FADE_THRESHOLD = ${optimalThreshold};`);
    console.log(`    const onboardingWeight = Math.max(0, 1 - (engagementCount / ONBOARDING_FADE_THRESHOLD));`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
