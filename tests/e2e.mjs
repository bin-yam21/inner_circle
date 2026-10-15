// End-to-end smoke test: drives your installed Chrome against `npm run preview` (http://localhost:4173).
// Run: npm run build && npm run preview  (in one terminal), then: node tests/e2e.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR ?? "";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/sw\.js|CacheStorage|favicon/i.test(m.text())) errors.push("console: " + m.text()); });

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, String(e.message ?? e).split("\n")[0]]); }
}
const go = (path) => page.goto(`${BASE}/#${path}`, { waitUntil: "networkidle" });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false }); };

await step("dashboard renders", async () => { await go("/"); await page.locator(".hero h1").waitFor(); });

await step("mark a lesson complete + notes persist", async () => {
  await go("/courses/ict-mentorship-2016/ict-27");
  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await page.getByText("Completed").first().waitFor();
  await page.locator("#lnotes").fill("OB = last down candle before displacement");
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "networkidle" });
  if ((await page.locator("#lnotes").inputValue()) !== "OB = last down candle before displacement") throw new Error("notes not saved");
  await page.getByRole("button", { name: "Mark as not done" }).waitFor();
  await shot("lesson");
});

await step("quiz round records an answer", async () => {
  await go("/quiz?course=ict-mentorship-2016");
  await page.getByRole("button", { name: "Start a round" }).click();
  await page.locator(".qopt").first().click();
  await page.locator(".qexp").waitFor();
  await shot("quiz");
});

await step("log a trade with auto R from prices", async () => {
  await go("/journal/new");
  await page.getByLabel("Market").fill("eur/usd");
  await page.getByLabel("Entry", { exact: true }).fill("1.1430");
  await page.getByLabel("Stop", { exact: true }).fill("1.1414");
  await page.getByLabel("Exit", { exact: true }).fill("1.1478");
  await page.getByRole("button", { name: "Calm" }).first().click();
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/#\/journal$/);
  await page.getByRole("cell", { name: "EUR/USD" }).first().waitFor();
  await page.getByRole("cell", { name: "+3.00R" }).first().waitFor();
});

await step("log a losing trade → tilt guard halves risk", async () => {
  await go("/journal/new");
  await page.getByLabel("Market").fill("GBP/USD");
  await page.getByLabel(/Result \(R\)/).fill("-1");
  await page.getByRole("button", { name: "Moved stop" }).click();
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/#\/journal$/);
  await page.getByText("+2.00R").first().waitFor();
  await shot("journal");
  await go("/psychology");
  await page.getByRole("button", { name: "Tilt guard" }).click();
  await page.getByText("Reduce risk.").waitFor();
});

await step("daily check-in saves", async () => {
  await go("/psychology");
  await page.getByRole("button", { name: "Daily check-in" }).click();
  await page.getByLabel("Today's intention (one sentence)").fill("Only A+ setups in London");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page.getByRole("cell", { name: "Only A+ setups in London" }).waitFor();
  await shot("psychology");
});

await step("rules: seed starter rules and tick one", async () => {
  await go("/psychology");
  await page.getByRole("button", { name: "My rules" }).click();
  await page.getByRole("button", { name: "add ICT-based starter rules" }).click();
  await page.locator('ul.check input[type="checkbox"]').first().check();
});

await step("daily log saves", async () => {
  await go("/daily");
  await page.getByLabel("Markets studied").fill("EUR/USD");
  await page.getByRole("button", { name: "Save day" }).click();
  await page.getByRole("cell", { name: "EUR/USD" }).waitFor();
});

await step("library note with markdown", async () => {
  await go("/library");
  await page.getByRole("button", { name: "+ Add material" }).click();
  await page.getByLabel("Title").fill("My OB checklist");
  await page.getByLabel("Notes (Markdown supported)").fill("## Steps\n- find displacement");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "My OB checklist" }).waitFor();
  await page.getByRole("button", { name: "Read notes" }).click();
  await page.getByRole("heading", { name: "Steps" }).waitFor();
});

