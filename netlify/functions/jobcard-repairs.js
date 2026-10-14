import { json, requireUser, listParam } from "../lib/common.js";

// GET /api/jobcard-repairs?caseNumbers=CAS-1,CAS-2
// The repair lines (public.case_repairs, uploaded through the RTMA dashboard)
// of exactly these cases - "Repairs Performed (This Case)" on the job card.
// Read-only.

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  const auth = await requireUser(event);
  if (auth.response) return auth.response;
  try {
    const wanted = listParam((event.queryStringParameters || {}).caseNumbers);
    if (!wanted) return json(400, { error: "caseNumbers is required." });
    const keys = [...new Set(wanted.flatMap(c => [c, c.toUpperCase()]))];
    const { data, error } = await auth.supabase
      .from("case_repairs")
      .select("repair_id,case_number,asset_number,repair_code,repair_name,technician,created_on,case_status_reason")
      .in("case_number", keys)
      .order("created_on", { ascending: true })
      .limit(1000);
    if (error) throw error;
    return json(200, { rows: data || [] });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || String(error) });
  }
}
