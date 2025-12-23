// Simple test endpoint to check if API is working
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  const envCheck = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    nodeEnv: process.env.NODE_ENV,
    method: req.method,
    timestamp: new Date().toISOString()
  }
  
  console.log('Test endpoint called:', envCheck)
  
  return res.status(200).json({
    success: true,
    message: 'API is working!',
    env: envCheck
  })
}