await step("practice plan task toggles", async () => {
  await go("/plan");
  await page.locator('ul.check input[type="checkbox"]').first().check();
  await page.getByText("1/27").first().waitFor();
});

await step("tools: IPDA + position size + seasonals", async () => {
  await go("/tools");
  await page.getByRole("button", { name: "IPDA calculator" }).click();
  await page.getByRole("cell", { name: "60 days" }).waitFor();
  await page.getByRole("button", { name: "Position size" }).click();
  await page.getByText("Risk $").waitFor();
  await page.getByRole("button", { name: "Seasonals" }).click();
  await page.getByText("This month").waitFor();
});

await step("reference diagrams drawn", async () => {
  await go("/reference/concepts");
  const n = await page.locator("svg#c1 rect").count();
  if (n < 10) throw new Error("diagram not drawn");
});

await step("backup export produces a file", async () => {
  await go("/settings");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download backup" }).click()]);
  if (!(await dl.suggestedFilename()).startsWith("trading-academy-backup")) throw new Error("bad filename");
});

await step("explainer video plays, captions, seek, completes", async () => {
  await go("/explainers");
  await page.locator(".xthumb").first().click();
  await page.getByRole("button", { name: "Play explainer" }).click();
  await page.waitForTimeout(3500);
  const time = await page.locator(".xp-time").innerText();
  if (time.startsWith("0:00")) throw new Error("clock did not advance: " + time);
  await page.locator(".xp-cc span").waitFor();
  await shot("explainer");
  const max = Number(await page.locator(".xp-scrub input").getAttribute("max"));
  await page.locator(".xp-scrub input").evaluate((el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); }, max - 1.5);
  await page.getByText("Explainer complete").waitFor({ timeout: 20000 });
  await go("/explainers");
  await page.getByText("Watched").first().waitFor();
});

await step("lesson page embeds its explainer", async () => {
  await go("/courses/ict-mentorship-2016/ict-33");
  await page.locator(".lesson-video .xp-player").waitFor();
  await go("/courses/ict-mentorship-2016");
  await page.getByText("▶ explainer").first().waitFor();
});

await step("daily log scores the bias", async () => {
  await go("/daily");
  await page.getByLabel("My bias (before the session)").selectOption("Bullish");
  await page.getByLabel("What price actually did (after close)").selectOption("Bullish");
  await page.getByLabel("Did price reach the level I expected?").selectOption("yes");
  await page.getByText("Bias was right").waitFor();
  await page.getByRole("button", { name: "Save day" }).click();
  await page.locator(".stat", { hasText: "Bias hit rate" }).getByText("100%").waitFor();
  await page.locator(".dots i.hit").first().waitFor();
});

await step("trade execution fields feed journal stats", async () => {
  await go("/journal/new");
  await page.getByLabel("Market").fill("USD/JPY");
  await page.getByLabel(/Result \(R\)/).fill("2");
  await page.getByLabel("Did I follow my plan?").selectOption("yes");
  await page.getByLabel("Max in my favour (MFE, R)").fill("3");
  await page.getByLabel("Max against me (MAE, R)").fill("0.4");
  await page.getByRole("button", { name: "Time of day & killzones" }).click();
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/#\/journal$/);
  await page.locator(".stat", { hasText: "Plan adherence" }).getByText("100%").waitFor();
  await page.locator(".stat", { hasText: "Left on the table" }).getByText("+1.00R").waitFor();
  await page.getByRole("button", { name: "Concept" }).click();
  await page.getByRole("cell", { name: "Time of day & killzones" }).waitFor();
});

await step("quiz offers due-for-review mode", async () => {
  await go("/quiz");
  await page.getByLabel("Questions").selectOption("due");
  await page.waitForURL(/due=1/);
});

await step("progress page joins it all", async () => {
  await go("/progress");
  await page.getByRole("heading", { name: "Go-live gates" }).waitFor();
  await page.getByRole("cell", { name: /Order blocks & breakers/ }).waitFor();
  await page.getByRole("cell", { name: /Time of day & killzones/ }).waitFor();
  await shot("progress");
});

