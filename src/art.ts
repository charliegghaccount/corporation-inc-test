import { rooms, roles } from "./config";
import { hour, type Game, type Room, type Person } from "./sim";
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
  draw(g: Game, delta: number) {
    this.clock += delta;
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
    }
    for (const event of g.events) {
      if (event.id <= this.lastEvent) continue;
      const r = g.rooms.find((r) => r.id === event.room);
      if (r && event.id % 3 === 0)
        this.floating.push({
          x: roomX(r) + 40 + (event.id % 4) * 42,
          y: floorY(r.floor) + 44,
          age: 0,
          value: event.value,
        });
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
    this.floating = this.floating.filter((f) => f.age < 1.8);
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
        const dx = x + 14 + i * 51;
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
        this.ellipse(dx + 36, y + 84, 3, 2, "#dc714e");
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
    const c = this.ctx;
    const y = GROUND - p.floor * 150 - 18,
      x = p.x;
    const walking = /Walking|Arriving|Leaving/.test(p.state);
    const bounce = walking
      ? Math.sin(this.clock * 11 + p.id) * 2
      : Math.sin(this.clock * 3 + p.id) * 0.6;
    c.save();
    c.translate(x, y + bounce);
    c.scale(scale, scale);
    const skin = ["#e6b186", "#b77d5d", "#f3c59c", "#80563f"][p.id % 4];
    const outfit = roles[p.role].color;
    this.ellipse(0, 4, 9, 3, "#907b6244");
    this.box(-5, -12, 4, 14, "#425b62", 2);
    this.box(2, -12, 4, 14, "#425b62", 2);
    if (walking) {
      this.box(-5 + Math.sin(this.clock * 12) * 3, 0, 6, 3, "#334b50", 1);
      this.box(2 - Math.sin(this.clock * 12) * 3, 0, 6, 3, "#334b50", 1);
    }
    this.box(-8, -31, 16, 21, outfit, 5);
    this.box(-3, -31, 6, 5, "#eee5cf", 1);
    this.ellipse(0, -40, 8, 10, skin);
    this.ellipse(-1, -46, 8, 5, ["#50443b", "#866347", "#383d3b"][p.id % 3]);
    this.box(4, -41, 2, 2, "#374548");
    const press =
      p.state === "Pushing buttons" ? Math.sin(this.clock * 9 + p.id) * 3 : 0;
    this.box(5, -25, 13, -4 + press, skin, 2);
    if (p.role === "janitor") {
      this.box(13, -25, 2, 31, "#987a4d");
      this.box(8, 3, 14, 4, "#679b91", 2);
    }
    if (p.state === "Computer broken")
      this.label("!", 0, -59, "#b45c49", 17, "center");
    else if (p.happy < 50) this.label("…", 0, -59, "#ac6854", 15, "center");
    if (p.state === "Pushing buttons" && p.timer < 0.45) {
      this.label("+$", 7, -57, "#427c62", 10);
    }
    c.restore();
  }
}
