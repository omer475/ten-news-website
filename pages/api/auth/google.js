import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

async function mintSessionForUser(supabase, email) {
  // We don't know the user's password, but we can issue a magic-link-style
  // session using admin.generateLink, then immediately verify the token.
  try {
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData?.properties?.hashed_token) return null;
    const { data: verified, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });
    if (verifyErr || !verified?.session) return null;
    return verified.session;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id_token: authCode } = req.body || {};
  if (!authCode) {
    return res.status(400).json({ error: 'Missing auth code' });
  }

  try {
    const reversedClientId = 'com.googleusercontent.apps.465407271728-t3osp3o35l4hs6ei9coddr24bbsmbkda';
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: authCode,
        client_id: GOOGLE_IOS_CLIENT_ID,
        redirect_uri: `${reversedClientId}:/oauth2callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      console.error('[google] token exchange failed:', tokenData);
      return res.status(401).json({ error: 'Failed to exchange auth code' });
    }

    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`);
    const googleUser = await verifyRes.json();
    if (verifyRes.status !== 200 || !googleUser.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look for an existing profile by email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, username, date_of_birth, avatar_url, created_at')
      .eq('email', googleUser.email)
      .maybeSingle();

    let userId = existingProfile?.id || null;
    let profile = existingProfile || null;

    if (!userId) {
      // New user — create via Supabase auth admin
      const tempPassword = `google_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const { data: signupData, error: signupError } = await supabase.auth.admin.createUser({
        email: googleUser.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: googleUser.name,
          avatar_url: googleUser.picture,
          provider: 'google',
        }
      });

      if (signupError) {
        // If auth user exists but profile is missing, find them in auth and create profile
        if (signupError.message?.includes('already') || signupError.message?.includes('registered')) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const authUser = users?.find(u => u.email === googleUser.email);
          if (!authUser) {
            return res.status(500).json({ error: 'Account exists but could not be resolved' });
          }
          userId = authUser.id;
        } else {
          console.error('[google] signup error:', signupError);
          return res.status(500).json({ error: 'Failed to create account' });
        }
      } else {
        userId = signupData.user.id;
      }

      // Create / upsert profile for new user (no username/dob yet)
      await supabase.from('profiles').upsert([{
        id: userId,
        email: googleUser.email,
        full_name: googleUser.name || null,
        avatar_url: googleUser.picture || null,
        newsletter_subscribed: true,
        preferred_email_hour: 10,
        created_at: new Date().toISOString(),
      }], { onConflict: 'id' });

      // Re-read profile
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('id, email, full_name, username, date_of_birth, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle();
      profile = freshProfile;
    } else {
      // Existing user — update avatar if Google has a newer one
      if (googleUser.picture && googleUser.picture !== existingProfile.avatar_url) {
        await supabase
          .from('profiles')
          .update({ avatar_url: googleUser.picture })
          .eq('id', userId);
      }
    }

    const needsProfile = !(profile?.username) || !(profile?.date_of_birth);

    // Mint a real session so the iOS client is logged in immediately
    const session = await mintSessionForUser(supabase, googleUser.email);

    return res.status(200).json({
      user: {
        id: userId,
        email: googleUser.email,
        name: profile?.full_name || googleUser.name || null,
        avatar_url: googleUser.picture || profile?.avatar_url || null,
        created_at: profile?.created_at || new Date().toISOString(),
      },
      session: session ? {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      } : null,
      needs_profile: needsProfile,
      message: needsProfile ? 'Profile completion required' : 'Login successful'
    });
  } catch (error) {
    console.error('[google] unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
