# Tracker TCP Simulator

Standalone app that simulates a GT06 tracker device: connects to the tracker TCP server and streams positions along a real route (point A → B) or runs a simple one-shot test.

## Prerequisites

- Node 18+
- Tracker TCP server running (e.g. from `api`: `pnpm run dev:tcp`)

## Install

From repo root:

```bash
pnpm install
```

## Usage

From repo root (recommended):

```bash
pnpm --filter simulator dev
pnpm --filter simulator start "Av Paulista, São Paulo" "Campinas" --speed=60 --interval=15
```

From `apps/simulator`:

```bash
pnpm dev
pnpm start "origin" "destination" [options]
```

### Modes

- **Route mode** (with origin + destination): Fetches the route from Google Routes API (or cache), then sends GT06 login + location packets at the given interval and speed.
- **Simple mode** (no args): Sends login + heartbeat + one fixed position.

### Options

| Option        | Default           | Description              |
|---------------|-------------------|--------------------------|
| `--host=`     | localhost         | Tracker TCP host         |
| `--port=`     | 5023              | Tracker TCP port         |
| `--imei=`     | 123456789012345   | Device IMEI              |
| `--speed=`    | 50                | Speed in km/h            |
| `--interval=` | 10                | Position interval (sec)  |
| `--api-key=`  | (env)             | Google Routes API key    |
| `--no-cache`  | false             | Skip route cache         |

Env: `TRACKER_TCP_HOST`, `TRACKER_TCP_PORT`, `TRACKER_TEST_IMEI`, `GOOGLE_MAPS_API_KEY`.

### Route cache

Routes are cached under `tmp/route-cache/` (git-ignored). Use `--no-cache` to force a new API request.

## Google Routes API

Enable the **Routes API** in Google Cloud Console (not the legacy Directions API). Set `GOOGLE_MAPS_API_KEY` or pass `--api-key=KEY`.
