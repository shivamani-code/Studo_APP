import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

// Helper to decode JWT payload for debugging
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

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

async function razorpayGet(path: string, keyId: string, keySecret: string) {
  const res = await fetch(`https://api.razorpay.com${path}`, {
    method: 'GET',
    headers: {
      Authorization: basicAuth(keyId, keySecret)
    }
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, statusText: res.statusText, text };
}

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
  const jwtPayload = token ? decodeJwtPayload(token) : null;
  if (!token) {
    return json({ error: 'Missing authorization token.' }, 401);
  }

  if (!jwtPayload || !(jwtPayload as any)?.sub) {
    return json({
      error: `Invalid authorization token: missing sub claim (role=${String((jwtPayload as any)?.role || '')}). Please login again and ensure Authorization uses the user's access_token, not the anon key.`
    }, 401);
  }

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
    .select('trial_ends_at, razorpay_customer_id, razorpay_subscription_id, subscription_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingErr) return json({ error: existingErr.message }, 500);

  if (existing?.subscription_status === 'active') {
    return json({ error: 'Subscription already active.' }, 400);
  }

  let customerId = (existing as any)?.razorpay_customer_id || null;

  if (!customerId) {
    const customerRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(rzpKeyId, rzpKeySecret)
      },
      body: JSON.stringify({
        name: email || userId,
        notes: { user_id: userId, email }
      })
    });

    if (!customerRes.ok) {
      const errorText = await customerRes.text();
      return json(
        {
          error: `Failed to create customer: ${customerRes.status} ${customerRes.statusText}`,
          details: errorText
        },
        500
      );
    }

    const customer = await customerRes.json();
    customerId = customer.id;
  }

  const planCheck = await razorpayGet(`/v1/plans/${encodeURIComponent(rzpPlanId)}`, rzpKeyId, rzpKeySecret);
  if (!planCheck.ok) {
    return json(
      {
        error: 'Razorpay plan_id is not valid for these keys/mode.',
        plan_id: rzpPlanId,
        details: {
          status: planCheck.status,
          statusText: planCheck.statusText,
          body: planCheck.text
        }
      },
      500
    );
  }

  const customerCheck = await razorpayGet(`/v1/customers/${encodeURIComponent(customerId)}`, rzpKeyId, rzpKeySecret);
  if (!customerCheck.ok) {
    return json(
      {
        error: 'Razorpay customer_id is not valid for these keys/mode.',
        customer_id: customerId,
        details: {
          status: customerCheck.status,
          statusText: customerCheck.statusText,
          body: customerCheck.text
        }
      },
      500
    );
  }

  const subscriptionRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(rzpKeyId, rzpKeySecret)
    },
    body: JSON.stringify({
      plan_id: rzpPlanId,
      customer_id: customerId,
      total_count: 12,
      notes: { user_id: userId }
    })
  });

  if (!subscriptionRes.ok) {
    const errorText = await subscriptionRes.text();
    return json(
      {
        error: `Failed to create subscription: ${subscriptionRes.status} ${subscriptionRes.statusText}`,
        details: errorText,
        debug: { plan_id: rzpPlanId, customer_id: customerId }
      },
      500
    );
  }

  const subscription = await subscriptionRes.json();

  const nowIso = new Date().toISOString();
  const trialEndsAt = (existing as any)?.trial_ends_at ? String((existing as any).trial_ends_at) : nowIso;
  const currentPeriodEndIso =
    typeof (subscription as any)?.current_end === 'number'
      ? new Date((subscription as any).current_end * 1000).toISOString()
      : null;

  const { error: updateErr } = await supabaseAdmin
    .from('user_billing')
    .upsert(
      {
        user_id: userId,
        razorpay_customer_id: customerId,
        razorpay_subscription_id: subscription.id,
        subscription_status: String(subscription.status || 'created'),
        trial_ends_at: trialEndsAt,
        current_period_end: currentPeriodEndIso,
        updated_at: nowIso
      },
      { onConflict: 'user_id' }
    );

  if (updateErr) {
    return json(
      {
        error: 'Failed to update billing record.',
        details: updateErr.message
      },
      500
    );
  }

  return json({
    ok: true,
    keyId: rzpKeyId,
    subscriptionId: subscription.id,
    subscription_id: subscription.id,
    short_url: subscription.short_url
  });
});
