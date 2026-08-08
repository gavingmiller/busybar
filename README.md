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
  - `bun run nyan-cat:rainbow` — cat stays centered, but the rainbow trail
    scrolls in place (the wave pattern's phase advances each frame); Ctrl+C
    to stop.
- **color-grid** — a systematic 72-swatch reference palette for checking how
  a given color actually renders on the physical LED matrix before using it
  elsewhere: 12 hues (30° apart) crossed with a 3-step brightness ramp and a
  2-step saturation ramp, plus a 12-step grayscale ramp.
  - `bun run color-grid` — draws the grid and prints the row/column key.

### Shared code

`src/lib/` holds the rendering/animation pipeline every app is built on top
of — not an app itself, nothing to run directly:

- `display.ts` — the `RectangleElement` type, device color/positioning quirk
  compensation, display dimensions, draw priority.
- `canvas.ts` — a pixel buffer to draw onto (`setPixel`/`fillRect`/
  `paintGrid`), compiled to the fewest `RectangleElement`s the device needs
  (row run-length + vertical merge). This is the image rendering library —
  every visual app builds a `Canvas`, draws onto it, then calls
  `toElements()`, rather than hand-placing rects.
- `busybar-client.ts` — the draw/clear HTTP calls, including `drawFrame()`
  (clear everything, then draw — see below).
- `animate.ts` — the animation library, built on `canvas.ts` +
  `busybar-client.ts`: `runAnimation()` clears, then repeatedly calls a
  `frameFn(tick)` on an interval and draws the result; `installShutdownHandler()`
  wires Ctrl+C to stop the loop and clear the display.

**Every draw clears the *entire* display first, not just the drawing app's
own prior elements.** `/api/display/draw` upserts elements by id rather than
replacing the scene, and — confirmed live against the device — a *different*
app's leftover draw can block a fresh one even at max priority, despite the
API spec claiming equal-priority + a different `application_name` should
override. `drawFrame()` and `runAnimation()` both clear unconditionally so
switching between apps never silently fails.

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
