import { device } from "@shared/device";
import type { DisplayDrawParams } from "@busy-app/busy-lib";
import manifest from "./appmeta/manifest.json";
import { RAVEN_FRAMES, RAVEN_PERCHED, RAVEN_W, PERCHED_W, PERCHED_H, CLOUD_W, cloudXpm } from "./sprites";
import { HAVAMAL, nextLine } from "./havamal";

/** The name the app draws under; the device clears elements by this id. */
const APP = manifest.id;

const SCREEN_W = 72;
const SCREEN_H = 16;

/** Animation tick. Each tick is one display request, so this stays well under 10/s. */
const TICK_MS = 160;
/** Wing frame flips every N ticks. */
const FLAP_TICKS = 1;
/** Stars twinkle every N ticks. */
const TWINKLE_TICKS = 5;
/** Stars drift one pixel left every N ticks (the far layer of the parallax). */
const STAR_DRIFT_TICKS = 6;
/** Clouds drift one pixel left every N ticks (nearer than the stars, farther than the ravens). */
const CLOUD_DRIFT_TICKS = 2;
/** The cloud layer repeats every N pixels, same layout as Dino Run's sky. */
const CLOUD_PERIOD = 144;
/** Cloud anchors on that loop, lifted from Dino Run's sky (x, y). */
const CLOUDS: ReadonlyArray<readonly [number, number]> = [[10, 3], [70, 6], [112, 2]];

/** Scrolling speed of the Hávamál line, in pixels per minute (the device's unit). */
const SCROLL_RATE = 1500;
/** Rough advance of the small font, used to size the scroll timer. */
const SMALL_FONT_PX_PER_CHAR = 4;

type Elements = NonNullable<DisplayDrawParams["elements"]>;
type Element = Elements[number];

/** Night and dawn palettes. */
interface Palette {
  name: string;
  skyTop: string;
  skyBottom: string;
  star: string;
  starDim: string;
  cloud: string;
  text: string;
}

const NIGHT: Palette = {
  name: "night",
  skyTop: "#040818FF",
  skyBottom: "#0A1030FF",
  star: "#FFFFFFFF",
  starDim: "#8090C0FF",
  cloud: "#30344A",
  text: "#E8E8FFFF",
};

const DAWN: Palette = {
  name: "dawn",
  skyTop: "#2A1038FF",
  skyBottom: "#C04820FF",
  star: "#FFE0A0FF",
  starDim: "#A06040FF",
  cloud: "#6A3A48",
  text: "#FFF4D0FF",
};

/** Starting star positions; they drift left from here and wrap around. */
const STAR_SEED: ReadonlyArray<readonly [number, number]> = [
  [3, 1], [11, 4], [19, 0], [27, 6], [35, 2], [44, 5], [52, 1], [60, 3], [68, 0], [66, 7], [8, 9], [40, 10],
];

/** A raven in flight. Both start off-screen so they enter rather than pop in. */
interface Raven {
  id: string;
  x: number;
  y: number;
  /** Pixels per tick. Different per raven so they cross and overtake. */
  speed: number;
  /** Flap phase offset so the two don't beat in sync. */
  phase: number;
}

type Mode = "flying" | "landed";

function skyElements(p: Palette): Elements {
  return [
    { id: "sky-top", type: "rectangle", x: 0, y: 0, width: SCREEN_W, height: 9, fill: "solid", fill_colors: [p.skyTop], border_width: 0, z_index: 0 },
    { id: "sky-bottom", type: "rectangle", x: 0, y: 9, width: SCREEN_W, height: SCREEN_H - 9, fill: "solid", fill_colors: [p.skyBottom], border_width: 0, z_index: 0 },
  ];
}

function starElements(p: Palette, tick: number, stars: ReadonlyArray<readonly [number, number]>): Elements {
  const phase = Math.floor(tick / TWINKLE_TICKS);
  return stars.map(([x, y], i) => ({
    id: `star-${i}`,
    type: "rectangle" as const,
    x,
    y,
    width: 1,
    height: 1,
    fill: "solid" as const,
    fill_colors: [(phase + i) % 3 === 0 ? p.starDim : p.star],
    border_width: 0,
    z_index: 1,
  }));
}

