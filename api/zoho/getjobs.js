import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log('[GetJobs] 🔥 API called at:', new Date().toISOString());
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
    const url = `https://recruit.zoho.in/recruit/v2/JobOpenings?page=1&per_page=200`;

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

    // 📆 Calculate date 60 days ago
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // ✅ Filter jobs with status = "In-progress"
    const filteredJobs = allJobs
      .filter((job) => {
        try {
          if (job.Job_Opening_Status !== "In-progress") return false;

          const createdDate = new Date(job.Created_Time);
          if (isNaN(createdDate.getTime())) {
            console.warn(
              "[GetJobs] Skipping job with invalid Created_Time:",
              job.Job_Opening_ID
            );
            return false;
          }

          return createdDate >= sixtyDaysAgo;
        } catch (err) {
          console.warn(
            "[GetJobs] Error filtering job:",
            job?.Job_Opening_ID,
            err.message
          );
          return false;
        }
      })
      .map((job) => ({
        Job_Opening_ID: job.Job_Opening_ID || "",
        Job_Description: job.Job_Description || "",
        Posting_Title: job.Job_Opening_Name || "",
        Location: job.City || "",
      }));


    console.log(`[GetJobs] Fetched: ${allJobs.length}, In-progress: ${filteredJobs.length}`);

    return res.status(200).json({ data: filteredJobs });

  } catch (error) {
    console.error('[GetJobs] Exception:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
