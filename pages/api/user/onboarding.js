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

    // Anonymous user (no auth_user_id): don't write to DB, return success for localStorage
    if (!auth_user_id && !user_id) {
      return res.status(200).json({
        success: true,
        user: { ...personalizationData, id: null }
      });
    }

    // If user_id provided, update existing profile
    if (user_id) {
      const { data, error } = await supabase
        .from('profiles')
        .update(personalizationData)
        .eq('id', user_id)
        .select()
        .single();

      if (error) {
        // user_id doesn't match a profiles row — likely a localStorage-only user
        console.error('Error updating profile:', error);
        return res.status(200).json({
          success: true,
          user: { ...personalizationData, id: user_id }
        });
      }

      // V3: Ensure personalization_profiles row exists for this user
      const { data: persResult } = await supabase.rpc('resolve_personalization_id', { p_auth_id: user_id }).catch(() => ({ data: null }));

      // Store subtopic selection order for weighted allocation
      if (persResult && persResult.length > 0) {
        await supabase.from('personalization_profiles')
          .update({ subtopic_order: followed_topics })
          .eq('personalization_id', persResult[0].personalization_id)
          .catch(() => {});
      }

      // V3: Initialize taste vector from subtopic embeddings on personalization_profiles
      await initializeTasteVector(supabase, user_id, null, followed_topics);

      return res.status(200).json({ success: true, user: data });
    }

    // Authenticated user: upsert into profiles using auth_user_id as the id
    if (auth_user_id) {
      const { data, error } = await supabase
        .from('profiles')
        .update(personalizationData)
        .eq('id', auth_user_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile for auth user:', error);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      // V3: Ensure personalization_profiles row exists
      const { data: persResult2 } = await supabase.rpc('resolve_personalization_id', { p_auth_id: auth_user_id }).catch(() => ({ data: null }));

      // Store subtopic selection order for weighted allocation
      if (persResult2 && persResult2.length > 0) {
        await supabase.from('personalization_profiles')
          .update({ subtopic_order: followed_topics })
          .eq('personalization_id', persResult2[0].personalization_id)
          .catch(() => {});
      }

      // V3: Initialize taste vector from subtopic embeddings on personalization_profiles
      await initializeTasteVector(supabase, auth_user_id, null, followed_topics);

      return res.status(200).json({ success: true, user: data });
    }

    return res.status(200).json({
      success: true,
      user: { ...personalizationData, id: null }
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
