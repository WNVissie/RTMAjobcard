import fs from "node:fs";

// Netlify build check: the files the site needs are present, and the page was
// generated (no template placeholders left). public/index.html is built by
// `npm run sync` from the RTMA dashboard and committed.
const required = [
  "public/index.html",
  "public/coolerco-logo.png",
  "public/user-guide.html",
  "netlify/lib/common.js",
  "netlify/functions/jobcard-cases.js",
  "netlify/functions/jobcard-repairs.js",
  "netlify/functions/jobcard-asset-history.js",
  "netlify.toml",
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing required build file: ${file}`);
}
const page = fs.readFileSync("public/index.html", "utf8");
if (/\{\{[A-Z_]+\}\}/.test(page)) throw new Error("public/index.html still has template placeholders - run npm run sync");
if (!page.includes("/api/jobcard-cases")) throw new Error("public/index.html does not call /api/jobcard-cases - run npm run sync");
console.log("Build check passed.");
