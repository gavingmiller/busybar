import { describe, it, expect } from "bun:test";
import { Canvas } from "./canvas.ts";
import { toDeviceColor } from "./display.ts";

describe("Canvas pixel primitives", () => {
  it("starts fully transparent", () => {
    const canvas = new Canvas(3, 2);
    expect(canvas.get(0, 0)).toBeNull();
    expect(canvas.get(2, 1)).toBeNull();
  });

  it("setPixel writes a single pixel", () => {
    const canvas = new Canvas(3, 2);
    canvas.setPixel(1, 1, "#FF0000FF");
    expect(canvas.get(1, 1)).toBe("#FF0000FF");
    expect(canvas.get(0, 0)).toBeNull();
  });

  it("setPixel outside the canvas bounds is silently ignored", () => {
    const canvas = new Canvas(3, 2);
    expect(() => canvas.setPixel(-1, 0, "#FF0000FF")).not.toThrow();
    expect(() => canvas.setPixel(10, 10, "#FF0000FF")).not.toThrow();
  });

  it("fillRect paints a rectangular region", () => {
    const canvas = new Canvas(4, 4);
    canvas.fillRect(1, 1, 2, 2, "#00FF00FF");
    expect(canvas.get(1, 1)).toBe("#00FF00FF");
    expect(canvas.get(2, 2)).toBe("#00FF00FF");
    expect(canvas.get(0, 0)).toBeNull();
    expect(canvas.get(3, 3)).toBeNull();
  });

  it("later writes overwrite earlier ones at the same pixel", () => {
    const canvas = new Canvas(2, 2);
    canvas.setPixel(0, 0, "#FF0000FF");
    canvas.setPixel(0, 0, "#00FF00FF");
    expect(canvas.get(0, 0)).toBe("#00FF00FF");
  });
});

describe("Canvas.paintGrid", () => {
  it("paints one pixel per non-background character, looked up by color map", () => {
    const canvas = new Canvas(3, 2);
    canvas.paintGrid(["AB.", ".BA"], { A: "#FF0000FF", B: "#00FF00FF" });
    expect(canvas.get(0, 0)).toBe("#FF0000FF");
    expect(canvas.get(1, 0)).toBe("#00FF00FF");
    expect(canvas.get(2, 0)).toBeNull();
    expect(canvas.get(1, 1)).toBe("#00FF00FF");
    expect(canvas.get(2, 1)).toBe("#FF0000FF");
  });

  it("offsets the grid onto the canvas at (originX, originY)", () => {
    const canvas = new Canvas(4, 4);
    canvas.paintGrid(["A"], { A: "#FF0000FF" }, 2, 3);
    expect(canvas.get(2, 3)).toBe("#FF0000FF");
    expect(canvas.get(0, 0)).toBeNull();
  });

  it("throws on a character with no color mapping, rather than silently skipping it", () => {
    const canvas = new Canvas(2, 2);
    expect(() => canvas.paintGrid(["Z"], { A: "#FF0000FF" })).toThrow(/Z/);
  });
});

describe("Canvas.toElements", () => {
  it("merges each row's runs of identical colors into one rect per run", () => {
    const canvas = new Canvas(3, 2);
    canvas.paintGrid(["AAB", ".BB"], { A: "#FF0000FF", B: "#00FF00FF" });

    const rects = canvas.toElements("t");

    expect(rects).toHaveLength(3);
    expect(rects.find((r) => r.id === "t-0-0")).toMatchObject({ x: 0, y: 0, width: 2 });
    expect(rects.find((r) => r.id === "t-0-2")).toMatchObject({ x: 2, y: 0, width: 1 });
    expect(rects.find((r) => r.id === "t-1-1")).toMatchObject({ x: 1, y: 1, width: 2 });
  });

  it("merges vertically-stacked identical runs into one taller rect", () => {
    // The device rejects draws past an element-count cap, so collapsing
    // solid blocks matters, not just tidiness.
    const canvas = new Canvas(2, 3);
    canvas.fillRect(0, 0, 2, 3, "#FF0000FF");

    const rects = canvas.toElements("t");
    expect(rects).toHaveLength(1);
    expect(rects[0]).toMatchObject({ x: 0, y: 0, width: 2, height: 3 });
  });

  it("breaks the vertical merge where a row's run differs", () => {
    const canvas = new Canvas(2, 3);
    canvas.fillRect(0, 0, 2, 2, "#FF0000FF");
    canvas.setPixel(0, 2, "#FF0000FF");
    canvas.setPixel(1, 2, "#00FF00FF");

    const rects = canvas.toElements("t");
    expect(rects).toHaveLength(3);
    expect(rects.find((r) => r.x === 0 && r.y === 0)).toMatchObject({ width: 2, height: 2 });
    expect(rects.find((r) => r.y === 2 && r.x === 0)).toMatchObject({ width: 1, height: 1 });
    expect(rects.find((r) => r.y === 2 && r.x === 1)).toMatchObject({ width: 1, height: 1 });
  });

  it("skips transparent pixels entirely", () => {
    const canvas = new Canvas(3, 1);
    canvas.setPixel(1, 0, "#FF0000FF");
    expect(canvas.toElements("t")).toHaveLength(1);
  });

  it("translates every rect by (translateX, translateY), including negative offsets", () => {
    const canvas = new Canvas(2, 1);
    canvas.fillRect(0, 0, 2, 1, "#FF0000FF");
    const rects = canvas.toElements("t", -10, 5);
    expect(rects[0]).toMatchObject({ x: -10, y: 5 });
  });

  it("produces valid solid-fill rectangles with device-swapped color and no border", () => {
    const canvas = new Canvas(1, 1);
    canvas.setPixel(0, 0, "#FF0000FF");
    const [el] = canvas.toElements("t");
    expect(el).toMatchObject({
      type: "rectangle",
      fill: "solid",
      fill_colors: [toDeviceColor("#FF0000FF")],
      border_width: 0,
      display: "front",
      timeout: 0,
    });
  });
});
