import { type RectangleElement, rect } from "./display.ts";

const BACKGROUND = ".";

interface Run {
  x: number;
  length: number;
  color: string;
}

function rowRuns(pixels: (string | null)[], y: number, width: number): Run[] {
  const runs: Run[] = [];
  let x = 0;
  while (x < width) {
    const color = pixels[y * width + x]!;
    if (color === null) {
      x++;
      continue;
    }
    let length = 1;
    while (x + length < width && pixels[y * width + x + length] === color) length++;
    runs.push({ x, length, color });
    x += length;
  }
  return runs;
}

/**
 * A pixel buffer apps draw onto (setPixel/fillRect/paintGrid), then compile
 * to the fewest RectangleElements the device needs to reproduce it: each
 * row is run-length-encoded, then identical runs stacked on consecutive
 * rows merge into one taller rectangle. This is the single rendering
 * pipeline every visual app should go through — draw onto a Canvas, then
 * call toElements() — rather than each app hand-building rects.
 */
export class Canvas {
  readonly width: number;
  readonly height: number;
  private pixels: (string | null)[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Array(width * height).fill(null);
  }

  private index(x: number, y: number): number | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return y * this.width + x;
  }

  get(x: number, y: number): string | null {
    const i = this.index(x, y);
    return i === null ? null : this.pixels[i]!;
  }

  setPixel(x: number, y: number, color: string): void {
    const i = this.index(x, y);
    if (i !== null) this.pixels[i] = color;
  }

  fillRect(x: number, y: number, width: number, height: number, color: string): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) this.setPixel(x + dx, y + dy, color);
    }
  }

  /**
   * Paints ASCII-art pixel data onto the canvas at (originX, originY): one
   * character per pixel, looked up in `colors`. "." (or `background`) is
   * transparent — left untouched rather than painted. Throws on an
   * unmapped character rather than silently skipping it, since a missing
   * color entry is almost always a typo, not an intentional gap.
   */
  paintGrid(
    grid: string[],
    colors: Record<string, string>,
    originX: number = 0,
    originY: number = 0,
    background: string = BACKGROUND
  ): void {
    grid.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx]!;
        if (ch === background) continue;
        const color = colors[ch];
        if (color === undefined) {
          throw new Error(`paintGrid: no color mapped for '${ch}' (row ${ry}, col ${rx})`);
        }
        this.setPixel(originX + rx, originY + ry, color);
      }
    });
  }

  /**
   * Compiles the canvas to RectangleElements, translated by
   * (translateX, translateY) — which may be negative (e.g. a sprite
   * currently scrolled off-screen).
   */
  toElements(idPrefix: string, translateX: number = 0, translateY: number = 0): RectangleElement[] {
    const elements: RectangleElement[] = [];
    const active = new Map<string, { run: Run; startRow: number }>();

    const flush = (key: string, endRow: number) => {
      const entry = active.get(key)!;
      active.delete(key);
      elements.push(
        rect(
          `${idPrefix}-${entry.startRow}-${entry.run.x}`,
          translateX,
          translateY,
          entry.run.x,
          entry.startRow,
          entry.run.length,
          endRow - entry.startRow,
          entry.run.color
        )
      );
    };

    for (let y = 0; y < this.height; y++) {
      const runs = rowRuns(this.pixels, y, this.width);
      const currentKeys = new Set(runs.map((r) => `${r.x}:${r.length}:${r.color}`));

      for (const key of active.keys()) {
        if (!currentKeys.has(key)) flush(key, y);
      }
      for (const run of runs) {
        const key = `${run.x}:${run.length}:${run.color}`;
        if (!active.has(key)) active.set(key, { run, startRow: y });
      }
    }
    for (const key of [...active.keys()]) flush(key, this.height);

    return elements;
  }

  /** Rasterizes to row-major RGBA bytes (width*height*4), for building animation frames. */
  toRGBA(background: string = "#000000FF"): Uint8Array {
    const out = new Uint8Array(this.width * this.height * 4);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const color = this.get(x, y) ?? background;
        const i = (y * this.width + x) * 4;
        out[i + 0] = parseInt(color.slice(1, 3), 16);
        out[i + 1] = parseInt(color.slice(3, 5), 16);
        out[i + 2] = parseInt(color.slice(5, 7), 16);
        out[i + 3] = parseInt(color.slice(7, 9), 16);
      }
    }
    return out;
  }
}