await step("replay trainer: generate data, run and score a drill", async () => {
  await go("/replay");
  await page.getByRole("button", { name: "Generate practice data" }).first().click();
  await page.getByRole("button", { name: /Start a drill/ }).click();
  await page.locator(".chartbox.candles svg g.cd-up, .chartbox.candles svg g.cd-dn").first().waitFor();
  await page.getByRole("button", { name: "Next candle →" }).click();
  await page.getByText("Call your bias first").waitFor();
  await page.getByRole("button", { name: "Bullish", exact: true }).click();
  const label = await page.getByRole("button", { name: /Enter at market/ }).innerText();
  const close = Number(label.match(/\(([\d.]+)\)/)[1]);
  const dec = (String(close).split(".")[1] ?? "").length || 5;
  await page.getByLabel("Stop", { exact: true }).fill((close * 0.997).toFixed(dec));
  await page.getByLabel("Target", { exact: true }).fill((close * 1.006).toFixed(dec));
  await page.getByRole("button", { name: /Enter at market/ }).click();
  await page.locator(".lvl.entry").waitFor();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "+10" }).click();
  await page.getByLabel("Show ICT structures").check();
  await page.locator(".chartbox .overlay .zone, .chartbox .overlay .level").first().waitFor();
  await shot("replay");
  await page.getByRole("button", { name: "Finish & score" }).click();
  await page.getByRole("cell", { name: /Bullish/ }).waitFor();
  await page.locator(".stat", { hasText: "Drills" }).getByText("1", { exact: true }).waitFor();
});

await step("targeted replay drill: scenario briefing and results by type", async () => {
  await go("/replay");
  await page.getByLabel("Drill type").selectOption("fvg-bull");
  await page.getByText(/Drills start right after it forms/).waitFor();
  await page.getByRole("button", { name: "Start a drill" }).click();
  await page.locator(".drill-q").getByText("Fresh bullish FVG").waitFor();
  await page.getByRole("button", { name: "Bullish", exact: true }).click();
  await page.getByRole("button", { name: "+10" }).click();
  await page.getByRole("button", { name: "Finish & score" }).click();
  await page.getByRole("heading", { name: "Results by drill type" }).waitFor();
  await page.getByRole("cell", { name: "Fresh bullish FVG", exact: true }).waitFor();
});

await step("chart drills: answer, see feedback, stats update", async () => {
  await go("/chart-drills");
  await page.getByRole("button", { name: "Premium or discount", exact: true }).click();
  await page.getByRole("button", { name: "Premium", exact: true }).click();
  await page.locator(".alert").filter({ hasText: /range runs/ }).waitFor();
  await page.locator(".chartbox .level.eq").waitFor();
  await page.getByRole("button", { name: "Bullish FVG", exact: true }).click();
  const box = await page.locator(".chartbox svg").boundingBox();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.locator(".alert").filter({ hasText: /^(Right|Not quite)\./ }).waitFor();
  await page.locator(".chartbox .zone.target").first().waitFor();
  await page.locator(".chartbox .mark-pt.click").waitFor();
  await shot("chart-drills");
  await page.locator(".stat", { hasText: "This session" }).getByText(/\d \/ 2/).waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".alert").filter({ hasText: /^(Right|Not quite)\./ }).waitFor({ state: "detached" });
});

