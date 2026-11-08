// Encoder for BUSY Bar's ".anim" binary format, major version 1 ("bicycle1"),
// reverse-engineered from the (public) firmware source:
// github.com/busy-app/busybar-firmware, lib/anim_file/anim_file_format.h,
// cross-checked against the reference Python encoder at scripts/seq2anim.py.
// Not documented in the device's own OpenAPI spec or the busy.app docs mirror.
//
// Firmware 1.3.1 (HTTP API 27.14, 2026-11) replaced the earlier "bicycle0"
// layout: durations are gone (every display frame is a file frame), and each
// frame carries a *mask* saying which pixels changed since the previous
// frame, followed by only those pixels. The device shows a purple [x] for a
// file in the old layout.
//
// File layout: AnimFileHeader (34 bytes) -> Sections chunk -> Frames chunk.
// All integers little-endian. Sections are named frame ranges the player can
// seek to (a single "default" one unless the caller names its own); colors
// are Bgra8888 (full RGBA with alpha). Masks: FullyWhite (keyframe, all pixels, no mask data) or
// FullyBlack (frame identical to the previous one, no pixels at all).
// Pixels: Raw only — RLE/QOI-like and partial bitmap masks are optional
// compression this project doesn't need for correctness.

const SIGNATURE = "bicycle1";
const COLOR_FORMAT_BGRA8888 = 2;
const PIXEL_ENCODING_RAW = 0;
const MASK_ENCODING_FULLY_BLACK = 0;
const MASK_ENCODING_FULLY_WHITE = 1;
const HEADER_LENGTH = 34;
const FRAME_HEADER_LENGTH = 5;

export interface AnimSection {
  /** Section name as referenced by an AnimationElement's `section` field. */
  name: string;
  /** One entry per display frame, each RGBA bytes, width*height*4 long. */
  frames: Uint8Array[];
}

export interface EncodeAnimFileOptions {
  width: number;
  height: number;
  fps: number;
  /** One entry per display frame, each RGBA bytes, width*height*4 long. Shorthand for a single "default" section. */
  frames?: Uint8Array[];
  /**
   * Named sections the player can seek to (`section` on the element; a
   * switch with `await_previous_end` happens on the running section's loop
   * boundary, which is how Dino Run changes speed and how Nyan Cat pans).
   * Every section starts on a keyframe since the player seeks to it.
   */
  sections?: AnimSection[];
}

interface FileFrame {
  maskEncoding: number;
  /** Packed Bgra8888 pixel bytes; empty when the frame repeats the previous one. */
  data: Uint8Array;
}

/** RGBA -> Bgra8888 (B, G, R, A per pixel — this format's own byte order, not the debunked toDeviceColor R/B swap). */
function packBgra8888(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i + 0] = rgba[i + 2]!; // B
    out[i + 1] = rgba[i + 1]!; // G
    out[i + 2] = rgba[i + 0]!; // R
    out[i + 3] = rgba[i + 3]!; // A
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** A keyframe for the first frame and for any frame that differs; a no-pixel "repeat" frame otherwise. */
function buildFileFrames(frames: Uint8Array[]): FileFrame[] {
  const fileFrames: FileFrame[] = [];
  let previous: Uint8Array | null = null;
  for (const frame of frames) {
    if (previous && sameBytes(previous, frame)) {
      fileFrames.push({ maskEncoding: MASK_ENCODING_FULLY_BLACK, data: new Uint8Array(0) });
    } else {
      fileFrames.push({ maskEncoding: MASK_ENCODING_FULLY_WHITE, data: packBgra8888(frame) });
    }
    previous = frame;
  }
  return fileFrames;
}

