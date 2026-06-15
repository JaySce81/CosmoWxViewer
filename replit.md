# Cosmic Web Visualizer

A scientifically accurate 3D cosmological visualization showing ~3 million DESI survey galaxies positioned from Earth using real RA/Dec/redshift data, with Saffir-Simpson-inspired density color coding, velocity flow overlays, galaxy futurecast animation, and full zoom/pan/rotate navigation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/cosmic-web run dev` — run the 3D frontend (port 19074, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (no DB — serves directly from CSV files in memory)
- Frontend: React + Vite + Three.js + @react-three/fiber + @react-three/drei
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle for API server)

## Where things live

- `attached_assets/` — 6 DESI LRG CSV files (~500k galaxies each, ~3M total)
- `artifacts/api-server/src/routes/galaxies.ts` — galaxy data loading, coordinate conversion, density grid
- `artifacts/cosmic-web/src/components/CosmicViewer.tsx` — Three.js/R3F 3D canvas
- `artifacts/cosmic-web/src/components/GalaxyPoints.tsx` — 80k-galaxy point cloud renderer
- `artifacts/cosmic-web/src/components/FlowField.tsx` — velocity flow overlay (like UW steering charts)
- `artifacts/cosmic-web/src/lib/cosmicColors.ts` — Saffir-Simpson density color scale
- `lib/api-spec/openapi.yaml` — API contract (source of truth)

## Architecture decisions

- **No database**: All 3M galaxies are loaded into memory at server startup from CSV files (~8s cold start), then sampled per-request. No DB needed for read-only astronomical data.
- **Coordinate conversion on server**: RA/Dec/z → Cartesian Mpc via ΛCDM comoving distance (H0=70, Ω_m=0.3, Ω_Λ=0.7) with 1000-step numerical integration, pre-computed via lookup table.
- **Density grid**: 48³ spatial bins over ±3500 Mpc, density contrast δ = n/n̄ - 1. 16³ flow field coarsened for rendering performance.
- **Saffir-Simpson color scale**: Voids (high pressure) = light blue → Superclusters (Cat 5) = red, matching hurricane analogy.
- **Scale**: 1 Three.js world unit = 1000 Mpc. Galaxy render range ≈ z=0.6–1.1 (1730–3100 Mpc).
- **WebGL detection**: Pre-checks GPU availability before mounting Canvas to avoid Vite error overlay in no-GPU environments.

## Product

- Full-screen 3D cosmic web visualization with Earth at center
- 80k galaxy point cloud (sampled from 3M) colored by local density, redshift, or dataset
- Saffir-Simpson density scale: void=High pressure, filaments=Cat 3, clusters=Cat 5
- Velocity flow overlay (density-gradient-driven, like UW tropical weather steering charts)
- Density field contour overlay
- Futurecast animation: advance galaxy positions along flow field vectors
- Layer controls: galaxies, flow field, density contours, scale grid, starfield, Earth marker
- Dataset filter: individual z-bin DESI slices or all combined
- Color modes: by density, redshift, or dataset membership

## User preferences

_Accuracy is paramount. Multi-session effort expected._

## Gotchas

- API server takes ~8s on cold start to load all 3M galaxies; `/galaxies/stats` returns `ready: false` until done
- `allGalaxies.push(...g)` with 500k elements causes stack overflow — must use a for loop
- WebGL requires GPU; Replit's preview iframe has no GPU. Use deploy or open in GPU browser tab to see 3D
- Never import `@workspace/db` in api-server; no database is provisioned for this project

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
