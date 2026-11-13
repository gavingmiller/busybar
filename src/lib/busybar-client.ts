export interface DisplayDrawPayload {
  application_name: string;
  elements: unknown[];
  priority?: number;
  led_notification_color?: string;
}

export async function drawElements(
  baseUrl: string,
  payload: DisplayDrawPayload,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/display/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`BUSY Bar rejected draw request: ${res.status} ${await res.text()}`);
  }
}

/**
 * Clears every app's draw from the display, then draws the payload.
 * `/api/display/draw` upserts elements by id rather than replacing the
 * scene, so a stale element from a previous, differently-shaped draw
 * otherwise lingers. Scoping the clear to just this payload's own
 * application_name isn't sufficient either — confirmed live against the
 * device that a *different* app's leftover draw can block a fresh
 * application_name's draw even at equal max priority (100), despite the
 * OpenAPI spec claiming equal-priority + different app_name should
 * override. An unscoped clear avoids this regardless of which app drew
 * previously, so every draw should go through this rather than calling
 * drawElements directly.
 */
export async function drawFrame(
  baseUrl: string,
  payload: DisplayDrawPayload,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  await clearAllDisplays(baseUrl, fetchImpl);
  await drawElements(baseUrl, payload, fetchImpl);
}

export async function clearDisplay(
  baseUrl: string,
  applicationName: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(
    `${baseUrl}/api/display/draw?application_name=${encodeURIComponent(applicationName)}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    throw new Error(`BUSY Bar rejected clear request: ${res.status} ${await res.text()}`);
  }
}

/** Clears every app's elements from the display, not just one. */
export async function clearAllDisplays(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/display/draw`, { method: "DELETE" });

  if (!res.ok) {
    throw new Error(`BUSY Bar rejected clear request: ${res.status} ${await res.text()}`);
  }
}

/** Uploads a file (e.g. a .anim animation asset) to an app's assets directory. */
export async function uploadAsset(
  baseUrl: string,
  applicationName: string,
  fileName: string,
  bytes: Uint8Array,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const url = `${baseUrl}/api/assets/upload?application_name=${encodeURIComponent(applicationName)}&file=${encodeURIComponent(fileName)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes,
  });

  if (!res.ok) {
    throw new Error(`BUSY Bar rejected asset upload: ${res.status} ${await res.text()}`);
  }
}

/** An installed JS app as reported by `GET /api/apps/list` (firmware ≥ 1.3.1). */
export interface DeviceApp {
  id: string;
  name: string;
  version?: string;
  api_version?: string;
  author?: string;
  description?: string;
  is_debug?: boolean;
  icon_path?: string;
}

/** Lists the JS apps installed on the device. */
export async function listApps(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<DeviceApp[]> {
  const res = await fetchImpl(`${baseUrl}/api/apps/list`);
  if (!res.ok) {
    throw new Error(`BUSY Bar rejected app list request: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { apps?: DeviceApp[] };
  return body.apps ?? [];
}

/** Launches an installed JS app by id. */
export async function launchApp(
  baseUrl: string,
  appId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/apps/launch?app_id=${encodeURIComponent(appId)}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`BUSY Bar rejected launch: ${res.status} ${await res.text()}`);
  }
}

/**
 * Uninstalls a JS app by id (`DELETE /api/apps?app_id=`, the call busy-cli
 * makes). The firmware update to 1.4.1 (2026-11-13) re-installed the stock
 * Clock, Weather and JS App Example that Gavin had removed; the control
 * server's heartbeat uninstalls `app.busy.*` whenever they reappear. The
 * device answers 503 when the app is running and it failed to quit it first.
 */
export async function uninstallApp(
  baseUrl: string,
  appId: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/apps?app_id=${encodeURIComponent(appId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`BUSY Bar rejected uninstall: ${res.status} ${await res.text()}`);
  }
}

/**
 * Quits whichever JS app is running. The device answers 409 when nothing is
 * running; that is the state we wanted, so it counts as success.
 */
export async function quitApp(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/apps/quit`, { method: "POST" });
  if (res.ok || res.status === 409) return;
  throw new Error(`BUSY Bar rejected quit: ${res.status} ${await res.text()}`);
}

/**
 * When the device last booted (`GET /api/status/system`, `boot_time` in
 * seconds). A boot later than our last command means every draw and running
 * app is gone: firmware auto-updates reboot the bar (1.4.1 landed overnight
 * 2026-11-13 and left it on its APPS menu).
 */
export async function getBootTime(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<Date> {
  const res = await fetchImpl(`${baseUrl}/api/status/system`);
  if (!res.ok) {
    throw new Error(`BUSY Bar rejected system status request: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { boot_time?: number };
  if (typeof body.boot_time !== "number") throw new Error("BUSY Bar system status has no boot_time");
  return new Date(body.boot_time * 1000);
}

/** One entry of a device storage directory (`GET /api/storage/list`). */
export interface StorageEntry {
  type: "file" | "dir";
  name: string;
  size?: number;
}

/** Lists a device storage directory; a directory that doesn't exist yet lists as empty (the device answers 400). */
export async function listStorage(baseUrl: string, path: string, fetchImpl: typeof fetch = fetch): Promise<StorageEntry[]> {
  const res = await fetchImpl(`${baseUrl}/api/storage/list?path=${encodeURIComponent(path)}`);
  if (res.status === 400) return [];
  if (!res.ok) throw new Error(`BUSY Bar rejected storage listing: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { list?: StorageEntry[] };
  return body.list ?? [];
}

/** Deletes one file from device storage (`DELETE /api/storage/remove`, confirmed live on fw 1.3.1). */
export async function removeStorageFile(baseUrl: string, path: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/storage/remove?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`BUSY Bar rejected storage remove: ${res.status} ${await res.text()}`);
}

/** Where `uploadAsset(baseUrl, applicationName, fileName)` lands on the device. */
export function assetStoragePath(applicationName: string, fileName = ""): string {
  return `/ext/user_assets/${applicationName}${fileName ? `/${fileName}` : ""}`;
}
