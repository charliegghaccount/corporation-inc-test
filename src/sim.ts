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
  waste: number[];
  todayIncome: number;
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
  desk: number;
  direction: number;
  cycle: number;
  task: {
    kind: "repair" | "clean";
    room: number;
    desk: number;
    progress: number;
  } | null;
}
export interface Ledger {
  day: number;
  income: number;
  salaries: number;
  construction: number;
  net: number;
  rewards: number;
  operating: number;
  operatingNet: number;
  presses: number;
}
export interface Game {
  version: 2;
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
  lastAlert: number;
  message: string;
}
export const ledger = (day: number): Ledger => ({
  day,
  income: 0,
  salaries: 0,
  construction: 0,
  net: 0,
  rewards: 0,
  operating: 0,
  operatingNet: 0,
  presses: 0,
});
export const fresh = (name = "Good Company"): Game => ({
  version: 2,
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
  report: ledger(1),
  history: [],
  nextId: 1,
  seed: 7321,
  lift: { y: 0, target: 0, phase: 0, passengers: [] },
  events: [],
  eventId: 0,
  lastAlert: -1000,
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
  reconcile(g.report);
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
    waste: [0, 0, 0, 0],
    todayIncome: 0,
  });
  g.message = rooms[type].name + " is open for business.";
  return true;
}
export function addFloor(g: Game) {
  if (g.floors >= (g.tech.includes("height") ? 8 : 4)) {
    g.message = "Research Bigger ambitions to raise the height limit.";
    return false;
  }
  if (!spend(g, economy.floorCost + g.floors * economy.floorStep)) return false;
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
    desk:
      [0, 1, 2, 3].find(
        (d) => !g.staff.some((p) => p.room === r.id && p.desk === d),
      ) ?? 0,
    direction: 1,
    cycle: 0,
    task: null,
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
  if (!spend(g, economy.upgradeCost * r.level)) return false;
  r.level++;
  return true;
}
export function promote(g: Game, id: number) {
  const p = g.staff.find((p) => p.id === id);
  if (!p || p.level >= 3 || !g.tech.includes("promote")) {
    g.message = "Research Career ladders first. Maximum level is 3.";
    return false;
  }
  if (!spend(g, p.level * economy.promotionCost)) return false;
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
  reconcile(g.report);
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
  [
    "A healthy business",
    "Finish a day with positive operating profit",
    100,
    (g: Game) => g.history.some((r) => operatingProfit(r) > 0),
  ],
] as const;
export function claimObjectives(g: Game) {
  objectives.forEach((o, i) => {
    if (!g.claimed.includes(i) && o[3](g)) {
      g.claimed.push(i);
      g.cash += o[2];
      g.report.rewards += o[2];
      g.message = "Objective complete: " + o[0] + " · +$" + o[2];
    }
  });
  reconcile(g.report);
}
// Shared coordinates are used by simulation AND artwork: no approximate hand targets.
export const roomLeft = (r: Room) => 365 + r.slot * 240;
export const deskLeft = (r: Room, d: number) => roomLeft(r) + 14 + d * 51;
export const deskStand = (r: Room, d: number) => deskLeft(r, d) + 9;
export const buttonPoint = (r: Room, d: number) => ({
  x: deskLeft(r, d) + 36,
  y: 800 - r.floor * 150 - 66,
});
export const binPoint = (r: Room, d: number) => ({
  x: deskLeft(r, d) + 41,
  y: 800 - r.floor * 150 - 22,
});
export const pressValue = (g: Game, r: Room) =>
  economy.pressValue *
  (1 + (r.level - 1) * 0.45) *
  (g.tech.includes("keys") ? 1.2 : 1) *
  (g.staff.some((p) => p.role === "accountant") ? 1.08 : 1);
export const productivity = (g: Game, p: Person) => {
  const r = g.rooms.find((r) => r.id === p.room)!;
  return (
    (0.65 + p.happy / 285) *
    (1 + (p.level - 1) * 0.25) *
    (g.staff.some(
      (q) =>
        q.role === "supervisor" &&
        g.rooms.find((r) => r.id === q.room)?.floor === r.floor,
    )
      ? 1.15
      : 1)
  );
};
export const operatingProfit = (r: Ledger) =>
  r.income - r.salaries - r.operating;
