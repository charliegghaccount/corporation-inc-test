import {
  rooms,
  roles,
  techs,
  economy,
  type RoomType,
  type Role,
} from "./config";
export interface Room {
  id: number;
  floor: number;
  slot: number;
  type: RoomType;
  level: number;
  dirt: number;
  broken: number[];
}
export interface Person {
  id: number;
  name: string;
  role: Role;
  room: number;
  level: number;
  happy: number;
  state: string;
  x: number;
  floor: number;
  targetFloor: number;
  timer: number;
  presses: number;
  breakTime: number;
}
export interface Ledger {
  day: number;
  income: number;
  salaries: number;
  construction: number;
  net: number;
}
export interface Game {
  version: 1;
  name: string;
  cash: number;
  time: number;
  day: number;
  floors: number;
  liftTop: number;
  rooms: Room[];
  staff: Person[];
  points: number;
  tech: string[];
  claimed: number[];
  lifetime: number;
  presses: number;
  report: Ledger;
  history: Ledger[];
  nextId: number;
  seed: number;
  lift: { y: number; target: number; phase: number; passengers: number[] };
  events: { id: number; room: number; value: number }[];
  eventId: number;
  message: string;
}
export const fresh = (name = "Good Company"): Game => ({
  version: 1,
  name: name.slice(0, 28) || "Good Company",
  cash: economy.startingCash,
  time: (7 / 24) * 240,
  day: 1,
  floors: 1,
  liftTop: 0,
  rooms: [],
  staff: [],
  points: 0,
  tech: [],
  claimed: [],
  lifetime: 0,
  presses: 0,
  report: { day: 1, income: 0, salaries: 0, construction: 0, net: 0 },
  history: [],
  nextId: 1,
  seed: 7321,
  lift: { y: 0, target: 0, phase: 0, passengers: [] },
  events: [],
  eventId: 0,
  message: "Start small. Build a Button studio, then hire two button pushers.",
});
const rand = (g: Game) => {
  g.seed = (Math.imul(1664525, g.seed) + 1013904223) >>> 0;
  return g.seed / 4294967296;
};
export const hour = (g: Game) => g.time / 10;
export const working = (g: Game) => hour(g) >= 8 && hour(g) < 18;
export function spend(g: Game, n: number) {
  if (g.cash < n) {
    g.message = "Not enough cash. Let your team work a little longer.";
    return false;
  }
  g.cash -= n;
  g.report.construction += n;
  return true;
}
export function build(g: Game, type: RoomType, floor: number, slot: number) {
  if (
    !Number.isInteger(floor) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot > 2 ||
    floor < 0 ||
    floor >= g.floors ||
    floor > g.liftTop ||
    g.rooms.some((r) => r.floor === floor && r.slot === slot)
  ) {
    g.message = "Choose an empty connected building plot.";
    return false;
  }
  if (!spend(g, rooms[type].cost)) return false;
  g.rooms.push({
    id: g.nextId++,
    floor,
    slot,
    type,
    level: 1,
    dirt: 0,
    broken: [],
  });
  g.message = rooms[type].name + " is open for business.";
  return true;
}
export function addFloor(g: Game) {
  if (g.floors >= (g.tech.includes("height") ? 8 : 4)) {
    g.message = "Research Bigger ambitions to raise the height limit.";
    return false;
  }
  if (!spend(g, economy.floorCost + g.floors * 150)) return false;
  g.floors++;
  g.message = "New floor built. Extend elevator service before adding rooms.";
  return true;
}
export function extendLift(g: Game) {
  if (g.liftTop >= g.floors - 1) {
    g.message = "Elevator already reaches every floor.";
    return false;
  }
  if (!spend(g, economy.liftCost)) return false;
  g.liftTop++;
  g.message = "Elevator connected to floor " + (g.liftTop + 1);
  return true;
}
export function hire(g: Game, role: Role, preferred?: number) {
  const def = roles[role];
  const r = g.rooms.find(
    (r) =>
      (preferred === undefined || r.id === preferred) &&
      r.type === def.room &&
      g.staff.filter((p) => p.room === r.id).length < rooms[r.type].capacity,
  );
  if (!r) {
    g.message = "Build an available " + rooms[def.room].name + " first.";
    return false;
  }
  if (!spend(g, def.cost)) return false;
  const id = g.nextId++;
  g.staff.push({
    id,
    name:
      [
        "Alex",
        "Jamie",
        "Sam",
        "Morgan",
        "Riley",
        "Charlie",
        "Robin",
        "Taylor",
        "Casey",
        "Jordan",
      ][id % 10] +
      " " +
      String.fromCharCode(65 + (id % 26)) +
      ".",
    role,
    room: r.id,
    level: 1,
    happy: 82,
    state: "Arriving",
    x: 335,
    floor: 0,
    targetFloor: r.floor,
    timer: 0,
    presses: 0,
    breakTime: 0,
  });
  g.message = def.name + " hired. Salary $" + def.salary + "/day.";
  return true;
}
export function research(g: Game, id: string) {
  const t = techs.find((t) => t.id === id);
  if (
    !t ||
    g.tech.includes(id) ||
    (t.requires && !g.tech.includes(t.requires)) ||
    g.points < t.cost
  ) {
    g.message = "Earn enough research points and complete prerequisites.";
    return false;
  }
  g.points -= t.cost;
  g.tech.push(id);
  g.message = t.name + " researched!";
  return true;
}
export function upgrade(g: Game, id: number) {
  const r = g.rooms.find((r) => r.id === id);
  if (
    !r ||
    r.type !== "office" ||
    r.level >= 3 ||
    !g.tech.includes(r.level === 1 ? "desks" : "deluxe")
  ) {
    g.message = "Research the next studio tier first.";
    return false;
  }
  if (!spend(g, 450 * r.level)) return false;
  r.level++;
  return true;
}
export function promote(g: Game, id: number) {
  const p = g.staff.find((p) => p.id === id);
  if (!p || p.level >= 3 || !g.tech.includes("promote")) {
    g.message = "Research Career ladders first. Maximum level is 3.";
    return false;
  }
  if (!spend(g, p.level * 240)) return false;
  p.level++;
  p.happy = Math.min(100, p.happy + 10);
  return true;
}
export function demolish(g: Game, id: number) {
  if (g.staff.some((p) => p.room === id)) {
    g.message = "Dismiss occupants before demolishing this room.";
    return false;
  }
  const r = g.rooms.find((r) => r.id === id);
  if (!r) return false;
  g.cash += Math.floor(rooms[r.type].cost * 0.35);
  g.report.construction -= Math.floor(rooms[r.type].cost * 0.35);
  g.rooms = g.rooms.filter((r) => r.id !== id);
  return true;
}
export const objectives = [
  [
    "A place to begin",
    "Build a Button studio",
    100,
    (g: Game) => g.rooms.some((r) => r.type === "office"),
  ],
  [
    "Your first colleague",
    "Hire a button pusher",
    75,
    (g: Game) => g.staff.some((p) => p.role === "worker"),
  ],
  [
    "Make an impression",
    "Earn $100 from button presses",
    80,
    (g: Game) => g.lifetime >= 100,
  ],
  [
    "A full house",
    "Hire four button pushers",
    100,
    (g: Game) => g.staff.filter((p) => p.role === "worker").length >= 4,
  ],
  [
    "Room to grow",
    "Build two Button studios",
    120,
    (g: Game) => g.rooms.filter((r) => r.type === "office").length >= 2,
  ],
  ["Moving up", "Construct a second floor", 100, (g: Game) => g.floors >= 2],
  ["Going places", "Extend the elevator", 100, (g: Game) => g.liftTop >= 1],
  [
    "Technical support",
    "Hire an IT technician",
    100,
    (g: Game) => g.staff.some((p) => p.role === "it"),
  ],
  [
    "Fresh start",
    "Hire a janitor",
    100,
    (g: Game) => g.staff.some((p) => p.role === "janitor"),
  ],
  [
    "A little comfort",
    "Build a Common room or Restroom",
    100,
    (g: Game) =>
      g.rooms.some((r) => r.type === "break" || r.type === "restroom"),
  ],
  [
    "Bright ideas",
    "Hire a researcher",
    120,
    (g: Game) => g.staff.some((p) => p.role === "researcher"),
  ],
  [
    "The next chapter",
    "Complete your first research",
    100,
    (g: Game) => g.tech.length > 0,
  ],
  [
    "An upgrade in life",
    "Upgrade a Button studio",
    100,
    (g: Game) => g.rooms.some((r) => r.level > 1),
  ],
  [
    "Career goals",
    "Promote a colleague",
    100,
    (g: Game) => g.staff.some((p) => p.level > 1),
  ],
  ["Skyward", "Build five floors", 200, (g: Game) => g.floors >= 5],
] as const;
export function claimObjectives(g: Game) {
  objectives.forEach((o, i) => {
    if (!g.claimed.includes(i) && o[3](g)) {
      g.claimed.push(i);
      g.cash += o[2];
      g.report.income += o[2];
      g.message = "Objective complete: " + o[0] + " · +$" + o[2];
    }
  });
}
function move(p: Person, x: number, dt: number) {
  const d = x - p.x;
  p.x += Math.sign(d) * Math.min(Math.abs(d), dt * 65);
  return Math.abs(d) < 3;
}
export function tick(g: Game, dt: number) {
  if (dt <= 0 || dt > 1) return;
  g.time += dt;
  if (g.time >= 240) {
    g.time -= 240;
    g.report.net = g.report.income - g.report.salaries - g.report.construction;
    g.history.push({ ...g.report });
    g.history = g.history.slice(-14);
    g.day++;
    g.report = { day: g.day, income: 0, salaries: 0, construction: 0, net: 0 };
  }
  const work = working(g),
    special = g.tech.includes("specialists") ? 1.5 : 1;
  // A shared car serves one queue at a time, with boarding dwell and finite capacity.
  const lift = g.lift;
  const cap = g.tech.includes("lift") ? 6 : 3;
  if (Math.abs(lift.y - lift.target) > 0.01) {
    lift.y +=
      Math.sign(lift.target - lift.y) *
      Math.min(
        Math.abs(lift.target - lift.y),
        dt * (g.tech.includes("lift") ? 1 : 0.5),
      );
    for (const p of g.staff.filter((p) => lift.passengers.includes(p.id))) {
      p.floor = lift.y;
      p.x = 335;
      p.state = "Riding elevator";
    }
  } else {
    lift.y = lift.target;
    lift.phase += dt;
    if (lift.phase > 1.2) {
      for (const id of [...lift.passengers]) {
        const p = g.staff.find((p) => p.id === id);
        if (!p || p.targetFloor === lift.y) {
          lift.passengers = lift.passengers.filter((n) => n !== id);
          if (p) {
            p.floor = lift.y;
            p.state = "Walking";
          }
        }
      }
      const waiting = g.staff.filter(
        (p) => p.state === "Waiting for elevator" && p.floor === lift.y,
      );
      for (const p of waiting.slice(0, cap - lift.passengers.length)) {
        lift.passengers.push(p.id);
        p.state = "Riding elevator";
      }
      if (lift.passengers.length)
        lift.target = g.staff.find(
          (p) => p.id === lift.passengers[0],
        )!.targetFloor;
      else {
        const next = g.staff.find((p) => p.state === "Waiting for elevator");
        if (next) lift.target = next.floor;
      }
      lift.phase = 0;
    }
  }
  for (const r of g.rooms) {
    r.dirt = Math.min(100, r.dirt + dt * (work ? 0.018 : 0.005));
    if (
      work &&
      r.type === "office" &&
      rand(g) < dt * (g.tech.includes("reliable") ? 0.00012 : 0.00024)
    ) {
      const desk = Math.floor(rand(g) * 4);
      if (!r.broken.includes(desk)) r.broken.push(desk);
    }
  }
  for (const p of g.staff) {
    const home = g.rooms.find((r) => r.id === p.room);
    if (!home) continue;
    const salary =
      (roles[p.role].salary * (1 + (p.level - 1) * 0.45) * dt) / 240;
    g.cash -= salary;
    g.report.salaries += salary;
    const active = p.role === "janitor" ? hour(g) >= 18 || hour(g) < 7 : work;
    let target = home;
    if ((p.role === "it" || p.role === "janitor") && active) {
      const job = g.rooms.find((r) =>
        p.role === "it" ? r.broken.length > 0 : r.dirt > 8,
      );
      if (job) target = job;
    }
    if (p.breakTime > 0 && active) {
      target =
        g.rooms.find((r) => r.type === "break" && r.floor === home.floor) ||
        home;
      p.breakTime -= dt;
    }
    p.targetFloor = active ? target.floor : 0;
    if (lift.passengers.includes(p.id)) continue;
    if (p.floor !== p.targetFloor) {
      if (move(p, 335, dt)) {
        p.state = "Waiting for elevator";
        p.happy = Math.max(20, p.happy - dt * 0.025);
      } else p.state = "Walking to elevator";
      continue;
    }
    const index = g.staff
      .filter((q) => q.room === home.id)
      .findIndex((q) => q.id === p.id);
    const dest = active ? 385 + target.slot * 240 + 24 + (index % 4) * 51 : 335;
    if (!move(p, dest, dt)) {
      p.state = active ? "Walking" : "Leaving work";
      continue;
    }
    if (!active) {
      p.state = "Off shift";
      continue;
    }
    const comfort =
      g.rooms.filter(
        (r) =>
          (r.type === "break" || r.type === "restroom") &&
          r.floor === home.floor,
      ).length * 6;
    const hr = g.staff.some((p) => p.role === "hr") ? 5 : 0;
    const happyTarget =
      70 +
      comfort +
      hr +
      (g.tech.includes("comfort") ? 10 : 0) +
      (home.level - 1) * 4 -
      home.dirt * 0.3 -
      (home.broken.length ? 8 : 0);
    p.happy += Math.sign(happyTarget - p.happy) * dt * 0.1;
    if (p.breakTime > 0) {
      p.state = "Taking a break";
      p.happy = Math.min(100, p.happy + dt * 0.6);
      continue;
    }
    p.timer += dt;
    const rate = (0.5 + p.happy / 200) * (1 + (p.level - 1) * 0.25);
    p.state =
      p.role === "worker"
        ? "Pushing buttons"
        : p.role === "researcher"
          ? "Researching"
          : p.role === "it"
            ? "Repairing"
            : p.role === "janitor"
              ? "Cleaning"
              : "Supporting team";
    if (p.role === "worker") {
      const desk = index % 4;
      if (home.broken.includes(desk)) {
        p.state = "Computer broken";
        continue;
      }
      const sup = g.staff.some(
        (q) =>
          q.role === "supervisor" &&
          g.rooms.find((r) => r.id === q.room)?.floor === home.floor,
      )
        ? 1.15
        : 1;
      if (p.timer >= economy.pressSeconds / rate / sup) {
        p.timer = 0;
        p.presses++;
        g.presses++;
        const value =
          economy.pressValue *
          (1 + (home.level - 1) * 0.35) *
          (g.tech.includes("keys") ? 1.2 : 1) *
          (g.staff.some((q) => q.role === "accountant") ? 1.08 : 1);
        g.cash += value;
        g.lifetime += value;
        g.report.income += value;
        g.events.push({ id: ++g.eventId, room: home.id, value });
        g.events = g.events.slice(-20);
        if (p.presses % 32 === 0) p.breakTime = 12;
      }
    }
    if (p.role === "researcher") g.points += dt * 0.12 * rate * special;
    if (p.role === "it" && target.broken.length && p.timer > 10 / special) {
      target.broken.shift();
      p.timer = 0;
    }
    if (p.role === "janitor")
      target.dirt = Math.max(0, target.dirt - dt * 1.8 * special);
  }
  claimObjectives(g);
  g.report.net = g.report.income - g.report.salaries - g.report.construction;
}
export function restore(raw: string): Game | null {
  try {
    const g = JSON.parse(raw);
    const base = fresh();
    if (!g || typeof g !== "object") return null;
    for (const [key, value] of Object.entries(base)) {
      if (Array.isArray(value)) {
        if (!Array.isArray(g[key])) return null;
      } else if (typeof value === "number") {
        if (!Number.isFinite(g[key])) return null;
      } else if (typeof g[key] !== typeof value || g[key] === null) return null;
    }
    const ledgerOK = (r: Ledger) =>
      r &&
      ["day", "income", "salaries", "construction", "net"].every((k) =>
        Number.isFinite(r[k as keyof Ledger]),
      );
    if (
      !ledgerOK(g.report) ||
      !g.history.every(ledgerOK) ||
      !Array.isArray(g.lift.passengers) ||
      ![g.lift.y, g.lift.target, g.lift.phase].every(Number.isFinite)
    )
      return null;
    if (
      g.time < 0 ||
      g.time >= 240 ||
      g.liftTop < 0 ||
      g.liftTop >= g.floors ||
      !Number.isInteger(g.floors)
    )
      return null;
    if (
      !g.tech.every((id: string) => techs.some((t) => t.id === id)) ||
      !g.claimed.every(
        (i: number) => Number.isInteger(i) && i >= 0 && i < objectives.length,
      )
    )
      return null;
    if (
      g.version !== 1 ||
      !Array.isArray(g.rooms) ||
      !Array.isArray(g.staff) ||
      !Array.isArray(g.tech) ||
      !Array.isArray(g.claimed) ||
      !Array.isArray(g.history) ||
      !g.lift ||
      !Number.isFinite(g.cash) ||
      !Number.isFinite(g.time) ||
      g.floors < 1 ||
      g.floors > 8
    )
      return null;
    for (const r of g.rooms)
      if (
        !rooms[r.type as RoomType] ||
        ![r.id, r.slot, r.level, r.dirt].every(Number.isFinite) ||
        !Array.isArray(r.broken) ||
        !r.broken.every(
          (i: number) => Number.isInteger(i) && i >= 0 && i < 4,
        ) ||
        !Number.isInteger(r.slot) ||
        r.level < 1 ||
        r.level > 3 ||
        !Number.isInteger(r.floor) ||
        r.floor >= g.floors ||
        r.floor < 0 ||
        r.slot < 0 ||
        r.slot > 2
      )
        return null;
    for (const p of g.staff)
      if (
        !roles[p.role as Role] ||
        typeof p.name !== "string" ||
        typeof p.state !== "string" ||
        ![
          p.id,
          p.level,
          p.happy,
          p.timer,
          p.presses,
          p.breakTime,
          p.targetFloor,
        ].every(Number.isFinite) ||
        p.level < 1 ||
        p.level > 3 ||
        !g.rooms.some((r: Room) => r.id === p.room) ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.floor)
      )
        return null;
    return g;
  } catch {
    return null;
  }
}
