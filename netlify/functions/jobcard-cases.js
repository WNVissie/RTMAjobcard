import { json, clean, requireUser, listParam } from "../lib/common.js";

// GET /api/jobcard-cases?caseNumbers=CAS-1,CAS-2   (or ?caseNumber=CAS-1)
// The cases to print, in the same row shape the dashboard's Job Card code
// uses ("Case Number", "Point of Sale", "Asset Barcode", ...), so the card
// layout code is shared unchanged. Reads public.cases (owned by the RTMA
// dashboard) - read-only. Barcodes come from assets_live by asset name, as in
// the dashboard's cases-summary.js.

const SELECT = [
  "case_number", "case_type", "begin_date", "end_date", "service_closure_date",
  "sla_status", "status_reason", "motive", "technician_routed_to", "warehouse_workshop",
  "point_of_sale", "pos_local_code", "address", "asset_type", "mapped_asset",
  "asset_removed", "asset_delivered", "asset_repaired", "asset_condition", "created_on",
].join(",");

function useful(value) {
  const text = clean(value);
  if (!text || ["UNASSIGNED", "N/A", "NA", "NULL", "-"].includes(text.toUpperCase())) return "";
  return text;
}

// SLA Status as the dashboard shows it by default (measured SLA = Solved + Not
// Solved; see displaySlaStatus() in the dashboard's cases-summary.js).
const MEASURED_CANCEL_MOTIVES = new Set(["LACK OF MATERIAL", "SERVICE DENIED/REFUSED", "ASSET MISSING", "LOCATION UNAVAILABLE", "LOCATION CLOSED"]);
function displaySlaStatus(row) {
  const status = clean(row.status_reason).toUpperCase();
  const motive = clean(row.motive).toUpperCase();
  const cancelled = ["CANCELED", "CANCELLED"].includes(status);
  if (cancelled && motive === "OUT OF STOCK") return "Cancelled - Out of Stock";
  if (cancelled && !MEASURED_CANCEL_MOTIVES.has(motive)) return "Cancelled by Organisation";
  if (cancelled) return "Cancelled - Not in SLA";
  if (["ERROR", "REJECTED", "ON HOLD"].includes(status)) return "SLA Not Measured";
  return row.sla_status || "SLA Not Measured";
}

const assetNames = value => clean(value).match(/AST-[A-Z0-9-]+/gi) || [];
const caseAssetNames = row => [row.mapped_asset, row.asset_removed, row.asset_delivered, row.asset_repaired].flatMap(assetNames);

async function barcodeLookup(supabase, rows) {
  const names = [...new Set(rows.flatMap(caseAssetNames).map(n => n.toUpperCase()))];
  const lookup = new Map();
  for (let i = 0; i < names.length; i += 500) {
    const { data, error } = await supabase.from("assets_live").select("name,bar_code").in("name", names.slice(i, i + 500));
    if (error) return lookup;
    for (const a of data || []) {
      if (useful(a.name) && useful(a.bar_code)) lookup.set(useful(a.name).toUpperCase(), useful(a.bar_code));
    }
  }
  return lookup;
}

function barcodesFor(names, lookup) {
  return [...new Set(names.map(n => n.toUpperCase()))].map(n => lookup.get(n)).filter(Boolean).join(" / ");
}

function toRow(row, lookup) {
  return {
    "Case Number": row.case_number || "",
    "Case Type": row.case_type || "Unclassified",
    "Begin Date": row.begin_date || "",
    "End Date": row.end_date || "",
    "Service Closure Date": row.service_closure_date || "",
    "SLA Status": displaySlaStatus(row),
    "Status Reason": row.status_reason || "",
    Motive: row.motive || "",
    "Technician Routed To": row.technician_routed_to || "",
    "Warehouse / Workshop": row.warehouse_workshop || "Unassigned",
    "Point of Sale": row.point_of_sale || "",
    "POS Local Code": row.pos_local_code || "",
    Address: row.address || "",
    "Asset Type": row.asset_type || "Unclassified",
    "Mapped Asset": row.mapped_asset || "",
    "Asset Removed": row.asset_removed || "",
    "Asset Delivered": row.asset_delivered || "",
    "Asset Repaired": row.asset_repaired || "",
    "Asset Barcode": barcodesFor(caseAssetNames(row), lookup),
    "Asset Removed Barcode": barcodesFor(assetNames(row.asset_removed), lookup),
    "Asset Delivered Barcode": barcodesFor(assetNames(row.asset_delivered), lookup),
    "Asset Repaired Barcode": barcodesFor(assetNames(row.asset_repaired), lookup),
    "Asset Condition": row.asset_condition || "",
    "Created On": row.created_on || "",
  };
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  const auth = await requireUser(event);
  if (auth.response) return auth.response;
  try {
    const params = event.queryStringParameters || {};
    const wanted = listParam(params.caseNumbers || params.caseNumber);
    if (!wanted) return json(400, { error: "caseNumbers is required." });
    // Case numbers are stored upper-case; accept what people paste either way.
    const keys = [...new Set(wanted.flatMap(c => [c, c.toUpperCase()]))];
    const { data, error } = await auth.supabase.from("cases").select(SELECT).in("case_number", keys).limit(1000);
    if (error) throw error;
    const rows = data || [];
    const lookup = await barcodeLookup(auth.supabase, rows);
    const byKey = new Map(rows.map(r => [clean(r.case_number).toUpperCase(), toRow(r, lookup)]));
    // Keep the order the user gave; list what wasn't found.
    const cases = [];
    const missing = [];
    for (const c of wanted) {
      const hit = byKey.get(c.toUpperCase());
      if (hit) { if (!cases.includes(hit)) cases.push(hit); } else missing.push(c);
    }
    return json(200, { cases, missing });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || String(error) });
  }
}
