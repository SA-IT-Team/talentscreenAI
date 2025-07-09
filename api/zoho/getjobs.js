import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { page = 1, per_page = 10 } = req.query;
    const start = (page - 1) * per_page;
    const end = start + parseInt(per_page);

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

    const jobsRes = await fetch(`https://recruit.zoho.in/recruit/v2/JobOpenings?per_page=200&page=1`, {
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

    const filtered = jobsData.data?.filter(job => job.Job_Opening_Status === 'In-progress') || [];
    const paginated = filtered.slice(start, end);
    const hasMore = filtered.length > end;

    return res.status(200).json({
      count: paginated.length,
      hasMore,
      currentPage: parseInt(page),
      perPage: parseInt(per_page),
      data: paginated
    });
  } catch (error) {
    console.error('[Get Jobs] Exception:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
