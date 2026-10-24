import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  fresh,
  build,
  hire,
  addFloor,
  extendLift,
  tick,
  restore,
  research,
  relocate,
  decorate,
  productivity,
  type Game,
} from "./sim";
import { techs, economy } from "./config";
const run = (g: Game, s: number) => {
  for (let i = 0; i < Math.round(s / 0.05); i++) tick(g, 0.05);
};
function company(w = 8, fac = false, support = false) {
  const g = fresh();
  g.cash = 300000;
  g.tech = techs.map((t) => t.id);
  const types = [
    "office",
    "office",
    "maintenance",
    fac ? "restroom" : "office",
    fac ? "cafeteria" : "office",
  ] as const;
  for (let s = 0; s < 5; s++) build(g, types[s], 0, s);
  addFloor(g);
  extendLift(g);
  build(g, "break", 1, 0);
  build(g, "research", 1, 1);
  if (support) build(g, "management", 1, 2);
  while (g.staff.filter((p) => p.role === "worker").length < w) {
    if (!hire(g, "worker")) {
      const f = g.floors;
      addFloor(g);
      extendLift(g);
      for (let s = 0; s < 5; s++) build(g, "office", f, s);
    }
  }
  hire(g, "it");
  hire(g, "janitor");
  if (support) {
    hire(g, "supervisor");
    hire(g, "accountant");
    hire(g, "hr");
  }
  return g;
}
test("five independent plots, four researchers and full-room hire rejection", () => {
  const g = company();
  assert.equal(g.rooms.filter((r) => r.floor === 0).length, 5);
  assert(!build(g, "office", 0, 5));
  for (let i = 0; i < 4; i++) assert(hire(g, "researcher"));
  assert(!hire(g, "researcher"));
  g.time = 80;
  run(g, 35);
  assert(g.points > 4);
  assert(
    g.staff
      .filter((p) => p.role === "researcher")
      .every((p) => p.state === "Researching"),
  );
});
test("off-site visits stop revenue, return; cross-floor facilities reserve exclusive stalls and restore needs", () => {
  const g = company();
  g.time = 80;
  for (const p of g.staff.filter((p) => p.role === "worker")) {
    p.toilet = 99;
    p.hunger = 0;
    p.energy = 100;
  }
  run(g, 12);
  assert(g.staff.some((p) => p.state === "Off-site toilet"));
  const n = g.presses;
  run(g, 8);
  assert.equal(g.presses, n);
  run(g, 40);
  assert(g.staff.some((p) => p.role === "worker" && p.toilet < 30));
  assert(build(g, "restroom", 1, 3));
  for (const p of g.staff.filter((p) => p.role === "worker")) p.toilet = 99;
  let used = false;
  for (let i = 0; i < 1800; i++) {
    tick(g, 0.05);
    const visitors = g.staff.filter(
      (p) => p.visit?.room === g.rooms.at(-1)!.id && p.visit.seat >= 0,
    );
    assert.equal(
      new Set(visitors.map((p) => p.visit!.seat)).size,
      visitors.length,
    );
    for (const p of visitors) assert.equal(p.floor, 1);
    if (g.stats.wc > 0) used = true;
  }
  assert(used);
});
test("cafeteria and breaks restore hunger and energy; saved occupancy continues identically", () => {
  const g = company(8, true);
  g.time = 80;
  for (const p of g.staff) {
    p.hunger = 99;
    p.toilet = 0;
    p.energy = 100;
  }
  run(g, 15);
  const b = restore(JSON.stringify(g))!;
  assert(b);
  run(g, 50);
  run(b, 50);
  assert.deepEqual(b, g);
  assert(g.stats.food > 0);
  for (const p of g.staff) p.energy = 5;
  g.time = 80;
  let recovered = false;
  for (let i = 0; i < 1200; i++) {
    tick(g, 0.05);
    if (g.staff.some((p) => p.energy > 95)) recovered = true;
  }
  assert(recovered);
});
test("physical supervisors and HR, capped accounting contribution, relocation and swap, decorations", () => {
  const g = company(8, true, true);
  g.time = 80;
  g.staff.filter((p) => p.role === "worker").forEach((p) => (p.happy = 50));
  run(g, 65);
  assert(g.stats.motivated > 0);
  assert(g.stats.hr > 0);
  assert(
    g.report.accountant > 0 && g.report.accountant < g.report.income * 0.17,
  );
  assert(g.staff.every((p) => p.boost <= 60));
  const p = g.staff[0],
    q = g.staff[4];
  const identity = p.name;
  assert(relocate(g, p.id, q.room, q.desk, true));
  assert.equal(p.name, identity);
  assert(!relocate(g, p.id, g.rooms.find((r) => r.type === "research")!.id, 0));
  assert(decorate(g, p.room, "plant"));
  assert(!decorate(g, p.room, "plant"));
  assert(restore(JSON.stringify(g)));
});
test("V2 migration retains layout, cash, faults, waste and adds needs; V3 round trip", () => {
  const g: any = company();
  g.version = 2;
  delete g.stats;
  for (const r of g.rooms) delete r.decor;
  for (const p of g.staff)
    for (const k of [
      "toilet",
      "hunger",
      "energy",
      "visit",
      "social",
      "boost",
      "hrCooldown",
    ])
      delete p[k];
  const cash = g.cash;
  const b = restore(JSON.stringify(g))!;
  assert(b);
  assert.equal(b.cash, cash);
  assert.equal(b.version, 3);
  assert.deepEqual(
    b.rooms.map((r) => [r.floor, r.slot]),
    g.rooms.map((r: any) => [r.floor, r.slot]),
  );
  assert.deepEqual(restore(JSON.stringify(b)), b);
});
test("20-day scenarios, facilities improve earned income; upgraded and multi-floor companies stay profitable", () => {
  let without = 0,
    withFacilities = 0;
  for (const [name, w, fac, support] of [
    ["B", 8, false, false],
    ["C", 8, true, false],
    ["D", 16, true, true],
    ["E", 24, true, true],
  ] as const) {
    const g = company(w, fac, support);
    if (w >= 16)
      g.rooms.filter((r) => r.type === "office").forEach((r) => (r.level = 2));
    run(g, 240 * 20);
    const profit =
      g.history.slice(1).reduce((n, r) => n + r.operatingNet, 0) / 19;
    assert(profit > 0);
    if (name === "B") without = g.lifetime;
    if (name === "C") withFacilities = g.lifetime;
    console.log(
      `V3 scenario ${name}: ${w} workers mean operating $${profit.toFixed(0)}, revenue ${g.lifetime.toFixed(0)}, needs visits ${g.stats.wc}/${g.stats.food}`,
    );
  }
  assert(withFacilities > without);
});
test("60 workers across populated floors at 16x steps: bounded state, productive workers, deterministic resume", () => {
  const g = company(60, true, true);
  const start = performance.now();
  run(g, 240 * 5);
  assert(
    g.staff.filter((p) => p.role === "worker").every((p) => p.presses > 0),
  );
  assert(g.events.length <= 40);
  const b = restore(JSON.stringify(g))!;
  run(g, 10);
  for (let i = 0; i < 200; i += 16)
    for (let j = 0; j < Math.min(16, 200 - i); j++) tick(b, 0.05);
  assert.deepEqual(b, g);
  console.log(
    "60-worker five-day simulation ms",
    Math.round(performance.now() - start),
  );
});
