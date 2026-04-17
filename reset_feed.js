const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    // List all users with activity
    console.log('Listing users with recent feed activity...\n');
    const { data: events } = await supabase
      .from('user_article_events')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 3600000).toISOString())
      .limit(1000);

    if (events) {
      const userCounts = {};
      for (const e of events) {
        userCounts[e.user_id] = (userCounts[e.user_id] || 0) + 1;
      }
      const sorted = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
      for (const [uid, count] of sorted.slice(0, 20)) {
        // Get user info
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', uid)
          .single();
        console.log(`  ${uid} - ${count} events - ${profile?.email || '(no profile)'}`);
      }
      console.log('\nUsage: node reset_feed.js <user_id>');
    }
    return;
  }

  console.log(`Resetting feed state for user: ${userId}\n`);

  // 1. Delete seen article events
  const { data: d1, error: e1 } = await supabase
    .from('user_article_events')
    .delete()
    .eq('user_id', userId);
  console.log('Cleared user_article_events:', e1 ? e1.message : 'OK');

  // 2. Delete feed impressions
  const { data: d2, error: e2 } = await supabase
    .from('user_feed_impressions')
    .delete()
    .eq('user_id', userId);
  console.log('Cleared user_feed_impressions:', e2 ? e2.message : 'OK');

  console.log('\nFeed reset complete. Next feed request will show fresh articles.');
}
main().catch(console.error);
