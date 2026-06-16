import { createClient } from '@supabase/supabase-js';
import { COUNTRIES, TOPICS, PERSONALIZATION_CONFIG } from '../../../lib/personalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const validCountryCodes = COUNTRIES.map(c => c.code);
const validTopicCodes = TOPICS.map(t => t.code);

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - Fetch user preferences by id (profiles.id = auth.users.id)
  if (req.method === 'GET') {
    const { user_id, auth_user_id } = req.query;

    // Use auth_user_id as the profiles id, or fall back to user_id
    const profileId = auth_user_id || user_id;

    if (!profileId) {
      return res.status(400).json({ error: 'user_id or auth_user_id required' });
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, home_country, followed_countries, followed_topics, onboarding_completed')
        .eq('id', profileId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json(data);

    } catch (error) {
      console.error('Get preferences error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PATCH - Update user preferences
  if (req.method === 'PATCH') {
    const {
      user_id, auth_user_id,
      home_country, followed_countries, followed_topics,
      onboarding_completed
    } = req.body;

    // Use auth_user_id as the profiles id, or fall back to user_id
    const profileId = auth_user_id || user_id;

    if (!profileId) {
      return res.status(400).json({ error: 'user_id or auth_user_id required' });
    }

    // --- Defense-in-depth: verify the JWT subject matches the target row.
    //
    // The body's auth_user_id could be spoofed (or just stale from a
    // previous user's session on the same device — that was the original
    // 2026-05-13 cross-user leak). When a Bearer token is supplied, decode
    // it via Supabase and refuse the write unless the token's `sub` matches
    // the row we're about to mutate. Same patch the iOS SessionManager
    // refactor enforces client-side; this is the server-side backstop so
    // an iOS bug can never silently write the wrong user's preferences.
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const { data: { user }, error: jwtErr } = await supabase.auth.getUser(token);
          if (jwtErr || !user) {
            return res.status(401).json({ error: 'Invalid or expired session token' });
          }
          if (user.id !== profileId) {
            console.warn(
              `[preferences] identity mismatch: jwt.sub=${user.id.slice(0,8)} body.auth_user_id=${profileId.slice(0,8)} — refusing`
            );
            return res.status(403).json({
              error: 'auth_user_id does not match session token'
            });
          }
        } catch (err) {
          // Network/parse errors talking to Supabase — fail closed.
          console.error('[preferences] JWT verification error:', err.message);
          return res.status(401).json({ error: 'Could not verify session token' });
        }
      }
    }

    try {
      const updateData = {};

      // Validate and set home_country if provided
      if (home_country !== undefined) {
        if (!validCountryCodes.includes(home_country)) {
          return res.status(400).json({ error: 'Invalid home_country' });
        }
        updateData.home_country = home_country;
      }

      // Validate and set followed_countries if provided
      if (followed_countries !== undefined) {
        if (followed_countries.length > PERSONALIZATION_CONFIG.MAX_FOLLOWED_COUNTRIES) {
          return res.status(400).json({
            error: `Maximum ${PERSONALIZATION_CONFIG.MAX_FOLLOWED_COUNTRIES} followed countries`
          });
        }
        const invalidCountries = followed_countries.filter(c => !validCountryCodes.includes(c));
        if (invalidCountries.length > 0) {
          return res.status(400).json({
            error: `Invalid countries: ${invalidCountries.join(', ')}`
          });
        }
        updateData.followed_countries = followed_countries;
      }

      // Validate and set followed_topics if provided
      if (followed_topics !== undefined) {
        if (followed_topics.length < PERSONALIZATION_CONFIG.MIN_TOPICS_REQUIRED) {
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
        updateData.followed_topics = followed_topics;
      }

      // Forward the onboarding flag. Previously this body field was silently
      // dropped — iOS sent {onboarding_completed: true} after topic selection
      // and the column stayed false in DB. The algorithm reads followed_topics
      // independently so the bug didn't hard-break anything, but the column
      // is the canonical "user finished setup" signal so set it.
      if (onboarding_completed !== undefined) {
        updateData.onboarding_completed = !!onboarding_completed;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // UPSERT (not update): the profiles row may not exist yet, and the INSERT
      // half needs the NOT NULL email — resolve it so changing interests always
      // persists.
      let emailVal = null;
      try { const { data: au } = await supabase.auth.admin.getUserById(profileId); emailVal = au?.user?.email || null; } catch (_) {}
      const row = { id: profileId, ...updateData, ...(emailVal ? { email: emailVal } : {}) };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('Error updating preferences:', error);
        return res.status(500).json({ error: 'Failed to update preferences' });
      }

      // The algorithm must SEE the change on the next load: bust the cached
      // feed + histogram so warm-start re-synthesizes from the new topics.
      try { await supabase.from('user_feed_cache').delete().eq('user_id', profileId); } catch (_) {}
      try { await supabase.from('user_histogram_cache').delete().eq('user_id', profileId); } catch (_) {}

      return res.status(200).json({ success: true, user: data });

    } catch (error) {
      console.error('Update preferences error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
