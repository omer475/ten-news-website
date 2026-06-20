import { createClient } from '@supabase/supabase-js';
import { COUNTRIES, TOPICS, PERSONALIZATION_CONFIG } from '../../../lib/personalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const validCountryCodes = COUNTRIES.map(c => c.code);
const validTopicCodes = TOPICS.map(t => t.code);

// Map onboarding topic codes to subtopic_embeddings names
const TOPIC_TO_SUBTOPIC = {
  'War & Conflict': ['war & conflict'], 'US Politics': ['us politics'], 'European Politics': ['european politics'],
  'Asian Politics': ['asian politics'], 'Middle East': ['middle east'], 'Latin America': ['latin america'],
  'Africa & Oceania': ['africa & oceania'], 'Human Rights & Civil Liberties': ['human rights & civil liberties'],
  'NFL': ['nfl'], 'NBA': ['nba'], 'Soccer/Football': ['soccer/football'], 'MLB/Baseball': ['mlb/baseball'],
  'Cricket': ['cricket'], 'F1 & Motorsport': ['f1 & motorsport'], 'Boxing & MMA/UFC': ['boxing & mma/ufc'],
  'Olympics & Paralympics': ['olympics & paralympics'],
  'Oil & Energy': ['oil & energy'], 'Automotive': ['automotive'], 'Retail & Consumer': ['retail & consumer'],
  'Corporate Deals': ['corporate deals'], 'Trade & Tariffs': ['trade & tariffs'],
  'Corporate Earnings': ['corporate earnings'], 'Startups & Venture Capital': ['startups & venture capital'],
  'Real Estate': ['real estate'],
  'Movies & Film': ['movies & film'], 'TV & Streaming': ['tv & streaming'], 'Music': ['music'],
  'Gaming': ['gaming'], 'Celebrity News': ['celebrity news'], 'K-Pop & K-Drama': ['k-pop & k-drama'],
  'AI & Machine Learning': ['ai & machine learning'], 'Smartphones & Gadgets': ['smartphones & gadgets'],
  'Social Media': ['social media'], 'Cybersecurity': ['cybersecurity'], 'Space Tech': ['space tech'],
  'Robotics & Hardware': ['robotics & hardware'],
  'Space & Astronomy': ['space & astronomy'], 'Climate & Environment': ['climate & environment'],
  'Biology & Nature': ['biology & nature'], 'Earth Science': ['earth science'],
  'Medical Breakthroughs': ['medical breakthroughs'], 'Public Health': ['public health'],
  'Mental Health': ['mental health'], 'Pharma & Drug Industry': ['pharma & drug industry'],
  'Stock Markets': ['stock markets'], 'Banking & Lending': ['banking & lending'],
  'Cryptocurrency': ['cryptocurrency'],
  'Fitness & Nutrition': ['fitness & nutrition'], 'Travel & Adventure': ['travel & adventure'],
  'Food & Cooking': ['food & cooking'], 'Fashion & Beauty': ['fashion & beauty'],
  'Parenting & Family': ['parenting & family'], 'Pets & Animals': ['pets & animals'],
};

