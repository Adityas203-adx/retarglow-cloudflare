import { createClient } from "@supabase/supabase-js";

let cachedKey = null;
let cachedClient = null;

function resolveKey(env) {
  if (!env) return null;
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || null;
}

export function getSupabaseClient(env) {
  const url = env?.SUPABASE_URL || env?.SUPABASE_PROJECT_URL || null;
  const key = resolveKey(env);

  if (!url || !key) {
    throw new Error("Supabase credentials are not configured in the Worker environment");
  }

  const nextKey = `${url}|${key}`;
  if (cachedClient && cachedKey === nextKey) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false }
  });
  cachedKey = nextKey;
  return cachedClient;
}