// AI features: api.anthropic.com is intercepted, so no key or money is needed. We check what
// the app sends (model, screenshots, JSON schema) and feed back a canned streamed answer.
const aiBodies = [];
const sse = (text) => [
  ["message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
  ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
  ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }],
  ["content_block_stop", { type: "content_block_stop", index: 0 }],
  ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20 } }],
  ["message_stop", { type: "message_stop" }],
].map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
await page.route("https://api.anthropic.com/**", async (route) => {
  const req = route.request();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const body = req.postDataJSON();
  aiBodies.push(body);
  const schema = body.output_config?.format?.schema;
  const answer = schema?.properties?.decision
    ? JSON.stringify({ decision: "partly", grade: "B", summary: "Mostly follows the OTE plan, but it's outside the killzone.", concerns: ["Stop is close to the swing low"],
        checks: [{ item: "Higher-timeframe bias agrees with the trade direction", status: "pass", note: "Bullish bias, long" }, { item: "It's inside the London or New York killzone", status: "fail", note: "Window closed" }, { item: "An order block or FVG sits inside the OTE zone", status: "unclear", note: "Not visible on the screenshot" }] })
    : schema
      ? JSON.stringify({ best: "Held the London long to target", worst: "Moved my stop on GBP/USD", mistakes: "Moved stop once", lessons: "Trust the stop", nextFocus: "Never touch the stop after entry" })
      : "Verdict — B: clean entry at the order block.\nNext time — wait for displacement.";
  await route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body: sse(answer) });
});
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

await step("AI trade review sends screenshots and saves the review", async () => {
  await go("/settings");
  await page.getByLabel(/API key/).fill("sk-ant-test-key");
  await page.getByRole("button", { name: "Save key" }).click();
  await go("/journal/new");
  await page.getByLabel("Market").fill("NZD/USD");
  await page.getByLabel(/Result \(R\)/).fill("1.5");
  await page.getByLabel("Checklist score (0–10)").fill("9");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: PNG });
  await page.locator(".thumb img").first().waitFor();
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/#\/journal$/);
  await page.getByRole("cell", { name: "NZD/USD" }).click();
  await page.getByRole("button", { name: "Get a review" }).click();
  await page.getByText("Verdict — B: clean entry").waitFor();
  await page.getByText(/^Reviewed /).waitFor();
  const b = aiBodies.at(-1);
  if (b.model !== "claude-opus-5-5") throw new Error("model " + b.model);
  const blocks = b.messages[0].content;
  if (!blocks.some((x) => x.type === "image" && x.source.media_type === "image/jpeg" && x.source.data.length > 20)) throw new Error("no screenshot sent");
  if (!blocks.at(-1).text.includes("Trade: Long NZD/USD")) throw new Error("trade summary missing");
  if (b.fallbacks !== "default") throw new Error("fallbacks not set");
});

await step("AI review of a replay drill sends the candles", async () => {
  await go("/replay");
  await page.getByRole("button", { name: "Review", exact: true }).first().click();
  await page.getByRole("button", { name: "Get a review" }).click();
  await page.getByText("Verdict — B: clean entry").waitFor();
  const text = aiBodies.at(-1).messages[0].content[0].text;
  if (!text.includes("Candles (index,time,open,high,low,close):") || !/\n-80,/.test(text)) throw new Error("candles missing from drill review");
  await page.getByRole("button", { name: "Review ✓" }).waitFor();
});

await step("AI review of the daily bias", async () => {
  await go("/daily");
  await page.getByRole("heading", { name: "AI review of my bias" }).waitFor();
  await page.getByRole("button", { name: "Get a review" }).click();
  await page.getByText("Verdict — B: clean entry").waitFor();
  if (!aiBodies.at(-1).messages[0].content[0].text.includes("Bias called before the session: Bullish")) throw new Error("bias call missing");
});

await step("AI weekly coach fills the review from structured output", async () => {
  await go("/psychology");
  await page.getByRole("button", { name: "Weekly review" }).click();
  await page.getByRole("button", { name: "Draft with AI coach" }).click();
  await page.getByText("Draft ready").waitFor();
  if ((await page.getByLabel("One focus for next week").inputValue()) !== "Never touch the stop after entry") throw new Error("draft not applied");
  const b = aiBodies.at(-1);
  if (b.output_config?.format?.type !== "json_schema" || b.output_config.format.schema.additionalProperties !== false) throw new Error("no JSON schema sent");
  if (!b.messages[0].content[0].text.includes("NZD/USD")) throw new Error("week data missing the trade");
});

