import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    process.env.TEST_URL || "http://localhost:5173/corporation-inc-test/",
  );
  await page.locator("#company-name").fill("Browser Test Co");
  await page.locator("#new").click();
  await page.locator('[data-tab="build"]').click();
  await page.mouse.click(466, 480);
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-tab="staff"]').click();
  await page.locator('[data-action="hire:worker"]').click();
  await page.locator('[data-action="hire:worker"]').click();
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-speed="4"]').click();
  await page.waitForTimeout(6500);
  await page.locator('[data-tab="settings"]').click();
  await page.locator('[data-action="save"]').click();
  const save = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("corporate-climb-v1")),
  );
  assert.equal(save.rooms.length, 1);
  assert.equal(save.staff.length, 2);
  assert(save.presses > 0);
  await page.reload();
  await page.locator("#continue").click();
  assert.equal(await page.locator("#company").textContent(), "Browser Test Co");
  assert((await page.locator("#people").textContent()).startsWith("2"));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('[data-tab="research"]').click();
  const panel = await page.locator("#panel").boundingBox();
  assert(panel.x >= 0 && panel.y >= 0 && panel.y + panel.height <= 390);
  const canvas = page.locator("#world");
  const before = await canvas.screenshot();
  await page.mouse.move(370, 220);
  await page.mouse.down();
  await page.mouse.move(310, 200, { steps: 8 });
  await page.mouse.up();
  const after = await canvas.screenshot();
  assert(!before.equals(after));
  await page.locator('[data-action="close"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator("#rotate").isVisible());
  // Exercise real Chromium touch events rather than synthetic captured pointers.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 110, y: 300, id: 1 },
      { x: 230, y: 300, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 80, y: 300, id: 1 },
      { x: 280, y: 300, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.reload(); // Pagehide saves the active game; the next title screen has no active game.
  await page.evaluate(() =>
    localStorage.setItem("corporate-climb-v1", '{"version":1}'),
  );
  await page.reload();
  assert(await page.locator("#continue").isDisabled());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: construction, hiring, real presses, save/continue, landscape panels, pan, touch handling, portrait suggestion, invalid save recovery, no runtime errors.",
  );
} finally {
  await browser.close();
}
