import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://nandqoilqwsepborxkrz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmRxb2lscXdzZXBib3J4a3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTkwODAsImV4cCI6MjA2MDkzNTA4MH0.FU7khFN_ESgFTFETWcyTytqcaCQFQzDB6LB5CzVQiOg";

let cachedKey = null;
let cachedClient = null;

function resolveUrl(env) {
  if (env) {
    const fromEnv = env.SUPABASE_URL || env.SUPABASE_PROJECT_URL || env.SUPABASE_API_URL;
    if (fromEnv) return fromEnv;
  }
  return DEFAULT_SUPABASE_URL;
}

function resolveKey(env) {
  if (env) {
    const fromEnv =
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_ANON_KEY ||
      env.SUPABASE_KEY ||
      env.SUPABASE_API_KEY;
    if (fromEnv) return fromEnv;
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function getSupabaseClient(env) {
  const url = resolveUrl(env);
  const key = resolveKey(env);

  if (!url || !key) {
    throw new Error("Supabase credentials are not configured for the Worker");
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
