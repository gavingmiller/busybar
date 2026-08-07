import { drawFrame } from "../lib/busybar-client.ts";
import { colorGridPayload, HUES, ROW_LABELS } from "./palette.ts";

export async function drawColorGrid(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await drawFrame(baseUrl, colorGridPayload(), fetchImpl);
}

if (import.meta.main) {
  const baseUrl = process.env.BUSYBAR_BASE_URL ?? "http://10.0.4.20";
  await drawColorGrid(baseUrl);
  console.log(`Color grid drawn on ${baseUrl}.`);
  console.log(`Columns (left-to-right) are hues, 30 degrees apart: ${HUES.join(", ")}`);
  console.log(`Rows (top-to-bottom): ${ROW_LABELS.join(", ")}`);
  console.log(
    "full/dark1/dark2 = 100% saturation at 100/66/33% value; " +
      "pale1/pale2 = 100% value at 66/33% saturation; grayscale = 0% saturation, 0-100% value."
  );
}
