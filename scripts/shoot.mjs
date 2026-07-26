import { chromium } from "playwright-core";

const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3123";
const OUT = process.env.OUT || "/tmp/shots";

const browser = await chromium.launch({ executablePath: EXEC });
const shots = [
  { url: "/", theme: "light", name: "home-light" },
  { url: "/style", theme: "light", name: "style-light" },
  { url: "/style", theme: "dark", name: "style-dark" },
];

for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: s.theme,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + s.url, { waitUntil: "networkidle" });
  if (s.theme === "dark") {
    // /style setzt data-theme über den Toggle; hier direkt setzen für den Shot.
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: s.url === "/style" });
  await ctx.close();
  console.log("shot:", s.name);
}
await browser.close();
