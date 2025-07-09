import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { data: tokens, error } = await supabase
      .from('zoho_tokens')
      .select('refresh_token')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !tokens || tokens.length === 0) {
      return res.status(400).json({ error: 'No refresh token found' });
    }

    const refresh_token = tokens[0].refresh_token;

    const params = new URLSearchParams({
      refresh_token,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    });

    const refreshRes = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await refreshRes.json();

    if (!refreshRes.ok || !data.access_token) {
      console.error('[Refresh] Failed:', data);
      return res.status(500).json({ error: 'Failed to refresh token', details: data });
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    const { error: updateError } = await supabase.from('zoho_tokens').update({
      access_token: data.access_token,
      expires_at: expiresAt
    }).order('created_at', { ascending: false }).limit(1);

    if (updateError) {
      console.error('[Refresh] Supabase update failed:', updateError);
      return res.status(500).json({ error: 'Failed to update token in Supabase' });
    }

    return res.status(200).json({ message: 'Access token refreshed successfully' });

  } catch (err) {
    console.error('[Refresh Token] Exception:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
