import { test } from "node:test";
import assert from "node:assert/strict";
import { economy } from "./config";
import {
  fresh,
  build,
  hire,
  addFloor,
  extendLift,
  tick,
  restore,
  working,
  deskStand,
  buttonPoint,
  operatingProfit,
  type Game,
} from "./sim";
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / economy.step); i++)
    tick(g, economy.step);
};
function setup(workers: number, it: number, janitors: number) {
  const g = fresh();
  let offices = Math.ceil(workers / 4);
  for (let i = 0; i < offices; i++) {
    if (i % 3 === 0 && i > 0) {
      assert(addFloor(g));
      assert(extendLift(g));
    }
    assert(build(g, "office", Math.floor(i / 3), i % 3));
  }
  for (let i = 0; i < workers; i++) assert(hire(g, "worker"));
  if (it + janitors) {
    let floor = 0,
      slot = -1;
    for (let f = 0; f < g.floors; f++) {
      const empty = [0, 1, 2].find(
        (s) => !g.rooms.some((r) => r.floor === f && r.slot === s),
      );
      if (empty !== undefined) {
        floor = f;
        slot = empty;
        break;
      }
    }
    if (slot < 0) {
      assert(addFloor(g));
      assert(extendLift(g));
      floor = g.floors - 1;
      slot = 0;
    }
    assert(build(g, "maintenance", floor, slot));
    for (let i = 0; i < it; i++) assert(hire(g, "it"));
    for (let i = 0; i < janitors; i++) assert(hire(g, "janitor"));
  }
  return g;
}
for (const [w, it, j] of [
  [4, 0, 0],
  [8, 1, 1],
  [8, 2, 2],
  [16, 2, 2],
])
  test(`20-day economy: ${w} workers, ${it} IT, ${j} janitors`, () => {
    const g = setup(w === 16 ? 12 : w, it, j);
    if (w === 16) {
      run(g, 240);
      assert(build(g, "office", 1, 1));
      for (let i = 0; i < 4; i++) assert(hire(g, "worker"));
    }
    const afterConstruction = g.cash;
    run(g, 240 * (w === 16 ? 19 : 20));
    const days = g.history.filter((r) => r.day > 1);
    const average =
      days.reduce((n, r) => n + operatingProfit(r), 0) / days.length;
    assert(average > 0);
    assert(g.cash > afterConstruction);
    assert(days.filter((r) => operatingProfit(r) > 0).length >= 15);
    assert(
      Math.abs(
        g.cash -
          (economy.startingCash +
            g.history.reduce((n, r) => n + r.net, 0) +
            g.report.net),
      ) < 0.01,
    );
    if (j)
      assert(
        g.rooms
          .filter((r) => r.type === "office")
          .every((r) => r.waste.every((v) => v < economy.binCapacity * 2)),
      );
    console.log(
      `ECONOMY ${w}/${it}/${j}: mean daily operating $${average.toFixed(0)}, cash $${g.cash.toFixed(0)}, presses ${g.presses}`,
    );
  });
