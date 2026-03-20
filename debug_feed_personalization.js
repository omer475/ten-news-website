#!/usr/bin/env node
/**
 * Feed Personalization Debug Script
 *
 * Investigates WHY the feed feels non-personalized by inspecting:
 * 1. User profile data (tag_profile, category_profile, taste_vector)
 * 2. Engagement history (event counts by type)
 * 3. Interest clusters
 * 4. Personal pool results (pgvector similarity search)
 * 5. Trending pool category distribution
 * 6. Discovery pool category distribution
 * 7. profiles vs users table mismatch
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ── Load .env.local ──
const envContent = readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers ──
const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

function categoryDistribution(articles) {
  const dist = {};
  for (const a of articles) {
    const cat = a.category || 'Other';
    dist[cat] = (dist[cat] || 0) + 1;
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1]);
}

function bar(count, total, width = 30) {
  const pct = total > 0 ? count / total : 0;
  const filled = Math.round(pct * width);
  return '#'.repeat(filled) + '.'.repeat(width - filled) + ` ${count} (${(pct * 100).toFixed(1)}%)`;
}

const SEPARATOR = '='.repeat(70);
const SUBSEP = '-'.repeat(50);

// ══════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════

async function main() {
  console.log(SEPARATOR);
  console.log('  FEED PERSONALIZATION DEBUG REPORT');
  console.log(`  Generated: ${new Date().toISOString()}`);
  console.log(SEPARATOR);
  console.log();

  // ── Step 1: Find real users with taste vectors ──
  console.log('STEP 1: Finding real users with taste vectors...');
  console.log(SUBSEP);

  const { data: candidateUsers, error: userErr } = await supabase
    .from('profiles')
    .select('id, taste_vector, taste_vector_minilm, tag_profile, category_profile, discovery_stats, followed_topics, followed_countries, home_country')
    .not('taste_vector', 'is', null)
    .limit(5);

  if (userErr) {
    console.error('Error querying profiles:', userErr.message);
    // Try users table as fallback
    const { data: legacyUsers, error: legacyErr } = await supabase
      .from('users')
      .select('id, taste_vector, taste_vector_minilm, tag_profile, skip_profile')
      .not('taste_vector', 'is', null)
      .limit(5);
    if (legacyErr) {
      console.error('Error querying users table too:', legacyErr.message);
      process.exit(1);
    }
    console.log(`Found ${legacyUsers?.length || 0} users in legacy 'users' table with taste vectors.`);
    if (!legacyUsers || legacyUsers.length === 0) {
      console.log('NO USERS WITH TASTE VECTORS FOUND. This is a root cause of non-personalization.');
      process.exit(0);
    }
  }

  if (!candidateUsers || candidateUsers.length === 0) {
    console.log('NO USERS WITH TASTE VECTORS FOUND in profiles table.');
    console.log('Checking users table...');
    const { data: legacyUsers } = await supabase
      .from('users')
      .select('id')
      .not('taste_vector', 'is', null)
      .limit(5);
    console.log(`Users table has ${legacyUsers?.length || 0} users with taste vectors.`);

    // Check total profiles count
    const { count: profileCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });
    console.log(`Total profiles: ${profileCount}`);

    const { count: profilesWithTaste } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('taste_vector', 'is', null);
    console.log(`Profiles with taste_vector: ${profilesWithTaste}`);

    if ((profilesWithTaste || 0) === 0 && (legacyUsers?.length || 0) === 0) {
      console.log('\n*** ROOT CAUSE: Zero users have taste vectors. The embedding pipeline may not be running. ***');
      process.exit(0);
    }
  }

  console.log(`Found ${candidateUsers.length} candidate users:`);
  for (const u of candidateUsers) {
    const tasteVec = safeJsonParse(u.taste_vector, null);
    const tasteVecMinilm = safeJsonParse(u.taste_vector_minilm, null);
    const tagProfile = safeJsonParse(u.tag_profile, {});
    const tagCount = Object.keys(tagProfile).filter(k => !k.startsWith('_')).length;
    const topics = safeJsonParse(u.followed_topics, []);
    console.log(`  - ${u.id.substring(0, 12)}... | taste_vec: ${Array.isArray(tasteVec) ? tasteVec.length + 'd' : 'JSONB obj'} | minilm: ${tasteVecMinilm ? 'yes' : 'no'} | tags: ${tagCount} | topics: ${topics.length}`);
  }
  console.log();

  // ── Pick the user with the most tag_profile data (most engaged) ──
  let selectedUser = candidateUsers[0];
  let maxTags = 0;
  for (const u of candidateUsers) {
    const tp = safeJsonParse(u.tag_profile, {});
    const count = Object.keys(tp).filter(k => !k.startsWith('_')).length;
    if (count > maxTags) {
      maxTags = count;
      selectedUser = u;
    }
  }

  const userId = selectedUser.id;
  console.log(`Selected user for deep analysis: ${userId}`);
  console.log();

  // ══════════════════════════════════════════════
  // STEP 2: User Profile Analysis
  // ══════════════════════════════════════════════
  console.log(SEPARATOR);
  console.log('STEP 2: USER PROFILE ANALYSIS');
  console.log(SEPARATOR);

  // 2a. Tag Profile
  console.log('\n2a. TAG PROFILE (what the algorithm thinks they like):');
  console.log(SUBSEP);
  const tagProfile = safeJsonParse(selectedUser.tag_profile, {});
  const tagEntries = Object.entries(tagProfile)
    .filter(([k]) => !k.startsWith('_'))
    .sort((a, b) => b[1] - a[1]);

  if (tagEntries.length === 0) {
    console.log('  *** EMPTY TAG PROFILE ***');
    console.log('  The algorithm has NO entity-level signal about what this user likes.');
    console.log('  This means scoring relies entirely on taste_vector similarity (cosine).');
  } else {
    console.log(`  Total tags: ${tagEntries.length}`);
    console.log(`  Top 20 tags:`);
    for (const [tag, weight] of tagEntries.slice(0, 20)) {
      const barStr = '#'.repeat(Math.round(weight * 30));
      console.log(`    ${tag.padEnd(30)} ${typeof weight === 'number' ? weight.toFixed(3) : JSON.stringify(weight).substring(0, 20)} ${barStr}`);
    }
    if (tagEntries.length > 20) {
      console.log(`    ... and ${tagEntries.length - 20} more tags`);
    }
    // Check for _new_interests
    const newInterests = tagProfile._new_interests;
    if (newInterests) {
      console.log(`\n  New interests (velocity boost): ${JSON.stringify(newInterests).substring(0, 200)}`);
    }
    const lastUpdated = tagProfile._last_updated;
    if (lastUpdated) {
      const age = Date.now() - lastUpdated;
      console.log(`  Last updated: ${new Date(lastUpdated).toISOString()} (${(age / 3600000).toFixed(1)}h ago)`);
    }
  }

  // 2b. Category Profile
  console.log('\n2b. CATEGORY PROFILE (engagement rates):');
  console.log(SUBSEP);
  const categoryProfile = safeJsonParse(selectedUser.category_profile, {});
  const catEntries = Object.entries(categoryProfile).sort((a, b) => {
    const rateA = a[1].shown > 0 ? a[1].engaged / a[1].shown : 0;
    const rateB = b[1].shown > 0 ? b[1].engaged / b[1].shown : 0;
    return rateB - rateA;
  });

  if (catEntries.length === 0) {
    console.log('  *** EMPTY CATEGORY PROFILE ***');
    console.log('  No category engagement data. categoryAffinity defaults to 0.5 for all.');
  } else {
    console.log(`  ${'Category'.padEnd(20)} ${'Shown'.padStart(6)} ${'Engaged'.padStart(8)} ${'Rate'.padStart(8)}  Visual`);
    for (const [cat, data] of catEntries) {
      const shown = data.shown || 0;
      const engaged = data.engaged || 0;
      const rate = shown > 0 ? (engaged / shown) : 0;
      const rateBar = '#'.repeat(Math.round(rate * 20));
      console.log(`  ${cat.padEnd(20)} ${String(shown).padStart(6)} ${String(engaged).padStart(8)} ${(rate * 100).toFixed(1).padStart(7)}%  ${rateBar}`);
    }
  }

  // 2c. Taste Vector
  console.log('\n2c. TASTE VECTOR STATUS:');
  console.log(SUBSEP);
  const tasteVec = safeJsonParse(selectedUser.taste_vector, null);
  const tasteVecMinilm = safeJsonParse(selectedUser.taste_vector_minilm, null);
  if (!tasteVec) {
    console.log('  *** NO TASTE VECTOR ***');
    console.log('  Without a taste vector, the personal pool (pgvector search) is EMPTY.');
    console.log('  Feed falls back to trending + discovery only.');
  } else {
    const vecArray = Array.isArray(tasteVec) ? tasteVec : (typeof tasteVec === 'object' ? Object.values(tasteVec) : []);
    console.log(`  Taste vector: ${vecArray.length} dimensions`);
    const nonZero = vecArray.filter(v => Math.abs(v) > 0.001).length;
    console.log(`  Non-zero elements: ${nonZero} / ${vecArray.length} (${(nonZero / vecArray.length * 100).toFixed(1)}% active)`);
    const magnitude = Math.sqrt(vecArray.reduce((s, v) => s + v * v, 0));
    console.log(`  Vector magnitude: ${magnitude.toFixed(4)}`);
    // Check if vector is degenerate (all same values)
    const unique = new Set(vecArray.map(v => v.toFixed(6)));
    if (unique.size < 10) {
      console.log(`  *** WARNING: Vector has only ${unique.size} unique values — likely degenerate! ***`);
    }
  }
  if (tasteVecMinilm) {
    const mlArray = Array.isArray(tasteVecMinilm) ? tasteVecMinilm : Object.values(tasteVecMinilm);
    console.log(`  MiniLM taste vector: ${mlArray.length} dimensions (used for search: ${!!tasteVecMinilm})`);
  } else {
    console.log('  MiniLM taste vector: NOT PRESENT');
  }

  // 2d. Followed topics
  console.log('\n2d. FOLLOWED TOPICS / COUNTRIES:');
  console.log(SUBSEP);
  const followedTopics = safeJsonParse(selectedUser.followed_topics, []);
  const followedCountries = safeJsonParse(selectedUser.followed_countries, []);
  console.log(`  Followed topics: ${followedTopics.length > 0 ? followedTopics.join(', ') : 'NONE'}`);
  console.log(`  Followed countries: ${followedCountries.length > 0 ? followedCountries.join(', ') : 'NONE'}`);
  console.log(`  Home country: ${selectedUser.home_country || 'NOT SET'}`);

  // 2e. Discovery stats
  console.log('\n2e. DISCOVERY STATS:');
  console.log(SUBSEP);
  const discoveryStats = safeJsonParse(selectedUser.discovery_stats, {});
  if (Object.keys(discoveryStats).length === 0) {
    console.log('  No discovery stats recorded.');
  } else {
    for (const [cat, data] of Object.entries(discoveryStats)) {
      const rate = data.shown > 0 ? (data.engaged / data.shown) : 0;
      const status = data.shown >= 5 && rate < 0.15 ? ' [BLOCKED - low engagement]' : '';
      console.log(`  ${cat.padEnd(20)} shown=${data.shown} engaged=${data.engaged} rate=${(rate * 100).toFixed(1)}%${status}`);
    }
  }

  // ══════════════════════════════════════════════
  // STEP 3: Engagement History (last 7 days)
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 3: ENGAGEMENT HISTORY (last 7 days)');
  console.log(SEPARATOR);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: events, error: eventErr } = await supabase
    .from('user_article_events')
    .select('event_type, article_id')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo);

  if (eventErr) {
    console.log(`  Error fetching events: ${eventErr.message}`);
  } else if (!events || events.length === 0) {
    console.log('  *** ZERO EVENTS IN LAST 7 DAYS ***');
    console.log('  The user has not interacted with any articles recently.');
    console.log('  Without engagement signals, the feed cannot learn preferences.');
  } else {
    const eventCounts = {};
    const engagedArticleIds = new Set();
    for (const e of events) {
      eventCounts[e.event_type] = (eventCounts[e.event_type] || 0) + 1;
      if (['article_engaged', 'article_saved', 'article_detail_view'].includes(e.event_type)) {
        engagedArticleIds.add(e.article_id);
      }
    }
    console.log(`  Total events: ${events.length}`);
    for (const [type, count] of Object.entries(eventCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type.padEnd(30)} ${bar(count, events.length)}`);
    }
    console.log(`  Unique engaged articles: ${engagedArticleIds.size}`);

    // Get category distribution of engaged articles
    if (engagedArticleIds.size > 0) {
      const engagedIds = [...engagedArticleIds].slice(0, 200);
      const { data: engagedArticles } = await supabase
        .from('published_articles')
        .select('id, category, interest_tags')
        .in('id', engagedIds);

      if (engagedArticles && engagedArticles.length > 0) {
        console.log('\n  Categories of ENGAGED articles:');
        const engCatDist = categoryDistribution(engagedArticles);
        for (const [cat, count] of engCatDist) {
          console.log(`    ${cat.padEnd(20)} ${bar(count, engagedArticles.length)}`);
        }

        // Tag distribution of engaged articles
        const engTagFreq = {};
        for (const a of engagedArticles) {
          const tags = safeJsonParse(a.interest_tags, []);
          for (const t of tags) {
            const tl = t.toLowerCase();
            engTagFreq[tl] = (engTagFreq[tl] || 0) + 1;
          }
        }
        const topEngTags = Object.entries(engTagFreq).sort((a, b) => b[1] - a[1]).slice(0, 15);
        console.log('\n  Top 15 tags in ENGAGED articles:');
        for (const [tag, count] of topEngTags) {
          console.log(`    ${tag.padEnd(30)} ${count}x`);
        }
      }
    }
  }

  // ══════════════════════════════════════════════
  // STEP 4: Interest Clusters
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 4: USER INTEREST CLUSTERS');
  console.log(SEPARATOR);

  const { data: clusters, error: clusterErr } = await supabase
    .from('user_interest_clusters')
    .select('cluster_index, article_count, label, medoid_article_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('article_count', { ascending: false });

  if (clusterErr) {
    console.log(`  Error: ${clusterErr.message}`);
  } else if (!clusters || clusters.length === 0) {
    console.log('  *** NO INTEREST CLUSTERS ***');
    console.log('  Single taste_vector only. Multi-interest detection not active.');
    console.log('  If the user has varied interests, they all collapse into one averaged vector.');
  } else {
    console.log(`  ${clusters.length} cluster(s):`);
    for (const c of clusters) {
      console.log(`    Cluster ${c.cluster_index}: "${c.label || 'unlabeled'}" | articles: ${c.article_count} | medoid: ${c.medoid_article_id} | updated: ${c.updated_at}`);
    }

    // Check proportional allocation
    const totalArticles = clusters.reduce((s, c) => s + (c.article_count || 1), 0);
    console.log('\n  Proportional allocation (used for personal pool):');
    for (const c of clusters) {
      const weight = Math.min((c.article_count || 1) / Math.max(totalArticles, 1), 0.5);
      const allocation = Math.max(1, Math.round(weight * 150));
      console.log(`    Cluster ${c.cluster_index}: weight=${(weight * 100).toFixed(1)}% -> ~${allocation} articles in personal pool`);
    }
  }

  // ══════════════════════════════════════════════
  // STEP 5: Simulate Feed Pools
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 5: SIMULATED FEED POOLS');
  console.log(SEPARATOR);

  const now = Date.now();
  const twentyFourHoursAgo = new Date(now - 24 * 3600000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 3600000).toISOString();

  // 5a. Personal Pool (pgvector search)
  console.log('\n5a. PERSONAL POOL (taste vector similarity search):');
  console.log(SUBSEP);

  let personalResults = [];
  const hasTasteVec = !!tasteVec;
  const hasMinilm = !!tasteVecMinilm;
  const hasClusters = clusters && clusters.length > 0;

  if (!hasTasteVec && !hasMinilm) {
    console.log('  *** SKIPPED: No taste vector to search with ***');
    console.log('  Personal pool will be EMPTY. Feed is 100% trending + discovery.');
  } else {
    // Determine which RPC to call
    let rpcName, rpcParams;
    if (hasClusters && hasMinilm) {
      rpcName = 'match_articles_multi_cluster_minilm';
      rpcParams = { p_user_id: userId, match_per_cluster: 50, hours_window: 720, exclude_ids: null, min_similarity: 0 };
    } else if (hasClusters) {
      rpcName = 'match_articles_multi_cluster';
      rpcParams = { p_user_id: userId, match_per_cluster: 50, hours_window: 720, exclude_ids: null, min_similarity: 0 };
    } else if (hasMinilm) {
      rpcName = 'match_articles_personal_minilm';
      rpcParams = { query_embedding: tasteVecMinilm, match_count: 150, hours_window: 720, exclude_ids: null, min_similarity: 0 };
    } else {
      rpcName = 'match_articles_personal';
      rpcParams = { query_embedding: tasteVec, match_count: 150, hours_window: 720, exclude_ids: null, min_similarity: 0 };
    }

    console.log(`  RPC: ${rpcName} (hours_window=720 = 30 days)`);
    const { data: personalRaw, error: personalErr } = await supabase.rpc(rpcName, rpcParams);

    if (personalErr) {
      console.log(`  ERROR: ${personalErr.message}`);
      console.log(`  *** Personal pool search FAILED. This means feed has NO personalized content. ***`);
    } else if (!personalRaw || personalRaw.length === 0) {
      console.log('  *** ZERO RESULTS from pgvector search ***');
      console.log('  Possible causes:');
      console.log('    - No articles have embeddings (embedding_vec column is NULL)');
      console.log('    - Taste vector is incompatible dimension');
      console.log('    - No articles within 720h window');
    } else {
      personalResults = personalRaw;
      console.log(`  Results: ${personalResults.length} articles matched`);

      // Similarity distribution
      const sims = personalResults.map(r => r.similarity);
      const avgSim = sims.reduce((s, v) => s + v, 0) / sims.length;
      const maxSim = Math.max(...sims);
      const minSim = Math.min(...sims);
      const medianSim = sims.sort((a, b) => a - b)[Math.floor(sims.length / 2)];
      console.log(`  Similarity: min=${minSim.toFixed(4)} median=${medianSim.toFixed(4)} avg=${avgSim.toFixed(4)} max=${maxSim.toFixed(4)}`);

      // Similarity buckets
      const simBuckets = { '0.9+': 0, '0.8-0.9': 0, '0.7-0.8': 0, '0.6-0.7': 0, '0.5-0.6': 0, '<0.5': 0 };
      for (const s of sims) {
        if (s >= 0.9) simBuckets['0.9+']++;
        else if (s >= 0.8) simBuckets['0.8-0.9']++;
        else if (s >= 0.7) simBuckets['0.7-0.8']++;
        else if (s >= 0.6) simBuckets['0.6-0.7']++;
        else if (s >= 0.5) simBuckets['0.5-0.6']++;
        else simBuckets['<0.5']++;
      }
      console.log('  Similarity distribution:');
      for (const [bucket, count] of Object.entries(simBuckets)) {
        if (count > 0) console.log(`    ${bucket.padEnd(10)} ${bar(count, sims.length)}`);
      }

      // Fetch article details for top 20
      const top20Ids = personalResults.slice(0, 20).map(r => r.id);
      const { data: top20Articles } = await supabase
        .from('published_articles')
        .select('id, title_news, category, interest_tags, ai_final_score, created_at')
        .in('id', top20Ids);

      if (top20Articles) {
        // Build id->article map
        const artMap = {};
        for (const a of top20Articles) artMap[a.id] = a;

        console.log('\n  TOP 20 PERSONAL RESULTS:');
        console.log(`  ${'#'.padStart(3)} ${'Sim'.padStart(6)} ${'Score'.padStart(5)} ${'Category'.padEnd(15)} Title`);
        for (let i = 0; i < Math.min(20, personalResults.length); i++) {
          const r = personalResults[i];
          const a = artMap[r.id];
          if (!a) continue;
          const title = (a.title_news || '').substring(0, 60);
          console.log(`  ${String(i + 1).padStart(3)} ${r.similarity.toFixed(4)} ${String(a.ai_final_score || 0).padStart(5)} ${(a.category || '?').padEnd(15)} ${title}`);
        }

        // Category distribution of ALL personal results
        const allPersonalIds = personalResults.map(r => r.id);
        let allPersonalArticles = [];
        for (let i = 0; i < allPersonalIds.length; i += 300) {
          const batch = allPersonalIds.slice(i, i + 300);
          const { data } = await supabase
            .from('published_articles')
            .select('id, category')
            .in('id', batch);
          if (data) allPersonalArticles.push(...data);
        }

        console.log('\n  PERSONAL POOL CATEGORY DISTRIBUTION:');
        const pCatDist = categoryDistribution(allPersonalArticles);
        for (const [cat, count] of pCatDist) {
          console.log(`    ${cat.padEnd(20)} ${bar(count, allPersonalArticles.length)}`);
        }

        // Check for single-category dominance
        if (pCatDist.length > 0) {
          const topCatPct = pCatDist[0][1] / allPersonalArticles.length;
          if (topCatPct > 0.5) {
            console.log(`\n  *** WARNING: ${pCatDist[0][0]} dominates ${(topCatPct * 100).toFixed(1)}% of personal pool ***`);
            console.log(`  This means ~60% of the feed (personal slots) shows mostly ${pCatDist[0][0]}.`);
          }
        }
      }
    }
  }

  // 5b. Trending Pool
  console.log('\n5b. TRENDING POOL (ai_final_score >= 750, last 24h):');
  console.log(SUBSEP);

  const { data: trendingArticles, error: trendErr } = await supabase
    .from('published_articles')
    .select('id, category, ai_final_score, created_at, title_news')
    .gte('created_at', twentyFourHoursAgo)
    .gte('ai_final_score', 750)
    .order('ai_final_score', { ascending: false })
    .limit(50);

  if (trendErr) {
    console.log(`  Error: ${trendErr.message}`);
  } else if (!trendingArticles || trendingArticles.length === 0) {
    console.log('  *** ZERO TRENDING ARTICLES (last 24h, score >= 750) ***');
    console.log('  Checking lower threshold...');
    const { data: lowerTrending } = await supabase
      .from('published_articles')
      .select('id, category, ai_final_score')
      .gte('created_at', twentyFourHoursAgo)
      .gte('ai_final_score', 400)
      .order('ai_final_score', { ascending: false })
      .limit(50);
    console.log(`  With score >= 400: ${lowerTrending?.length || 0} articles`);
  } else {
    console.log(`  ${trendingArticles.length} trending articles:`);
    const tCatDist = categoryDistribution(trendingArticles);
    for (const [cat, count] of tCatDist) {
      console.log(`    ${cat.padEnd(20)} ${bar(count, trendingArticles.length)}`);
    }

    // Show top 5
    console.log('\n  Top 5 trending:');
    for (const a of trendingArticles.slice(0, 5)) {
      console.log(`    [${a.ai_final_score}] ${(a.category || '?').padEnd(15)} ${(a.title_news || '').substring(0, 60)}`);
    }
  }

  // 5c. Discovery Pool
  console.log('\n5c. DISCOVERY POOL (ai_final_score >= 400, last 30 days):');
  console.log(SUBSEP);

  const { data: discoveryArticles, error: discErr } = await supabase
    .from('published_articles')
    .select('id, category, ai_final_score')
    .gte('created_at', thirtyDaysAgo)
    .gte('ai_final_score', 400)
    .order('ai_final_score', { ascending: false })
    .limit(200);

  if (discErr) {
    console.log(`  Error: ${discErr.message}`);
  } else {
    console.log(`  ${discoveryArticles?.length || 0} discovery-eligible articles:`);
    if (discoveryArticles && discoveryArticles.length > 0) {
      const dCatDist = categoryDistribution(discoveryArticles);
      for (const [cat, count] of dCatDist) {
        console.log(`    ${cat.padEnd(20)} ${bar(count, discoveryArticles.length)}`);
      }
    }
  }

  // ══════════════════════════════════════════════
  // STEP 6: Interest Enrichment
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 6: INTEREST ENRICHMENT (followed topics -> categories/tags)');
  console.log(SEPARATOR);

  const ONBOARDING_TOPIC_MAP = {
    'War & Conflict': { categories: ['Politics'], tags: ['war', 'conflict', 'military'] },
    'US Politics': { categories: ['Politics'], tags: ['us politics', 'congress', 'senate', 'white house'] },
    'NFL': { categories: ['Sports'], tags: ['nfl', 'american football', 'super bowl'] },
    'NBA': { categories: ['Sports'], tags: ['nba', 'basketball'] },
    'Soccer/Football': { categories: ['Sports'], tags: ['soccer', 'football', 'premier league'] },
    'AI & Machine Learning': { categories: ['Tech'], tags: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai'] },
    'Movies & Film': { categories: ['Entertainment'], tags: ['movies', 'film', 'box office', 'hollywood'] },
    'Stock Markets': { categories: ['Finance', 'Business'], tags: ['stock market', 'wall street', 'nasdaq'] },
    'Bitcoin': { categories: ['Finance', 'Tech'], tags: ['bitcoin', 'btc'] },
    'Climate & Environment': { categories: ['Science'], tags: ['climate', 'environment', 'global warming'] },
  };

  if (followedTopics.length === 0) {
    console.log('  User has NO followed topics (no onboarding selections).');
    console.log('  Interest enrichment is INACTIVE. No category-specific boosting.');
  } else {
    const interestCats = new Set();
    const interestTagSet = new Set();
    for (const topic of followedTopics) {
      const mapping = ONBOARDING_TOPIC_MAP[topic];
      if (mapping) {
        mapping.categories.forEach(c => interestCats.add(c));
        mapping.tags.forEach(t => interestTagSet.add(t));
      }
      console.log(`  Topic: "${topic}" -> categories: ${mapping ? mapping.categories.join(', ') : 'UNMAPPED'}`);
    }
    console.log(`\n  Interest categories: ${[...interestCats].join(', ')}`);
    console.log(`  Interest tags: ${[...interestTagSet].join(', ')}`);

    // Count articles available per interest category
    for (const cat of interestCats) {
      const { count } = await supabase
        .from('published_articles')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat)
        .gte('created_at', thirtyDaysAgo)
        .gte('ai_final_score', 150);
      console.log(`  Available "${cat}" articles (30d, score>=150): ${count}`);
    }
  }

  // ══════════════════════════════════════════════
  // STEP 7: Holdback Check
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 7: HOLDBACK GROUP CHECK');
  console.log(SEPARATOR);

  const hashCode = userId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const isHoldback = Math.abs(hashCode) % 10 === 0;
  console.log(`  User hash: ${hashCode}, mod 10 = ${Math.abs(hashCode) % 10}`);
  console.log(`  In holdback group: ${isHoldback ? 'YES (using legacy scoring)' : 'NO (using unified scoring)'}`);
  if (isHoldback) {
    console.log('  *** The holdback group uses OLD scoring without category affinity, velocity boost, etc. ***');
  }

  // ══════════════════════════════════════════════
  // STEP 8: profiles vs users table mismatch
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 8: PROFILES vs USERS TABLE MISMATCH CHECK');
  console.log(SEPARATOR);

  // Check if this user exists in users table
  const { data: usersRow, error: usersErr } = await supabase
    .from('users')
    .select('id, taste_vector, taste_vector_minilm, skip_profile, tag_profile, home_country, followed_topics, followed_countries')
    .eq('id', userId)
    .single();

  // Also check auth_user_id link
  const { data: linkedUser } = await supabase
    .from('users')
    .select('id, taste_vector, tag_profile, auth_user_id')
    .eq('auth_user_id', userId)
    .single();

  if (usersErr && !linkedUser) {
    console.log(`  User ${userId.substring(0, 12)}... NOT found in users table (by id or auth_user_id).`);
    console.log('  This is fine IF profiles table is the primary. Feed code checks profiles first.');
  } else {
    const uRow = usersRow || linkedUser;
    console.log(`  Found in users table: ${uRow?.id?.substring(0, 12)}...`);

    // Compare key fields
    const profileTasteVec = !!tasteVec;
    const usersTasteVec = !!uRow?.taste_vector;
    const profileTagProfile = Object.keys(safeJsonParse(selectedUser.tag_profile, {})).filter(k => !k.startsWith('_')).length;
    const usersTagProfile = Object.keys(safeJsonParse(uRow?.tag_profile, {})).filter(k => !k.startsWith('_')).length;

    console.log(`  ${'Field'.padEnd(25)} ${'profiles'.padEnd(15)} ${'users'.padEnd(15)} ${'Match?'}`);
    console.log(`  ${'taste_vector'.padEnd(25)} ${String(profileTasteVec).padEnd(15)} ${String(usersTasteVec).padEnd(15)} ${profileTasteVec === usersTasteVec ? 'OK' : 'MISMATCH!'}`);
    console.log(`  ${'tag_profile entries'.padEnd(25)} ${String(profileTagProfile).padEnd(15)} ${String(usersTagProfile).padEnd(15)} ${profileTagProfile === usersTagProfile ? 'OK' : 'MISMATCH!'}`);
    console.log(`  ${'skip_profile'.padEnd(25)} ${String(!!safeJsonParse(selectedUser.skip_profile, null)).padEnd(15)} ${String(!!uRow?.skip_profile).padEnd(15)}`);

    if (profileTasteVec !== usersTasteVec) {
      console.log('\n  *** MISMATCH: taste_vector exists in one table but not the other! ***');
      console.log('  The feed code reads from profiles first. If taste_vector is missing there,');
      console.log('  but present in users, the feed WILL NOT USE IT.');
    }
  }

  // ══════════════════════════════════════════════
  // STEP 9: Article Embedding Coverage
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 9: ARTICLE EMBEDDING COVERAGE');
  console.log(SEPARATOR);

  const { count: totalArticles } = await supabase
    .from('published_articles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo);

  const { count: withEmbedding } = await supabase
    .from('published_articles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo)
    .not('embedding_vec', 'is', null);

  const { count: withMinilm } = await supabase
    .from('published_articles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo)
    .not('embedding_minilm_vec', 'is', null);

  console.log(`  Articles in last 30 days: ${totalArticles}`);
  console.log(`  With embedding_vec (3072d): ${withEmbedding} (${totalArticles > 0 ? ((withEmbedding || 0) / totalArticles * 100).toFixed(1) : 0}%)`);
  console.log(`  With embedding_minilm_vec (384d): ${withMinilm} (${totalArticles > 0 ? ((withMinilm || 0) / totalArticles * 100).toFixed(1) : 0}%)`);

  if ((withEmbedding || 0) < (totalArticles || 0) * 0.5) {
    console.log(`\n  *** WARNING: Less than 50% of articles have embeddings! ***`);
    console.log('  The personal pool can only match articles WITH embeddings.');
    console.log('  Missing embeddings = invisible articles to the personalization engine.');
  }

  // Check recent articles specifically (last 24h)
  const { count: recent24h } = await supabase
    .from('published_articles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', twentyFourHoursAgo);

  const { count: recent24hEmb } = await supabase
    .from('published_articles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', twentyFourHoursAgo)
    .not('embedding_vec', 'is', null);

  console.log(`\n  Last 24h articles: ${recent24h}`);
  console.log(`  Last 24h with embeddings: ${recent24hEmb} (${recent24h > 0 ? ((recent24hEmb || 0) / recent24h * 100).toFixed(1) : 0}%)`);

  // ══════════════════════════════════════════════
  // STEP 10: Slot Pattern Analysis
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('STEP 10: SLOT PATTERN & FINAL FEED COMPOSITION');
  console.log(SEPARATOR);

  const hasAnyPersonalization = hasTasteVec || hasMinilm || hasClusters;
  console.log(`  hasAnyPersonalization: ${hasAnyPersonalization}`);
  console.log(`  Has followed topics: ${followedTopics.length > 0}`);

  if (!hasAnyPersonalization) {
    console.log('  -> Cold-start path: Thompson Sampling bandit (all trending + discovery).');
    console.log('  Feed is NOT personalized at all. It shows the best articles by category.');
  } else if (followedTopics.length > 0) {
    console.log('  -> Interest quota path: 80% from interest categories, 20% diversity.');
    console.log(`  Interest categories: ${[...new Set(followedTopics.flatMap(t => ONBOARDING_TOPIC_MAP[t]?.categories || []))].join(', ') || 'NONE'}`);
  } else {
    console.log('  -> Standard personalized path: slot pattern P P T P P S P P T S');
    console.log('  ~60% personal (pgvector), ~20% trending, ~20% discovery/surprise');
  }

  // Compute what the actual mix would look like
  const personalCount = personalResults.length;
  const trendingCount = trendingArticles?.length || 0;
  const discoveryCount = discoveryArticles?.length || 0;

  console.log(`\n  Pool sizes: Personal=${personalCount}, Trending=${trendingCount}, Discovery=${discoveryCount}`);
  if (personalCount === 0 && hasAnyPersonalization) {
    console.log('  *** CRITICAL: Personal pool is EMPTY despite having a taste vector ***');
    console.log('  This means pgvector search returned zero results.');
    console.log('  Likely causes: embedding dimension mismatch, NULL embeddings, or stale data.');
  }

  // ══════════════════════════════════════════════
  // DIAGNOSIS SUMMARY
  // ══════════════════════════════════════════════
  console.log('\n' + SEPARATOR);
  console.log('DIAGNOSIS SUMMARY');
  console.log(SEPARATOR);

  const issues = [];

  if (!hasTasteVec && !hasMinilm) {
    issues.push('NO TASTE VECTOR: Feed has no embedding to search with. Personal pool is empty.');
  }
  if (personalResults.length === 0 && (hasTasteVec || hasMinilm)) {
    issues.push('EMPTY PERSONAL POOL: Taste vector exists but pgvector search returned 0 results. Check embedding dimensions/coverage.');
  }
  if (personalResults.length > 0) {
    const pCats = categoryDistribution(personalResults.map(r => ({ category: 'unknown' })));
    // Actually fetch categories for real analysis
    const allPIds = personalResults.map(r => r.id);
    let catCheckArticles = [];
    for (let i = 0; i < allPIds.length; i += 300) {
      const { data } = await supabase.from('published_articles').select('id, category').in('id', allPIds.slice(i, i + 300));
      if (data) catCheckArticles.push(...data);
    }
    const catDist = categoryDistribution(catCheckArticles);
    if (catDist.length > 0 && catDist[0][1] / catCheckArticles.length > 0.5) {
      issues.push(`CATEGORY DOMINANCE: ${catDist[0][0]} is ${(catDist[0][1] / catCheckArticles.length * 100).toFixed(0)}% of personal pool. Taste vector may be biased.`);
    }
  }
  if (tagEntries.length === 0) {
    issues.push('EMPTY TAG PROFILE: No entity-level preferences. tagOverlap scoring component = 0.');
  }
  if (catEntries.length === 0) {
    issues.push('EMPTY CATEGORY PROFILE: No category engagement data. categoryAffinity defaults to 0.5 for all.');
  }
  if (followedTopics.length === 0) {
    issues.push('NO FOLLOWED TOPICS: Interest enrichment inactive. No onboarding preferences to bootstrap from.');
  }
  if (isHoldback) {
    issues.push('HOLDBACK GROUP: User is in 10% holdback, using legacy scoring without advanced features.');
  }
  if ((withEmbedding || 0) < (totalArticles || 0) * 0.5) {
    issues.push(`LOW EMBEDDING COVERAGE: Only ${((withEmbedding || 0) / (totalArticles || 1) * 100).toFixed(0)}% of articles have embeddings. Many articles invisible to personal pool.`);
  }
  if (events && events.length < 10) {
    issues.push(`LOW ENGAGEMENT: Only ${events?.length || 0} events in 7 days. Not enough signal for taste vector to be meaningful.`);
  }
  if (personalResults.length > 0) {
    const avgSim = personalResults.reduce((s, r) => s + r.similarity, 0) / personalResults.length;
    if (avgSim < 0.3) {
      issues.push(`LOW SIMILARITY SCORES: Average similarity is ${avgSim.toFixed(3)}. Taste vector may be poorly calibrated.`);
    }
  }

  if (issues.length === 0) {
    console.log('  No obvious issues detected. The feed should be personalized.');
    console.log('  Possible non-detectable issues:');
    console.log('  - Taste vector updated but pointing to generic content');
    console.log('  - Too many "seen" articles being excluded');
    console.log('  - MMR diversity over-diversifying away from preferences');
  } else {
    console.log(`  Found ${issues.length} potential issue(s):\n`);
    for (let i = 0; i < issues.length; i++) {
      console.log(`  ${i + 1}. ${issues[i]}`);
    }
  }

  console.log('\n' + SEPARATOR);
  console.log('END OF REPORT');
  console.log(SEPARATOR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
