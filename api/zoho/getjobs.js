import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 🔐 1. Get the latest access token
    const { data: tokens, error: tokenError } = await supabase
      .from('zoho_tokens')
      .select('access_token')
      .order('created_at', { ascending: false })
      .limit(1);

    if (tokenError || !tokens || tokens.length === 0) {
      console.error('[GetJobs] Failed to retrieve access token from Supabase:', tokenError);
      return res.status(401).json({ error: 'Access token missing or invalid' });
    }

    const accessToken = tokens[0].access_token;
    const allJobs = [];
    let page = 1;
    let moreRecords = true;

    // 🔁 2. Loop through all paginated results
    while (moreRecords) {
      const url = `https://recruit.zoho.in/recruit/v2/JobOpenings?page=${page}&per_page=200`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[GetJobs] Zoho API error (page ${page}):`, errorBody);
        return res.status(502).json({ error: 'Failed to fetch jobs from Zoho', page, details: errorBody });
      }

      const responseData = await response.json();
      const pageJobs = responseData?.data || [];

      allJobs.push(...pageJobs);
      moreRecords = responseData.info?.more_records || false;
      page++;
    }

    // ✅ 3. Filter jobs by "In-progress"
    const inProgressJobs = allJobs.filter(
      job => job.Job_Opening_Status === 'In-progress'
    );

    console.log(`[GetJobs] Total jobs fetched: ${allJobs.length}`);
    console.log(`[GetJobs] In-progress jobs returned: ${inProgressJobs.length}`);

    return res.status(200).json({ data: inProgressJobs });

  } catch (error) {
    console.error('[GetJobs] Unhandled Exception:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
