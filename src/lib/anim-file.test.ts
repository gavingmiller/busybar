import { describe, it, expect } from "bun:test";
import { encodeAnimFile } from "./anim-file.ts";

// Bit-for-bit oracle hand-computed against the BUSY Bar firmware's own
// format, major version 1 — the one firmware 1.3.1 (API 27.14) reads.
// (github.com/busy-app/busybar-firmware, lib/anim_file/anim_file_format.h,
// cross-checked against scripts/seq2anim.py's reference encoder.) All
// integers little-endian. Header is exactly 34 bytes:
//   signature[8] "bicycle1", flags(u8), width(u8), height(u8),
//   color_format(u8, 2=Bgra8888), max_mask_length(u16, bits),
//   max_pixel_length(u16, bytes), fps(u8), _unused(u8),
//   sections_chunk_length(u32), frames_chunk_length(u32),
//   section_count(u32), frame_count(u32)
// Every display frame is a file frame (no durations any more); each frame is
//   joint_encoding(u8: pixel enc low nibble, mask enc high nibble),
//   mask_length(u16, bits), pixel_length(u16, bytes), mask data, pixel data.
function readHeader(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    signature: new TextDecoder().decode(bytes.slice(0, 8)),
    flags: dv.getUint8(8),
    width: dv.getUint8(9),
    height: dv.getUint8(10),
    colorFormat: dv.getUint8(11),
    maxMaskLength: dv.getUint16(12, true),
    maxPixelLength: dv.getUint16(14, true),
    fps: dv.getUint8(16),
    sectionsChunkLength: dv.getUint32(18, true),
    framesChunkLength: dv.getUint32(22, true),
    sectionCount: dv.getUint32(26, true),
    frameCount: dv.getUint32(30, true),
  };
}

const HEADER_LENGTH = 34;
const SECTION_LENGTH = 12 + "default\0".length; // 20
const FRAME_HEADER_LENGTH = 5;
const MASK_FULLY_BLACK = 0;
const MASK_FULLY_WHITE = 1;
const PIXELS_RAW = 0;

function readFrame(bytes: Uint8Array, offset: number) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, FRAME_HEADER_LENGTH);
  const joint = dv.getUint8(0);
  const maskBits = dv.getUint16(1, true);
  const pixelLength = dv.getUint16(3, true);
  const maskBytes = Math.ceil(maskBits / 8);
  const pixelStart = offset + FRAME_HEADER_LENGTH + maskBytes;
  return {
    pixelEncoding: joint & 0x0f,
    maskEncoding: joint >> 4,
    maskBits,
    pixelLength,
    pixels: bytes.slice(pixelStart, pixelStart + pixelLength),
    next: pixelStart + pixelLength,
  };
}

function rgbaPixels(...hex8: string[]): Uint8Array {
  // Each hex8 is "#RRGGBBAA" — one pixel.
  const bytes = new Uint8Array(hex8.length * 4);
  hex8.forEach((h, i) => {
    const clean = h.replace("#", "");
    bytes[i * 4 + 0] = parseInt(clean.slice(0, 2), 16);
    bytes[i * 4 + 1] = parseInt(clean.slice(2, 4), 16);
    bytes[i * 4 + 2] = parseInt(clean.slice(4, 6), 16);
    bytes[i * 4 + 3] = parseInt(clean.slice(6, 8), 16);
  });
  return bytes;
}

