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
/** Star life cycle, in ticks: fade in, shine, fade out, then dark before it is reborn elsewhere. */
const STAR_FADE_TICKS = 4;
const STAR_SHINE_MIN_TICKS = 40;
const STAR_SHINE_MAX_TICKS = 140;
const STAR_DARK_MIN_TICKS = 6;
const STAR_DARK_MAX_TICKS = 30;
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
  starFaint: string;
  cloud: string;
  text: string;
}

const NIGHT: Palette = {
  name: "night",
  skyTop: "#040818FF",
  skyBottom: "#0A1030FF",
  star: "#FFFFFFFF",
  starDim: "#8090C0FF",
  starFaint: "#303C60FF",
  cloud: "#30344A",
  text: "#E8E8FFFF",
};

const DAWN: Palette = {
  name: "dawn",
  skyTop: "#2A1038FF",
  skyBottom: "#C04820FF",
  star: "#FFE0A0FF",
  starDim: "#A06040FF",
  starFaint: "#5A3030FF",
  cloud: "#6A3A48",
  text: "#FFF4D0FF",
};

/** Starting star positions; each star stays put, fades out after a while and is reborn somewhere else. */
const STAR_SEED: ReadonlyArray<readonly [number, number]> = [
  [3, 1], [11, 4], [19, 0], [27, 6], [35, 2], [44, 5], [52, 1], [60, 3], [68, 0], [66, 7], [8, 9], [40, 10],
];

/** A star's place in its life cycle. `at` is the tick its current phase started. */
interface Star {
  x: number;
  y: number;
  phase: "in" | "shine" | "out" | "dark";
  at: number;
  /** Ticks this shine / dark phase lasts (fades are fixed). */
  span: number;
  /** Brightness last drawn, 0..STAR_FADE_TICKS, so unchanged stars are not resent. */
  drawn: number;
}

const randomBetween = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

function newStar(x: number, y: number, tick: number): Star {
  // Stagger the first generation so they don't all fade at once.
  return { x, y, phase: "shine", at: tick - randomBetween(0, STAR_SHINE_MAX_TICKS), span: randomBetween(STAR_SHINE_MIN_TICKS, STAR_SHINE_MAX_TICKS), drawn: -1 };
}

/** Brightness 0..STAR_FADE_TICKS for this tick, advancing the star's phase as needed. */
function starLevel(star: Star, tick: number, taken: ReadonlyArray<Star>): number {
  const age = tick - star.at;
  switch (star.phase) {
    case "in":
      if (age >= STAR_FADE_TICKS) { star.phase = "shine"; star.at = tick; star.span = randomBetween(STAR_SHINE_MIN_TICKS, STAR_SHINE_MAX_TICKS); return STAR_FADE_TICKS; }
      return age;
    case "shine":
      if (age >= star.span) { star.phase = "out"; star.at = tick; return STAR_FADE_TICKS - 1; }
      return STAR_FADE_TICKS;
    case "out":
      if (age >= STAR_FADE_TICKS) { star.phase = "dark"; star.at = tick; star.span = randomBetween(STAR_DARK_MIN_TICKS, STAR_DARK_MAX_TICKS); return 0; }
      return STAR_FADE_TICKS - 1 - age;
    case "dark":
      if (age >= star.span) {
        // Reborn somewhere new, not on top of another star.
        let x = star.x, y = star.y;
        for (let tries = 0; tries < 8; tries++) {
          x = randomBetween(0, SCREEN_W - 1);
          y = randomBetween(0, 11);
          if (!taken.some((o) => o !== star && o.x === x && o.y === y)) break;
        }
        star.x = x; star.y = y; star.phase = "in"; star.at = tick;
        return 0;
      }
      return 0;
  }
}

/** Star colour for a brightness level: the sky colour at 0, then faint, dim, bright. */
function starColor(p: Palette, level: number, y: number): string {
  if (level <= 0) return y < 9 ? p.skyTop : p.skyBottom;
  if (level === 1) return p.starFaint;
  if (level < STAR_FADE_TICKS) return p.starDim;
  return p.star;
}

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

/** Every star at its current brightness (`all`), or only the ones whose brightness changed this tick. */
function starElements(p: Palette, tick: number, stars: Star[], all: boolean): Elements {
  const out: Elements = [];
  stars.forEach((star, i) => {
    const level = starLevel(star, tick, stars);
    if (!all && level === star.drawn) return;
    star.drawn = level;
    out.push({
      id: `star-${i}`,
      type: "rectangle",
      x: star.x,
      y: star.y,
      width: 1,
      height: 1,
      fill: "solid",
      fill_colors: [starColor(p, level, star.y)],
      border_width: 0,
      z_index: 1,
    });
  });
  return out;
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
  const stars: Star[] = STAR_SEED.map(([x, y]) => newStar(x, y, 0));
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
    return [...skyElements(palette), ...starElements(palette, tick, stars, true), ...cloudElements(palette, tick), ...ravens];
  };

  /** Only what moved this tick. */
  const tickFrame = (): Elements => {
    const out: Elements = [ravenElement(huginn, tick)];
    if (mode === "flying") out.push(ravenElement(muninn, tick));
    if (tick % CLOUD_DRIFT_TICKS === 0) out.push(...cloudElements(palette, tick));
    out.push(...starElements(palette, tick, stars, false));
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
