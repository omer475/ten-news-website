// pages/api/feed/reminder.js — "remind me / pin to top" for an upcoming event.
//
// POST   { event_id, guest_device_id? }  → add a reminder
// DELETE { event_id, guest_device_id? }  → remove it
//
// The reminded event is returned in /api/feed/main's pinned_events (top-of-feed
// pinning) until it passes. Works for logged-in users (cookie/bearer) AND
// guests (guest_device_id). Reminders on a past/unknown event are rejected.

import { createClient as createAuthedClient } from '../../../lib/supabase-server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createAdminClient(url, serviceKey, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body || {}
  const eventId = Number(body.event_id)
  if (!Number.isFinite(eventId)) return res.status(400).json({ error: 'event_id required' })

  const admin = getAdminSupabase()
  if (!admin) return res.status(500).json({ error: 'reminder storage not configured' })

  try {
    const supabase = createAuthedClient({ req, res })
    let userId = null
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user) userId = data.user.id
    } catch (_) {}
    if (!userId) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization
      const token = (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer '))
        ? authHeader.slice(7).trim() : null
      if (token) {
        try { const { data } = await admin.auth.getUser(token); if (data?.user) userId = data.user.id } catch (_) {}
      }
    }
    const guestId = (!userId && typeof body.guest_device_id === 'string' && body.guest_device_id.trim())
      ? body.guest_device_id.trim() : null
    if (!userId && !guestId) return res.status(401).json({ error: 'auth or guest_device_id required' })

    const subject = userId ? { user_id: userId } : { guest_id: guestId }

    if (req.method === 'DELETE') {
      let q = admin.from('user_reminders').delete().eq('event_id', eventId)
      q = userId ? q.eq('user_id', userId) : q.eq('guest_id', guestId)
      const { error } = await q
      if (error) { console.error('[reminder] delete failed:', error.message); return res.status(500).json({ error: 'delete failed' }) }
      return res.status(200).json({ success: true, reminded: false })
    }

    // POST — only allow reminders on a real, still-future event.
    const { data: ev } = await admin
      .from('upcoming_events').select('id, event_date').eq('id', eventId).maybeSingle()
    if (!ev) return res.status(404).json({ error: 'event not found' })
    if (new Date(ev.event_date) <= new Date()) return res.status(400).json({ error: 'event already passed' })

    // Plain insert; a unique-violation (23505) means it's already reminded —
    // idempotent success. (The dedup indexes are partial, so ON CONFLICT can't
    // be inferred by PostgREST; insert-and-tolerate-dup is the robust path.)
    const { error } = await admin.from('user_reminders').insert({ ...subject, event_id: eventId })
    if (error && error.code !== '23505') {
      console.error('[reminder] insert failed:', error.message)
      return res.status(500).json({ error: 'insert failed' })
    }
    return res.status(200).json({ success: true, reminded: true, event_id: eventId })
  } catch (e) {
    console.error('[reminder] handler error:', e?.message || e)
    return res.status(500).json({ error: 'internal error' })
  }
}
