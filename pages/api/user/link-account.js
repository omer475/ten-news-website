import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { auth_user_id, personalization_user_id, home_country, followed_countries, followed_topics, onboarding_completed } = req.body;

    if (!auth_user_id) {
      return res.status(400).json({ error: 'auth_user_id is required' });
    }

    // CASE 1: User has personalization data to link (from localStorage after onboarding)
    if (personalization_user_id || home_country) {
      // Check if this auth user already has personalization in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, home_country, followed_countries, followed_topics, onboarding_completed')
        .eq('id', auth_user_id)
        .single();

      if (existingProfile && existingProfile.onboarding_completed) {
        // Already has personalization — return existing
        return res.status(200).json({
          success: true,
          action: 'already_linked',
          user: existingProfile
        });
      }

      // Write personalization fields directly to profiles
      const personalizationData = {};
      if (home_country) personalizationData.home_country = home_country;
      if (followed_countries) personalizationData.followed_countries = followed_countries;
      if (followed_topics) personalizationData.followed_topics = followed_topics;
      if (onboarding_completed !== undefined) personalizationData.onboarding_completed = onboarding_completed;

      if (Object.keys(personalizationData).length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .update(personalizationData)
          .eq('id', auth_user_id)
          .select()
          .single();

        if (error) {
          console.error('Link error:', error);
          return res.status(500).json({ error: 'Failed to link account' });
        }

        return res.status(200).json({
          success: true,
          action: 'linked',
          user: data
        });
      }

      return res.status(200).json({
        success: true,
        action: 'linked',
        user: existingProfile
      });
    }

    // CASE 2: User logged in on new device (no personalization data)
    // Fetch their personalization from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, home_country, followed_countries, followed_topics, onboarding_completed')
      .eq('id', auth_user_id)
      .single();

    if (profile && profile.onboarding_completed) {
      return res.status(200).json({
        success: true,
        action: 'fetched',
        user: profile
      });
    }

    // No personalization found — user needs to do onboarding
    return res.status(200).json({
      success: true,
      action: 'no_profile',
      user: null
    });

  } catch (error) {
    console.error('Link account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
