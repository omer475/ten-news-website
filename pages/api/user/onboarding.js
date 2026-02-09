import { createClient } from '@supabase/supabase-js';
import { COUNTRIES, TOPICS, PERSONALIZATION_CONFIG } from '../../../lib/personalization';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const validCountryCodes = COUNTRIES.map(c => c.code);
const validTopicCodes = TOPICS.map(t => t.code);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { home_country, followed_countries = [], followed_topics, email, user_id } = req.body;

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

    // Build user data
    const userData = {
      home_country,
      followed_countries,
      followed_topics,
      onboarding_completed: true,
    };

    if (email) {
      userData.email = email;
    }

    // If user_id provided, update existing user
    if (user_id) {
      const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', user_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Failed to update user' });
      }

      return res.status(200).json({ success: true, user: data });
    }

    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    return res.status(201).json({ success: true, user: data });

  } catch (error) {
    console.error('Onboarding error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