function reconcile(r: Ledger) {
  r.operatingNet = operatingProfit(r);
  r.net = r.operatingNet + r.rewards - r.construction;
}
function alert(g: Game, message: string) {
  const now = g.day * 240 + g.time;
  if (now - g.lastAlert >= 20) {
    g.lastAlert = now;
    g.message = message;
  }
}
function move(p: Person, x: number, dt: number) {
  const d = x - p.x;
  if (Math.abs(d) < 0.01) {
    p.x = x;
    return true;
  }
  p.direction = Math.sign(d);
  p.x += Math.sign(d) * Math.min(Math.abs(d), dt * 78);
  return Math.abs(x - p.x) < 0.01;
}
function release(p: Person) {
  p.task = null;
  p.timer = 0;
}
function taskExists(g: Game, p: Person) {
  const t = p.task;
  if (!t) return false;
  const r = g.rooms.find((r) => r.id === t.room);
  return (
    !!r &&
    (t.kind === "repair" ? r.broken.includes(t.desk) : r.waste[t.desk] > 0)
  );
}
function assignTask(g: Game, p: Person) {
  if (p.task && taskExists(g, p)) return;
  release(p);
  const kind = p.role === "it" ? "repair" : "clean";
  const candidates = g.rooms
    .flatMap((r) =>
      (kind === "repair"
        ? r.broken
        : r.waste.map((v, i) => (v >= 4 ? i : -1)).filter((i) => i >= 0)
      ).map((desk) => ({ r, desk })),
    )
    .filter(
      ({ r, desk }) =>
        !g.staff.some(
          (q) =>
            q.id !== p.id &&
            q.task?.kind === kind &&
            q.task.room === r.id &&
            q.task.desk === desk,
        ),
    )
    .sort(
      (a, b) =>
        (kind === "clean" ? (b.r.waste[b.desk] - a.r.waste[a.desk]) * 60 : 0) +
        Math.abs(a.r.floor - p.floor) * 500 +
        Math.abs(binPoint(a.r, a.desk).x - p.x) -
        Math.abs(b.r.floor - p.floor) * 500 -
        Math.abs(binPoint(b.r, b.desk).x - p.x),
    );
  const job = candidates[0];
  if (job) p.task = { kind, room: job.r.id, desk: job.desk, progress: 0 };
}
function elevator(g: Game, dt: number) {
  const l = g.lift,
    cap = g.tech.includes("lift") ? 6 : 3;
  l.passengers = l.passengers.filter((id) => g.staff.some((p) => p.id === id));
  if (Math.abs(l.y - l.target) > 0.0001) {
    l.y +=
      Math.sign(l.target - l.y) *
      Math.min(
        Math.abs(l.target - l.y),
        dt * (g.tech.includes("lift") ? 1.2 : 0.65),
      );
    for (const id of l.passengers) {
      const p = g.staff.find((p) => p.id === id)!;
      p.floor = l.y;
      p.x = 335;
      p.state = "Riding elevator";
    }
    return;
  }
  l.y = l.target;
  l.phase += dt;
  if (l.phase < 0.7) return;
  for (const id of [...l.passengers]) {
    const p = g.staff.find((p) => p.id === id)!;
    if (p.targetFloor === l.y) {
      l.passengers = l.passengers.filter((n) => n !== id);
      p.floor = l.y;
      p.state = "Walking";
    }
  }
  for (const p of g.staff
    .filter((p) => p.state === "Waiting for elevator" && p.floor === l.y)
    .slice(0, cap - l.passengers.length)) {
    l.passengers.push(p.id);
    p.state = "Riding elevator";
  }
  const passenger = g.staff.find((p) => p.id === l.passengers[0]);
  const waiting = g.staff.find((p) => p.state === "Waiting for elevator");
  l.target = passenger ? passenger.targetFloor : waiting ? waiting.floor : l.y;
  l.phase = 0;
}
export function tick(g: Game, dt: number) {
  if (dt <= 0 || dt > 1) return;
  // Split midnight exactly: no lost or double payroll, including during large updates.
  if (g.time + dt > 240 + 1e-8) {
    const part = 240 - g.time;
    tick(g, part);
    tick(g, dt - part);
    return;
  }
  const work = working(g),
    special = g.tech.includes("specialists") ? 1.5 : 1;
  elevator(g, dt);
  for (const p of g.staff) {
    const home = g.rooms.find((r) => r.id === p.room);
    if (!home) continue;
    const wages =
      (roles[p.role].salary * (1 + (p.level - 1) * 0.45) * dt) / 240;
    g.cash -= wages;
    g.report.salaries += wages;
    const active = p.role === "janitor" ? hour(g) >= 18 || hour(g) < 7 : work;
    if (!active) {
      p.timer = 0;
      p.cycle = 0;
    } else if (p.role === "it" || p.role === "janitor") assignTask(g, p);
    let target = p.task ? g.rooms.find((r) => r.id === p.task!.room)! : home;
    if (p.breakTime > 0 && active)
      target =
        g.rooms.find((r) => r.type === "break" && r.floor === home.floor) ||
        home;
    // Do not reroute passengers mid-trip: finish the current journey before selecting a new destination.
    if (g.lift.passengers.includes(p.id)) {
      p.cycle = 0;
      continue;
    }
    p.targetFloor = active ? target.floor : 0;
    if (p.floor !== p.targetFloor) {
      p.cycle = 0;
      if (move(p, 335, dt)) {
        p.state = "Waiting for elevator";
        p.happy = Math.max(25, p.happy - dt * 0.015);
      } else p.state = "Walking to elevator";
      continue;
    }
    const dest = !active
      ? 335
      : p.task
        ? p.task.kind === "clean"
          ? binPoint(target, p.task.desk).x - 15
          : deskStand(target, p.task.desk) + 17
        : p.breakTime > 0
          ? roomLeft(target) + 80 + p.desk * 12
          : deskStand(home, p.desk);
    if (!move(p, dest, dt)) {
      p.cycle = 0;
      p.state = active ? "Walking" : "Leaving work";
      continue;
    }
    if (!active) {
      p.cycle = 0;
      p.state = "Off shift";
      continue;
    }
    p.direction = 1;
    const comfort =
      g.rooms.filter(
        (r) =>
          (r.type === "break" || r.type === "restroom") &&
          r.floor === home.floor,
      ).length * 6;
    const overflow = home.waste.reduce(
      (n, v) => n + Math.max(0, v - economy.binCapacity),
      0,
    );
    const happyTarget = Math.max(
      35,
      76 +
        comfort +
        (g.staff.some((q) => q.role === "hr") ? 5 : 0) +
        (g.tech.includes("comfort") ? 10 : 0) +
        (home.level - 1) * 4 -
        Math.min(15, overflow * 0.12) -
        (home.broken.length ? 4 : 0),
    );
    p.happy +=
      Math.sign(happyTarget - p.happy) *
      Math.min(Math.abs(happyTarget - p.happy), dt * 0.12);
    if (p.breakTime > 0) {
      p.state = "Taking a break";
      p.breakTime = Math.max(0, p.breakTime - dt);
      p.happy = Math.min(100, p.happy + dt * 0.4);
      p.cycle = 0;
      continue;
    }
    if (p.task) {
      p.state =
        p.task.kind === "repair" ? "Repairing computer" : "Emptying bin";
      p.task.progress += dt * special * (1 + (p.level - 1) * 0.25);
      const duration =
        p.task.kind === "repair" ? economy.repairSeconds : economy.cleanSeconds;
      if (p.task.progress >= duration) {
        if (p.task.kind === "repair")
          target.broken = target.broken.filter((d) => d !== p.task!.desk);
        else target.waste[p.task.desk] = 0;
        release(p);
      }
      continue;
    }
    if (p.role === "it" || p.role === "janitor") {
      p.state = p.role === "it" ? "On call" : "No bins need cleaning";
      continue;
    }
    p.timer += dt;
    if (p.role === "worker") {
      if (home.broken.includes(p.desk)) {
        p.state = "Computer broken";
        p.cycle = 0;
        continue;
      }
      p.state = "Pushing buttons";
      const old = p.cycle;
      p.cycle += (dt * productivity(g, p)) / economy.pressSeconds;
      // The contact phase is the single source of truth for money, paper and button depression.
      if (old < economy.contactPhase && p.cycle >= economy.contactPhase) {
        const value = pressValue(g, home);
        p.presses++;
        g.presses++;
        g.report.presses++;
        g.cash += value;
        g.lifetime += value;
        g.report.income += value;
        home.todayIncome += value;
        home.waste[p.desk] = Math.min(
          economy.binCapacity * 2,
          home.waste[p.desk] + economy.paperPerPress,
        );
        g.events.push({ id: ++g.eventId, room: home.id, value });
        g.events = g.events.slice(-40);
        if (
          rand(g) <
          economy.breakdownPerPress * (g.tech.includes("reliable") ? 0.5 : 1)
        ) {
          home.broken.push(p.desk);
          alert(
            g,
            "Computer fault · " +
              (g.staff.some((p) => p.role === "it")
                ? "IT has been notified."
                : "Hire an IT technician in a Service workshop."),
          );
        }
      }
      if (p.cycle >= 1) {
        p.cycle -= 1;
        if (p.presses > 0 && p.presses % 30 === 0) p.breakTime = 8;
      }
    } else if (p.role === "researcher") {
      p.state = "Researching";
      g.points += dt * 0.12 * productivity(g, p) * special;
    } else p.state = "Supporting team";
  }
  for (const r of g.rooms) {
    r.dirt = Math.min(
      100,
      (r.waste.reduce((n, v) => n + v, 0) / (economy.binCapacity * 4)) * 100,
    );
    if (r.waste.some((v) => v > economy.binCapacity))
      alert(
        g,
        "Paper is overflowing on floor " +
          (r.floor + 1) +
          ". A night janitor can help.",
      );
  }
  claimObjectives(g);
  reconcile(g.report);
  g.time += dt;
  if (g.time >= 240 - 1e-8) {
    g.time = 0;
    g.history.push({ ...g.report });
    g.history = g.history.slice(-20);
    g.message =
      "Day " +
      g.day +
      " closed · revenue $" +
      Math.round(g.report.income) +
      " · wages $" +
      Math.round(g.report.salaries) +
      " · operating " +
      (g.report.operatingNet >= 0 ? "+" : "−") +
      "$" +
      Math.round(Math.abs(g.report.operatingNet));
    g.day++;
    g.report = ledger(g.day);
    for (const r of g.rooms) r.todayIncome = 0;
  }
}
export function restore(raw: string): Game | null {
  try {
    const g = JSON.parse(raw);
    if (g?.version === 1) {
      g.version = 2;
      g.lastAlert = -1000;
      for (const r of g.rooms ?? []) {
        r.waste = Array.from(
          { length: 4 },
          () => (Math.max(0, r.dirt || 0) / 100) * economy.binCapacity,
        );
        r.todayIncome = 0;
      }
      for (const p of g.staff ?? []) {
        p.desk = g.staff
          .filter((q: Person) => q.room === p.room)
          .findIndex((q: Person) => q.id === p.id);
        p.direction = 1;
        p.cycle = 0;
        p.task = null;
      }
      for (const r of [g.report, ...(g.history ?? [])]) {
        r.rewards = 0;
        r.operating = 0;
        r.operatingNet = r.income - r.salaries;
        r.presses = 0;
      }
      g.message =
        "V1 company migrated to V2. Cash and progress preserved; past income includes legacy rewards. Start a new V2 company for the new $30,000 budget.";
    }
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
      [
        "day",
        "income",
        "salaries",
        "construction",
        "net",
        "rewards",
        "operating",
        "operatingNet",
        "presses",
      ].every((k) => Number.isFinite(r[k as keyof Ledger]));
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
      g.version !== 2 ||
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
        !Array.isArray(r.waste) ||
        r.waste.length !== 4 ||
        !r.waste.every((v: number) => Number.isFinite(v) && v >= 0) ||
        !Number.isFinite(r.todayIncome) ||
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
        !Number.isInteger(p.desk) ||
        p.desk < 0 ||
        p.desk > 3 ||
        !Number.isFinite(p.cycle) ||
        p.cycle < 0 ||
        p.cycle >= 1.1 ||
        ![-1, 1].includes(p.direction) ||
        (p.task !== null &&
          (!["repair", "clean"].includes(p.task.kind) ||
            !Number.isFinite(p.task.progress) ||
            p.task.progress < 0 ||
            !g.rooms.some((r: Room) => r.id === p.task.room) ||
            !Number.isInteger(p.task.desk) ||
            p.task.desk < 0 ||
            p.task.desk > 3)) ||
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
