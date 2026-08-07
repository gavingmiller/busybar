interface TextElement {
  id: string;
  type: "text";
  text: string;
  font: "normal" | "small" | "tiny" | "condensed" | "bold" | "large" | "extra_large" | "global";
  align: "top_left" | "top_mid" | "top_right" | "mid_left" | "center" | "mid_right" | "bottom_left" | "bottom_mid" | "bottom_right";
  display: "front" | "back";
  timeout: number;
}

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
      },
    ],
  };
}

export async function drawHelloWorld(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/display/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(helloWorldPayload()),
  });

  if (!res.ok) {
    throw new Error(`BUSY Bar rejected draw request: ${res.status} ${await res.text()}`);
  }
}

if (import.meta.main) {
  const baseUrl = process.env.BUSYBAR_BASE_URL ?? "http://10.0.4.20";
  await drawHelloWorld(baseUrl);
  console.log(`Sent "Hello, World!" to ${baseUrl}`);
}
