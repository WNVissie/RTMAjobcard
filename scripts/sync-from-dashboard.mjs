// Builds public/index.html from scripts/page.template.html plus the Job Card
// code copied out of the RTMA dashboard (rtma-cases-dashboard-netlify,
// public/index.html), so the job card layout and rules stay identical.
//
//   node scripts/sync-from-dashboard.mjs [path-to-dashboard-index.html]
//
// Default dashboard path: ../rtma-cases-dashboard-netlify/public/index.html
// Run it after a Job Card change in the dashboard, check the page, commit.
// Fails loudly if a marker it relies on has moved.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dashPath = process.argv[2] || path.resolve(root, "../rtma-cases-dashboard-netlify/public/index.html");
const src = fs.readFileSync(dashPath, "utf8").replace(/\r\n/g, "\n");

function slice(startMarker, endMarker, { includeEnd = false, label }) {
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker not found: ${endMarker}`);
  return src.slice(start, includeEnd ? end + endMarker.length : end);
}
function must(text, find, label) {
  if (!text.includes(find)) throw new Error(`${label}: expected to find ${find}`);
}

// 1. Job Card styles: from the section comment up to the print rules.
const jcCss = slice("    /* ---- Job Card Generator ---- */", "    @page { size: A4 landscape", { label: "CSS" });

// 2. Job Card form + preview markup (the dashboard tab panel).
let jcHtml = slice('    <div class="tab-panel" id="jobCardTab">', "  </main>", { label: "HTML" }).trimEnd();

// 3. Job Card script (search, history, preview, signature, photos, print).
let jcJs = slice("    const jcState = ", "    // =================== END JOB CARD ===================", { label: "JC JS" });

// 4. Bulk job card / logistics note printing.
let bulkJs = slice("    function displayServiceDate(row) {", "    async function exportExceptionRecords() {", { label: "Bulk JS" });

// API paths -> this app's own (login-checked) functions.
for (const [from, to] of [
  ["/api/cases-summary?caseNumber=", "/api/jobcard-cases?caseNumber="],
  ["/api/repairs-summary?caseNumbers=", "/api/jobcard-repairs?caseNumbers="],
  ["/api/asset-history?asset_no=", "/api/jobcard-asset-history?asset_no="],
]) {
  must(jcJs + bulkJs, from, "API path");
  jcJs = jcJs.split(from).join(to);
  bulkJs = bulkJs.split(from).join(to);
}
if (/\/api\/(?!jobcard-)/.test(jcJs + bulkJs)) throw new Error("Copied code calls a dashboard API this app does not have: " + (jcJs + bulkJs).match(/\/api\/(?!jobcard-)[a-z-]+/)[0]);

// Bulk printing takes its cases from the Bulk tab's selection.
must(bulkJs, "const rows = selectedCaseRows();", "Bulk JS");
// Every selection lookup (print and ZIP) uses the Bulk tab's selection here.
bulkJs = bulkJs.split("selectedCaseRows()").join("bulkSelectedRows()");
bulkJs = bulkJs.split("Generated via RTMA Dashboard").join("Generated via RTMA Job Cards");
jcJs = jcJs.split("Generated via RTMA Dashboard").join("Generated via RTMA Job Cards");

// Public anon key, as embedded in the dashboard (safe for browsers).
const anon = (src.match(/const SUPABASE_ANON_KEY = '([^']+)'/) || [])[1];
if (!anon) throw new Error("SUPABASE_ANON_KEY not found in the dashboard page");

let page = fs.readFileSync(path.join(here, "page.template.html"), "utf8");
page = page
  .replace("{{JC_CSS}}", () => jcCss.trimEnd())
  .replace("{{JC_HTML}}", () => jcHtml)
  .replace("{{JC_JS}}", () => jcJs.trimEnd())
  .replace("{{BULK_JS}}", () => bulkJs.trimEnd())
  .replace("{{ANON_KEY}}", () => anon);
if (/\{\{[A-Z_]+\}\}/.test(page)) throw new Error("Unfilled placeholder in page.template.html");

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public/index.html"), page);
console.log(`public/index.html written (${page.length.toLocaleString()} chars) from ${dashPath}`);
