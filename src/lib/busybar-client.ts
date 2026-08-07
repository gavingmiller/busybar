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
