import { rooms, roles, economy } from "./config";
import {
  hour,
  deskLeft,
  deskStand,
  buttonPoint,
  binPoint,
  type Game,
  type Room,
  type Person,
} from "./sim";
export const ROOM_W = 240,
  FLOOR_H = 150,
  GROUND = 800;
export function roomX(r: Room) {
  return 365 + r.slot * 240;
}
export function floorY(f: number) {
  return GROUND - (f + 1) * FLOOR_H;
}
export class Tower {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  zoom = 1;
  panX = 0;
  panY = 0;
  width = 0;
  height = 0;
  clock = 0;
  lastGame: Game | null = null;
  lastEvent = 0;
  popups = new Map<number, { pending: number; last: number }>();
  pose = new Map<number, { x: number; floor: number; cycle: number }>();
  renderedGame: Game | null = null;
  simulationSpeed = 1;
  currentGame: Game | null = null;
  floating: { x: number; y: number; age: number; value: number }[] = [];
  selected: number | null = null;
  buildMode = false;
  pointer = new Map<number, { x: number; y: number }>();
  lastDistance = 0;
  dragged = false;
  down = { x: 0, y: 0 };
  onSelect: (floor: number, slot: number, person?: number) => void = () => {};
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(-e.deltaY * 0.001));
      },
      { passive: false },
    );
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointer.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.down = { x: e.clientX, y: e.clientY };
      this.dragged = false;
      this.lastDistance = 0;
    });
    canvas.addEventListener("pointermove", (e) => {
      const old = this.pointer.get(e.pointerId);
      if (!old) return;
      this.pointer.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointer.size === 2) {
        const [a, b] = [...this.pointer.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.lastDistance)
          this.setZoom((this.zoom * d) / this.lastDistance);
        this.lastDistance = d;
        this.dragged = true;
      } else {
        const dx = e.clientX - old.x,
          dy = e.clientY - old.y;
        this.panX += dx;
        this.panY += dy;
        if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6)
          this.dragged = true;
      }
    });
    canvas.addEventListener("pointerup", (e) => {
      this.pointer.delete(e.pointerId);
      if (!this.dragged) {
        const rect = canvas.getBoundingClientRect();
        const x =
          (e.clientX - rect.left - this.width / 2 - this.panX) / this.zoom +
          690;
        const y =
          (e.clientY - rect.top - this.height * 0.69 - this.panY) / this.zoom +
          GROUND;
        this.onSelect(
          Math.floor((GROUND - y) / FLOOR_H),
          Math.floor((x - 365) / 240),
        );
      }
    });
    canvas.addEventListener("pointercancel", (e) =>
      this.pointer.delete(e.pointerId),
    );
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width;
    this.height = r.height;
    const d = Math.min(devicePixelRatio, 2);
    this.canvas.width = r.width * d;
    this.canvas.height = r.height * d;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    if (!this.panY) this.zoom = Math.min(1.2, Math.max(0.5, r.height / 530));
  }
  setZoom(z: number) {
    this.zoom = Math.max(0.35, Math.min(2, z));
  }
  focus(f: number) {
    this.panY = (f * 0.7 + 0.5) * FLOOR_H * this.zoom;
    this.panX = 0;
  }
  draw(g: Game, delta: number, speed = 1) {
    this.simulationSpeed = speed;
    this.currentGame = g;
    if (this.renderedGame !== g) {
      this.pose.clear();
      this.renderedGame = g;
    }
    const ids = new Set(g.staff.map((p) => p.id));
    for (const id of this.pose.keys()) if (!ids.has(id)) this.pose.delete(id);
    for (const p of g.staff) {
      const prev = this.pose.get(p.id) ?? {
        x: p.x,
        floor: p.floor,
        cycle: p.cycle,
      };
      // Frame-rate-independent easing removes fixed-step position jumps; contact poses remain exact at desks.
      const a = 1 - Math.exp(-delta * 30);
      const atDesk =
        p.state === "Pushing buttons" ||
        p.state === "Repairing computer" ||
        p.state === "Emptying bin";
      prev.x = atDesk ? p.x : prev.x + (p.x - prev.x) * a;
      prev.floor += (p.floor - prev.floor) * a;
      prev.cycle = p.cycle;
      this.pose.set(p.id, prev);
    }
    this.clock += speed === 0 ? 0 : delta;
    const c = this.ctx,
      W = this.width,
      H = this.height;
    const night = hour(g) < 6 || hour(g) >= 19;
    c.clearRect(0, 0, W, H);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, night ? "#1d354d" : "#a9d9d6");
    sky.addColorStop(1, night ? "#576478" : "#f4e8cf");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);
    c.fillStyle = night ? "#e5ddb9" : "#fff1c1";
    c.beginPath();
    c.arc(W * 0.83, H * 0.19, 33, 0, 7);
    c.fill();
    // Soft distant city, clouds and a foreground avenue.
    for (let i = 0; i < 16; i++) {
      const x = (i * W) / 13 - 70;
      const h = 65 + ((i * 47) % 130);
      this.box(x, H * 0.77 - h, 58, h, night ? "#30485c" : "#94bcba", 3);
      c.fillStyle = night ? "#66818a" : "#c6d8cc";
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 3; k++)
          c.fillRect(x + 9 + j * 12, H * 0.77 - h + 14 + k * 22, 5, 9);
    }
    c.fillStyle = night ? "#526a68" : "#c5d2b1";
    c.fillRect(0, H * 0.77, W, H * 0.23);
    this.box(0, H * 0.86, W, 30, night ? "#5a6868" : "#b8c2ae");
    c.strokeStyle = "#e9e6cc";
    c.setLineDash([25, 25]);
    c.beginPath();
    c.moveTo(0, H * 0.89);
    c.lineTo(W, H * 0.89);
    c.stroke();
    c.setLineDash([]);
    c.save();
    c.translate(W / 2 + this.panX, H * 0.69 + this.panY);
    c.scale(this.zoom, this.zoom);
    c.translate(-690, -GROUND);
    // Trees, pavement, sign and tower shell.
    this.box(170, GROUND + 14, 1070, 18, "#85978a", 5);
    for (const x of [215, 1190]) {
      this.box(x, GROUND - 40, 10, 55, "#857766");
      this.ellipse(x + 5, GROUND - 63, 32, 42, "#699583");
      this.ellipse(x - 11, GROUND - 48, 24, 28, "#7da88c");
    }
    const top = floorY(g.floors - 1);
    this.box(303, top - 15, 795, g.floors * FLOOR_H + 23, "#24484c", 7);
    this.box(310, top - 21, 795, 12, "#edf0df", 3);
    this.box(312, top, 45, g.floors * FLOOR_H, "#597579");
    for (let f = 0; f < g.floors; f++) {
      const y = floorY(f);
      this.box(317, y + 8, 34, 130, "#314e55");
      c.strokeStyle = "#8ba2a0";
      c.beginPath();
      c.moveTo(325, y + 5);
      c.lineTo(325, y + 145);
      c.moveTo(344, y + 5);
      c.lineTo(344, y + 145);
      c.stroke();
      this.label(String(f + 1).padStart(2, "0"), 286, y + 76, "#4d7777", 14);
      for (let s = 0; s < 3; s++) {
        const r = g.rooms.find((r) => r.floor === f && r.slot === s);
        if (r) this.room(r, night);
        else {
          const x = 365 + s * 240;
          this.box(x, y + 5, 232, 137, "#d9dfce");
          c.strokeStyle = "#b0c1b3";
          c.setLineDash([5, 5]);
          c.strokeRect(x + 12, y + 17, 208, 111);
          c.setLineDash([]);
          this.label("+", x + 113, y + 79, "#779a90", 30);
          this.label(
            f > g.liftTop ? "CONNECT ELEVATOR" : "AVAILABLE SPACE",
            x + 116,
            y + 110,
            "#79958b",
            9,
            "center",
          );
        }
      }
      this.box(357, y + 142, 738, 8, "#3b5a59");
    }
    const ly = GROUND - (g.lift.y + 1) * 150 + 41;
    this.box(316, ly, 36, 96, "#db9a56", 3);
    this.box(320, ly + 6, 28, 77, "#eed7a4", 2);
    this.box(333, ly + 6, 2, 77, "#b98c54");
    this.label(
      String(Math.round(g.lift.y) + 1),
      334,
      ly + 94,
      "#493d31",
      9,
      "center",
    );
    this.box(555, top - 63, 360, 41, "#285557", 7);
    this.label(g.name.toUpperCase(), 735, top - 37, "#f9e8b2", 17, "center");
    for (const p of g.staff) {
      if (p.state === "Off shift" || p.state === "Riding elevator") continue;
      this.person(p);
    }
    const visible = g.staff.filter((p) => p.state === "Riding elevator");
    visible
      .slice(0, 3)
      .forEach((p, i) =>
        this.person({ ...p, x: 322 + i * 10, floor: g.lift.y }, 0.55),
      );
    this.box(444, GROUND + 1, 265, 15, "#e5d8b7", 2);
    this.box(459, GROUND + 16, 235, 10, "#c4bfa9", 2);
    this.label(
      "A LITTLE OFFICE. BIG AMBITIONS.",
      835,
      GROUND + 33,
      "#456965",
      10,
      "center",
    );
    if (this.lastGame !== g) {
      this.lastGame = g;
      this.lastEvent = g.eventId;
      this.floating = [];
      this.popups.clear();
    }
    for (const event of g.events) {
      if (event.id <= this.lastEvent) continue;
      const q = this.popups.get(event.room) ?? { pending: 0, last: -10 };
      q.pending += event.value;
      this.popups.set(event.room, q);
    }
    for (const [id, q] of this.popups) {
      if (q.pending <= 0 || this.clock - q.last < 0.8) continue;
      const r = g.rooms.find((r) => r.id === id);
      if (r)
        this.floating.push({
          x: roomX(r) + 115,
          y: floorY(r.floor) + 43,
          age: 0,
          value: q.pending,
        });
      q.pending = 0;
      q.last = this.clock;
    }
    this.lastEvent = g.eventId;
    for (const f of this.floating) {
      f.age += delta;
      c.globalAlpha = Math.max(0, 1 - f.age / 1.8);
      this.label(
        "+$" + f.value.toFixed(1),
        f.x,
        f.y - f.age * 22,
        "#347b57",
        13,
        "center",
      );
    }
    c.globalAlpha = 1;
    this.floating = this.floating.filter((f) => f.age < 1.6).slice(-36);
    c.restore();
  }
  box(x: number, y: number, w: number, h: number, color: string, r = 0) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
  }
  ellipse(x: number, y: number, w: number, h: number, color: string) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    c.fill();
  }
  label(
    t: string,
    x: number,
    y: number,
    color: string,
    size = 12,
    align: CanvasTextAlign = "left",
  ) {
    const c = this.ctx;
    c.fillStyle = color;
    c.font = `${size >= 15 ? "700" : "600"} ${size}px system-ui`;
    c.textAlign = align;
    c.fillText(t, x, y);
  }
  plant(x: number, y: number) {
    this.box(x - 7, y - 12, 14, 14, "#cf8e62", 3);
    this.ellipse(x, y - 22, 5, 15, "#559879");
    this.ellipse(x - 8, y - 22, 5, 10, "#78ab82");
    this.ellipse(x + 7, y - 27, 5, 11, "#649c75");
  }
  room(r: Room, night: boolean) {
    const x = roomX(r),
      y = floorY(r.floor),
      color = rooms[r.type].color;
    this.box(x, y + 4, 232, 138, color);
    this.box(x, y + 111, 232, 31, "#d2b48c");
    this.box(x, y + 108, 232, 4, "#ae9477");
    for (let k = 0; k < 3; k++) {
      this.box(
        x + 18 + k * 72,
        y + 24,
        54,
        58,
        night ? "#667b89" : "#d8eee3",
        3,
      );
      this.box(x + 22 + k * 72, y + 28, 46, 4, night ? "#a6a68f" : "#f2f8e9");
      this.box(x + 43 + k * 72, y + 24, 3, 58, "#f8edda");
      this.box(x + 18 + k * 72, y + 80, 54, 5, "#eee4c9");
    }
    this.label(rooms[r.type].name.toUpperCase(), x + 12, y + 17, "#685d50", 8);
    this.plant(x + 216, y + 114);
    if (r.type === "office" || r.type === "research") {
      for (let i = 0; i < (r.type === "office" ? 4 : 3); i++) {
        const dx = deskLeft(r, i);
        this.box(dx + 8, y + 95, 16, 24, "#677a78", 5);
        this.box(dx, y + 87, 47, 6, r.level > 1 ? "#6c8584" : "#9f785a", 2);
        this.box(dx + 3, y + 93, 3, 29, "#786756");
        this.box(dx + 40, y + 93, 3, 29, "#786756");
        this.box(dx + 11, y + 60, 28, 23, "#3d5b61", 3);
        this.box(
          dx + 14,
          y + 63,
          22,
          16,
          r.broken.includes(i)
            ? "#d37e6b"
            : r.type === "research"
              ? "#b7a5e2"
              : "#a5d9cd",
          2,
        );
        this.box(dx + 23, y + 82, 4, 5, "#536d6c");
        this.box(dx + 8, y + 85, 17, 2, "#eedbaf");
        const worker = this.currentGame?.staff.find(
          (p) => p.room === r.id && p.desk === i && p.role === "worker",
        );
        const pressed =
          worker?.state === "Pushing buttons" &&
          worker.cycle >= economy.contactPhase &&
          worker.cycle < economy.contactPhase + 0.12;
        this.box(dx + 31, y + 82, 10, 4, "#8c5547", 2);
        this.ellipse(
          dx + 36,
          y + 81 + (pressed ? 3 : 0),
          5,
          pressed ? 1 : 2,
          pressed ? "#ffcf70" : "#e77250",
        );
        // Every paper animation follows a credited contact, never a wall-clock timer.
        if (
          worker &&
          worker.state === "Pushing buttons" &&
          worker.cycle >= economy.contactPhase
        ) {
          const t =
            (worker.cycle - economy.contactPhase) / (1 - economy.contactPhase);
          this.box(dx + 31 + t * 10, y + 69 + t * 50, 8, 5, "#fff8dc", 1);
        }
        const fill = Math.min(1, r.waste[i] / economy.binCapacity);
        this.box(dx + 35, y + 118, 13, 18, "#688681", 2);
        this.box(dx + 37, y + 134 - fill * 14, 9, fill * 14, "#f5edcf", 1);
        this.box(dx + 34, y + 117, 15, 3, "#557770", 1);
        if (r.waste[i] > economy.binCapacity) {
          this.box(dx + 33, y + 113, 7, 4, "#fff1cf");
          this.box(dx + 42, y + 111, 7, 5, "#fff1cf");
        }
        const cleaner = this.currentGame?.staff.find(
          (p) =>
            p.task?.kind === "clean" &&
            p.task.room === r.id &&
            p.task.desk === i &&
            p.state === "Emptying bin",
        );
        if (cleaner) {
          this.label("↻", dx + 41, y + 109, "#4b886d", 13, "center");
          this.box(
            dx + 32,
            y + 138,
            17 * (cleaner.task!.progress / economy.cleanSeconds),
            2,
            "#77b387",
          );
        }
        const repair = this.currentGame?.staff.find(
          (p) =>
            p.task?.kind === "repair" &&
            p.task.room === r.id &&
            p.task.desk === i &&
            p.state === "Repairing computer",
        );
        if (repair) {
          this.box(dx + 11, y + 57, 28, 2, "#9f7661");
          this.box(
            dx + 11,
            y + 57,
            28 * (repair.task!.progress / economy.repairSeconds),
            2,
            "#f2d28b",
          );
        }
        if (r.broken.includes(i))
          this.label("!", dx + 24, y + 76, "#fff1d2", 13, "center");
      }
      if (r.level > 1) {
        this.box(x + 168, y + 27, 32, 22, "#a77e44", 2);
        this.label(
          "★".repeat(r.level - 1),
          x + 184,
          y + 43,
          "#fff0bd",
          11,
          "center",
        );
      }
    }
    if (r.type === "break") {
      this.box(x + 22, y + 83, 91, 27, "#db815f", 6);
      this.box(x + 25, y + 70, 85, 25, "#e29570", 7);
      this.box(x + 60, y + 111, 65, 6, "#9b745a", 3);
      this.box(x + 144, y + 59, 34, 54, "#7e9d93", 3);
      this.box(x + 148, y + 63, 26, 24, "#b9d9cb", 2);
      this.label("☕", x + 153, y + 100, "#fff2d1", 15);
      this.ellipse(x + 88, y + 107, 19, 5, "#f6e1b7");
    }
    if (r.type === "restroom") {
      for (let i = 0; i < 3; i++) {
        this.box(x + 15 + i * 65, y + 36, 51, 76, "#78ada7", 3);
        this.box(x + 20 + i * 65, y + 41, 41, 65, "#a4cebf", 2);
        this.ellipse(x + 51 + i * 65, y + 77, 2, 2, "#fff0ca");
      }
      this.label("WC", x + 110, y + 29, "#43706e", 12);
    }
    if (r.type === "maintenance") {
      this.box(x + 17, y + 49, 83, 56, "#6d999c", 3);
      for (let i = 0; i < 4; i++)
        this.box(x + 22, y + 56 + i * 11, 71, 3, "#b9d4cc");
      this.box(x + 125, y + 78, 68, 9, "#a67854");
      this.box(x + 130, y + 88, 5, 29, "#786c55");
      this.box(x + 182, y + 88, 5, 29, "#786c55");
      this.box(x + 143, y + 50, 21, 26, "#e0ae5b", 2);
      this.label("⚒", x + 148, y + 70, "#5d6b62", 16);
    }
    if (r.type === "management") {
      this.box(x + 37, y + 85, 134, 9, "#a27655", 4);
      this.box(x + 45, y + 94, 5, 29, "#7f694e");
      this.box(x + 160, y + 94, 5, 29, "#7f694e");
      this.box(x + 92, y + 57, 36, 27, "#415a60", 3);
      this.box(x + 96, y + 61, 28, 18, "#bbd8c4");
      this.box(x + 20, y + 33, 26, 26, "#f4e0aa", 3);
      this.label("↗", x + 26, y + 54, "#5e8c80", 20);
    }
    if (r.dirt > 25)
      for (let i = 0; i < Math.floor(r.dirt / 12); i++)
        this.box(
          x + 16 + ((i * 41) % 195),
          y + 125 + (i % 2) * 5,
          5,
          3,
          "#987b65",
        );
    if (this.selected === r.id) {
      const c = this.ctx;
      c.strokeStyle = "#fff8dc";
      c.lineWidth = 3;
      c.strokeRect(x + 2, y + 6, 228, 134);
      c.lineWidth = 1;
    }
  }
  person(p: Person, scale = 1) {
    const c = this.ctx,
      pose = this.pose.get(p.id);
    const riding = scale !== 1;
    const x = riding ? p.x : (pose?.x ?? p.x),
      floor = riding ? p.floor : (pose?.floor ?? p.floor);
    const walking = /Walking|Arriving|Leaving/.test(p.state);
    const phase =
      this.clock * Math.min(22, 9 * Math.sqrt(this.simulationSpeed || 1)) +
      p.id;
    const stride = walking ? Math.sin(phase) : 0;
    const bob = walking ? Math.abs(stride) * 1.3 : 0;
    const y = GROUND - floor * 150 - 22;
    c.save();
    c.translate(x, y - bob);
    c.scale(scale * (walking ? p.direction : 1), scale);
    const skin = ["#e6b186", "#b77d5d", "#f3c59c", "#80563f"][p.id % 4],
      outfit = roles[p.role].color;
    this.ellipse(0, 3, 9, 2, "#6f6c5144");
    // Articulated legs: opposing stride and a grounded foot, rather than sliding rectangles.
    const line = (points: number[][], color: string, width: number) => {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      points.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b)));
      c.stroke();
    };
    line(
      [
        [-4, -19],
        [-5 + stride * 4, -10],
        [-6 + stride * 7, 0],
      ],
      "#3e5960",
      4,
    );
    line(
      [
        [3, -19],
        [4 - stride * 4, -10],
        [5 - stride * 7, 0],
      ],
      "#49646a",
      4,
    );
    this.box(-9 + stride * 7, -1, 7, 3, "#30484f", 1);
    this.box(2 - stride * 7, -1, 7, 3, "#30484f", 1);
    this.box(-8, -44, 17, 27, outfit, 5);
    this.box(-3, -44, 6, 6, "#f8ecd2", 1);
    this.ellipse(0, -54, 9, 10, skin);
    this.ellipse(-1, -61, 9, 5, ["#50443b", "#866347", "#383d3b"][p.id % 3]);
    this.box(4, -55, 2, 2, "#374548");
    line(
      [
        [4, -49],
        [7, -49],
      ],
      "#9c6349",
      1,
    );
    let hand = { x: 9 + stride * 5, y: -26 },
      elbow = { x: 13, y: -32 };
    if (p.state === "Pushing buttons") {
      const phase = p.cycle;
      // Anticipation -> extension -> exact contact -> short hold -> recovery.
      let reach =
        phase < 0.34
          ? 0
          : phase < economy.contactPhase
            ? (phase - 0.34) / (economy.contactPhase - 0.34)
            : phase < 0.77
              ? 1
              : 1 - (phase - 0.77) / 0.23;
      reach = Math.max(0, Math.min(1, reach));
      reach = reach * reach * (3 - 2 * reach);
      const home = this.currentGame!.rooms.find((r) => r.id === p.room)!;
      const contact = buttonPoint(home, p.desk);
      hand = {
        x: 9 + (contact.x - p.x - 9) * reach,
        y: -26 + (contact.y - y + 26) * reach,
      };
      elbow = { x: 15, y: -32 - reach * 5 };
    } else if (p.state === "Repairing computer") {
      hand = { x: 2 + Math.sin(this.clock * 10) * 2, y: -62 };
      elbow = { x: 12, y: -49 };
      line(
        [
          [hand.x, hand.y - 1],
          [hand.x + 5, hand.y - 9],
        ],
        "#536b70",
        3,
      );
      this.ellipse(hand.x + 6, hand.y - 11, 4, 3, "#eed08e");
    } else if (p.state === "Emptying bin") {
      hand = { x: 15, y: -16 + Math.sin(this.clock * 8) * 3 };
      elbow = { x: 15, y: -26 };
      line(
        [
          [hand.x, hand.y],
          [hand.x + 3, 1],
        ],
        "#a48656",
        2,
      );
      this.box(hand.x - 2, 0, 14, 4, "#71a398", 2);
      this.box(-17, -10, 13, 13, "#51776e", 2);
    } else if (p.role === "janitor") {
      line(
        [
          [12, -28],
          [15, 1],
        ],
        "#a48656",
        2,
      );
      this.box(10, 0, 12, 4, "#71a398", 2);
    }
    line(
      [
        [6, -39],
        [elbow.x, elbow.y],
        [hand.x, hand.y],
      ],
      skin,
      4,
    );
    this.ellipse(hand.x, hand.y, 2.5, 2.5, skin);
    if (p.state === "Computer broken")
      this.label("!", 0, -74, "#b45c49", 17, "center");
    else if (p.happy < 50) this.label("…", 0, -74, "#ac6854", 15, "center");
    c.restore();
  }
}