async function initializeTasteVector(supabase, authId, deviceId, followedTopics) {
  try {
    // Resolve subtopic names from selected topics
    const subtopicNames = [];
    for (const topic of (followedTopics || [])) {
      const subs = TOPIC_TO_SUBTOPIC[topic];
      if (subs) subtopicNames.push(...subs);
    }
    if (subtopicNames.length === 0) return;

    // Fetch pre-computed subtopic embeddings
    const { data: embeddings } = await supabase
      .from('subtopic_embeddings')
      .select('embedding_minilm')
      .in('subtopic_name', subtopicNames);

    if (!embeddings || embeddings.length === 0) return;

    // Average the embeddings
    const dim = 384;
    const avg = new Array(dim).fill(0);
    let count = 0;
    for (const row of embeddings) {
      const emb = typeof row.embedding_minilm === 'string'
        ? JSON.parse(row.embedding_minilm)
        : row.embedding_minilm;
      if (!emb || !Array.isArray(emb)) continue;
      for (let i = 0; i < dim; i++) {
        avg[i] += (emb[i] || 0);
      }
      count++;
    }
    if (count === 0) return;
    for (let i = 0; i < dim; i++) avg[i] /= count;

    // Resolve personalization_id and update taste vector
    const rpcParams = authId ? { p_auth_id: authId } : { p_device_id: deviceId };
    const { data: persData } = await supabase.rpc('resolve_personalization_id', rpcParams);
    if (!persData || persData.length === 0) return;

    await supabase
      .from('personalization_profiles')
      .update({ taste_vector_minilm: avg })
      .eq('personalization_id', persData[0].personalization_id);
  } catch (e) {
    console.error('[onboarding] Failed to initialize taste vector on personalization_profiles:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { home_country, followed_countries = [], followed_topics, email, user_id, auth_user_id } = req.body;
    // Onboarding v2 signals (all optional / additive).
    const {
      avoid_topics = null, followed_entities = null, depth_pref = null,
      seriousness_pref = null, reading_cadence = null, onboarding_freetext = null,
      onboarding_signals = null, headline_picks = null, global_breadth = null,
      followed_subtopics = null,
    } = req.body || {};

    // Validate home_country
    if (!home_country || !validCountryCodes.includes(home_country)) {
      return res.status(400).json({
        error: `Invalid home_country. Must be one of: ${validCountryCodes.join(', ')}`
      });
    }

    // Validate followed_countries
    if (followed_countries.length > PERSONALIZATION_CONFIG.MAX_FOLLOWED_COUNTRIES) {
      return res.status(400).json({
        error: `Maximum ${PERSONALIZATION_CONFIG.MAX_FOLLOWED_COUNTRIES} followed countries allowed`
      });
    }

    const invalidCountries = followed_countries.filter(c => !validCountryCodes.includes(c));
    if (invalidCountries.length > 0) {
      return res.status(400).json({
        error: `Invalid followed countries: ${invalidCountries.join(', ')}`
      });
    }

    if (followed_countries.includes(home_country)) {
      return res.status(400).json({
        error: 'followed_countries should not include home_country'
      });
    }

    // Validate followed_topics
    if (!followed_topics || followed_topics.length < PERSONALIZATION_CONFIG.MIN_TOPICS_REQUIRED) {
      return res.status(400).json({
        error: `At least ${PERSONALIZATION_CONFIG.MIN_TOPICS_REQUIRED} topics required`
      });
    }

    if (followed_topics.length > PERSONALIZATION_CONFIG.MAX_TOPICS_ALLOWED) {
      return res.status(400).json({
        error: `Maximum ${PERSONALIZATION_CONFIG.MAX_TOPICS_ALLOWED} topics allowed`
      });
    }

    const invalidTopics = followed_topics.filter(t => !validTopicCodes.includes(t));
    if (invalidTopics.length > 0) {
      return res.status(400).json({
        error: `Invalid topics: ${invalidTopics.join(', ')}`
      });
    }

    // ═══════════════════════════════════════════════════
    // EMBEDDING-FIRST: Initialize taste_vector from subtopic embeddings
    // This gives pgvector personalization from page 1 (no cold start)
    // ═══════════════════════════════════════════════════
    const TOPIC_TO_SUBTOPIC = {
      'politics': ['US Politics', 'European Politics', 'Asian Politics', 'Middle East'],
      'geopolitics': ['War & Conflict', 'Middle East', 'Asian Politics'],
      'sports': ['NFL', 'NBA', 'Soccer/Football', 'MLB/Baseball', 'Cricket', 'F1 & Motorsport', 'Boxing & MMA/UFC', 'Tennis', 'Golf'],
      'ai': ['AI & Machine Learning'],
      'tech_industry': ['AI & Machine Learning', 'Robotics & Hardware'],
      'consumer_tech': ['Smartphones & Gadgets'],
      'cybersecurity': ['Cybersecurity'],
      'space': ['Space Tech', 'Space & Astronomy'],
      'science': ['Climate & Environment', 'Biology & Nature', 'Space & Astronomy'],
      'climate': ['Climate & Environment'],
      'health': ['Medical Breakthroughs', 'Public Health', 'Mental Health'],
      'biotech': ['Medical Breakthroughs', 'Biology & Nature'],
      'economics': ['Stock Markets', 'Oil & Energy'],
      'stock_markets': ['Stock Markets'],
      'banking': ['Stock Markets'],
      'startups': ['AI & Machine Learning'],
      'entertainment': ['Movies & Film', 'TV & Streaming', 'Music', 'Gaming', 'Celebrity News'],
      'movies': ['Movies & Film'],
      'music': ['Music'],
      'gaming': ['Gaming'],
      'crypto': ['Bitcoin', 'DeFi & Web3'],
      'soccer': ['Soccer/Football'], 'nfl': ['NFL'], 'nba': ['NBA'],
      'baseball': ['MLB/Baseball'], 'cricket': ['Cricket'], 'f1': ['F1 & Motorsport'],
      'boxing_mma': ['Boxing & MMA/UFC'], 'tennis': ['Tennis'], 'golf': ['Golf'],
      'movies_film': ['Movies & Film'], 'tv_streaming': ['TV & Streaming'],
      'kpop_kdrama': ['K-Pop & K-Drama'], 'anime_manga': ['Anime & Manga'],
      'hip_hop': ['Music'], 'afrobeats': ['Music'], 'latin_music': ['Music'],
      'comedy': ['Comedy & Humor'],
      'ai_ml': ['AI & Machine Learning'], 'smartphones_gadgets': ['Smartphones & Gadgets'],
      'social_media': ['AI & Machine Learning'], 'space_tech': ['Space Tech'],
      'robotics_hardware': ['Robotics & Hardware'],
      'space_astronomy': ['Space & Astronomy'], 'climate_environment': ['Climate & Environment'],
      'biology_nature': ['Biology & Nature'], 'earth_science': ['Climate & Environment'],
      'medical_breakthroughs': ['Medical Breakthroughs'], 'public_health': ['Public Health'],
      'mental_health': ['Mental Health'], 'pharma_drug': ['Medical Breakthroughs'],
      'us_politics': ['US Politics'], 'european_politics': ['European Politics'],
      'asian_politics': ['Asian Politics'], 'middle_east': ['Middle East'],
      'war_conflict': ['War & Conflict'],
      'oil_energy': ['Oil & Energy'], 'automotive': ['Automotive'],
      'startups_vc': ['AI & Machine Learning'],
      'real_estate': ['Stock Markets'],
      'food_cooking': ['Food & Cooking'], 'travel_adventure': ['Travel & Adventure'],
      'fitness_workout': ['Fitness & Workout'], 'beauty_skincare': ['Beauty & Skincare'],
      'parenting_family': ['Mental Health'], 'pets_animals': ['Pets & Animals'],
      'sneakers_streetwear': ['Sneakers & Streetwear'], 'celebrity_style': ['Celebrity News'],
      'bitcoin': ['Bitcoin'], 'defi_web3': ['DeFi & Web3'],
      'news': ['War & Conflict', 'US Politics', 'Middle East'],
    };

    // Resolve followed_topics to subtopic names
    const subtopicNames = new Set();
    for (const code of followed_topics) {
      const mapped = TOPIC_TO_SUBTOPIC[code];
      if (mapped) mapped.forEach(s => subtopicNames.add(s));
    }

    // Fetch pre-computed subtopic embeddings
    let initialTasteVector = null;
    if (subtopicNames.size > 0) {
      const { data: subtopicEmbs } = await supabase
        .from('subtopic_embeddings')
        .select('subtopic_name, embedding_minilm')
        .in('subtopic_name', [...subtopicNames]);

      if (subtopicEmbs && subtopicEmbs.length > 0) {
        const DIM = 384;
        const avg = new Array(DIM).fill(0);
        let count = 0;
        for (const se of subtopicEmbs) {
          const emb = se.embedding_minilm;
          if (!emb || !Array.isArray(emb) || emb.length !== DIM) continue;
          for (let i = 0; i < DIM; i++) avg[i] += emb[i];
          count++;
        }
        if (count > 0) {
          for (let i = 0; i < DIM; i++) avg[i] /= count;
          initialTasteVector = avg;
          console.log('[onboarding] Initialized taste_vector from', count, 'subtopic embeddings for topics:', [...subtopicNames].join(', '));
        }
      }
    }

    // Build personalization data
    const personalizationData = {
      home_country,
      followed_countries,
      followed_topics,
      onboarding_completed: true,
      ...(initialTasteVector ? { taste_vector_minilm: initialTasteVector } : {}),
    };

    // CRITICAL: `profiles` has followed_topics / onboarding_completed /
    // taste_vector_minilm but NOT home_country / followed_countries. Writing the
    // full object errored the whole .update() ("Failed to update profile"), so
    // onboarding NEVER persisted topics → the warm-start synthesizer (which
    // reads profiles.followed_topics) never fired → generic feed for everyone.
    // Split: profiles gets only its columns; the country fields go to `users`.
    const profilesData = {
      followed_topics,
      onboarding_completed: true,
      onboarding_version: 2,
      ...(initialTasteVector ? { taste_vector_minilm: initialTasteVector } : {}),
      ...(Array.isArray(avoid_topics) ? { avoid_topics } : {}),
      ...(followed_entities != null ? { followed_entities } : {}),
      ...(depth_pref != null ? { depth_pref } : {}),
      ...(seriousness_pref != null ? { seriousness_pref } : {}),
      ...(reading_cadence != null ? { reading_cadence } : {}),
      ...(global_breadth != null ? { global_breadth } : {}),
      ...(Array.isArray(followed_subtopics) ? { followed_subtopics } : {}),
      ...(onboarding_freetext != null ? { onboarding_freetext } : {}),
    };
    const usersData = { home_country, followed_countries, followed_topics, onboarding_completed: true };

    // Anonymous user (no auth_user_id): don't write to DB, return success for localStorage
    if (!auth_user_id && !user_id) {
      return res.status(200).json({
        success: true,
        user: { ...personalizationData, id: null }
      });
    }

    // Persist for any identified user (auth_user_id preferred over user_id).
    // CRITICAL: UPSERT, not UPDATE. A brand-new account has no `profiles` row
    // yet, so .update().eq('id',…) silently wrote NOTHING and the user's chosen
    // topics never reached the warm-start synthesizer (which reads
    // profiles.followed_topics) → generic cold feed for everyone. This was the
    // root cause of "0 users have onboarding topics".
    const profileId = auth_user_id || user_id;

    // profiles.email is NOT NULL — resolve it (body → auth lookup) so the
    // INSERT half of the upsert can't fail on a first-time row.
    let emailVal = email || null;
    if (!emailVal) {
      try { const { data: au } = await supabase.auth.admin.getUserById(profileId); emailVal = au?.user?.email || null; } catch (_) {}
    }

    const profilesRow = { id: profileId, ...profilesData, ...(emailVal ? { email: emailVal } : {}) };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profilesRow, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting profile:', error);
      return res.status(500).json({ error: 'Failed to save profile' });
    }

    // Country fields live on `users`, not `profiles` (best-effort, never fatal).
    try { await supabase.from('users').upsert({ id: profileId, ...usersData, ...(emailVal ? { email: emailVal } : {}) }, { onConflict: 'id' }); } catch (_) {}

    // Ensure a personalization_profiles row + store subtopic selection order.
    const { data: persResult } = await supabase.rpc('resolve_personalization_id', { p_auth_id: profileId }).catch(() => ({ data: null }));
    if (persResult && persResult.length > 0) {
      await supabase.from('personalization_profiles')
        .update({ subtopic_order: followed_topics })
        .eq('personalization_id', persResult[0].personalization_id)
        .catch(() => {});
    }

    // Best-effort taste-vector init — must not fail the request after topics saved.
    try { await initializeTasteVector(supabase, profileId, null, followed_topics); } catch (e) { console.warn('initializeTasteVector failed (non-fatal):', e?.message); }

    // Durable home for LLM-parsed free-text signals (entities/tags/avoid/tone +
    // the summary line + raw text for re-parsing if the prompt improves later).
    if (onboarding_signals && typeof onboarding_signals === 'object') {
      try {
        await supabase.from('onboarding_signals').insert({
          profile_id: profileId,
          topic_codes: onboarding_signals.topic_codes || null,
          entities: onboarding_signals.entities || null,
          interest_tags: onboarding_signals.interest_tags || null,
          avoid_topics: onboarding_signals.avoid_topics || null,
          tone_prefs: onboarding_signals.tone_prefs || null,
          summary_line: onboarding_signals.summary_line || null,
          raw_text: onboarding_freetext || null,
        });
      } catch (_) {}
    }
    // Headline-pick burn-in log (which fresh headlines the user swiped).
    if (Array.isArray(headline_picks) && headline_picks.length) {
      try {
        await supabase.from('onboarding_headline_picks').insert(
          headline_picks.slice(0, 30).map((h) => ({ profile_id: profileId, article_id: h.article_id, picked: !!h.picked }))
        );
      } catch (_) {}
    }

    // Bust caches so the very next feed reflects the chosen interests immediately
    // (warm-start re-synthesizes from the fresh followed_topics).
    try { await supabase.from('user_feed_cache').delete().eq('user_id', profileId); } catch (_) {}
    try { await supabase.from('user_histogram_cache').delete().eq('user_id', profileId); } catch (_) {}

    return res.status(200).json({ success: true, user: data });

  } catch (error) {
    console.error('Onboarding error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
