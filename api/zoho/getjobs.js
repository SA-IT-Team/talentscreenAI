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

    // 1. Get latest access token
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

    // 2. Loop through Zoho pages
    const allJobs = [];
    let currentPage = 1;
    let moreRecords = true;

    while (moreRecords) {
      const url = `https://recruit.zoho.in/recruit/v2/JobOpenings?per_page=200&page=${currentPage}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`
        }
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[Zoho API error] Page ${currentPage}:`, err);
        return res.status(502).json({ error: 'Failed to fetch jobs from Zoho', details: err });
      }

      const json = await response.json();
      const jobsPage = json.data || [];

      allJobs.push(...jobsPage);
      moreRecords = json.info?.more_records || false;
      currentPage++;
    }

    // 3. Filter & paginate
    const inProgress = allJobs.filter(job => job.Job_Opening_Status === 'In-progress');
    const paginated = inProgress.slice(start, end);
    const hasMore = inProgress.length > end;

    console.log(`[GetJobs] Total: ${allJobs.length}, In-progress: ${inProgress.length}`);

    return res.status(200).json({
      count: paginated.length,
      hasMore,
      currentPage: parseInt(page),
      perPage: parseInt(per_page),
      data: paginated
    });

  } catch (error) {
    console.error('[GetJobs] Unhandled Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