await step("flashcards: study a chart card and a glossary card", async () => {
  await go("/flashcards");
  await page.getByRole("button", { name: "Start studying" }).click();
  await page.getByText("What's the bias, the draw on liquidity").waitFor();
  await page.getByRole("button", { name: /Show answer/ }).click();
  await page.getByRole("button", { name: /Knew it/ }).click();
  await page.getByText(/Card 2 of/).waitFor();
  await page.keyboard.press("Space");
  await page.keyboard.press("1");
  await page.getByText(/Card 3 of/).waitFor();
  await shot("flashcards");
});

await step("pre-session routine saves check-in and bias", async () => {
  await go("/routine");
  await page.getByLabel("Today's intention (one sentence)").fill("Only the NY open");
  await page.getByLabel("Markets").fill("EUR/USD");
  await page.getByLabel(/^Bias/).selectOption("Bearish");
  await page.getByLabel("Why").fill("Daily bearish breaker");
  await page.getByLabel("PD arrays and liquidity, with prices").fill("FVG 1.1450");
  await page.getByLabel(/I checked today's calendar/).check();
  await page.getByRole("button", { name: /I'm ready/ }).click();
  await page.getByText(/^Done today at/).waitFor();
  await shot("routine");
  await go("/daily");
  await page.waitForFunction(() => [...document.querySelectorAll("label.field")].some((l) => l.textContent.startsWith("My bias") && l.querySelector("select")?.value === "Bearish"), null, { timeout: 5000 })
    .catch(() => { throw new Error("bias not in daily log"); });
});

await step("playbook shows model trades and saves a definition", async () => {
  await go("/playbook");
  await page.getByRole("button", { name: /Order block/ }).click();
  await page.locator(".thumb.model").first().waitFor();
  await page.getByLabel(/My definition/).fill("Last down candle before displacement");
  await page.getByRole("button", { name: "Save definition" }).click();
  await page.getByText("Playbook saved").waitFor();
});

await step("strategy models page", async () => {
  await go("/models");
  await page.getByRole("heading", { name: "Optimal trade entry (OTE)" }).waitFor();
  await page.getByRole("heading", { name: "Steps" }).first().waitFor();
  await page.getByRole("button", { name: /Silver Bullet/ }).click();
  await page.getByText("ICT's later public teaching").first().waitFor();
  await page.getByRole("link", { name: /Practise in replay/ }).first().click();
  await page.waitForURL(/replay\?drill=/);
  if ((await page.getByLabel("Drill type").inputValue()) === "random") throw new Error("drill preset ignored");
});

await step("pre-trade check: AI verdict, then log the trade from it", async () => {
  await go("/pretrade?model=ote");
  await page.getByLabel("Market").fill("gbp/jpy");
  await page.getByLabel("Entry", { exact: true }).fill("190.50");
  await page.getByLabel("Stop", { exact: true }).fill("190.20");
  await page.getByLabel("Target", { exact: true }).fill("191.40");
  await page.getByLabel(/Why: bias/).fill("OB in the OTE zone");
  await page.getByLabel("Higher-timeframe bias agrees with the trade direction").check();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: PNG });
  await page.getByText("Reward:risk to target: 3:1").waitFor();
  await page.getByRole("button", { name: "Check my plan" }).click();
  await page.getByRole("heading", { name: "Partly meets your plan" }).waitFor();
  await page.locator(".checks li.fail").waitFor();
  const b = aiBodies.at(-1);
  const blocks = b.messages[0].content;
  if (!blocks.some((x) => x.type === "image")) throw new Error("screenshot not sent");
  const text = blocks.at(-1).text;
  if (!text.includes("MODEL: Optimal trade entry (OTE)") || !text.includes("- [x] Higher-timeframe bias agrees") || !text.includes("Reward:risk to target: 3:1")) throw new Error("plan text incomplete");
  await shot("pretrade");
  await page.getByRole("button", { name: "I took it: log the trade" }).click();
  await page.waitForURL(/journal\/new\?precheck=/);
  if ((await page.getByLabel("Market").inputValue()) !== "GBP/JPY") throw new Error("not prefilled");
  await page.getByLabel(/Result \(R\)/).fill("3");
  await page.getByRole("button", { name: "Save trade" }).click();
  await page.waitForURL(/#\/journal$/);
  await go("/pretrade");
  await page.getByRole("link", { name: "taken" }).waitFor();
  await go("/edge");
  await page.getByRole("heading", { name: "By pre-trade check" }).waitFor();
});

await step("broker CSV import with preview", async () => {
  await go("/journal");
  await page.getByRole("button", { name: "Import from broker" }).click();
  const csv = "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit\n"
    + "9001,2026.10.06 08:15:00,buy,0.50,audcad,0.92000,0.91800,0.92600,2026.10.06 11:00:00,0.92600,0,0,0,300.00\n"
    + "9002,2026.10.07 09:00:00,sell,0.50,audcad,0.93000,0.93200,0.92400,2026.10.07 10:00:00,0.93200,0,0,0,-100.00\n";
  await page.getByLabel("Statement file (.csv)").setInputFiles({ name: "history.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByText(/Found\s+2\s+trades/).waitFor();
  await page.getByRole("button", { name: "Import 2 trades" }).click();
  await page.getByRole("cell", { name: "AUD/CAD" }).first().waitFor();
  await page.getByRole("button", { name: "Import from broker" }).click();
  await page.getByLabel("Statement file (.csv)").setInputFiles({ name: "history.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByText(/2 already in your journal/).waitFor();
  // 08:15 on a New York + 7h server is 01:15 in New York: Asian session, previous-day rollover not involved.
  // 09:00 server → 02:00 New York → London open.
  const journal = page.locator("table").filter({ hasText: "Checklist" });
  for (const [when, session] of [["2026-10-06 01:15", "Asia"], ["2026-10-07 02:00", "London open"]]) {
    const row = journal.getByRole("row", { name: new RegExp(`${when}.*AUD/CAD`) });
    await row.waitFor();
    if (!(await row.innerText()).includes(session)) throw new Error(`${when}: expected ${session}, got ${await row.innerText()}`);
  }
});

await step("edge finder: heatmap, hour bars, tooltips, tables", async () => {
  await go("/edge");
  await page.getByRole("heading", { name: "Weekday × session" }).waitFor();
  const cell = page.locator(".heat-c:not(.empty)").first();
  await cell.hover();
  await page.locator(".edge-tip").filter({ hasText: /per trade \((.*95%|too few trades to judge)\)/ }).waitFor();
  if (!(await page.locator(".edge-chart .ebar").count())) throw new Error("no bars drawn");
  await page.getByRole("heading", { name: "With or against my daily bias" }).waitFor();
  await page.locator("summary", { hasText: "Table view" }).first().click();
  await page.getByRole("columnheader", { name: "Day" }).waitFor();
  await page.waitForTimeout(500);
  await shot("edge");
});

await step("dashboard reflects activity", async () => {
  await go("/");
  await page.getByText("1 of 65 lessons").waitFor();
  await page.getByRole("heading", { name: "Your coach" }).waitFor();
  await page.getByRole("heading", { name: /Go-live gates · \d\/7/ }).waitFor();
  await page.locator(".study h3").filter({ hasText: "Today's study plan" }).waitFor();
  if ((await page.locator(".study .tasks li").count()) !== 5) throw new Error("study plan should have 5 tasks");
  const plan = page.locator(".today");
  await plan.getByText("Bearish").first().waitFor();
  await plan.getByText("Only the NY open").waitFor();
  await page.waitForTimeout(800);
  await shot("dashboard");
  await go("/progress");
  const trends = page.locator("table").filter({ hasText: "Study days" });
  await trends.locator("tbody tr").first().waitFor();
  await trends.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot("trends");
});

await browser.close();
for (const r of results) console.log(r.join(" | "));
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "No page errors");
process.exit(results.some((r) => r[0] === "FAIL") || errors.length ? 1 : 0);
