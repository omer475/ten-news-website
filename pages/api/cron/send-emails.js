/**
 * Cron Job: Send Daily Digest Emails
 * 
 * This endpoint is called by Vercel Cron every hour (0 * * * *)
 * It sends daily digest emails to users whose local time matches their preferred hour.
 * 
 * Required environment variable:
 * - CRON_SECRET: Used to authenticate cron requests
 */

export const config = {
  maxDuration: 60, // 60 second timeout for cron jobs
};

export default async function handler(req, res) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.authorization;
  
  // Vercel sends the CRON_SECRET as a Bearer token
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('❌ Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('⏰ Cron job triggered: send-emails');
  console.log(`🕐 Current time: ${new Date().toISOString()}`);

  try {
    // Call the daily digest endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://tennews.ai';

    const response = await fetch(`${baseUrl}/api/email/send-daily-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET
      }
    });

    const result = await response.json();
    
    console.log('📧 Daily digest result:', result);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return res.status(500).json({ 
      error: 'Cron job failed', 
      message: error.message 
    });
  }
}
