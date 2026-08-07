# busybar

Custom apps for the [BUSY Bar](https://busy.app) HTTP display API.

## Prerequisites

- [Bun](https://bun.sh)
- A BUSY Bar, connected to your computer via USB

## Getting hello-world working

1. Install dependencies:

   ```sh
   bun install
   ```

2. Connect your BUSY Bar to your computer via USB. No authentication is
   needed over USB — the device is reachable at `10.0.4.20`.

3. Run the app:

   ```sh
   bun run hello-world
   ```

   You should see "Hello, World!" centered on the BUSY Bar's front display.

## Other apps

- **nyan-cat** — pixel-art Nyan Cat on the front display.
  - `bun run nyan-cat:stationary` — draws once, centered, stays put.
  - `bun run nyan-cat:flying` — loops it flying across the screen; Ctrl+C to
    stop (clears the display on exit).
- **color-grid** — a systematic 72-swatch reference palette for checking how
  a given color actually renders on the physical LED matrix before using it
  elsewhere: 12 hues (30° apart) crossed with a 3-step brightness ramp and a
  2-step saturation ramp, plus a 12-step grayscale ramp.
  - `bun run color-grid` — draws the grid and prints the row/column key.

### Shared code

`src/lib/` holds code used by every app: `display.ts` (the `RectangleElement`
type, device color/positioning quirks compensation, display dimensions) and
`busybar-client.ts` (the draw/clear HTTP calls). Not an app itself — nothing
to run directly.

### Connecting over Wi-Fi or the internet instead

By default the app talks to `http://10.0.4.20` (USB). To target a device over
Wi-Fi or the internet, set `BUSYBAR_BASE_URL`:

```sh
BUSYBAR_BASE_URL=http://<busy-bar-ip-address> bun run hello-world
```

Wi-Fi and internet connections require authentication, which this app does
not yet send — see the [HTTP API docs](https://docs.busy.app/bar/dev/http-api)
for the `X-API-Token` (Wi-Fi) or `Authorization: Bearer` (internet) headers
you'd need to add.

## Tests

```sh
bun test
```
