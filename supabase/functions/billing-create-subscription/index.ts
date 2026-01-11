import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const basicAuth = (keyId: string, keySecret: string) => {
  const raw = `${keyId}:${keySecret}`;
  return `Basic ${btoa(raw)}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const rzpPlanId = Deno.env.get('RAZORPAY_PLAN_ID');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return json({ error: 'Server is not configured.' }, 500);
  }

  if (!rzpKeyId || !rzpKeySecret || !rzpPlanId) {
    return json({ error: 'Billing is not configured.' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';
  console.log('billing-create-subscription: request', {
    hasAuth: Boolean(token),
    hasAnonKey: Boolean(supabaseAnonKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    hasRazorpayKeyId: Boolean(rzpKeyId),
    hasRazorpayPlanId: Boolean(rzpPlanId)
  });
  if (!token) return json({ error: 'Missing authorization token.' }, 401);

  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: userData, error: userErr } = await supabaseUserClient.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    console.log('billing-create-subscription: invalid session', { message: userErr?.message || 'no_user' });
    return json({ error: userErr?.message || 'Invalid session' }, 401);
  }

  const userId = userData.user.id;
  const email = userData.user.email || '';

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('user_billing')
    .select('razorpay_customer_id, razorpay_subscription_id, subscription_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingErr) return json({ error: existingErr.message }, 500);

  if (existing?.subscription_status === 'active') {
    return json({ error: 'Subscription already active.' }, 400);
  }

  let customerId = existing?.razorpay_customer_id || null;

  if (!customerId) {
    const custResp = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(rzpKeyId, rzpKeySecret)
      },
      body: JSON.stringify({
        name: email ? email.split('@')[0] : 'Studo User',
        email: email || undefined
      })
    });

    const custJson = await custResp.json().catch(() => ({}));
    if (!custResp.ok || !custJson?.id) {
      return json({ error: custJson?.error?.description || 'Failed to create Razorpay customer.' }, 500);
    }

    customerId = String(custJson.id);

    await supabaseAdmin
      .from('user_billing')
      .upsert({ user_id: userId, razorpay_customer_id: customerId }, { onConflict: 'user_id' });
  }

  const subResp = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(rzpKeyId, rzpKeySecret)
    },
    body: JSON.stringify({
      plan_id: rzpPlanId,
      customer_id: customerId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1
    })
  });

  const subJson = await subResp.json().catch(() => ({}));
  if (!subResp.ok || !subJson?.id) {
    return json({ error: subJson?.error?.description || 'Failed to create Razorpay subscription.' }, 500);
  }

  const subscriptionId = String(subJson.id);

  await supabaseAdmin
    .from('user_billing')
    .upsert(
      {
        user_id: userId,
        subscription_status: 'created',
        razorpay_subscription_id: subscriptionId
      },
      { onConflict: 'user_id' }
    );

  return json({
    ok: true,
    keyId: rzpKeyId,
    subscriptionId
  });
});
