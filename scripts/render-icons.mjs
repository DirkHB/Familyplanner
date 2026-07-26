import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const svg = readFileSync("design/icon.svg", "utf8");
const sizes = [180, 192, 512];

const browser = await chromium.launch({ executablePath: EXEC });
for (const size of sizes) {
  const ctx = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const html = `<!doctype html><style>*{margin:0}html,body{width:${size}px;height:${size}px}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`;
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: `public/icons/icon-${size}.png`, omitBackground: false });
  await ctx.close();
  console.log("rendered", size);
}
await browser.close();
