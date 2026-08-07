import { drawElements, clearDisplay } from "../lib/busybar-client.ts";
import { colorGridPayload, PALETTE, COLUMNS } from "./palette.ts";

const APPLICATION_NAME = "color_grid";

export async function drawColorGrid(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await clearDisplay(baseUrl, APPLICATION_NAME, fetchImpl);
  await drawElements(baseUrl, colorGridPayload(), fetchImpl);
}

if (import.meta.main) {
  const baseUrl = process.env.BUSYBAR_BASE_URL ?? "http://10.0.4.20";
  await drawColorGrid(baseUrl);
  console.log(`Color grid drawn on ${baseUrl}. Swatches, left-to-right, top-to-bottom:`);
  PALETTE.forEach((swatch, i) => {
    const sep = (i + 1) % COLUMNS === 0 ? "\n" : "  ";
    process.stdout.write(swatch.label.padEnd(8) + sep);
  });
}
