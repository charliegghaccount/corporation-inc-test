import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "./style.css";
import {
  rooms,
  roles,
  techs,
  economy,
  type RoomType,
  type Role,
} from "./config";
import {
  fresh,
  tick,
  hour,
  hire,
  build,
  addFloor,
  extendLift,
  research,
  upgrade,
  promote,
  demolish,
  restore,
  objectives,
  type Game,
} from "./sim";
import { Tower } from "./art";
const key = "corporate-climb-v1";
let game: Game = fresh(),
  speed = 1,
  started = false,
  tab = "",
  selected: number | null = null,
  buildType: RoomType = "office",
  lastMessage = "",
  saveStatus = "Autosave on",
  accumulator = 0;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<canvas id="world" aria-label="Interactive office tower. Drag to pan; pinch or scroll to zoom."></canvas><header><div class="brand"><span class="brand-icon">↗</span><div><small>CORPORATE CLIMB</small><strong id="company">Good Company</strong></div></div><div class="metric"><small>AVAILABLE CASH</small><strong id="cash">$2,400</strong></div><div class="metric wide"><small>TODAY’S NET</small><strong id="profit">$0</strong></div><div class="metric wide"><small>YOUR PEOPLE</small><strong id="people">0 · 82% ☺</strong></div><div class="time"><small id="day">DAY 01 · 07:00</small><div id="speeds"><button data-speed="0" aria-label="Pause">Ⅱ</button><button data-speed="1" class="active">1×</button><button data-speed="2">2×</button><button data-speed="4">4×</button></div></div></header><aside class="mission"><small>THE NEXT BIG THING</small><strong id="goal">A place to begin</strong><span id="goal-sub">Build your first Button studio</span><div class="mission-line"><i id="goal-progress"></i></div></aside><div class="view-tools"><button id="up" aria-label="View upper floors">↑</button><button id="zoom-in" aria-label="Zoom in">＋</button><button id="zoom-out" aria-label="Zoom out">−</button><button id="home-view" aria-label="Reset camera">⌂</button></div><div class="scene-caption"><span class="live-dot"></span> <span id="scene-time">A new day, a new beginning.</span></div><section id="panel" class="panel" hidden></section><div id="toast" role="status"></div><nav>${[
  ["build", "▦", "Build"],
  ["staff", "♙", "People"],
  ["research", "✧", "Research"],
  ["objectives", "⚑", "Goals"],
  ["finances", "▥", "Finances"],
  ["settings", "⚙", "Settings"],
]
  .map(
    ([id, icon, name]) =>
      `<button data-tab="${id}"><span>${icon}</span>${name}</button>`,
  )
  .join(
    "",
  )}<div class="nav-note">BUILD SOMETHING<br><b>worth working for.</b></div></nav><div id="title" class="title-screen"><div class="title-card"><div class="eyebrow">THE LITTLE OFFICE TYCOON</div><h1>Corporate<br><em>Climb.</em><span>↗</span></h1><p>Good people. Bright ideas.<br>Your next big thing starts on the ground floor.</p><label for="company-name">NAME YOUR CORPORATION</label><input id="company-name" maxlength="28" value="Good Company" autocomplete="organization"><button id="new" class="primary big">Start something great <span>↗</span></button><button id="continue" class="secondary big">Continue your company</button><button id="title-settings" class="text-button">Settings & how to play</button><small class="title-footer">AN ORIGINAL OFFICE-BUILDING SIMULATION</small></div></div><div id="rotate">↻ <span>Room to grow.<small>Try landscape for the best view of your company.</small></span><button aria-label="Dismiss rotate suggestion">×</button></div>`;
const el = (id: string) => document.getElementById(id)!;
const panel = el("panel");
const tower = new Tower(el("world") as HTMLCanvasElement);
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
function load() {
  try {
    const raw = localStorage.getItem(key);
    return raw ? restore(raw) : null;
  } catch {
    return null;
  }
}
const existing = load();
(el("continue") as HTMLButtonElement).disabled = !existing;
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(game));
    saveStatus = "Saved just now";
  } catch {
    saveStatus = "Save unavailable";
    game.message = "Browser storage is unavailable. Progress cannot be saved.";
  }
}
function start(g: Game) {
  game = g;
  started = true;
  el("title").hidden = true;
  speed = 1;
  lastMessage = "";
  hud();
  save();
}
el("new").onclick = () => {
  if (load() && !confirm("Replace the saved company with a new game?")) return;
  start(fresh((el("company-name") as HTMLInputElement).value));
};
el("continue").onclick = () => {
  const saved = load();
  if (saved) start(saved);
};
el("title-settings").onclick = () => {
  tab = "settings";
  renderPanel();
};
function action(f: () => unknown) {
  f();
  hud();
  renderPanel();
  save();
}
function button(
  label: string,
  act: string,
  cls = "secondary",
  disabled = false,
) {
  return `<button class="${cls}" data-action="${act}" ${disabled ? "disabled" : ""}>${label}</button>`;
}
function heading(kicker: string, title: string, desc = "") {
  return `<div class="panel-top"><div><small>${kicker}</small><h2>${title}</h2></div><button data-action="close" class="close" aria-label="Close panel">×</button></div>${desc ? `<p class="intro">${desc}</p>` : ""}`;
}
function renderPanel() {
  panel.hidden = !tab;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.classList.toggle("active", (b as HTMLElement).dataset.tab === tab),
    );
  if (!tab) {
    tower.buildMode = false;
    return;
  }
  tower.buildMode = tab === "build";
  let html = "";
  if (tab === "build") {
    html = heading(
      "MAKE ROOM FOR POSSIBILITY",
      "Build your company",
      "Choose a room, then tap an empty plot in the tower. Three rooms fit on each floor.",
    );
    html += `<div class="cards">${Object.entries(rooms)
      .map(
        ([id, r]) =>
          `<button class="room-card ${buildType === id ? "chosen" : ""}" data-action="choose:${id}"><span class="room-swatch" style="background:${r.color}">${{ office: "▤", research: "✧", maintenance: "⚒", restroom: "WC", break: "☕", management: "↗" }[id as RoomType]}</span><span><b>${r.name}</b><small>${r.description}</small></span><strong>${money(r.cost)}</strong></button>`,
      )
      .join(
        "",
      )}</div><div class="two">${button("＋ Floor · " + money(economy.floorCost + game.floors * 150), "floor")}${button("↕ Extend lift · $350", "lift")}</div><p class="footnote">${game.floors} / ${game.tech.includes("height") ? 8 : 4} floors · elevator serves ${game.liftTop + 1}. Drag the scene to reach upper floors.</p>`;
  }
  if (tab === "staff") {
    html = heading(
      "THE PEOPLE MAKE THE PLACE",
      "Your team",
      `Salaries are charged throughout the day. Hire specialists into their matching rooms.`,
    );
    html += `<div class="cards">${Object.entries(roles)
      .map(
        ([id, r]) =>
          `<div class="list-row"><span class="avatar" style="background:${r.color}">♙</span><div><b>${r.name}</b><small>${rooms[r.room].name} · $${r.salary}/day</small></div>${button("$" + r.cost + " +", "hire:" + id)}</div>`,
      )
      .join(
        "",
      )}</div><h3>On the payroll · ${game.staff.length}</h3>${game.staff.map((p) => `<button class="staff-row" data-action="person:${p.id}"><span class="avatar" style="background:${roles[p.role].color}">♙</span><span><b>${escape(p.name)}</b><small>${roles[p.role].name} · ${p.state}</small></span><span>${Math.round(p.happy)}% ☺</span></button>`).join("") || "<p>No colleagues yet. Build a studio to get started.</p>"}`;
  }
  if (tab === "research") {
    html = heading(
      "SMALL IDEAS. BIG DIFFERENCE.",
      "Research & development",
      `Your researchers have generated ${game.points.toFixed(1)} available points. Hire them in an Ideas lab.`,
    );
    html += techs
      .map((t) => {
        const done = game.tech.includes(t.id);
        return `<article class="tech"><div><b>${done ? "✓ " : ""}${t.name}</b><small>${t.description}</small>${t.requires ? `<small>Requires: ${techs.find((q) => q.id === t.requires)!.name}</small>` : ""}</div>${button(done ? "Learned" : t.cost + " RP", "tech:" + t.id, done ? "complete" : "secondary", done || game.points < t.cost || (!!t.requires && !game.tech.includes(t.requires)))}</article>`;
      })
      .join("");
  }
  if (tab === "objectives") {
    html =
      heading(
        "ONE GOOD STEP AT A TIME",
        "Your next milestones",
        `${game.claimed.length} of ${objectives.length} complete. Rewards are paid automatically; earlier actions count.`,
      ) +
      objectives
        .map(
          (o, i) =>
            `<article class="objective ${game.claimed.includes(i) ? "done" : ""}"><span>${game.claimed.includes(i) ? "✓" : String(i + 1).padStart(2, "0")}</span><div><b>${o[0]}</b><small>${o[1]}</small></div><strong>+$${o[2]}</strong></article>`,
        )
        .join("");
  }
  if (tab === "finances") {
    html = heading(
      "A HEALTHY BOTTOM LINE",
      "The company books",
      "Income includes earned objective rewards. Hiring, construction, upgrades and refunds are in investments.",
    );
    const r = game.report;
    html += `<div class="finance-total"><small>LIFETIME BUTTON REVENUE</small><strong>${money(game.lifetime)}</strong><span>${game.presses.toLocaleString()} actual button presses</span></div><h3>Day ${game.day} · in progress</h3><div class="ledger"><span>Revenue & rewards</span><b>${money(r.income)}</b><span>Salaries</span><b>−${money(r.salaries)}</b><span>Investments (net)</span><b>−${money(r.construction)}</b><strong>Net change</strong><strong>${money(r.net)}</strong></div><h3>Previous days</h3>${
      game.history
        .slice()
        .reverse()
        .map(
          (r) =>
            `<div class="list-row"><b>Day ${r.day}</b><small>In ${money(r.income)} · salaries ${money(r.salaries)} · investments ${money(r.construction)}</small><strong>${money(r.net)}</strong></div>`,
        )
        .join("") || "<p>Your first report closes at midnight.</p>"
    }`;
  }
  if (tab === "settings") {
    html = heading("TAKE A MOMENT", "Settings & field guide");
    html += `<p><b>A little office. Big ambitions.</b></p><p>Build a Button studio and hire 2–4 button pushers. Their individual presses earn money between 08:00 and 18:00. Salaries continue overnight.</p><p>Build a workshop for IT repairs and night janitors. Amenities support morale. A lab unlocks research. Add floors, then extend the elevator before building upstairs.</p><p>Tap an occupied room to inspect it and manage its employees. Drag to pan; pinch or scroll to zoom. Use ↑ to see the top floor.</p><p>Progress saves every 10 seconds. No offline income. Audio is not included in this build.</p><p class="footnote">${saveStatus} · version 0.1.0</p><div class="two">${button("Save now", "save", "primary")}${button("New company", "reset")}</div>`;
  }
  if (tab === "room") {
    const r = game.rooms.find((r) => r.id === selected);
    if (!r) {
      tab = "";
      renderPanel();
      return;
    }
    const people = game.staff.filter((p) => p.room === r.id);
    html = heading(
      `FLOOR ${r.floor + 1} · SUITE ${r.slot + 1}`,
      rooms[r.type].name,
      rooms[r.type].description,
    );
    html += `<div class="room-stats"><span>Tier <b>${r.level}</b></span><span>Cleanliness <b>${Math.round(100 - r.dirt)}%</b></span><span>Faults <b>${r.broken.length}</b></span></div><div class="two">${r.type === "office" ? button("Upgrade · " + money(450 * r.level), "upgrade:" + r.id) : ""}${button("Demolish · 35% refund", "demolish:" + r.id)}</div><h3>Assigned colleagues · ${people.length}/${rooms[r.type].capacity}</h3>${people.map((p) => `<button class="staff-row" data-action="person:${p.id}"><span class="avatar" style="background:${roles[p.role].color}">♙</span><span><b>${escape(p.name)} · Lv.${p.level}</b><small>${p.state} · ${Math.round(p.happy)}% happiness</small></span><span>→</span></button>`).join("")}${Object.entries(
      roles,
    )
      .filter(([, d]) => d.room === r.type)
      .map(([role, d]) =>
        button(
          "Hire " + d.name + " · $" + d.cost,
          "hireRoom:" + role + ":" + r.id,
        ),
      )
      .join("")}`;
  }
  if (tab.startsWith("person:")) {
    const p = game.staff.find((p) => p.id === Number(tab.split(":")[1]));
    if (!p) {
      tab = "staff";
      renderPanel();
      return;
    }
    html = heading(roles[p.role].name.toUpperCase(), escape(p.name));
    html += `<div class="profile"><span class="avatar" style="background:${roles[p.role].color}">♙</span><h3>Level ${p.level} · ${Math.round(p.happy)}% happy</h3><p>${p.state}</p><p>Salary ${money(roles[p.role].salary * (1 + (p.level - 1) * 0.45))}/day<br>Personal button presses: ${p.presses}<br>Productivity: ${Math.round((0.5 + p.happy / 200) * (1 + (p.level - 1) * 0.25) * 100)}%</p></div><div class="two">${button("Promote · $" + p.level * 240, "promote:" + p.id)}${button("Dismiss employee", "dismiss:" + p.id)}</div>`;
  }
  panel.innerHTML = html;
}
function escape(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
app.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!target) return;
  if (target.dataset.tab) {
    tab = tab === target.dataset.tab ? "" : target.dataset.tab;
    renderPanel();
    return;
  }
  if (target.dataset.speed !== undefined) {
    speed = Number(target.dataset.speed);
    hud();
    return;
  }
  const a = target.dataset.action;
  if (!a) return;
  const [type, arg, arg2] = a.split(":");
  if (type === "close") {
    tab = "";
    renderPanel();
    return;
  }
  if (type === "choose") {
    buildType = arg as RoomType;
    renderPanel();
    return;
  }
  if (type === "person") {
    tab = "person:" + arg;
    renderPanel();
    return;
  }
  action(() => {
    switch (type) {
      case "floor":
        if (addFloor(game)) tower.focus(game.floors - 1);
        break;
      case "lift":
        extendLift(game);
        break;
      case "hire":
        hire(game, arg as Role);
        break;
      case "hireRoom":
        hire(game, arg as Role, Number(arg2));
        break;
      case "tech":
        research(game, arg);
        break;
      case "upgrade":
        upgrade(game, Number(arg));
        break;
      case "promote":
        promote(game, Number(arg));
        break;
      case "demolish":
        if (
          confirm(
            "Demolish this room for a 35% refund? Occupied rooms cannot be demolished.",
          )
        )
          demolish(game, Number(arg));
        break;
      case "dismiss":
        if (confirm("Dismiss this colleague? No refund is given.")) {
          game.staff = game.staff.filter((p) => p.id !== Number(arg));
          game.lift.passengers = game.lift.passengers.filter(
            (id) => id !== Number(arg),
          );
          tab = "staff";
        }
        break;
      case "save":
        save();
        game.message = "Your company has been saved.";
        break;
      case "reset":
        if (confirm("Permanently replace this company?")) {
          game = fresh();
          el("title").hidden = false;
          started = false;
          tab = "";
        }
        break;
    }
  });
});
tower.onSelect = (floor, slot) => {
  if (!started || slot < 0 || slot > 2 || floor < 0 || floor >= game.floors)
    return;
  const room = game.rooms.find((r) => r.floor === floor && r.slot === slot);
  if (room) {
    selected = room.id;
    tower.selected = room.id;
    tab = "room";
    renderPanel();
  } else {
    if (tab === "build") action(() => build(game, buildType, floor, slot));
    else {
      tab = "build";
      renderPanel();
    }
  }
};
el("zoom-in").onclick = () => tower.setZoom(tower.zoom * 1.2);
el("zoom-out").onclick = () => tower.setZoom(tower.zoom / 1.2);
el("home-view").onclick = () => {
  tower.panX = 0;
  tower.panY = 0;
  tower.resize();
};
el("up").onclick = () => tower.focus(game.floors - 1);
el("rotate").querySelector("button")!.onclick = () => el("rotate").remove();
function hud() {
  el("company").textContent = game.name;
  el("cash").textContent = money(game.cash);
  el("cash").classList.toggle("negative", game.cash < 0);
  el("profit").textContent =
    (game.report.net >= 0 ? "+" : "") + money(game.report.net);
  el("people").textContent =
    game.staff.length +
    " · " +
    Math.round(
      game.staff.length
        ? game.staff.reduce((n, p) => n + p.happy, 0) / game.staff.length
        : 82,
    ) +
    "% ☺";
  const h = hour(game);
  el("day").textContent =
    `DAY ${String(game.day).padStart(2, "0")} · ${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
  const next = objectives.find((_, i) => !game.claimed.includes(i));
  el("goal").textContent = next ? next[0] : "A company worth working for";
  el("goal-sub").textContent = next ? next[1] : "Keep building your story.";
  el("goal-progress").style.width =
    (game.claimed.length / objectives.length) * 100 + "%";
  el("scene-time").textContent =
    h >= 8 && h < 18
      ? "Good work is happening."
      : h >= 18
        ? "Clocking out. The night crew is taking over."
        : "A fresh start is just around the corner.";
  document
    .querySelectorAll("[data-speed]")
    .forEach((b) =>
      b.classList.toggle(
        "active",
        Number((b as HTMLElement).dataset.speed) === speed,
      ),
    );
  if (game.message !== lastMessage) {
    lastMessage = game.message;
    el("toast").textContent = lastMessage;
    el("toast").classList.add("show");
    setTimeout(() => el("toast").classList.remove("show"), 5500);
  }
}
// Attract mode is a separate, non-saved company.
const demo = fresh("GOOD COMPANY");
demo.floors = 3;
demo.liftTop = 2;
demo.cash = 100000;
for (let f = 0; f < 3; f++)
  for (let s = 0; s < 3; s++) {
    const type: RoomType =
      f === 0
        ? s === 1
          ? "break"
          : "office"
        : f === 1
          ? s === 0
            ? "research"
            : s === 2
              ? "maintenance"
              : "office"
          : s === 0
            ? "management"
            : s === 1
              ? "office"
              : "restroom";
    build(demo, type, f, s);
  }
for (let i = 0; i < 13; i++) hire(demo, "worker");
for (let i = 0; i < 2; i++) hire(demo, "researcher");
hire(demo, "it");
hire(demo, "supervisor");
demo.time = 100;
for (const p of demo.staff) {
  const r = demo.rooms.find((r) => r.id === p.room)!;
  p.floor = r.floor;
  p.x =
    390 +
    r.slot * 240 +
    demo.staff
      .filter((q) => q.room === p.room)
      .findIndex((q) => q.id === p.id) *
      51;
}
let prev = performance.now(),
  hudTime = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  accumulator += dt * (started ? speed : 1);
  while (accumulator >= 0.1) {
    tick(started ? game : demo, 0.1);
    accumulator -= 0.1;
  }
  tower.draw(started ? game : demo, dt);
  hudTime += dt;
  if (hudTime > 0.5 && started) {
    hud();
    hudTime = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => {
  if (started) save();
}, 10000);
setInterval(() => {
  if (started && ["research", "finances", "staff"].includes(tab)) {
    const scroll = panel.scrollTop;
    renderPanel();
    panel.scrollTop = scroll;
  }
}, 2000);
window.addEventListener("pagehide", () => {
  if (started) save();
});
