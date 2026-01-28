/**
 * DEPRECATED - This endpoint is disabled.
 * Use the cron job at /api/cron/send-emails instead.
 */

export default async function handler(req, res) {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated',
    message: 'Email sending is now handled by /api/cron/send-emails'
  });
}
