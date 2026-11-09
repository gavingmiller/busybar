// Fangs, the worm from Number Munchers, hand-drawn at bar scale from
// public/sprites/fangs/sheet.png (walkLeft frames, mirrored to face right).
// Redder than the sheet on request (Gavin 2026-11-09: "make him redder").
// Head raised at the front with one eye and two fangs under the mouth; the
// body hump travels back along the ground over the four frames.
import type { RunnerArt } from "../art.ts";

export const FANGS: RunnerArt = {
  name: "Fangs",
  frames: [
    [
      "..........KKKK..",
      ".........KPPPPK.",
      ".........KPWEPK.",
      "......KK.KPPPPPK",
      ".....KPPKKPPPPPK",
      "....KPPDPPPDDPKK",
      ".KKKPPDDPPDDKWW.",
      "KPPPPDDKKDDK....",
      ".KKKKKK.KKK.....",
    ],
    [
      "................",
      "..........KKKK..",
      ".........KPPPPK.",
      ".........KPWEPK.",
      "...KKK...KPPPPPK",
      "..KPPPKKKKPPPPPK",
      ".KPPDDPPPPPDDPKK",
      "KPDDKKDDDDDDKWW.",
      "KKK...KKKKKK....",
    ],
    [
      "................",
      "................",
      "...........KKKK.",
      "..........KPPPPK",
      "..........KPWEPK",
      "..........KPPPPK",
      "KKKKKKKKKKKPPPPK",
      "KPPPDDDDPPPDDKWW",
      ".KKKKKKKKKKKKK..",
    ],
    [
      "................",
      "..........KKKK..",
      ".........KPPPPK.",
      ".........KPWEPK.",
      ".........KPPPPPK",
      "......KKKKPPPPPK",
      "KKK..KPPPPPDDPKK",
      "KPPKKPDDDDDDKWW.",
      ".KKKKKK.KKKK....",
    ],
  ],
  colors: { K: "#6A3A5A", P: "#D83A50", D: "#9A2440", W: "#F4E8EE", E: "#2A1830" },
  eye: [12, 2],
};
