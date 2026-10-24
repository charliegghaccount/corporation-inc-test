import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  build,
  hire,
  tick,
  addFloor,
  extendLift,
  research,
  upgrade,
  promote,
  demolish,
  restore,
  claimObjectives,
} from "./sim";
const run = (g: ReturnType<typeof fresh>, seconds: number) => {
  for (let i = 0; i < seconds * 10; i++) tick(g, 0.1);
};
test("construction bounds, costs, capacity and occupied demolition", () => {
  const g = fresh();
  assert(!build(g, "office", 1, 0));
  assert(!build(g, "office", 0, -1));
  assert(build(g, "office", 0, 0));
  assert.equal(g.cash, 1750);
  assert(!build(g, "office", 0, 0));
  for (let i = 0; i < 4; i++) assert(hire(g, "worker"));
  assert(!hire(g, "worker"));
  assert(!demolish(g, g.rooms[0].id));
  assert.equal(g.staff.length, 4);
});
test("button income is produced only by working employees, salaries reconcile", () => {
  const g = fresh();
  build(g, "office", 0, 0);
  hire(g, "worker");
  g.time = 80;
  run(g, 50);
  assert(g.presses > 5);
  assert(g.lifetime > 0);
  assert(
    Math.abs(
      g.cash -
        (2400 + g.report.income - g.report.salaries - g.report.construction),
    ) < 0.001,
  );
  const n = g.presses;
  g.time = 190;
  run(g, 20);
  assert.equal(g.presses, n);
  assert(g.report.salaries > 0);
});
test("elevator gates construction and transports finite groups to desks", () => {
  const g = fresh();
  g.cash = 20000;
  assert(addFloor(g));
  assert(!build(g, "office", 1, 0));
  assert(extendLift(g));
  assert(build(g, "office", 1, 0));
  for (let i = 0; i < 4; i++) hire(g, "worker");
  g.time = 80;
  let max = 0;
  for (let i = 0; i < 1000; i++) {
    tick(g, 0.1);
    max = Math.max(max, g.lift.passengers.length);
  }
  assert(max <= 3);
  assert(g.staff.every((p) => p.floor === 1));
  assert(g.staff.every((p) => p.presses > 0));
  assert(g.lifetime > 0);
});
test("IT visits broken studio and janitor cleans on night shift", () => {
  const g = fresh();
  g.cash = 10000;
  build(g, "office", 0, 0);
  build(g, "maintenance", 0, 1);
  hire(g, "it");
  hire(g, "janitor");
  g.rooms[0].broken = [0];
  g.rooms[0].dirt = 80;
  g.time = 80;
  run(g, 50);
  assert.equal(g.rooms[0].broken.length, 0);
  g.time = 185;
  run(g, 60);
  assert(g.rooms[0].dirt < 20);
});
test("research prerequisites, costs, upgrades and promotions are real", () => {
  const g = fresh();
  g.cash = 10000;
  build(g, "research", 0, 0);
  hire(g, "researcher");
  g.time = 80;
  run(g, 100);
  assert(g.points > 5);
  assert(!research(g, "desks"));
  g.points = 500;
  assert(research(g, "keys"));
  assert(research(g, "desks"));
  assert(!research(g, "keys"));
  build(g, "office", 0, 1);
  hire(g, "worker");
  assert(upgrade(g, g.rooms[1].id));
  assert.equal(g.rooms[1].level, 2);
  assert(!promote(g, g.staff[1].id));
  assert(research(g, "promote"));
  assert(promote(g, g.staff[1].id));
  assert.equal(g.staff[1].level, 2);
});
test("objectives cannot duplicate cash; saves roundtrip and invalid saves fail", () => {
  const g = fresh();
  build(g, "office", 0, 0);
  claimObjectives(g);
  const cash = g.cash;
  claimObjectives(g);
  assert.equal(g.cash, cash);
  assert.deepEqual(restore(JSON.stringify(g)), g);
  assert.equal(restore("{bad"), null);
  assert.equal(restore("{}"), null);
  const bad = { ...g, rooms: [{ ...g.rooms[0], type: "fake" }] };
  assert.equal(restore(JSON.stringify(bad)), null);
});
test("economy: opening office remains profitable across 12 days without grants", () => {
  const g = fresh();
  build(g, "office", 0, 0);
  for (let i = 0; i < 4; i++) hire(g, "worker");
  const start = g.cash;
  run(g, 240 * 12);
  assert(g.cash > start);
  assert(g.history.length >= 12);
  assert(g.cash < 20000);
  assert(
    g.history.every(
      (r) => Math.abs(r.net - (r.income - r.salaries - r.construction)) < 0.001,
    ),
  );
  console.log(
    JSON.stringify({
      days: g.day,
      cash: Math.round(g.cash),
      lifetime: Math.round(g.lifetime),
      presses: g.presses,
      faults: g.rooms[0].broken.length,
    }),
  );
});
test("same simulation steps yield identical results regardless of render speed batching", () => {
  const a = fresh();
  build(a, "office", 0, 0);
  hire(a, "worker");
  const b = restore(JSON.stringify(a))!;
  run(a, 240);
  for (let j = 0; j < 600; j++) for (let n = 0; n < 4; n++) tick(b, 0.1);
  assert.deepEqual(a, b);
});
