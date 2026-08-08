import { describe, it, expect } from "bun:test";
import { encodeAnimFile } from "./anim-file.ts";

// Bit-for-bit oracle hand-computed against the BUSY Bar firmware's own
// format (github.com/busy-app/busybar-firmware, lib/anim_file/anim_file_format.h,
// cross-checked against scripts/seq2anim.py's reference encoder). All
// integers little-endian. Header is exactly 36 bytes:
//   signature[8] "bicycle0", flags(u8), width(u8), height(u8),
//   color_format(u8, 2=Bgra8888), fps(u8), max_encoded_length(u16),
//   _unused(u8), sections_chunk_length(u32), frames_chunk_length(u32),
//   section_count(u32), file_frame_count(u32), display_frame_count(u32)
function readHeader(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    signature: new TextDecoder().decode(bytes.slice(0, 8)),
    flags: dv.getUint8(8),
    width: dv.getUint8(9),
    height: dv.getUint8(10),
    colorFormat: dv.getUint8(11),
    fps: dv.getUint8(12),
    maxEncodedLength: dv.getUint16(13, true),
    sectionsChunkLength: dv.getUint32(16, true),
    framesChunkLength: dv.getUint32(20, true),
    sectionCount: dv.getUint32(24, true),
    fileFrameCount: dv.getUint32(28, true),
    displayFrameCount: dv.getUint32(32, true),
  };
}

const HEADER_LENGTH = 36;

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

describe("encodeAnimFile", () => {
  it("encodes a single 2x1 all-red frame to the exact expected bytes", () => {
    const frame = rgbaPixels("#FF0000FF", "#FF0000FF");
    const bytes = encodeAnimFile({ width: 2, height: 1, fps: 8, frames: [frame] });

    const header = readHeader(bytes);
    expect(header.signature).toBe("bicycle0");
    expect(header.flags).toBe(0);
    expect(header.width).toBe(2);
    expect(header.height).toBe(1);
    expect(header.colorFormat).toBe(2); // Bgra8888
    expect(header.fps).toBe(8);
    expect(header.maxEncodedLength).toBe(8); // 2px * 4 bytes (Bgra8888)
    expect(header.sectionsChunkLength).toBe(21); // 13 fixed + "default\0" (8)
    expect(header.framesChunkLength).toBe(12); // 4-byte file-frame header + 8 bytes data
    expect(header.sectionCount).toBe(1);
    expect(header.fileFrameCount).toBe(1);
    expect(header.displayFrameCount).toBe(1);

    // Sections chunk: one "default" section covering the whole (single) frame.
    const sectionsStart = HEADER_LENGTH;
    const sectionsDv = new DataView(bytes.buffer, sectionsStart, 13);
    expect(sectionsDv.getUint32(0, true)).toBe(0); // start
    expect(sectionsDv.getUint32(4, true)).toBe(0); // end
    expect(sectionsDv.getUint32(8, true)).toBe(HEADER_LENGTH + 21); // frame_offs
    expect(sectionsDv.getUint8(12)).toBe(1); // duration_override (== first file frame's duration)
    const name = new TextDecoder().decode(bytes.slice(sectionsStart + 13, sectionsStart + 13 + 8));
    expect(name).toBe("default\0");

    // Frames chunk: one Raw file frame, duration 1, 8 bytes of Bgra8888 data
    // (2 red pixels: B,G,R,A = 0,0,255,255 each — R and B swapped from the
    // #RRGGBBAA input, per the real Bgra8888 packing order. This is a real
    // requirement of THIS binary format, distinct from the debunked
    // toDeviceColor R/B-swap theory for the rectangle-draw JSON API.)
    const frameStart = HEADER_LENGTH + 21;
    expect(bytes[frameStart + 0]).toBe(0); // encoding = Raw
    expect(bytes[frameStart + 1]).toBe(1); // duration
    const frameDv = new DataView(bytes.buffer, frameStart + 2, 2);
    expect(frameDv.getUint16(0, true)).toBe(8); // encoded_length
    const pixelData = bytes.slice(frameStart + 4, frameStart + 4 + 8);
    expect([...pixelData]).toEqual([0, 0, 255, 255, 0, 0, 255, 255]);

    expect(bytes.length).toBe(HEADER_LENGTH + 21 + 12);
  });

  it("collapses identical consecutive frames into one file frame with a longer duration", () => {
    const red = rgbaPixels("#FF0000FF");
    const bytes = encodeAnimFile({ width: 1, height: 1, fps: 8, frames: [red, red, red] });
    const header = readHeader(bytes);

    expect(header.displayFrameCount).toBe(3);
    expect(header.fileFrameCount).toBe(1);

    const frameStart = HEADER_LENGTH + header.sectionsChunkLength;
    expect(bytes[frameStart + 0]).toBe(0); // encoding = Raw
    expect(bytes[frameStart + 1]).toBe(3); // duration = 3 identical display frames
  });

  it("keeps distinct consecutive frames as separate file frames", () => {
    const red = rgbaPixels("#FF0000FF");
    const blue = rgbaPixels("#0000FFFF");
    const bytes = encodeAnimFile({ width: 1, height: 1, fps: 8, frames: [red, blue] });
    const header = readHeader(bytes);

    expect(header.displayFrameCount).toBe(2);
    expect(header.fileFrameCount).toBe(2);
  });

  it("handles a longer multi-frame animation with a trailing duplicate", () => {
    const frames = [
      rgbaPixels("#FF0000FF", "#00FF00FF"),
      rgbaPixels("#0000FFFF", "#FFFF00FF"),
      rgbaPixels("#0000FFFF", "#FFFF00FF"), // duplicate of frame 2 — should collapse
    ];
    const bytes = encodeAnimFile({ width: 2, height: 1, fps: 12, frames });
    const header = readHeader(bytes);

    expect(header.width).toBe(2);
    expect(header.height).toBe(1);
    expect(header.fps).toBe(12);
    expect(header.displayFrameCount).toBe(3);
    expect(header.fileFrameCount).toBe(2);
  });
});
