import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // GET - List conversations for a user
  if (req.method === 'GET') {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    try {
      // Get all conversation IDs for this user
      const { data: participations, error: pErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user_id);

      if (pErr) throw pErr;
      if (!participations?.length) return res.status(200).json({ conversations: [] });

      const convIds = participations.map(p => p.conversation_id);

      // Get conversations with participants and last message
      const conversations = [];

      for (const convId of convIds) {
        // Get the other participant(s)
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', convId)
          .neq('user_id', user_id);

        // Get profile info for other participants
        const otherUserIds = (parts || []).map(p => p.user_id);
        let participants = [];
        if (otherUserIds.length > 0) {
          // Try profiles first for display_name
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', otherUserIds);

          // Also get email from auth.users
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const authMap = {};
          if (authUsers?.users) {
            for (const u of authUsers.users) {
              authMap[u.id] = u;
            }
          }

          participants = otherUserIds.map(uid => {
            const profile = (profiles || []).find(p => p.id === uid);
            const auth = authMap[uid];
            return {
              id: uid,
              display_name: profile?.display_name || auth?.user_metadata?.name || auth?.email?.split('@')[0] || 'User',
              avatar_url: profile?.avatar_url || auth?.user_metadata?.avatar_url || null,
              email: auth?.email || null
            };
          });
        }

        // Get last message
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = msgs?.[0] || null;

        // If last message has article_id, fetch article info
        if (lastMessage?.article_id) {
          const { data: article } = await supabase
            .from('articles')
            .select('id, title, image_url, source, category')
            .eq('id', lastMessage.article_id)
            .single();
          if (article) lastMessage.article = article;
        }

        // Get conversation metadata
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, created_at, updated_at')
          .eq('id', convId)
          .single();

        conversations.push({
          id: convId,
          participants,
          last_message: lastMessage,
          updated_at: conv?.updated_at || conv?.created_at,
          created_at: conv?.created_at
        });
      }

      // Sort by most recent activity
      conversations.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.updated_at || '';
        const bTime = b.last_message?.created_at || b.updated_at || '';
        return bTime.localeCompare(aTime);
      });

      return res.status(200).json({ conversations });
    } catch (error) {
      console.error('List conversations error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - Create or find existing conversation
  if (req.method === 'POST') {
    const { user_id, other_user_id } = req.body;
    if (!user_id || !other_user_id) {
      return res.status(400).json({ error: 'user_id and other_user_id required' });
    }

    try {
      // Check if conversation already exists between these two users
      const { data: userConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user_id);

      const { data: otherConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', other_user_id);

      const userConvIds = new Set((userConvs || []).map(c => c.conversation_id));
      const existing = (otherConvs || []).find(c => userConvIds.has(c.conversation_id));

      if (existing) {
        // Return existing conversation
        const convId = existing.conversation_id;
        const { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', convId)
          .single();

        // Get other user info
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', other_user_id);

        const { data: authData } = await supabase.auth.admin.getUserById(other_user_id);
        const auth = authData?.user;
        const profile = profiles?.[0];

        return res.status(200).json({
          conversation: {
            id: convId,
            participants: [{
              id: other_user_id,
              display_name: profile?.display_name || auth?.user_metadata?.name || auth?.email?.split('@')[0] || 'User',
              avatar_url: profile?.avatar_url || auth?.user_metadata?.avatar_url || null,
              email: auth?.email || null
            }],
            last_message: null,
            updated_at: conv?.updated_at
          }
        });
      }

      // Create new conversation
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convErr) throw convErr;

      // Add both participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: newConv.id, user_id },
        { conversation_id: newConv.id, user_id: other_user_id }
      ]);

      // Get other user info
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', other_user_id);

      const { data: authData } = await supabase.auth.admin.getUserById(other_user_id);
      const auth = authData?.user;
      const profile = profiles?.[0];

      return res.status(201).json({
        conversation: {
          id: newConv.id,
          participants: [{
            id: other_user_id,
            display_name: profile?.display_name || auth?.user_metadata?.name || auth?.email?.split('@')[0] || 'User',
            avatar_url: profile?.avatar_url || auth?.user_metadata?.avatar_url || null,
            email: auth?.email || null
          }],
          last_message: null,
          updated_at: newConv.updated_at
        }
      });

    } catch (error) {
      console.error('Create conversation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
