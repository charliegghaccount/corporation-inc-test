import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { fresh, build, hire, deskStand, buttonPoint } from "../src/sim";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url =
    process.env.TEST_URL || "http://localhost:5173/corporation-inc-test/";
  if (!process.env.INSPECTION_ONLY) {
    await page.goto(url);
    await page.locator("#new").click();
    assert.equal(await page.locator("#cash").textContent(), "$30,000");
    await page.locator('[data-tab="build"]').click();
    await page.mouse.click(466, 480);
    await page.mouse.click(754, 480);
    await page.locator('[data-action="choose:maintenance"]').click();
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(100, 300, { steps: 10 });
    await page.mouse.up();
    await page.mouse.click(754, 480);
    await page.locator('[data-action="close"]').click();
    await page.locator('[data-tab="staff"]').click();
    for (let i = 0; i < 8; i++)
      await page.locator('[data-action="hire:worker"]').click();
    await page.locator('[data-action="hire:it"]').click();
    await page.locator('[data-action="hire:janitor"]').click();
    await page.locator('[data-action="close"]').click();
    await page.locator('[data-speed="16"]').click();
    console.log(
      "V2 acceptance: eight workers and specialists hired through UI; fast-forwarding five days.",
    );
    await page.waitForTimeout(18000);
    await page.locator('[data-speed="0"]').click();
    await page.locator('[data-tab="settings"]').click();
    await page.locator('[data-action="save"]').click();
    let first = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("corporate-climb-v1")!),
    );
    assert.equal(first.staff.length, 10);
    assert(first.presses > 100);
    assert(first.rooms.some((r: any) => r.waste.some((v: number) => v > 0)));
    await page.locator('[data-action="close"]').click();
    await page.locator("#home-view").click();
    await page.screenshot({ path: "/tmp/climb-v2-active.png" });
    await page.locator('[data-speed="16"]').click();
    await page.waitForTimeout(58000);
    await page.locator('[data-speed="0"]').click();
    await page.locator('[data-tab="settings"]').click();
    await page.locator('[data-action="save"]').click();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("corporate-climb-v1")!),
    );
    assert(saved.day >= 5);
    assert(saved.history.slice(-3).every((r: any) => r.operatingNet > 0));
    assert(saved.rooms.some((r: any) => r.waste.some((v: number) => v < 10)));
    assert(saved.report.salaries >= 0);
    await page.reload();
    await page.evaluate(() => {
      (document.querySelector("#continue") as HTMLButtonElement).click();
      (document.querySelector('[data-speed="0"]') as HTMLButtonElement).click();
    });
    await page.locator('[data-tab="settings"]').click();
    await page.locator('[data-action="save"]').click();
    const resumed = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("corporate-climb-v1")!),
    );
    assert.deepEqual(resumed, saved);
    await page.locator('[data-action="close"]').click();
    await page.setViewportSize({ width: 844, height: 390 });
    for (const speed of [1, 8, 16, 0]) {
      await page.locator(`[data-speed="${speed}"]`).click();
      const b = await page.locator(`[data-speed="${speed}"]`).boundingBox();
      assert(b && b.x >= 0 && b.x + b.width < 844);
    }
    await page.locator('[data-tab="finances"]').click();
    assert(
      (await page.locator("#panel").textContent())!.includes(
        "Other operating expenses",
      ),
    );
    await page.screenshot({ path: "/tmp/climb-v2-mobile.png" });
    assert.deepEqual(errors, []);
    console.log(
      `PASS V2 UI: ${saved.day} days, ${saved.presses} contacts, profitable days, waste, save equality, landscape controls and finance panel; no runtime errors.`,
    );
  } else
    console.log(
      "Long session skipped; running contact and migration checks only.",
    );
  // A fixed contact pose checks the actual rendered pixel where the shared button coordinate is defined.
  const g = fresh("Contact check");
  build(g, "office", 0, 0);
  hire(g, "worker");
  g.time = 80;
  const p = g.staff[0],
    r = g.rooms[0];
  p.x = deskStand(r, p.desk);
  p.state = "Pushing buttons";
  p.cycle = 0.65;
  p.presses = 1;
  g.presses = 1;
  r.waste[0] = 0.5;
  const check = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await check.addInitScript(
    (value) => localStorage.setItem("corporate-climb-v1", value),
    JSON.stringify(g),
  );
  await check.goto(url);
  await check.evaluate(() => {
    (document.querySelector("#continue") as HTMLButtonElement).click();
    (document.querySelector('[data-speed="0"]') as HTMLButtonElement).click();
  });
  await check.waitForTimeout(150);
  const contact = buttonPoint(r, 0);
  const pixel = await check.evaluate(
    ({ x, y }) =>
      Array.from(
        (document.querySelector("#world") as HTMLCanvasElement)
          .getContext("2d")!
          .getImageData(
            Math.round(720 + (x - 690) * 1.2),
            Math.round(621 + (y - 800) * 1.2),
            1,
            1,
          ).data,
      ),
    contact,
  );
  assert.deepEqual(pixel.slice(0, 3), [243, 197, 156]);
  await check.screenshot({ path: "/tmp/climb-v2-contact.png" });
  console.log(
    "PASS exact contact: hand skin pixel covers shared depressed-button coordinate.",
  );
  const legacy: any = JSON.parse(JSON.stringify(g));
  legacy.version = 1;
  legacy.cash = 123;
  const raw = JSON.stringify(legacy),
    migration = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
  await migration.addInitScript(
    (value) => localStorage.setItem("corporate-climb-v1", value),
    raw,
  );
  await migration.goto(url);
  await migration.evaluate(() => {
    (document.querySelector("#continue") as HTMLButtonElement).click();
    (document.querySelector('[data-speed="0"]') as HTMLButtonElement).click();
  });
  assert.equal(
    await migration.evaluate(() =>
      localStorage.getItem("corporate-climb-v1.v1-backup"),
    ),
    raw,
  );
  assert.equal(await migration.locator("#cash").textContent(), "$123");
  await migration.locator('[data-tab="settings"]').click();
  await migration.locator('[data-action="reset"]').click();
  assert(await migration.locator("#title").isVisible());
  assert.equal(
    await migration.evaluate(
      () => JSON.parse(localStorage.getItem("corporate-climb-v1")!).cash,
    ),
    123,
  );
  migration.on("dialog", (d) => d.accept());
  await migration.locator("#new").click();
  assert.equal(await migration.locator("#cash").textContent(), "$30,000");
  assert.equal(
    await migration.evaluate(
      () =>
        JSON.parse(localStorage.getItem("corporate-climb-v1.previous")!).cash,
    ),
    123,
  );
  console.log(
    "PASS migration UI: original V1 backup retained, no cash grant on continue, explicit new V2 start preserves previous company.",
  );
} finally {
  await browser.close();
}
