import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { id: conversationId } = req.query;
  if (!conversationId) return res.status(400).json({ error: 'conversation id required' });

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - List messages in a conversation
  if (req.method === 'GET') {
    const { before, limit = 50 } = req.query;

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // Attach article data for article shares
      const articleIds = [...new Set((messages || []).filter(m => m.article_id).map(m => m.article_id))];
      let articleMap = {};
      if (articleIds.length > 0) {
        const { data: articles } = await supabase
          .from('articles')
          .select('id, title, image_url, source, category')
          .in('id', articleIds);
        for (const a of (articles || [])) {
          articleMap[a.id] = a;
        }
      }

      const enrichedMessages = (messages || []).map(m => ({
        ...m,
        article: m.article_id ? articleMap[m.article_id] || null : null
      }));

      // Return in chronological order (oldest first)
      enrichedMessages.reverse();

      return res.status(200).json({ messages: enrichedMessages });
    } catch (error) {
      console.error('List messages error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - Send a message
  if (req.method === 'POST') {
    const { sender_id, content, article_id } = req.body;
    if (!sender_id) return res.status(400).json({ error: 'sender_id required' });
    if (!content && !article_id) return res.status(400).json({ error: 'content or article_id required' });

    try {
      // Verify sender is a participant
      const { data: participant } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', sender_id)
        .single();

      if (!participant) {
        return res.status(403).json({ error: 'Not a participant in this conversation' });
      }

      // Insert message
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id,
          content: content || null,
          article_id: article_id || null
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Attach article data if present
      let enrichedMessage = { ...message, article: null };
      if (message.article_id) {
        const { data: article } = await supabase
          .from('articles')
          .select('id, title, image_url, source, category')
          .eq('id', message.article_id)
          .single();
        enrichedMessage.article = article || null;
      }

      return res.status(201).json({ message: enrichedMessage });
    } catch (error) {
      console.error('Send message error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
