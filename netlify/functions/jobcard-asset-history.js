import { json, clean, requireUser } from "../lib/common.js";

// GET /api/jobcard-asset-history?asset_no=...&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
// The asset's event timeline for "Asset Repair History" (the page keeps only
// earlier repair cases). Reads the dashboard's v_asset_history_events view -
// same lookup as the dashboard's asset-history.js, trimmed to what a job card
// needs. Read-only.

async function resolveAsset(supabase, term) {
  for (const column of ["name", "bar_code", "local_code"]) {
    const { data, error } = await supabase.from("assets_live").select("name,bar_code").eq(column, term).limit(1);
    if (error) throw error;
    if (data?.[0]?.name) return { name: clean(data[0].name), bar_code: clean(data[0].bar_code) };
  }
  return { name: term, bar_code: "" };
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  const auth = await requireUser(event);
  if (auth.response) return auth.response;
  try {
    const params = event.queryStringParameters || {};
    const term = clean(params.asset_no);
    if (!term) return json(400, { error: "asset_no is required." });
    const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
    const asset = await resolveAsset(auth.supabase, term);
    let query = auth.supabase
      .from("v_asset_history_events")
      .select("event_date,event_day,event_source,event_group,event_type,outcome_group,status_reason,case_number,repair_code,repair_name")
      .eq("asset_no", asset.name)
      .order("event_date", { ascending: false })
      .limit(1000);
    if (isDate(params.from_date)) query = query.gte("event_day", params.from_date);
    if (isDate(params.to_date)) query = query.lte("event_day", params.to_date);
    const { data, error } = await query;
    if (error) throw error;
    const timeline = (data || []).map(e => ({
      event_date: clean(e.event_date).slice(0, 10),
      event_type: e.event_type,
      event_group: e.event_group,
      outcome_group: e.outcome_group,
      status_reason: e.status_reason,
      case_number: e.case_number,
      repair_code: e.repair_code,
      repair_name: e.repair_name,
      source: e.event_source,
    }));
    return json(200, { asset_no: asset.name, bar_code: asset.bar_code, timeline });
  } catch (error) {
    return json(500, { error: error.message || String(error) });
  }
}
