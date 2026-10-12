/**
 * Refresh the live X (Twitter) stats for @rafi_a11.
 *
 * X renders the profile numbers client side and ships no working public API for
 * anonymous read, so this uses a real Chromium via Playwright. Run by
 * .github/workflows/update-stats.yml and commits data/stats.json when the
 * numbers actually move.
 *
 * Auth: the X_SESSION_COOKER repository secret holds the full `Cookie:` header
 * value copied from a logged-in browser session. Without it the script still
 * tries anonymously, but X increasingly serves a login wall to datacenter IPs.
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HANDLE = process.env.X_HANDLE || "rafi_a11";
const STATS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../data/stats.json");

/** Turn "4,856" / "12.3K" / "1.2M" into a number. */
function parseCount(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || "").toLowerCase()];
  if (mult) n *= mult;
  return Math.round(n);
}

function pick(text, label) {
  // "4,856 Followers", "12.3K followers", "Posts 2,432"
  const before = new RegExp(`([\\d][\\d.,]*\\s*[KMB]?)\\s*${label}`, "i");
  const after = new RegExp(`${label}\\s*:?\\s*([\\d][\\d.,]*\\s*[KMB]?)`, "i");
  const m = text.match(before) || text.match(after);
  return m ? parseCount(m[1]) : null;
}

async function readCurrent() {
  try {
    return JSON.parse(await readFile(STATS_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const current = await readCurrent();
  const cookieHeader = (process.env.X_SESSION_COOKER || "").trim();

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      extraHTTPHeaders: cookieHeader ? { cookie: cookieHeader } : {}
    });

    const page = await context.newPage();
    await page.goto(`https://x.com/${HANDLE}`, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Give X time to hydrate the profile header.
    await page
      .waitForFunction(
        () => /followers/i.test(document.body.innerText || ""),
        { timeout: 30000 }
      )
      .catch(() => {});

    // X sometimes needs a nudge past the "something went wrong" shell.
    if (!/followers/i.test(await page.innerText("body"))) {
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForTimeout(6000);
    }

    const text = await page.innerText("body");
    const followers = pick(text, "followers");
    const following = pick(text, "following");
    const posts = pick(text, "posts");

    if (!followers) {
      console.error("FAIL: could not read the follower count.");
      console.error(text.slice(0, 400).replace(/\n+/g, " | "));
      if (!cookieHeader) {
        console.error("Hint: no X_SESSION_COOKER secret was provided.");
      }
      process.exit(1);
    }

    const next = {
      handle: HANDLE,
      followers,
      following: following ?? current?.following ?? 0,
      posts: posts ?? current?.posts ?? 0,
      updatedAt: new Date().toISOString(),
      source: cookieHeader ? "github-actions+cookie" : "github-actions-anonymous"
    };

    const changed =
      !current ||
      current.followers !== next.followers ||
      current.following !== next.following ||
      current.posts !== next.posts;

    if (!changed) {
      console.log(`No change. followers=${followers} following=${next.following} posts=${next.posts}`);
      process.exit(0);
    }

    await mkdir(dirname(STATS_PATH), { recursive: true });
    await writeFile(STATS_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");

    console.log(
      `UPDATED: followers ${current?.followers} -> ${next.followers}` +
        `, following ${current?.following} -> ${next.following}` +
        `, posts ${current?.posts} -> ${next.posts} (${next.source})`
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
