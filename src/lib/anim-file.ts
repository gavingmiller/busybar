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
// All integers little-endian. We only ever emit one "default" section
// (covering the whole animation) and Bgra8888 color format (full RGBA with
// alpha). Masks: FullyWhite (keyframe, all pixels, no mask data) or
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

export interface EncodeAnimFileOptions {
  width: number;
  height: number;
  fps: number;
  /** One entry per display frame, each RGBA bytes, width*height*4 long. */
  frames: Uint8Array[];
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
  const { width, height, fps, frames } = options;
  if (frames.length === 0) throw new Error("encodeAnimFile: at least one frame is required");
  const expected = width * height * 4;
  frames.forEach((f, i) => {
    if (f.length !== expected) {
      throw new Error(`encodeAnimFile: frame ${i} has ${f.length} bytes, expected ${expected} for its size ${width}x${height}`);
    }
  });

  const fileFrames = buildFileFrames(frames);
  const maxPixelLength = Math.max(...fileFrames.map((f) => f.data.length));

  const sectionName = "default\0";
  const sectionsChunkLength = 4 + 4 + 4 + sectionName.length; // start, end, frame_offs, name
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
  dv.setUint32(26, 1, true); // section_count
  dv.setUint32(30, fileFrames.length, true); // frame_count

  // Sections chunk: single "default" section spanning every frame.
  const sectionsOffset = HEADER_LENGTH;
  dv.setUint32(sectionsOffset + 0, 0, true); // start
  dv.setUint32(sectionsOffset + 4, fileFrames.length - 1, true); // end
  dv.setUint32(sectionsOffset + 8, HEADER_LENGTH + sectionsChunkLength, true); // frame_offs
  new TextEncoder().encodeInto(sectionName, out.subarray(sectionsOffset + 12, sectionsOffset + 12 + sectionName.length));

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
