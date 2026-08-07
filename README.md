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
