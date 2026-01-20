import { createClient } from '@supabase/supabase-js';

/**
 * Email Tracking Pixel & Click Tracking
 * 
 * This endpoint handles:
 * - Open tracking via tracking pixel (GET with type=open)
 * - Click tracking via redirect (GET with type=click)
 * 
 * Usage in emails:
 * - Open tracking: <img src="https://tennews.ai/api/email/track?type=open&id=EMAIL_LOG_ID" width="1" height="1" />
 * - Click tracking: <a href="https://tennews.ai/api/email/track?type=click&id=EMAIL_LOG_ID&url=ENCODED_URL">
 */

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { type, id, url } = req.query;

  if (!type || !id) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  try {
    const emailLogId = parseInt(id);
    
    if (isNaN(emailLogId)) {
      return res.status(400).json({ message: 'Invalid email log ID' });
    }

    if (type === 'open') {
      // Track email open
      await trackOpen(emailLogId);
      
      // Return 1x1 transparent pixel
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.send(pixel);
      
    } else if (type === 'click') {
      // Track click and redirect
      await trackClick(emailLogId, url);
      
      const redirectUrl = url ? decodeURIComponent(url) : 'https://tennews.ai';
      return res.redirect(302, redirectUrl);
      
    } else {
      return res.status(400).json({ message: 'Invalid tracking type' });
    }

  } catch (error) {
    console.error('Tracking error:', error);
    
    // Still redirect on error for clicks
    if (type === 'click' && url) {
      return res.redirect(302, decodeURIComponent(url));
    }
    
    // Return pixel on error for opens
    if (type === 'open') {
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      res.setHeader('Content-Type', 'image/gif');
      return res.send(pixel);
    }
    
    return res.status(500).json({ message: 'Tracking failed' });
  }
}

async function trackOpen(emailLogId) {
  const now = new Date().toISOString();
  
  // Get the email log to find user
  const { data: emailLog } = await supabase
    .from('email_logs')
    .select('user_id, status')
    .eq('id', emailLogId)
    .single();

  if (!emailLog) return;

  // Only track first open
  if (emailLog.status === 'opened' || emailLog.status === 'clicked') {
    return;
  }

  // Update email log
  await supabase
    .from('email_logs')
    .update({ 
      status: 'opened',
      opened_at: now
    })
    .eq('id', emailLogId);

  // Update user's email stats
  if (emailLog.user_id) {
    await supabase.rpc('increment_email_open', { user_id: emailLog.user_id }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from('profiles')
        .update({ 
          email_open_count: supabase.sql`email_open_count + 1`,
          last_email_opened_at: now
        })
        .eq('id', emailLog.user_id);
    });
  }

  console.log(`📧 Email ${emailLogId} opened`);
}

async function trackClick(emailLogId, clickedUrl) {
  const now = new Date().toISOString();
  
  // Get the email log
  const { data: emailLog } = await supabase
    .from('email_logs')
    .select('user_id, metadata')
    .eq('id', emailLogId)
    .single();

  if (!emailLog) return;

  // Update email log with click
  const metadata = emailLog.metadata || {};
  metadata.clicked_urls = metadata.clicked_urls || [];
  metadata.clicked_urls.push({ url: clickedUrl, at: now });

  await supabase
    .from('email_logs')
    .update({ 
      status: 'clicked',
      clicked_at: now,
      metadata
    })
    .eq('id', emailLogId);

  // Update user's click stats
  if (emailLog.user_id) {
    await supabase
      .from('profiles')
      .update({ 
        email_click_count: supabase.sql`email_click_count + 1`,
        // Also update activity since they clicked through
        last_app_activity_at: now,
        consecutive_days_inactive: 0
      })
      .eq('id', emailLog.user_id)
      .catch(() => {});
  }

  console.log(`📧 Email ${emailLogId} clicked: ${clickedUrl}`);
}
