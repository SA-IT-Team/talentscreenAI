import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 🔐 Get the latest access token
    const { data: tokens, error: tokenError } = await supabase
      .from('zoho_tokens')
      .select('access_token')
      .order('created_at', { ascending: false })
      .limit(1);

    if (tokenError || !tokens || tokens.length === 0) {
      console.error('[GetJobs] Failed to retrieve access token:', tokenError);
      return res.status(401).json({ error: 'Access token missing or invalid' });
    }

    const accessToken = tokens[0].access_token;

    // 🌐 Fetch only the first page (200 records max)
    const url = `https://recruit.zoho.in/recruit/v2/JobOpenings?page=1&per_page=50`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GetJobs] Zoho API error:', errorText);
      return res.status(502).json({ error: 'Failed to fetch jobs from Zoho', details: errorText });
    }

    const json = await response.json();
    const allJobs = json?.data || [];

    // ✅ Filter jobs with status = "In-progress"
    const inProgressJobs = allJobs.filter(
      job => job.Job_Opening_Status === 'In-progress'
    );

    console.log(`[GetJobs] Fetched: ${allJobs.length}, In-progress: ${inProgressJobs.length}`);

    return res.status(200).json({ data: inProgressJobs });

  } catch (error) {
    console.error('[GetJobs] Exception:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
