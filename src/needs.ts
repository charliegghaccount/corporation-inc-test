import type { Game, Person, Room } from "./sim";
import { route, roomLeft, deskStand } from "./sim";
const capacity = (r: Room) =>
  r.type === "restroom" ? 3 : r.type === "gym" ? 3 : 4;
export function updateNeeds(g: Game, p: Person, dt: number, active: boolean) {
  if (active) {
    p.toilet = Math.min(100, p.toilet + dt * 0.38);
    p.hunger = Math.min(100, p.hunger + dt * 0.32);
    p.energy = Math.max(0, p.energy - dt * 0.65);
  } else {
    p.energy = Math.min(100, p.energy + dt * 0.6);
  }
  if (
    active &&
    !p.visit &&
    (p.toilet >= 85 || p.hunger >= 85 || p.energy < 40)
  ) {
    const kind =
      p.toilet >= 85 ? "toilet" : p.hunger >= 85 ? "hunger" : "energy";
    const options = g.rooms.filter((r) =>
      kind === "toilet"
        ? r.type === "restroom"
        : kind === "hunger"
          ? r.type === "cafeteria"
          : r.type === "break" || r.type === "gym",
    );
    const score = (r: Room) =>
      Math.abs(r.floor - p.floor) * 12 +
      Math.abs(roomLeft(r) + 100 - p.x) / 78 +
      g.staff.filter((q) => q.visit?.room === r.id).length * 5;
    options.sort((a, b) => score(a) - score(b));
    p.visit = {
      kind,
      room: options[0]?.id ?? null,
      seat: -1,
      progress: 0,
      phase: "travel",
    };
  }
  const v = p.visit;
  if (!v) return false;
  const r = g.rooms.find((r) => r.id === v.room);
  if (v.room !== null && !r) {
    v.room = null;
    v.phase = "travel";
    v.seat = -1;
  }
  if (v.phase === "return") {
    p.visit = null;
    return false;
  }
  const floor = r ? r.floor : 0;
  const waiting = roomLeft(r ?? ({ slot: 0 } as Room)) - 10 + (p.id % 3) * 5;
  if (
    !route(
      g,
      p,
      floor,
      r ? (v.seat < 0 ? waiting : facilitySeatX(r, v.seat)) : 335,
      dt,
    )
  )
    return true;
  if (r && v.seat < 0) {
    const occupied = g.staff
      .filter(
        (q) => q.id !== p.id && q.visit?.room === r.id && q.visit.seat >= 0,
      )
      .map((q) => q.visit!.seat);
    const seat = Array.from({ length: capacity(r) }, (_, i) => i).find(
      (i) => !occupied.includes(i),
    );
    if (seat === undefined) {
      p.state = "Waiting for facility";
      return true;
    }
    v.seat = seat;
    return true;
  }
  v.phase = "use";
  p.state = r
    ? v.kind === "toilet"
      ? "Using restroom"
      : v.kind === "hunger"
        ? "Eating"
        : r.type === "gym"
          ? "Exercising"
          : "Resting"
    : "Off-site " + v.kind;
  v.progress += dt * (g.tech.includes("service") ? 1.25 : 1);
  if (v.progress >= (r ? 4 : 28)) {
    if (v.kind === "toilet") p.toilet = 0;
    else if (v.kind === "hunger") p.hunger = 0;
    else p.energy = 100;
    if (r) {
      if (v.kind === "toilet") g.stats.wc++;
      else if (v.kind === "hunger") g.stats.food++;
      else if (r.type === "gym") g.stats.gym++;
    }
    p.happy = Math.min(100, p.happy + (r ? 4 : 0));
    v.phase = "return";
  }
  return true;
}
export function updateSocial(g: Game, p: Person, dt: number) {
  const hr = p.role === "hr";
  if (p.social && !g.staff.some((q) => q.id === p.social!.target))
    p.social = null;
  if (!p.social) {
    const candidates = g.staff.filter(
      (q) =>
        q.id !== p.id &&
        q.role === "worker" &&
        (hr
          ? q.happy < 73 && q.hrCooldown === 0
          : q.boost === 0 && q.state === "Pushing buttons") &&
        !g.staff.some((s) => s.id !== p.id && s.social?.target === q.id),
    );
    candidates.sort(
      (a, b) =>
        Math.abs(a.floor - p.floor) * 500 +
        Math.abs(a.x - p.x) -
        Math.abs(b.floor - p.floor) * 500 -
        Math.abs(b.x - p.x),
    );
    if (candidates[0]) p.social = { target: candidates[0].id, progress: 0 };
  }
  if (!p.social) {
    p.state = "Patrol standby";
    return true;
  }
  const q = g.staff.find((q) => q.id === p.social!.target)!;
  if (
    q.visit ||
    q.state === "Off shift" ||
    q.state === "Riding elevator" ||
    q.state === "Walking" ||
    q.state === "Walking to elevator" ||
    q.state === "Waiting for elevator"
  ) {
    p.social = null;
    return true;
  }
  if (!route(g, p, q.floor, q.x - 20, dt)) return true;
  p.state = hr ? "HR conversation" : "Motivating";
  p.direction = 1;
  p.social.progress +=
    dt *
    (hr && g.rooms.find((r) => r.id === p.room)?.type === "hr" ? 1.3 : 1) *
    (1 + (p.level - 1) * 0.15);
  if (p.social.progress >= 1 && !p.social.acted) {
    p.social.acted = true;
    if (hr) {
      g.stats.hr++;
      q.happy = Math.min(100, q.happy + 12 + (p.level - 1) * 3);
      q.hrCooldown = 60;
    } else {
      g.stats.motivated++;
      q.boost = g.tech.includes("duration")
        ? 60
        : g.rooms.find((r) => r.id === p.room)?.type === "supervisor"
          ? 48
          : 40;
    }
  }
  if (p.social.progress >= 2) p.social = null;
  return true;
}

export const facilitySeatX = (r: Room, seat: number) =>
  roomLeft(r) +
  (r.type === "restroom" || r.type === "gym"
    ? 40 + seat * 65
    : r.type === "break"
      ? 40 + seat * 18
      : 32 + seat * 48);
