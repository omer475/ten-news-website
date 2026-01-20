/**
 * Cron Job: Send Re-engagement Emails
 * 
 * This endpoint is called by Vercel Cron daily at 10 AM UTC (0 10 * * *)
 * It sends "we miss you" emails to users who haven't been active.
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
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('❌ Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('⏰ Cron job triggered: reengagement');
  console.log(`🕐 Current time: ${new Date().toISOString()}`);

  try {
    // Call the re-engagement endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'https://tennews.ai';

    const response = await fetch(`${baseUrl}/api/email/send-reengagement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET
      }
    });

    const result = await response.json();
    
    console.log('🔄 Re-engagement result:', result);

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
