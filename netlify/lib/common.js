import { createClient } from "@supabase/supabase-js";

// Shared helpers for the Job Card app's Netlify functions.
//
// Every function calls requireUser() first: the browser sends the signed-in
// user's Supabase access token (Authorization: Bearer ...), and we confirm it
// with Supabase before reading any data. Job cards show store names,
// addresses and asset numbers, so nothing is returned to an anonymous caller.
// Any RTMA login may use the app (same as the dashboard) - no role table.

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

export function clean(value) {
  return String(value ?? "").trim();
}

export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Returns { supabase, user } or { response } (a 401/500 to send back as is).
export async function requireUser(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { response: json(401, { error: "Please sign in." }) };
  let supabase;
  try {
    supabase = serviceClient();
  } catch (error) {
    return { response: json(500, { error: error.message }) };
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { response: json(401, { error: "Your session has expired. Please sign in again." }) };
  return { supabase, user: data.user };
}

// "a,b,c" -> ["a","b","c"] (trimmed, de-duplicated), or null when empty.
export function listParam(value, max = 200) {
  if (!value) return null;
  const list = [...new Set(String(value).split(",").map(s => s.trim()).filter(Boolean))];
  if (!list.length) return null;
  if (list.length > max) throw Object.assign(new Error(`At most ${max} case numbers per request.`), { statusCode: 400 });
  return list;
}
