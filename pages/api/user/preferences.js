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

  // GET - Fetch user preferences
  if (req.method === 'GET') {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, home_country, followed_countries, followed_topics, onboarding_completed')
        .eq('id', user_id)
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
    const { user_id, home_country, followed_countries, followed_topics } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
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

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating preferences:', error);
        return res.status(500).json({ error: 'Failed to update preferences' });
      }

      return res.status(200).json({ success: true, user: data });

    } catch (error) {
      console.error('Update preferences error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
