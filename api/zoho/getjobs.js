import { createClient } from '@supabase/supabase-js';

// Supabase client (secure backend access)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 🔐 Get the latest stored access token
    const { data: tokens, error } = await supabase
      .from('zoho_tokens')
      .select('access_token')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !tokens || tokens.length === 0) {
      console.warn('[Get Jobs] No valid access token found');
      return res.status(401).json({ error: 'Access token missing or invalid' });
    }

    const accessToken = tokens[0].access_token;

    // 🌐 Call Zoho Recruit API
    const jobsRes = await fetch('https://recruit.zoho.in/recruit/v2/JobOpenings', {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      }
    });

    if (!jobsRes.ok) {
      const errorText = await jobsRes.text();
      console.error('[Get Jobs] Zoho API error:', errorText);
      return res.status(502).json({ error: 'Failed to fetch jobs from Zoho' });
    }

    const jobsData = await jobsRes.json();
    console.log(`[Get Jobs] Retrieved ${jobsData.data?.length || 0} job(s)`);

    return res.status(200).json(jobsData);

  } catch (error) {
    console.error('[Get Jobs] Exception:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