export function encodeAnimFile(options: EncodeAnimFileOptions): Uint8Array {
  const { width, height, fps } = options;
  if (options.frames && options.sections) throw new Error("encodeAnimFile: pass either frames or sections, not both");
  const sections: AnimSection[] = options.sections ?? (options.frames ? [{ name: "default", frames: options.frames }] : []);
  if (sections.length === 0) throw new Error("encodeAnimFile: at least one section is required");
  const expected = width * height * 4;
  for (const section of sections) {
    if (section.frames.length === 0) throw new Error(`encodeAnimFile: section "${section.name}" has no frames`);
    section.frames.forEach((f, i) => {
      if (f.length !== expected) {
        throw new Error(`encodeAnimFile: frame ${i} of "${section.name}" has ${f.length} bytes, expected ${expected} for its size ${width}x${height}`);
      }
    });
  }

  // Each section is encoded on its own so it opens with a keyframe.
  const perSection = sections.map((s) => buildFileFrames(s.frames));
  const fileFrames = perSection.flat();
  const maxPixelLength = Math.max(...fileFrames.map((f) => f.data.length));

  // Section entries: the firmware wants a "default" section spanning the
  // whole file first (every Dino Run asset has one; without it the device
  // shows its error screen), then the caller's named ranges.
  const entries: Array<{ name: string; start: number; count: number }> = [];
  if (sections[0]!.name !== "default") entries.push({ name: "default", start: 0, count: fileFrames.length });
  let runningStart = 0;
  for (const [i, s] of sections.entries()) {
    entries.push({ name: s.name, start: runningStart, count: perSection[i]!.length });
    runningStart += perSection[i]!.length;
  }
  const encoder = new TextEncoder();
  const entryNames = entries.map((e) => encoder.encode(`${e.name}\0`));
  const sectionsChunkLength = entryNames.reduce((sum, n) => sum + 4 + 4 + 4 + n.length, 0); // start, end, frame_offs, name
  const framesChunkLength = fileFrames.reduce((sum, f) => sum + FRAME_HEADER_LENGTH + f.data.length, 0);

  const totalLength = HEADER_LENGTH + sectionsChunkLength + framesChunkLength;
  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);

  // Header
  new TextEncoder().encodeInto(SIGNATURE, out.subarray(0, 8));
  dv.setUint8(8, 0); // flags
  dv.setUint8(9, width);
  dv.setUint8(10, height);
  dv.setUint8(11, COLOR_FORMAT_BGRA8888);
  dv.setUint16(12, 0, true); // max_mask_length (bits) — our masks carry no data
  dv.setUint16(14, maxPixelLength, true);
  dv.setUint8(16, fps);
  dv.setUint8(17, 0); // _unused
  dv.setUint32(18, sectionsChunkLength, true);
  dv.setUint32(22, framesChunkLength, true);
  dv.setUint32(26, entries.length, true); // section_count
  dv.setUint32(30, fileFrames.length, true); // frame_count

  // Sections chunk: start/end are frame indices into the whole file,
  // frame_offs the absolute byte offset of the section's first frame.
  const frameOffsets: number[] = [];
  let acc = HEADER_LENGTH + sectionsChunkLength;
  for (const f of fileFrames) { frameOffsets.push(acc); acc += FRAME_HEADER_LENGTH + f.data.length; }
  let sectionsOffset = HEADER_LENGTH;
  entries.forEach((e, i) => {
    const name = entryNames[i]!;
    dv.setUint32(sectionsOffset + 0, e.start, true); // start
    dv.setUint32(sectionsOffset + 4, e.start + e.count - 1, true); // end
    dv.setUint32(sectionsOffset + 8, frameOffsets[e.start]!, true); // frame_offs
    out.set(name, sectionsOffset + 12);
    sectionsOffset += 12 + name.length;
  });

  // Frames chunk
  let offset = HEADER_LENGTH + sectionsChunkLength;
  for (const fileFrame of fileFrames) {
    dv.setUint8(offset + 0, PIXEL_ENCODING_RAW | (fileFrame.maskEncoding << 4));
    dv.setUint16(offset + 1, 0, true); // mask_length (bits)
    dv.setUint16(offset + 3, fileFrame.data.length, true); // pixel_length (bytes)
    out.set(fileFrame.data, offset + FRAME_HEADER_LENGTH);
    offset += FRAME_HEADER_LENGTH + fileFrame.data.length;
  }

  return out;
}
