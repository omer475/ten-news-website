// lib/pinnedEvents.js — a user/guest's reminded upcoming events, still in the
// future, for top-of-feed pinning (Feature C: reminders / alarm). Past events
// auto-excluded. Returns [] for anonymous-no-guest or no reminders.

export async function getPinnedEvents(supabase, userId, guestDeviceId) {
  if (!userId && !guestDeviceId) return []
  try {
    let q = supabase.from('user_reminders').select('event_id')
    q = userId ? q.eq('user_id', userId) : q.eq('guest_id', guestDeviceId)
    const { data: rem, error } = await q
    if (error) { console.error('[pinnedEvents] reminders query failed:', error.message); return [] }
    const ids = [...new Set((rem || []).map(r => r.event_id))]
    if (!ids.length) return []
    const { data: ev } = await supabase
      .from('upcoming_events')
      .select('id, name, event_date, topic_tags, context, source_article_id')
      .in('id', ids)
      .gt('event_date', new Date().toISOString())      // auto-exclude past
      .order('event_date', { ascending: true })
    return (ev || []).map(e => ({
      id: e.id, name: e.name, datetime: e.event_date, context: e.context || '',
      topic_tags: e.topic_tags || [], source_article_id: e.source_article_id ?? null,
    }))
  } catch (e) {
    console.error('[pinnedEvents] failed:', e.message)
    return []
  }
}
