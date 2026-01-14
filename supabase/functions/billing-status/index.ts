import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const decodeJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
    const json = atob(b64);
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
};

type BillingRow = {
  user_id: string;
  trial_ends_at: string;
  subscription_status: string;
  razorpay_subscription_id: string | null;
  current_period_end: string | null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';
  const jwtPayload = token ? decodeJwtPayload(token) : null;
  console.log('billing-status: request', {
    hasAuth: Boolean(token),
    hasServiceRoleKey: Boolean(serviceRoleKey),
    jwtHasSub: Boolean(jwtPayload && (jwtPayload as any)?.sub),
    jwtRole: jwtPayload ? String((jwtPayload as any)?.role || '') : ''
  });
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing authorization token.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (!jwtPayload || !(jwtPayload as any)?.sub) {
    return new Response(
      JSON.stringify({
        error: `Invalid authorization token: missing sub claim (role=${String((jwtPayload as any)?.role || '')}). Please login again and ensure Authorization uses the user's access_token, not the anon key.`
      }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    console.log('billing-status: invalid session', { message: userErr?.message || 'no_user' });
    return new Response(JSON.stringify({ error: userErr?.message || 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const userId = userData.user.id;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabaseAdmin
    .from('user_billing')
    .select('user_id, trial_ends_at, subscription_status, razorpay_subscription_id, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let row = data as BillingRow | null;

  if (!row) {
    const createdAtMs = userData?.user?.created_at ? new Date(userData.user.created_at).getTime() : NaN;
    const baseMs = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();
    const trialEndsAt = new Date(baseMs + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('user_billing')
      .upsert(
        {
          user_id: userId,
          trial_ends_at: trialEndsAt,
          subscription_status: 'trialing'
        },
        { onConflict: 'user_id' }
      )
      .select('user_id, trial_ends_at, subscription_status, razorpay_subscription_id, current_period_end')
      .maybeSingle();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    row = (inserted as BillingRow | null) ?? null;
  }
  const nowMs = Date.now();
  const trialEndsMs = row?.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;
  const isTrialActive = trialEndsMs !== null && Number.isFinite(trialEndsMs) && nowMs < trialEndsMs;
  const isPaid = row?.subscription_status === 'active';
  const accessAllowed = isPaid || isTrialActive;

  const msLeft = trialEndsMs !== null && Number.isFinite(trialEndsMs) ? Math.max(0, trialEndsMs - nowMs) : 0;
  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));

  return new Response(
    JSON.stringify({
      ok: true,
      accessAllowed,
      isPaid,
      status: row?.subscription_status || 'trialing',
      trialEndsAt: row?.trial_ends_at || null,
      trialHoursLeft: isPaid ? null : hoursLeft,
      currentPeriodEnd: row?.current_period_end || null,
      razorpaySubscriptionId: row?.razorpay_subscription_id || null
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
