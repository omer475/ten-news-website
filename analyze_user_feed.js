const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/omersogancioglu/Ten News Website/.env.local' });

const PERS_ID = '500e8af3-ebef-4a38-aba7-63b39879aba1';

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
}

(async () => {
  try {
    // ============================================================
    // 1. GET USER PROFILE + CLUSTERS
    // ============================================================
    console.log('='.repeat(80));
    console.log('FEED QUALITY ANALYSIS FOR USER:', PERS_ID);
    console.log('='.repeat(80));

    const { data: profile, error: profileErr } = await s
      .from('personalization_profiles')
      .select('taste_vector_minilm, session_taste_vector_minilm, phase, total_interactions, auth_profile_id, guest_device_id, created_at, updated_at, last_clustered_at')
      .eq('personalization_id', PERS_ID)
      .single();

    if (profileErr) { console.error('Profile error:', profileErr.message); return; }
    if (!profile) { console.error('No profile found for', PERS_ID); return; }

    console.log('\n--- USER PROFILE ---');
    console.log('Phase:', profile.phase);
    console.log('Total interactions:', profile.total_interactions);
    console.log('Created:', profile.created_at);
    console.log('Updated:', profile.updated_at);
    console.log('Last clustered:', profile.last_clustered_at);
    console.log('Taste vector present:', !!profile.taste_vector_minilm, profile.taste_vector_minilm ? `(${profile.taste_vector_minilm.length}d)` : '');
    console.log('Session taste vector present:', !!profile.session_taste_vector_minilm, profile.session_taste_vector_minilm ? `(${profile.session_taste_vector_minilm.length}d)` : '');

    const { data: clusters, error: clusterErr } = await s
      .from('user_interest_clusters')
      .select('*')
      .eq('personalization_id', PERS_ID)
      .order('importance_score', { ascending: false });

    console.log('\n--- INTEREST CLUSTERS ---');
    if (clusters && clusters.length > 0) {
      for (const c of clusters) {
        console.log(`  Cluster ${c.cluster_index}: importance=${(c.importance_score * 100).toFixed(1)}%, articles=${c.article_count}, last_engaged=${c.last_engaged_at}`);
      }
    } else {
      console.log('  No clusters found (or error:', clusterErr?.message, ')');
    }

    // ============================================================
    // 2. GET ARTICLES SEEN IN LAST 60 MINUTES
    // ============================================================
    const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Resolve the user_id used in user_article_events
    // personalization_profiles has auth_profile_id and guest_device_id
    const userId = profile.auth_profile_id || profile.guest_device_id;
    console.log('\n--- RESOLVED USER ID ---');
    console.log('auth_profile_id:', profile.auth_profile_id);
    console.log('guest_device_id:', profile.guest_device_id);
    console.log('Using for events lookup:', userId);

    // Get events from user_article_events
    const { data: events, error: eventsErr } = await s
      .from('user_article_events')
      .select('article_id, event_type, metadata, created_at, view_seconds, category')
      .eq('user_id', userId)
      .gte('created_at', sixtyMinAgo)
      .order('created_at', { ascending: false })
      .limit(200);

    if (eventsErr) { console.error('Events error:', eventsErr.message); }

    console.log('\n--- EVENTS IN LAST 60 MINUTES ---');
    console.log('Total events:', events?.length || 0);

    if (!events || events.length === 0) {
      console.log('No events in last 60 minutes. Expanding to last 24 hours...');

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: events24, error: events24Err } = await s
        .from('user_article_events')
        .select('article_id, event_type, metadata, created_at, view_seconds, category')
        .eq('user_id', userId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(200);

      if (events24Err) { console.error('Events24 error:', events24Err.message); }
      console.log('Events in last 24h:', events24?.length || 0);

      if (!events24 || events24.length === 0) {
        // Try even wider window
        const { data: recentEvents } = await s
          .from('user_article_events')
          .select('article_id, event_type, metadata, created_at, view_seconds, category')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        console.log('Most recent events at all:', recentEvents?.length || 0);
        if (recentEvents && recentEvents.length > 0) {
          console.log('Latest event:', recentEvents[0].created_at, recentEvents[0].event_type);
          console.log('Oldest in batch:', recentEvents[recentEvents.length - 1].created_at);
        }
      }

      // Use 24h events for analysis
      var analysisEvents = events24 || [];
    } else {
      var analysisEvents = events;
    }

    // Deduplicate: group events by article_id
    const articleEventMap = {};
    for (const e of analysisEvents) {
      if (!e.article_id) continue;
      if (!articleEventMap[e.article_id]) {
        articleEventMap[e.article_id] = { events: [], bucket: null, category: e.category };
      }
      articleEventMap[e.article_id].events.push(e);
      if (e.metadata?.bucket) articleEventMap[e.article_id].bucket = e.metadata.bucket;
    }

    const articleIds = Object.keys(articleEventMap).map(id => parseInt(id)).filter(id => !isNaN(id));
    console.log('Unique articles seen:', articleIds.length);

    if (articleIds.length === 0) {
      console.log('\nNo article events to analyze. Skipping per-article analysis.');
    } else {
      // Fetch article details including embeddings
      const { data: articles, error: artErr } = await s
        .from('published_articles')
        .select('id, title_news, category, interest_tags, embedding_minilm, ai_final_score')
        .in('id', articleIds);

      if (artErr) { console.error('Published articles error:', artErr.message); }

      const articleMap = {};
      for (const a of (articles || [])) {
        articleMap[a.id] = a;
      }

      // Classify each article
      const engaged = []; // articles user engaged with
      const skipped = []; // articles user skipped

      const ENGAGED_EVENTS = new Set(['article_engaged', 'article_liked', 'article_saved', 'article_shared', 'article_detail_view', 'article_revisit']);
      const SKIP_EVENTS = new Set(['article_skipped']);

      for (const [artId, data] of Object.entries(articleEventMap)) {
        const art = articleMap[artId];
        if (!art) continue;

        const eventTypes = data.events.map(e => e.event_type);
        const wasEngaged = eventTypes.some(et => ENGAGED_EVENTS.has(et));
        const wasSkipped = eventTypes.some(et => SKIP_EVENTS.has(et));

        const tags = typeof art.interest_tags === 'string'
          ? JSON.parse(art.interest_tags || '[]')
          : (art.interest_tags || []);

        // Calculate cosine similarity to taste vector
        let tasteSim = 0;
        let sessionSim = 0;
        let bestCluster = null;
        let bestClusterSim = 0;

        if (art.embedding_minilm && profile.taste_vector_minilm) {
          tasteSim = cosineSim(art.embedding_minilm, profile.taste_vector_minilm);
        }
        if (art.embedding_minilm && profile.session_taste_vector_minilm) {
          sessionSim = cosineSim(art.embedding_minilm, profile.session_taste_vector_minilm);
        }

        // Find closest cluster
        if (art.embedding_minilm && clusters && clusters.length > 0) {
          for (const c of clusters) {
            const centroid = c.medoid_minilm || c.medoid_embedding;
            if (!centroid) continue;
            const sim = cosineSim(art.embedding_minilm, centroid);
            if (sim > bestClusterSim) {
              bestClusterSim = sim;
              bestCluster = c.cluster_index;
            }
          }
        }

        const bucket = data.bucket || data.events[0]?.metadata?.bucket || 'unknown';
        const dwellSec = data.events[0]?.metadata?.dwell || data.events[0]?.metadata?.total_active_seconds || data.events[0]?.view_seconds || 0;

        const entry = {
          id: artId,
          title: (art.title_news || '').substring(0, 80),
          category: art.category,
          tags,
          tasteSim,
          sessionSim,
          bestCluster,
          bestClusterSim,
          bucket,
          engaged: wasEngaged,
          skipped: wasSkipped,
          dwellSec: parseFloat(dwellSec) || 0,
          eventTypes,
        };

        if (wasEngaged && !wasSkipped) engaged.push(entry);
        else if (wasSkipped && !wasEngaged) skipped.push(entry);
        else if (wasEngaged) engaged.push(entry); // both signals = engaged wins
        else skipped.push(entry); // article_view only = implicit skip
      }

      // ============================================================
      // PER-ARTICLE DETAILS
      // ============================================================
      console.log('\n--- PER-ARTICLE DETAILS ---');
      console.log(`ENGAGED (${engaged.length}):`);
      for (const a of engaged.sort((x, y) => y.tasteSim - x.tasteSim)) {
        console.log(`  [${a.bucket}] sim=${a.tasteSim.toFixed(3)} sessSim=${a.sessionSim.toFixed(3)} cluster=${a.bestCluster}(${a.bestClusterSim.toFixed(3)}) cat=${a.category} dwell=${a.dwellSec}s`);
        console.log(`    "${a.title}"`);
        console.log(`    tags: ${a.tags.slice(0, 6).join(', ')} | events: ${a.eventTypes.join(', ')}`);
      }

      console.log(`\nSKIPPED (${skipped.length}):`);
      for (const a of skipped.sort((x, y) => y.tasteSim - x.tasteSim)) {
        console.log(`  [${a.bucket}] sim=${a.tasteSim.toFixed(3)} sessSim=${a.sessionSim.toFixed(3)} cluster=${a.bestCluster}(${a.bestClusterSim.toFixed(3)}) cat=${a.category} dwell=${a.dwellSec}s`);
        console.log(`    "${a.title}"`);
        console.log(`    tags: ${a.tags.slice(0, 6).join(', ')} | events: ${a.eventTypes.join(', ')}`);
      }

      // ============================================================
      // 3. AGGREGATE STATS
      // ============================================================
      console.log('\n' + '='.repeat(80));
      console.log('AGGREGATE STATS');
      console.log('='.repeat(80));

      const avgSim = (arr) => arr.length > 0 ? arr.reduce((sum, a) => sum + a.tasteSim, 0) / arr.length : 0;
      const avgSessionSim = (arr) => arr.length > 0 ? arr.reduce((sum, a) => sum + a.sessionSim, 0) / arr.length : 0;

      console.log('\n--- SIMILARITY COMPARISON ---');
      console.log(`Engaged avg taste similarity:  ${avgSim(engaged).toFixed(4)} (n=${engaged.length})`);
      console.log(`Skipped avg taste similarity:  ${avgSim(skipped).toFixed(4)} (n=${skipped.length})`);
      console.log(`Delta (engaged - skipped):     ${(avgSim(engaged) - avgSim(skipped)).toFixed(4)}`);
      console.log(`Engaged avg session similarity: ${avgSessionSim(engaged).toFixed(4)}`);
      console.log(`Skipped avg session similarity: ${avgSessionSim(skipped).toFixed(4)}`);

      // Category distribution
      console.log('\n--- CATEGORY DISTRIBUTION ---');
      const allArticles = [...engaged, ...skipped];
      const catFed = {};
      const catEngaged = {};
      for (const a of allArticles) {
        catFed[a.category] = (catFed[a.category] || 0) + 1;
      }
      for (const a of engaged) {
        catEngaged[a.category] = (catEngaged[a.category] || 0) + 1;
      }

      const allCats = [...new Set([...Object.keys(catFed), ...Object.keys(catEngaged)])].sort();
      console.log('Category        | Fed  | Engaged | Fed%  | Eng%  | Gap');
      console.log('-'.repeat(65));
      for (const cat of allCats) {
        const fed = catFed[cat] || 0;
        const eng = catEngaged[cat] || 0;
        const fedPct = ((fed / allArticles.length) * 100).toFixed(1);
        const engPct = engaged.length > 0 ? ((eng / engaged.length) * 100).toFixed(1) : '0.0';
        const gap = (parseFloat(engPct) - parseFloat(fedPct)).toFixed(1);
        const marker = parseFloat(gap) < -10 ? ' <<<< OVERFED' : parseFloat(gap) > 10 ? ' >>> UNDERFED' : '';
        console.log(`${(cat || 'null').padEnd(16)}| ${String(fed).padEnd(5)}| ${String(eng).padEnd(8)}| ${fedPct.padStart(5)}%| ${engPct.padStart(5)}%| ${gap.padStart(5)}%${marker}`);
      }

      // Bucket distribution
      console.log('\n--- BUCKET DISTRIBUTION ---');
      const bucketFed = {};
      const bucketEngaged = {};
      for (const a of allArticles) {
        bucketFed[a.bucket] = (bucketFed[a.bucket] || 0) + 1;
      }
      for (const a of engaged) {
        bucketEngaged[a.bucket] = (bucketEngaged[a.bucket] || 0) + 1;
      }
      const allBuckets = [...new Set([...Object.keys(bucketFed), ...Object.keys(bucketEngaged)])].sort();
      console.log('Bucket       | Fed  | Engaged | Eng Rate');
      console.log('-'.repeat(50));
      for (const b of allBuckets) {
        const fed = bucketFed[b] || 0;
        const eng = bucketEngaged[b] || 0;
        const rate = fed > 0 ? ((eng / fed) * 100).toFixed(1) : '0.0';
        console.log(`${b.padEnd(13)}| ${String(fed).padEnd(5)}| ${String(eng).padEnd(8)}| ${rate}%`);
      }

      // Cluster distribution
      console.log('\n--- CLUSTER HIT DISTRIBUTION ---');
      const clusterFed = {};
      const clusterEngaged = {};
      for (const a of allArticles) {
        const cl = a.bestCluster ?? 'none';
        clusterFed[cl] = (clusterFed[cl] || 0) + 1;
      }
      for (const a of engaged) {
        const cl = a.bestCluster ?? 'none';
        clusterEngaged[cl] = (clusterEngaged[cl] || 0) + 1;
      }
      for (const cl of Object.keys(clusterFed).sort()) {
        const fed = clusterFed[cl] || 0;
        const eng = clusterEngaged[cl] || 0;
        const rate = fed > 0 ? ((eng / fed) * 100).toFixed(1) : '0.0';
        const clusterImportance = clusters?.find(c => c.cluster_index == cl)?.importance_score;
        console.log(`  Cluster ${cl}: fed=${fed} engaged=${eng} rate=${rate}%${clusterImportance ? ` (importance=${(clusterImportance * 100).toFixed(1)}%)` : ''}`);
      }
    }

    // ============================================================
    // 4. TAG PROFILE ANALYSIS (derived from engagement buffer)
    // No tag_profile/skip_profile columns exist -- derive from buffer + articles
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('TAG PROFILE ANALYSIS (derived from engagement buffer)');
    console.log('='.repeat(80));

    // Fetch ALL buffer entries to derive tag preferences
    const { data: allBuffer } = await s
      .from('engagement_buffer')
      .select('article_id, interaction_weight, event_type')
      .eq('personalization_id', PERS_ID)
      .order('created_at', { ascending: false })
      .limit(200);

    if (allBuffer && allBuffer.length > 0) {
      const bufArtIds = [...new Set(allBuffer.map(b => b.article_id).filter(Boolean))];
      const { data: bufArts } = await s
        .from('published_articles')
        .select('id, interest_tags, category')
        .in('id', bufArtIds);

      const bufArtMap = {};
      for (const a of (bufArts || [])) bufArtMap[a.id] = a;

      const tagWeights = {};
      const skipTagWeights = {};
      const catWeights = {};
      const skipCatWeights = {};

      for (const b of allBuffer) {
        const art = bufArtMap[b.article_id];
        if (!art) continue;
        const tags = typeof art.interest_tags === 'string'
          ? JSON.parse(art.interest_tags || '[]')
          : (art.interest_tags || []);

        if (b.interaction_weight > 0) {
          for (const t of tags) tagWeights[t] = (tagWeights[t] || 0) + b.interaction_weight;
          catWeights[art.category] = (catWeights[art.category] || 0) + b.interaction_weight;
        } else if (b.interaction_weight < 0) {
          for (const t of tags) skipTagWeights[t] = (skipTagWeights[t] || 0) + Math.abs(b.interaction_weight);
          skipCatWeights[art.category] = (skipCatWeights[art.category] || 0) + Math.abs(b.interaction_weight);
        }
      }

      const tagEntries = Object.entries(tagWeights).sort((a, b) => b[1] - a[1]);
      console.log('\n--- TOP 15 POSITIVE TAGS (from buffer) ---');
      for (const [tag, weight] of tagEntries.slice(0, 15)) {
        console.log(`  ${weight.toFixed(3)}  ${tag}`);
      }

      const skipEntries = Object.entries(skipTagWeights).sort((a, b) => b[1] - a[1]);
      console.log('\n--- TOP 15 SKIPPED TAGS (from buffer) ---');
      if (skipEntries.length === 0) {
        console.log('  (no skip data)');
      } else {
        for (const [tag, weight] of skipEntries.slice(0, 15)) {
          console.log(`  ${weight.toFixed(3)}  ${tag}`);
        }
      }

      console.log('\n--- CATEGORY PREFERENCE (positive weight) ---');
      for (const [cat, w] of Object.entries(catWeights).sort((a, b) => b[1] - a[1])) {
        const skipW = skipCatWeights[cat] || 0;
        const ratio = w / (w + skipW);
        console.log(`  ${cat.padEnd(16)} engage=${w.toFixed(2)} skip=${skipW.toFixed(2)} ratio=${(ratio * 100).toFixed(1)}%`);
      }

      // Check for skipped categories not in positive
      const skipOnlyCats = Object.keys(skipCatWeights).filter(c => !catWeights[c]);
      if (skipOnlyCats.length > 0) {
        console.log('\n  Categories with ONLY skips:');
        for (const c of skipOnlyCats) {
          console.log(`    ${c}: skip=${skipCatWeights[c].toFixed(2)}`);
        }
      }

      console.log('\n--- TAG OVERLAP (tags appearing in both positive and skip) ---');
      const overlapTags = Object.keys(tagWeights).filter(t => skipTagWeights[t]);
      overlapTags.sort((a, b) => (tagWeights[b] - (skipTagWeights[b] || 0)) - (tagWeights[a] - (skipTagWeights[a] || 0)));
      for (const t of overlapTags.slice(0, 10)) {
        const net = tagWeights[t] - (skipTagWeights[t] || 0);
        console.log(`  ${t.padEnd(25)} +${tagWeights[t].toFixed(2)} / -${(skipTagWeights[t] || 0).toFixed(2)} = net ${net.toFixed(2)}`);
      }
    } else {
      console.log('No engagement buffer data to derive tag preferences.');
    }

    // ============================================================
    // 5. ENGAGEMENT BUFFER
    // ============================================================
    console.log('\n' + '='.repeat(80));
    console.log('ENGAGEMENT BUFFER (last 25 entries)');
    console.log('='.repeat(80));

    const { data: buffer, error: bufErr } = await s
      .from('engagement_buffer')
      .select('article_id, event_type, interaction_weight, created_at')
      .eq('personalization_id', PERS_ID)
      .order('created_at', { ascending: false })
      .limit(25);

    if (bufErr) { console.error('Buffer error:', bufErr.message); }

    if (buffer && buffer.length > 0) {
      let posCount = 0, negCount = 0, posSum = 0, negSum = 0;
      console.log('Idx | Weight  | Type                    | Created');
      console.log('-'.repeat(75));
      for (let i = 0; i < buffer.length; i++) {
        const b = buffer[i];
        const w = b.interaction_weight;
        if (w > 0) { posCount++; posSum += w; }
        else { negCount++; negSum += w; }
        const marker = w > 0 ? '+' : w < 0 ? '-' : '=';
        console.log(`${String(i + 1).padStart(3)} | ${marker}${Math.abs(w).toFixed(3).padStart(6)} | ${(b.event_type || '').padEnd(24)}| ${b.created_at}`);
      }

      console.log('\n--- BUFFER SUMMARY ---');
      console.log(`Positive signals: ${posCount} (avg weight: ${posCount > 0 ? (posSum / posCount).toFixed(3) : 'N/A'})`);
      console.log(`Negative signals: ${negCount} (avg weight: ${negCount > 0 ? (negSum / negCount).toFixed(3) : 'N/A'})`);
      console.log(`Ratio positive: ${((posCount / buffer.length) * 100).toFixed(1)}%`);
    } else {
      console.log('No engagement buffer entries found.');
    }

    // ============================================================
    // ALSO: Get recent articles from engagement buffer with their titles
    // to understand what the user actually saw
    // ============================================================
    if (buffer && buffer.length > 0) {
      const bufferArticleIds = buffer.map(b => b.article_id).filter(Boolean);
      if (bufferArticleIds.length > 0) {
        const { data: bufferArticles } = await s
          .from('published_articles')
          .select('id, title_news, category, interest_tags')
          .in('id', bufferArticleIds);

        const bufArtMap = {};
        for (const a of (bufferArticles || [])) bufArtMap[a.id] = a;

        console.log('\n--- BUFFER ARTICLES (most recent) ---');
        for (const b of buffer.slice(0, 15)) {
          const art = bufArtMap[b.article_id];
          if (!art) continue;
          const tags = typeof art.interest_tags === 'string'
            ? JSON.parse(art.interest_tags || '[]')
            : (art.interest_tags || []);
          const w = b.interaction_weight;
          const marker = w > 0 ? '  +' : w < 0 ? '  -' : '  =';
          console.log(`${marker}${Math.abs(w).toFixed(2)} [${art.category}] "${(art.title_news || '').substring(0, 70)}"`);
          console.log(`        tags: ${tags.slice(0, 5).join(', ')}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (err) {
    console.error('Fatal error:', err);
  }
})();
