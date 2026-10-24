import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { fresh, build, hire, addFloor, extendLift } from "../src/sim";
import { techs } from "../src/config";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url =
    process.env.TEST_URL || "http://localhost:4173/corporation-inc-test/";
  await page.goto(url);
  await page.locator("#new").click();
  await page.locator('[data-speed="0"]').click();
  await page.locator('[data-tab="build"]').click();
  await page.mouse.click(466, 480);
  await page.mouse.click(754, 480);
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(100, 300, { steps: 10 });
    await page.mouse.up();
    await page.mouse.click(754, 480);
  }
  await page.locator('[data-action="close"]').click();
  await page.locator("#home-view").click(); // recenters the wider tower
  // Select first room via the build-free view after recentering.
  await page.mouse.click(160, 480);
  const hireButton = page.locator('[data-action="hireRoom:worker:1"]');
  const bounds = await hireButton.boundingBox();
  assert(bounds);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(await hireButton.boundingBox(), bounds);
    await hireButton.click();
  }
  assert(await hireButton.isDisabled());
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-tab="settings"]').click();
  await page.locator('[data-action="save"]').click();
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("corporate-climb-v1")!),
  );
  assert.equal(saved.rooms.length, 5);
  assert.equal(saved.staff.length, 4);
  await page.reload();
  await page.locator("#continue").click();
  await page.locator('[data-speed="0"]').click();
  await page.locator('[data-tab="staff"]').click();
  await page.locator('[data-action^="person:"]').first().click();
  assert(await page.locator(".needs").isVisible());
  await page.locator('[data-action^="move:"]').click();
  page.on("dialog", (d) => d.accept());
  await page
    .locator('[data-action^="transfer:"]')
    .filter({ hasText: "Desk" })
    .first()
    .click();
  await page.locator('[data-action="close"]').click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('[data-tab="build"]').click();
  const p = await page.locator("#panel").boundingBox();
  assert(p && p.y + p.height <= 390);
  await page.screenshot({ path: "/tmp/climb-v3-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS V3 browser: five independent plots, fixed-position four consecutive hires, capacity disable, needs profile, relocation, save/continue, mobile panel.",
  );
  // Visual acceptance fixture contains each new facility and travelling specialists.
  const g = fresh("V3 · People first");
  g.cash = 200000;
  g.tech = techs.map((t) => t.id);
  for (let s = 0; s < 5; s++)
    build(
      g,
      (["office", "office", "cafeteria", "restroom", "gym"] as const)[s],
      0,
      s,
    );
  addFloor(g);
  extendLift(g);
  for (let s = 0; s < 5; s++)
    build(
      g,
      (
        [
          "research",
          "maintenance",
          "management",
          "break",
          "accounting",
        ] as const
      )[s],
      1,
      s,
    );
  for (let i = 0; i < 8; i++) hire(g, "worker");
  for (let i = 0; i < 4; i++) hire(g, "researcher");
  for (const r of ["supervisor", "hr", "it", "janitor", "accountant"] as const)
    hire(g, r);
  g.time = 80;
  g.staff.forEach((p) => {
    p.toilet = 87;
    p.hunger = 30;
  });
  const view = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  view.on("pageerror", (e) => errors.push(e.message));
  await view.addInitScript(
    (raw) => localStorage.setItem("corporate-climb-v1", raw),
    JSON.stringify(g),
  );
  await view.goto(url);
  await view.locator("#continue").click();
  await view.locator('[data-speed="8"]').click();
  await view.waitForTimeout(5000);
  await view.locator('[data-speed="0"]').click();
  await view.locator("#home-view").click();
  await view.locator("#zoom-out").click();
  await view.screenshot({ path: "/tmp/climb-v3-tower.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS populated V3 scene: facility queues and new artwork run without browser errors.",
  );
} finally {
  await browser.close();
}
