// A full-display looping animation rendered ahead of time and played by the
// bar's own firmware (see anim-file.ts). Scenes are pure: `frames()` returns
// every frame of one seamless loop as opaque RGBA, FRONT_WIDTH*FRONT_HEIGHT*4
// bytes each; runScene (below) encodes, uploads and draws it.

export const FRONT_WIDTH = 72;
export const FRONT_HEIGHT = 16;

export interface Scene {
  /** Control-server app id and device application_name, e.g. "lava_lamp" (snake_case). */
  id: string;
  /** Display name, Title Case, e.g. "Lava Lamp". */
  name: string;
  /** Playback rate the frames were rendered for; 24–48. */
  fps: number;
  /** One seamless loop: frame N-1 flows into frame 0. */
  frames(): Uint8Array[];
}
