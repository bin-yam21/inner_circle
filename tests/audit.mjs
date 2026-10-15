// Quality audit: visits every page at desktop/light and phone/dark with realistic data, and reports
// horizontal overflow, console errors, unlabeled form fields, unnamed buttons and images without alt.
// Run: npm run build && npm run preview (one terminal), then: node tests/audit.mjs [screenshotDir]
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.argv[2] ?? "";
const ROUTES = ["/", "/today", "/pretrade", "/journal", "/journal/new", "/daily", "/courses", "/courses/ict-mentorship-2016", "/courses/ict-mentorship-2016/ict-33",
  "/models", "/chart-drills", "/flashcards", "/quiz", "/replay", "/edge", "/progress", "/psychology", "/routine", "/explainers", "/explainers/ict-01-liquidity",
  "/reference", "/reference/concepts", "/playbook", "/tools", "/news", "/library", "/plan", "/tutor", "/glossary", "/settings"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = [];

for (const mode of [{ name: "desktop-light", viewport: { width: 1280, height: 900 }, colorScheme: "light" }, { name: "phone-dark", viewport: { width: 390, height: 844 }, colorScheme: "dark" }]) {
  const ctx = await browser.newContext({ viewport: mode.viewport, colorScheme: mode.colorScheme });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  let errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/sw\.js|CacheStorage|favicon/i.test(m.text())) errors.push("console: " + m.text()); });
  const go = async (path) => { await page.goto(`${BASE}/#${path}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(900); };

  // Seed realistic data through the app itself: trades (import), a daily log, practice candles.
  await go("/journal");
  await page.getByRole("button", { name: "Import from broker" }).click();
  const rows = ["Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Profit"];
  [9, 10, 14, 15, 16, 9, 10, 15, 11, 12].forEach((h, i) => { const win = i % 3 !== 0, d = String(5 + (i % 5)).padStart(2, "0");
    rows.push(`${500 + i},2026.10.${d} ${String(h).padStart(2, "0")}:15:00,${i % 2 ? "sell" : "buy"},0.1,${["eurusd", "gbpusd", "usdjpy"][i % 3]},1.10000,${i % 2 ? "1.10100" : "1.09900"},1.10200,2026.10.${d} 18:00:00,${win ? (i % 2 ? "1.09800" : "1.10200") : (i % 2 ? "1.10100" : "1.09900")},${win ? 20 : -10}`); });
  await page.getByLabel("Statement file (.csv)").setInputFiles({ name: "seed.csv", mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")) });
  await page.getByRole("button", { name: /Import \d+ trades/ }).click();
  await go("/replay");
  await page.getByRole("button", { name: "Generate practice data" }).first().click();
  await page.waitForTimeout(500);
  errors = [];

  for (const path of ROUTES) {
    errors = [];
    await go(path);
    const found = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflow = document.documentElement.scrollWidth > vw + 1;
      const offenders = [];
      if (overflow) for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 0 && !el.closest(".tw, .chartbox, .seg, .topnav")) offenders.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} (right ${Math.round(r.right)})`);
      }
      const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("aria-labelledby") || (el.labels && el.labels.length ? "label" : "") || "").trim();
      const unlabeled = [...document.querySelectorAll("main input:not([type=hidden]), main select, main textarea")]
        .filter((el) => !name(el) && el.offsetParent !== null && !el.closest("label")).map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute("type") ?? ""}] ${el.getAttribute("placeholder") ?? ""}`.trim());
      const unnamedButtons = [...document.querySelectorAll("main button")].filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("title")).length;
      const noAlt = [...document.querySelectorAll("main img")].filter((i) => !i.hasAttribute("alt")).length;
      return { overflow, offenders: offenders.slice(0, 4), unlabeled: [...new Set(unlabeled)].slice(0, 6), unnamedButtons, noAlt };
    });
    const issues = [];
    if (found.overflow) issues.push(`horizontal overflow: ${found.offenders.join("; ") || "(inside a scroll container?)"}`);
    if (found.unlabeled.length) issues.push(`unlabeled fields: ${found.unlabeled.join(" | ")}`);
    if (found.unnamedButtons) issues.push(`${found.unnamedButtons} button(s) with no name`);
    if (found.noAlt) issues.push(`${found.noAlt} image(s) without alt`);
    for (const e of errors) issues.push(e.slice(0, 160));
    if (issues.length) report.push({ mode: mode.name, path, issues });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/audit-${mode.name}${path.replace(/\//g, "_") || "_home"}.png`, fullPage: false });
  }
  await ctx.close();
}
await browser.close();
if (!report.length) console.log("No issues found on", ROUTES.length, "pages × 2 modes");
for (const r of report) { console.log(`\n[${r.mode}] ${r.path}`); for (const i of r.issues) console.log("  - " + i); }