describe("encodeAnimFile (bicycle1)", () => {
  it("encodes a single 2x1 all-red frame to the exact expected bytes", () => {
    const frame = rgbaPixels("#FF0000FF", "#FF0000FF");
    const bytes = encodeAnimFile({ width: 2, height: 1, fps: 8, frames: [frame] });

    const header = readHeader(bytes);
    expect(header.signature).toBe("bicycle1");
    expect(header.flags).toBe(0);
    expect(header.width).toBe(2);
    expect(header.height).toBe(1);
    expect(header.colorFormat).toBe(2); // Bgra8888
    expect(header.maxMaskLength).toBe(0); // fully-white masks carry no data
    expect(header.maxPixelLength).toBe(8); // 2px * 4 bytes (Bgra8888)
    expect(header.fps).toBe(8);
    expect(header.sectionsChunkLength).toBe(SECTION_LENGTH);
    expect(header.framesChunkLength).toBe(FRAME_HEADER_LENGTH + 8);
    expect(header.sectionCount).toBe(1);
    expect(header.frameCount).toBe(1);

    // Sections chunk: one "default" section covering the whole (single) frame.
    const sectionsDv = new DataView(bytes.buffer, HEADER_LENGTH, 12);
    expect(sectionsDv.getUint32(0, true)).toBe(0); // start
    expect(sectionsDv.getUint32(4, true)).toBe(0); // end
    expect(sectionsDv.getUint32(8, true)).toBe(HEADER_LENGTH + SECTION_LENGTH); // frame_offs
    const name = new TextDecoder().decode(bytes.slice(HEADER_LENGTH + 12, HEADER_LENGTH + 12 + 8));
    expect(name).toBe("default\0");

    // Frames chunk: one keyframe — fully-white mask (every pixel present, no
    // mask data), raw Bgra8888 pixels (2 red pixels: B,G,R,A = 0,0,255,255
    // each — R and B swapped from the #RRGGBBAA input, per the format's own
    // packing order, distinct from the debunked toDeviceColor swap theory).
    const f = readFrame(bytes, HEADER_LENGTH + SECTION_LENGTH);
    expect(f.pixelEncoding).toBe(PIXELS_RAW);
    expect(f.maskEncoding).toBe(MASK_FULLY_WHITE);
    expect(f.maskBits).toBe(0);
    expect(f.pixelLength).toBe(8);
    expect([...f.pixels]).toEqual([0, 0, 255, 255, 0, 0, 255, 255]);

    expect(bytes.length).toBe(HEADER_LENGTH + SECTION_LENGTH + FRAME_HEADER_LENGTH + 8);
  });

  it("encodes an unchanged frame as a fully-black mask with no pixel data", () => {
    const red = rgbaPixels("#FF0000FF");
    const bytes = encodeAnimFile({ width: 1, height: 1, fps: 8, frames: [red, red, red] });
    const header = readHeader(bytes);
    expect(header.frameCount).toBe(3); // one file frame per display frame, always

    let off = HEADER_LENGTH + header.sectionsChunkLength;
    const f0 = readFrame(bytes, off);
    expect(f0.maskEncoding).toBe(MASK_FULLY_WHITE);
    expect(f0.pixelLength).toBe(4);
    off = f0.next;
    for (let i = 1; i < 3; i++) {
      const f = readFrame(bytes, off);
      expect(f.maskEncoding).toBe(MASK_FULLY_BLACK);
      expect(f.maskBits).toBe(0);
      expect(f.pixelLength).toBe(0);
      off = f.next;
    }
    expect(off).toBe(bytes.length);
    expect(header.framesChunkLength).toBe(FRAME_HEADER_LENGTH * 3 + 4);
  });

  it("sends a changed frame in full again", () => {
    const red = rgbaPixels("#FF0000FF");
    const blue = rgbaPixels("#0000FFFF");
    const bytes = encodeAnimFile({ width: 1, height: 1, fps: 8, frames: [red, blue] });
    const header = readHeader(bytes);
    expect(header.frameCount).toBe(2);
    const f0 = readFrame(bytes, HEADER_LENGTH + header.sectionsChunkLength);
    const f1 = readFrame(bytes, f0.next);
    expect(f1.maskEncoding).toBe(MASK_FULLY_WHITE);
    expect([...f1.pixels]).toEqual([255, 0, 0, 255]); // blue as B,G,R,A
  });

  it("records the largest pixel payload in the header and sizes the chunk exactly", () => {
    const frames = [
      rgbaPixels("#FF0000FF", "#00FF00FF"),
      rgbaPixels("#0000FFFF", "#FFFF00FF"),
      rgbaPixels("#0000FFFF", "#FFFF00FF"), // same as the frame before -> fully black
    ];
    const bytes = encodeAnimFile({ width: 2, height: 1, fps: 12, frames });
    const header = readHeader(bytes);
    expect(header.fps).toBe(12);
    expect(header.frameCount).toBe(3);
    expect(header.maxPixelLength).toBe(8);
    expect(header.framesChunkLength).toBe(FRAME_HEADER_LENGTH * 3 + 8 + 8);
    expect(bytes.length).toBe(HEADER_LENGTH + SECTION_LENGTH + header.framesChunkLength);
  });

  it("rejects an empty animation and a frame of the wrong size", () => {
    expect(() => encodeAnimFile({ width: 1, height: 1, fps: 8, frames: [] })).toThrow();
    expect(() =>
      encodeAnimFile({ width: 2, height: 1, fps: 8, frames: [rgbaPixels("#FF0000FF")] })
    ).toThrow(/size/);
  });
});
