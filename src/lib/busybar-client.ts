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
