// pages/api/auth/apple.js — Sign in with Apple bridge for the iOS app.
//
// Flow:
//   1) iOS uses ASAuthorizationAppleIDProvider with a PKCE-style nonce
//      (rawNonce on device, sha256(rawNonce) sent to Apple).
//   2) Apple returns an identity_token (JWT signed by Apple) whose `nonce`
//      claim equals sha256(rawNonce). iOS forwards { id_token, nonce, full_name? }
//      to this endpoint.
//   3) We hand the token + rawNonce to Supabase via signInWithIdToken. Supabase
//      verifies the JWT against Apple's JWKS (https://appleid.apple.com/auth/keys),
//      checks the nonce match, and either logs in the existing user or creates
//      a fresh Supabase auth user with the Apple sub as the identity. We then
//      ensure a `profiles` row exists for that user id.
//
// Requirements (one-time setup, on the user side):
//   * Apple Developer: enable "Sign in with Apple" for App ID com.tennews.app.
//   * Supabase Dashboard → Authentication → Providers → Apple:
//       - Enable provider
//       - Client ID = com.tennews.app  (the iOS app bundle id, NOT a Services ID)
//       - Secret JWT: generate via Apple Developer (Key + Team ID + Key ID)
//   * No env vars needed on Vercel — this endpoint only talks to Supabase.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id_token: idToken, nonce, full_name: fullName } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'Missing id_token' });
  }
  if (!nonce) {
    return res.status(400).json({ error: 'Missing nonce' });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Use the anon client to call signInWithIdToken — service-role keys
    // can't sign in as a user (they have no auth context).
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce,
    });

    if (error) {
      console.error('[apple] signInWithIdToken failed:', error.message);
      // Surface Supabase's message so the iOS app can show the real reason
      // (e.g. "Apple provider is not enabled" until the dashboard is set up).
      return res.status(400).json({
        error: `Apple sign-in failed: ${error.message}`,
      });
    }

    if (!data?.user || !data?.session) {
      return res.status(400).json({ error: 'Apple sign-in returned no session' });
    }

    const user = data.user;
    const session = data.session;
    const email = user.email || (user.user_metadata?.email) || null;

    // Ensure a profiles row exists. Supabase's auth.users is separate from our
    // app's profiles table — first-time Apple users need a profile bootstrapped
    // here so the rest of the app (FollowManager, AccountTabView, feed
    // personalization) has a row to read.
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing } = await adminClient
      .from('profiles')
      .select('id, full_name, username, date_of_birth, avatar_url, created_at')
      .eq('id', user.id)
      .maybeSingle();

    let profile = existing;
    if (!existing) {
      const insertRow = {
        id: user.id,
        email,
        full_name: fullName || null,
        avatar_url: null,
        newsletter_subscribed: true,
        preferred_email_hour: 10,
        created_at: new Date().toISOString(),
      };
      await adminClient.from('profiles').upsert(insertRow, { onConflict: 'id' });
      profile = insertRow;
    } else if (fullName && !existing.full_name) {
      // Apple only sends the name on the FIRST sign-in. If we missed it then
      // (e.g. user backed out before the profile insert) but iOS still passed
      // a name on this call, backfill it.
      await adminClient
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);
      profile.full_name = fullName;
    }

    const needsProfile = !(profile?.username) || !(profile?.date_of_birth);

    return res.status(200).json({
      user: {
        id: user.id,
        email,
        name: profile?.full_name || fullName || null,
        avatar_url: profile?.avatar_url || null,
        created_at: profile?.created_at || new Date().toISOString(),
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      },
      needs_profile: needsProfile,
      message: needsProfile ? 'Profile completion required' : 'Login successful',
    });
  } catch (err) {
    console.error('[apple] unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
