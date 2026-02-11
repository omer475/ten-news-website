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
    const { auth_user_id, personalization_user_id } = req.body;

    if (!auth_user_id) {
      return res.status(400).json({ error: 'auth_user_id is required' });
    }

    // CASE 1: User has a personalization profile from onboarding (link it to auth)
    if (personalization_user_id) {
      // Check if this auth user is already linked to a different personalization profile
      const { data: existingLink } = await supabase
        .from('users')
        .select('id, auth_user_id')
        .eq('auth_user_id', auth_user_id)
        .single();

      if (existingLink && existingLink.id !== personalization_user_id) {
        // Auth user already linked to a different profile - use the existing linked one
        // (This happens if user did onboarding on device A, linked on device A, 
        //  then did onboarding again on device B before logging in)
        const { data: linkedProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', existingLink.id)
          .single();

        if (linkedProfile) {
          return res.status(200).json({ 
            success: true, 
            action: 'already_linked',
            user: linkedProfile
          });
        }
      }

      if (!existingLink) {
        // Link the personalization profile to the auth user
        const { data, error } = await supabase
          .from('users')
          .update({ auth_user_id: auth_user_id })
          .eq('id', personalization_user_id)
          .is('auth_user_id', null)  // Only if not already linked
          .select()
          .single();

        if (error) {
          // Might fail if auth_user_id already exists (unique constraint)
          // Try to fetch the existing linked profile instead
          const { data: existing } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', auth_user_id)
            .single();

          if (existing) {
            return res.status(200).json({
              success: true,
              action: 'already_linked',
              user: existing
            });
          }

          console.error('Link error:', error);
          return res.status(500).json({ error: 'Failed to link account' });
        }

        return res.status(200).json({
          success: true,
          action: 'linked',
          user: data
        });
      }

      // Already linked to the same profile
      return res.status(200).json({
        success: true,
        action: 'already_linked',
        user: existingLink
      });
    }

    // CASE 2: User logged in on new device (no personalization_user_id)
    // Try to fetch their linked personalization profile
    const { data: linkedProfile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', auth_user_id)
      .single();

    if (linkedProfile) {
      return res.status(200).json({
        success: true,
        action: 'fetched',
        user: linkedProfile
      });
    }

    // No linked profile found - user needs to do onboarding
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
