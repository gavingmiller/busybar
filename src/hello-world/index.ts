import { drawElements } from "../lib/busybar-client.ts";

interface TextElement {
  id: string;
  type: "text";
  text: string;
  font: "normal" | "small" | "tiny" | "condensed" | "bold" | "large" | "extra_large" | "global";
  align: "top_left" | "top_mid" | "top_right" | "mid_left" | "center" | "mid_right" | "bottom_left" | "bottom_mid" | "bottom_right";
  display: "front" | "back";
  timeout: number;
  x: number;
  y: number;
}

// Front display is 72x16px (see docs-cache/busy/bar/tech-specs.md). `align`
// only sets the anchor point of the element — x/y still position that
// anchor relative to the top-left corner, and default to (0, 0).
const FRONT_DISPLAY_CENTER = { x: 36, y: 8 };

interface DisplayElements {
  application_name: string;
  elements: TextElement[];
}

export function helloWorldPayload(): DisplayElements {
  return {
    application_name: "hello_world",
    elements: [
      {
        id: "0",
        type: "text",
        text: "Hello, World!",
        font: "normal",
        align: "center",
        display: "front",
        timeout: 0,
        x: FRONT_DISPLAY_CENTER.x,
        y: FRONT_DISPLAY_CENTER.y,
      },
    ],
  };
}

export async function drawHelloWorld(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  await drawElements(baseUrl, helloWorldPayload(), fetchImpl);
}

if (import.meta.main) {
  const baseUrl = process.env.BUSYBAR_BASE_URL ?? "http://10.0.4.20";
  await drawHelloWorld(baseUrl);
  console.log(`Sent "Hello, World!" to ${baseUrl}`);
}