/** Three clouds on a 144 px loop, like Dino Run's sky; a cloud off the right side parks off-screen left. */
function cloudElements(p: Palette, tick: number): Elements {
  const offset = Math.floor(tick / CLOUD_DRIFT_TICKS) % CLOUD_PERIOD;
  const xpm = cloudXpm(p.cloud);
  return CLOUDS.map(([cx, cy], i) => {
    const wrapped = (((cx - offset) % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD;
    const x = wrapped < SCREEN_W + CLOUD_W ? wrapped - CLOUD_W : -CLOUD_W;
    return { id: `cloud-${i}`, type: "xpmbitmap" as const, x, y: cy, data: xpm, z_index: 1 };
  });
}

function ravenElement(r: Raven, tick: number): Element {
  const frame = Math.floor((tick + r.phase) / FLAP_TICKS) % RAVEN_FRAMES.length;
  return {
    id: r.id,
    type: "xpmbitmap",
    x: Math.round(r.x),
    y: r.y,
    data: RAVEN_FRAMES[frame],
    z_index: 3,
  };
}

function perchedElement(r: Raven): Element {
  return {
    id: r.id,
    type: "xpmbitmap",
    x: Math.round(r.x),
    y: SCREEN_H - PERCHED_H,
    data: RAVEN_PERCHED,
    z_index: 3,
  };
}

function lineElement(p: Palette, text: string): Element {
  const labelX = PERCHED_W + 2;
  return {
    id: "line",
    type: "text",
    x: labelX,
    y: 3,
    width: SCREEN_W - labelX,
    text,
    font: "small",
    color: p.text,
    scroll_rate: SCROLL_RATE,
    scroll_start_delay: 400,
    scroll_repeat_delay: 60_000,
    // Above the ravens: Huginn keeps flying while the line shows.
    z_index: 4,
  };
}

/** How long the line needs to scroll fully past, plus a beat before take-off. */
function lineDurationMs(text: string): number {
  const travelPx = text.length * SMALL_FONT_PX_PER_CHAR + (SCREEN_W - PERCHED_W - 2);
  return 400 + Math.ceil((travelPx / SCROLL_RATE) * 60_000) + 1200;
}

function main(): void {
  let tick = 0;
  let palette: Palette = NIGHT;
  let mode: Mode = "flying";
  let stopped = false;
  let inFlight = false;
  let lastLine = -1;

  // Different heights so they cross and overtake rather than stack.
  const stars: Array<[number, number]> = STAR_SEED.map(([x, y]) => [x, y]);
  const huginn: Raven = { id: "huginn", x: -RAVEN_W, y: 0, speed: 1.0, phase: 0 };
  const muninn: Raven = { id: "muninn", x: -RAVEN_W - 36, y: 5, speed: 1.6, phase: 2 };

  const report = (err: unknown) =>
    console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);

  /** One display request; skipped if the previous one has not answered yet. */
  const send = (elements: Elements): void => {
    if (inFlight || stopped || elements.length === 0) return;
    inFlight = true;
    device
      .DisplayDraw({ application_name: APP, priority: 50, elements })
      .catch(report)
      .then(() => {
        inFlight = false;
      });
  };

  const advance = (r: Raven): void => {
    r.x += r.speed;
    if (r.x > SCREEN_W) r.x = -RAVEN_W - Math.floor(Math.random() * 20);
  };

  /** Everything, for the first frame and after a palette change. */
  const fullFrame = (): Elements => {
    const ravens: Elements =
      mode === "landed" ? [ravenElement(huginn, tick), perchedElement(muninn)] : [ravenElement(huginn, tick), ravenElement(muninn, tick)];
    return [...skyElements(palette), ...starElements(palette, tick, stars), ...cloudElements(palette, tick), ...ravens];
  };

  const driftStars = (): void => {
    for (const star of stars) star[0] = star[0] === 0 ? SCREEN_W - 1 : star[0] - 1;
  };

  /** Only what moved this tick. */
  const tickFrame = (): Elements => {
    const out: Elements = [ravenElement(huginn, tick)];
    if (mode === "flying") out.push(ravenElement(muninn, tick));
    if (tick % CLOUD_DRIFT_TICKS === 0) out.push(...cloudElements(palette, tick));
    if (tick % STAR_DRIFT_TICKS === 0) driftStars();
    if (tick % TWINKLE_TICKS === 0 || tick % STAR_DRIFT_TICKS === 0) out.push(...starElements(palette, tick, stars));
    return out;
  };

  send(fullFrame());

  const timer = setInterval(() => {
    tick += 1;
    advance(huginn);
    if (mode === "flying") advance(muninn);
    send(tickFrame());
  }, TICK_MS);

  let takeoffTimer: ReturnType<typeof setTimeout> | null = null;

  const takeOff = (): void => {
    takeoffTimer = null;
    if (stopped || mode !== "landed") return;
    mode = "flying";
    void device
      .DisplayClear({ application_name: APP, element_ids: ["line"] })
      .catch(report);
    // Muninn leaves from the left edge so the perch-to-flight jump reads as a take-off.
    muninn.x = 1;
  };

  const land = (): void => {
    if (mode === "landed") return;
    mode = "landed";
    lastLine = nextLine(lastLine);
    const text = HAVAMAL[lastLine];
    muninn.x = 0;
    // Wait for any in-flight tick so the perch and the line go out together.
    const push = (): void => {
      if (inFlight) {
        setTimeout(push, 20);
        return;
      }
      send([perchedElement(muninn), lineElement(palette, text)]);
    };
    push();
    takeoffTimer = setTimeout(takeOff, lineDurationMs(text));
  };

  const togglePalette = (): void => {
    palette = palette === NIGHT ? DAWN : NIGHT;
    const push = (): void => {
      if (inFlight) {
        setTimeout(push, 20);
        return;
      }
      const frame = fullFrame();
      if (mode === "landed" && lastLine >= 0) frame.push(lineElement(palette, HAVAMAL[lastLine]));
      send(frame);
    };
    push();
  };

  const unbind = listen("input", (event) => {
    if (stopped || event.action !== "short") return;
    if (event.key === "ok") {
      land();
      return;
    }
    if (event.key === "start") {
      togglePalette();
      return;
    }
    if (event.key === "back") {
      stopped = true;
      clearInterval(timer);
      if (takeoffTimer !== null) clearTimeout(takeoffTimer);
      void device.DisplayClear({ application_name: APP }).catch(report);
      // Not detached from inside the handler itself: with nothing else left the unbind stops the app on the spot.
      setTimeout(unbind, 0);
    }
  });
}

main();
