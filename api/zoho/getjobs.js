export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.warn('[Get Jobs] Missing Authorization header');
      return res.status(401).json({ error: 'Missing access token' });
    }

    const jobsRes = await fetch('https://recruit.zoho.in/recruit/v2/JobOpenings', {
      method: 'GET',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`
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
