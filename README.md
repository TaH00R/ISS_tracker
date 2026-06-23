#  ISS Live Tracker

A production-quality real-time ISS tracker built with **Three.js**, **satellite.js**, and **Vite**.

## Features

- **Live TLE propagation** — Fetches real orbital data from Celestrak every hour
- **SGP4 orbital mechanics** — Full ECI → ECEF → Three.js coordinate pipeline
- **Photorealistic Earth** — Day/night blending shader, clouds, Fresnel atmosphere
- **Orbit path** — One full 92-minute orbit drawn from future SGP4 positions
- **Ground track** — Sub-satellite path projected onto Earth's surface
- **ISS trail** — Recent position history rendered in 3D space
- **Telemetry panel** — Live lat/lon/altitude/velocity
- **Three camera modes** — Free orbit, Follow ISS, Auto-rotate

## Setup

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

## Architecture

```
src/
├── main.js          — Scene, renderer, camera, animation loop, UI
├── Earth.js         — Earth mesh with day/night shader, clouds, atmosphere
├── ISS.js           — ISS marker, orbit trail, ground dot, nadir line
├── OrbitPath.js     — Full orbit path and ground track rendering
├── tracker.js       — TLE management, satrec, SGP4 propagation
└── utils/
    ├── constants.js — All physical and scene constants
    ├── coordinates.js — ECI→ECEF→Three.js coordinate transforms
    └── tle.js       — TLE fetch, parse, cache, hourly refresh
```

## Coordinate Pipeline

```
TLE strings
    │
    ▼  satellite.twoline2satrec()
  satrec (orbital elements)
    │
    ▼  satellite.propagate(satrec, date)
  ECI position + velocity  (km, Earth-centred inertial)
    │
    ▼  satellite.gstime(date)  → GMST angle
    │
    ▼  satellite.eciToEcf(eci, gmst)
  ECEF position (km, Earth-fixed)
    │
    ▼  ecefToThree({ x, y, z })
  Three.js Vector3 (scene units, EARTH_RADIUS = 1)
```

### Axis mapping (ECEF → Three.js)

| ECEF axis | Meaning | Three.js axis |
|-----------|---------|---------------|
| +X | Prime meridian | +X |
| +Y | 90° E longitude | −Z |
| +Z | North pole | +Y |

The Y↔Z swap with Z negation places Earth's geographic north at Three.js +Y (up),
consistent with Three.js conventions.

## TLE / CORS Notes

Celestrak does not set `Access-Control-Allow-Origin` headers, so browser
requests are blocked by CORS.  The Vite dev server proxies `/tle-proxy` to
Celestrak automatically.  For production, point the proxy to your own
CORS-enabled backend.  If all network requests fail, the app falls back to a
bundled TLE (slightly stale but functional for demonstration).

## Texture Credits

Earth textures served via `unpkg.com/three-globe`, sourced from NASA's
[Visible Earth](https://visibleearth.nasa.gov/) collection (public domain).

## License

MIT
