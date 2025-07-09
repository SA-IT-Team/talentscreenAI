import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (with service role key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      console.error('[OAuth Callback] Missing code in query params');
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const params = new URLSearchParams({
      code,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: process.env.ZOHO_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const tokenRes = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[OAuth Callback] Token fetch failed:', errorText);
      return res.status(500).json({ error: 'Failed to retrieve token from Zoho' });
    }

    const tokenData = await tokenRes.json();
    console.log('[OAuth Callback] Access token received:', tokenData.access_token);

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Optional: clear any old tokens
    await supabase.from('zoho_tokens').delete().neq('id', '');

    // Insert the new token
    const { error } = await supabase.from('zoho_tokens').insert({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt
    });

    if (error) {
      console.error('[OAuth Callback] Supabase insert failed:', error);
      return res.status(500).json({ error: 'Failed to store token in Supabase' });
    }

    return res.status(200).json({ message: 'Token received and stored successfully' });

  } catch (error) {
    console.error('[OAuth Callback] Exception:', error);
    return res.status(500).json({ error: 'Server error during OAuth callback' });
  }
}