test("sustainable expansion reaches five floors through earned research and cash", () => {
  const g = setup(8, 1, 1);
  let lab = false;
  for (let day = 0; day < 20; day++) {
    run(g, 240);
    if (g.floors < 2 && g.cash > 12000) {
      addFloor(g);
      extendLift(g);
    }
    if (!lab && g.floors >= 2 && g.cash > 9000) {
      assert(build(g, "research", 1, 0));
      assert(hire(g, "researcher"));
      lab = true;
    }
    if (g.points >= 65 && !g.tech.includes("height")) {
      g.points -= 65;
      g.tech.push("height");
    }
    if (
      g.floors < 5 &&
      g.cash >
        economy.floorCost +
          g.floors * economy.floorStep +
          economy.liftCost +
          3000 &&
      g.tech.includes("height")
    ) {
      assert(addFloor(g));
      assert(extendLift(g));
    }
  }
  assert.equal(g.floors, 5);
  assert(g.cash > 0);
  assert(g.history.slice(-5).every((r) => operatingProfit(r) > 0));
  console.log("EXPANSION 5 floors cash $" + g.cash.toFixed(0));
});
test("excess specialist staffing is not free: unproductive company loses operating cash", () => {
  const g = fresh();
  build(g, "maintenance", 0, 0);
  for (let i = 0; i < 4; i++) hire(g, "it");
  const cash = g.cash;
  run(g, 240 * 3);
  assert(g.cash < cash);
  assert(g.history.at(-1)!.operatingNet < 0);
});
test("1/2/4/8/16 speed batches are exactly equivalent over 20 days", () => {
  const initial = setup(8, 1, 1);
  let baseline: Game | undefined;
  for (const speed of [1, 2, 4, 8, 16]) {
    const g = restore(JSON.stringify(initial))!;
    const steps = Math.round((240 * 20) / economy.step);
    for (let i = 0; i < steps; i += speed)
      for (let j = 0; j < Math.min(speed, steps - i); j++)
        tick(g, economy.step);
    if (baseline) assert.deepEqual(g, baseline);
    else baseline = g;
  }
});
test("contact is the only event that creates income and paper; no phantom presses", () => {
  const g = setup(4, 0, 0);
  g.time = 80;
  const p = g.staff[0],
    r = g.rooms[0];
  p.x = deskStand(r, p.desk);
  p.floor = 0;
  p.cycle = economy.contactPhase - 0.01;
  const before = g.lifetime;
  tick(g, economy.step);
  assert.equal(p.presses, 1);
  assert.equal(g.lifetime - before, 12);
  assert.equal(r.waste[p.desk], economy.paperPerPress);
  assert.equal(buttonPoint(r, p.desk).x - p.x, 27);
  const n = p.presses;
  r.broken = [p.desk];
  run(g, 5);
  assert.equal(p.presses, n);
  const paper = r.waste[p.desk];
  g.time = 190;
  run(g, 10);
  assert.equal(p.presses, n);
  assert.equal(r.waste[p.desk], paper);
});
test("exclusive specialist jobs, specific workstation repair, measurable progress, save/load and night-only waste removal", () => {
  const g = setup(8, 2, 2);
  g.time = 80;
  g.rooms[0].broken = [0, 1];
  g.rooms[1].broken = [2, 3];
  g.rooms[0].waste = [50, 50, 50, 50];
  run(g, 2);
  const tasks = g.staff
    .filter((p) => p.role === "it")
    .map((p) => JSON.stringify([p.task?.room, p.task?.desk]));
  assert.equal(new Set(tasks).size, 2);
  let progressed = false;
  for (let i = 0; i < 1500; i++) {
    tick(g, economy.step);
    if (g.staff.some((p) => p.task?.kind === "repair" && p.task.progress > 1)) {
      progressed = true;
      break;
    }
  }
  assert(progressed);
  const resumed = restore(JSON.stringify(g))!;
  assert.deepEqual(resumed, g);
  run(g, 30);
  run(resumed, 30);
  assert.deepEqual(resumed, g);
  assert(g.rooms.slice(0, 2).reduce((n, r) => n + r.broken.length, 0) < 4);
  const paper = g.rooms[0].waste.reduce((n, v) => n + v, 0);
  g.time = 185;
  run(g, 3);
  const cleaning = g.staff
    .filter((p) => p.role === "janitor")
    .map((p) => JSON.stringify([p.task?.room, p.task?.desk]));
  assert.equal(new Set(cleaning).size, 2);
  for (
    let i = 0;
    i < 1000 &&
    !g.staff.some((p) => p.task?.kind === "clean" && p.task.progress > 1);
    i++
  )
    tick(g, economy.step);
  assert(g.staff.some((p) => p.task?.kind === "clean" && p.task.progress > 1));
  const cleaningSave = restore(JSON.stringify(g))!;
  assert.deepEqual(cleaningSave, g);
  run(g, 50);
  run(cleaningSave, 50);
  assert.deepEqual(cleaningSave, g);
  assert(g.rooms[0].waste.reduce((n, v) => n + v, 0) < paper);
});
test("V1 migration preserves cash, faults, staff and progression without a cash grant", () => {
  const g: any = setup(4, 0, 0);
  g.version = 1;
  delete g.lastAlert;
  g.cash = 83;
  g.rooms[0].broken = [2];
  g.rooms[0].dirt = 50;
  for (const r of g.rooms) {
    delete r.waste;
    delete r.todayIncome;
  }
  for (const p of g.staff) {
    delete p.desk;
    delete p.cycle;
    delete p.direction;
    delete p.task;
  }
  const migrated = restore(JSON.stringify(g))!;
  assert(migrated);
  assert.equal(migrated.cash, 83);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.rooms[0].broken, [2]);
  assert.equal(migrated.staff.length, 4);
  assert(migrated.rooms[0].waste[0] > 0);
  run(migrated, 20);
});
test("24 employees on five floors remain finite and productive, bounded events and no duplicate tasks", () => {
  const g = fresh();
  g.cash = 200000;
  g.tech = ["height", "lift"];
  for (let f = 0; f < 5; f++) {
    if (f) {
      addFloor(g);
      extendLift(g);
    }
    build(g, f === 4 ? "maintenance" : "office", f, 0);
    if (f < 2) build(g, "office", f, 1);
  }
  for (let i = 0; i < 24; i++) assert(hire(g, "worker"));
  hire(g, "it");
  hire(g, "janitor");
  run(g, 240 * 10);
  assert(
    g.staff.every((p) => Number.isFinite(p.x) && Number.isFinite(p.floor)),
  );
  assert(
    g.staff.filter((p) => p.role === "worker").every((p) => p.presses > 40),
  );
  assert(g.events.length <= 40);
  assert(g.history.length <= 20);
});
