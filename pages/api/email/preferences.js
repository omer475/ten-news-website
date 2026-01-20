import { createClient } from '@supabase/supabase-js';

/**
 * User Email Preferences API
 * 
 * GET: Fetch user's current email preferences
 * PUT: Update user's email preferences
 * 
 * Requires authentication via Supabase session
 */

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // Initialize Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get user from session token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Handle different methods
  switch (req.method) {
    case 'GET':
      return getPreferences(supabase, user.id, res);
    case 'PUT':
      return updatePreferences(supabase, user.id, req.body, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Get user's current email preferences
 */
async function getPreferences(supabase, userId, res) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        email_frequency,
        email_timezone,
        preferred_email_hour,
        newsletter_subscribed,
        preferred_categories,
        email_personalization_enabled,
        last_email_sent_at,
        email_open_count,
        email_click_count
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      preferences: {
        frequency: data.email_frequency || 'daily',
        timezone: data.email_timezone || 'UTC',
        preferredHour: data.preferred_email_hour ?? 7,
        subscribed: data.newsletter_subscribed ?? true,
        categories: data.preferred_categories || [],
        personalizationEnabled: data.email_personalization_enabled ?? true,
        stats: {
          lastEmailSent: data.last_email_sent_at,
          totalOpened: data.email_open_count || 0,
          totalClicked: data.email_click_count || 0
        }
      },
      // Common timezones for dropdown
      availableTimezones: COMMON_TIMEZONES
    });

  } catch (error) {
    console.error('Error fetching preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch preferences' });
  }
}

/**
 * Update user's email preferences
 */
async function updatePreferences(supabase, userId, body, res) {
  try {
    const {
      frequency,
      timezone,
      preferredHour,
      subscribed,
      categories,
      personalizationEnabled
    } = body;

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'breaking_only', 'never'];
    if (frequency && !validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency. Use: daily, weekly, breaking_only, or never' });
    }

    // Validate hour
    if (preferredHour !== undefined && (preferredHour < 0 || preferredHour > 23)) {
      return res.status(400).json({ error: 'preferredHour must be between 0 and 23' });
    }

    // Build update object (only include provided fields)
    const updates = {};
    if (frequency !== undefined) updates.email_frequency = frequency;
    if (timezone !== undefined) updates.email_timezone = timezone;
    if (preferredHour !== undefined) updates.preferred_email_hour = preferredHour;
    if (subscribed !== undefined) updates.newsletter_subscribed = subscribed;
    if (categories !== undefined) updates.preferred_categories = categories;
    if (personalizationEnabled !== undefined) updates.email_personalization_enabled = personalizationEnabled;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Updated email preferences for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: {
        frequency: data.email_frequency,
        timezone: data.email_timezone,
        preferredHour: data.preferred_email_hour,
        subscribed: data.newsletter_subscribed,
        categories: data.preferred_categories,
        personalizationEnabled: data.email_personalization_enabled
      }
    });

  } catch (error) {
    console.error('Error updating preferences:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
}

/**
 * Common timezones for the preferences UI
 */
const COMMON_TIMEZONES = [
  { value: 'Pacific/Honolulu', label: 'Hawaii (HST)', offset: -10 },
  { value: 'America/Anchorage', label: 'Alaska (AKST)', offset: -9 },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PST)', offset: -8 },
  { value: 'America/Denver', label: 'Mountain Time (MST)', offset: -7 },
  { value: 'America/Chicago', label: 'Central Time (CST)', offset: -6 },
  { value: 'America/New_York', label: 'Eastern Time (EST)', offset: -5 },
  { value: 'America/Sao_Paulo', label: 'Brazil (BRT)', offset: -3 },
  { value: 'UTC', label: 'UTC (GMT)', offset: 0 },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 0 },
  { value: 'Europe/Paris', label: 'Central Europe (CET)', offset: 1 },
  { value: 'Europe/Istanbul', label: 'Turkey (TRT)', offset: 3 },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4 },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 5.5 },
  { value: 'Asia/Bangkok', label: 'Thailand (ICT)', offset: 7 },
  { value: 'Asia/Shanghai', label: 'China (CST)', offset: 8 },
  { value: 'Asia/Tokyo', label: 'Japan (JST)', offset: 9 },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 11 },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZDT)', offset: 13 }
];
