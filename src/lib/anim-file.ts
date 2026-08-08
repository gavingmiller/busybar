// Encoder for BUSY Bar's ".anim" binary format, reverse-engineered from the
// (public) firmware source: github.com/busy-app/busybar-firmware,
// lib/anim_file/anim_file_format.h, cross-checked against the reference
// Python encoder at scripts/seq2anim.py. Not documented in the device's own
// OpenAPI spec or the busy.app docs mirror.
//
// File layout: AnimFileHeader (36 bytes) -> Sections chunk -> Frames chunk.
// All integers little-endian. We only ever emit one "default" section
// (covering the whole animation) and Bgra8888 color format (the only mode
// this project needs — full RGBA color with alpha), Raw encoding only (RLE
// is optional per the spec; not needed for correctness).

const SIGNATURE = "bicycle0";
const COLOR_FORMAT_BGRA8888 = 2;
const FRAME_ENCODING_RAW = 0;
const HEADER_LENGTH = 36;

export interface EncodeAnimFileOptions {
  width: number;
  height: number;
  fps: number;
  /** One entry per source (display) frame, each RGBA bytes, width*height*4 long. */
  frames: Uint8Array[];
}

interface FileFrame {
  /** How many consecutive identical source frames this one represents. */
  duration: number;
  /** Packed Bgra8888 pixel bytes for this frame. */
  data: Uint8Array;
}

/** RGBA -> Bgra8888 (B, G, R, A per pixel — this device format's own byte order, not the debunked toDeviceColor R/B swap). */
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

/** Collapses consecutive identical source frames into one FileFrame with duration > 1. */
function buildFileFrames(frames: Uint8Array[]): FileFrame[] {
  const fileFrames: FileFrame[] = [];
  for (const frame of frames) {
    const packed = packBgra8888(frame);
    const last = fileFrames[fileFrames.length - 1];
    if (last && sameBytes(last.data, packed) && last.duration < 255) {
      last.duration++;
    } else {
      fileFrames.push({ duration: 1, data: packed });
    }
  }
  return fileFrames;
}

export function encodeAnimFile(options: EncodeAnimFileOptions): Uint8Array {
  const { width, height, fps, frames } = options;
  if (frames.length === 0) throw new Error("encodeAnimFile: at least one frame is required");

  const fileFrames = buildFileFrames(frames);
  const maxEncodedLength = Math.max(...fileFrames.map((f) => f.data.length));

  const sectionName = "default\0";
  const sectionsChunkLength = 4 + 4 + 4 + 1 + sectionName.length; // start,end,frame_offs,duration_override,name
  const framesChunkLength = fileFrames.reduce((sum, f) => sum + 4 + f.data.length, 0);

  const totalLength = HEADER_LENGTH + sectionsChunkLength + framesChunkLength;
  const out = new Uint8Array(totalLength);
  const dv = new DataView(out.buffer);

  // Header
  new TextEncoder().encodeInto(SIGNATURE, out.subarray(0, 8));
  dv.setUint8(8, 0); // flags
  dv.setUint8(9, width);
  dv.setUint8(10, height);
  dv.setUint8(11, COLOR_FORMAT_BGRA8888);
  dv.setUint8(12, fps);
  dv.setUint16(13, maxEncodedLength, true);
  dv.setUint8(15, 0); // _unused
  dv.setUint32(16, sectionsChunkLength, true);
  dv.setUint32(20, framesChunkLength, true);
  dv.setUint32(24, 1, true); // section_count
  dv.setUint32(28, fileFrames.length, true); // file_frame_count
  dv.setUint32(32, frames.length, true); // display_frame_count

  // Sections chunk: single "default" section spanning every display frame.
  const sectionsOffset = HEADER_LENGTH;
  dv.setUint32(sectionsOffset + 0, 0, true); // start
  dv.setUint32(sectionsOffset + 4, frames.length - 1, true); // end
  dv.setUint32(sectionsOffset + 8, HEADER_LENGTH + sectionsChunkLength, true); // frame_offs (first file frame's offset)
  dv.setUint8(sectionsOffset + 12, fileFrames[0]!.duration); // duration_override
  new TextEncoder().encodeInto(sectionName, out.subarray(sectionsOffset + 13, sectionsOffset + 13 + sectionName.length));

  // Frames chunk
  let offset = HEADER_LENGTH + sectionsChunkLength;
  for (const fileFrame of fileFrames) {
    dv.setUint8(offset + 0, FRAME_ENCODING_RAW);
    dv.setUint8(offset + 1, fileFrame.duration);
    dv.setUint16(offset + 2, fileFrame.data.length, true);
    out.set(fileFrame.data, offset + 4);
    offset += 4 + fileFrame.data.length;
  }

  return out;
}
