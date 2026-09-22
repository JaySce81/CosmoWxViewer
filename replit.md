# Cosmic Universe Model

A catalog-driven 3D cosmological visualization showing the supplied DESI and SPARC records in true comoving space. Each record is positioned from its own RA/Dec/redshift, sized from a catalog diameter or documented class fallback, and colored by the selected measured motion or rotation field.

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

- `attached_assets/` — supplied DESI/SPARC catalog files
- `artifacts/api-server/src/routes/galaxies.ts` — catalog discovery, ΛCDM distance conversion, and per-record motion fields
- `artifacts/cosmic-web/src/components/CosmicViewer.tsx` — Three.js/R3F 3D canvas
- `artifacts/cosmic-web/src/components/GalaxyPoints.tsx` — 80k-galaxy point cloud renderer
- `artifacts/cosmic-web/src/components/FlowField.tsx` — per-galaxy motion-vector overlay
- `artifacts/cosmic-web/src/lib/cosmicColors.ts` — dataset-class colors
- `lib/api-spec/openapi.yaml` — API contract (source of truth)

## Architecture decisions

- **No database**: Catalog records are loaded into memory at server startup, then sampled per request.
- **Coordinate conversion on server**: Each RA/Dec/redshift record is independently converted to Cartesian comoving Mpc using flat ΛCDM with H₀=67.4, Ωₘ=0.315, ΩΛ=0.685 and midpoint numerical integration.
- **Motion**: The supplied spectroscopic redshift is converted to an individual relativistic line-of-sight velocity and projected into a radial 3-D vector. Transverse and rotation fields remain null when absent from the source catalog.
- **Physical size**: Catalog diameters are used when present; otherwise the API marks a class-specific typical diameter fallback so the UI never presents it as a measurement.
- **Scale**: 1 Three.js world unit = 1 Mpc (true physical scale). Camera far plane and zoom limits are updated to cover the full 3000+ Mpc volume with a Stellarium-like zoom/pan experience.
- **WebGL detection**: Pre-checks GPU availability before mounting Canvas to avoid Vite error overlay in no-GPU environments.

## Product

- Full-screen 3D catalog visualization with Earth at the observer origin
- 80k-record point cloud sampled from the available catalogs without shell flattening
- Dot size tied to physical diameter data or an explicit typical class fallback
- Color modes for rotation speed, rotation direction, line-of-sight velocity, transverse motion, and dataset class
- Per-record motion vectors using only available spectroscopic velocities
- Motion preview: advance records using 1 km/s × 1 Gyr ≈ 1.022 Mpc
- Dynamic HUD scale bar that updates with camera zoom
- Layer controls: galaxies, motion vectors, comoving grid, starfield, Earth marker
- Dataset filter: discovered ELG, BGS, LRG, and SPARC catalog files

## User preferences

_Accuracy is paramount. Multi-session effort expected._

## Gotchas

- API server loads catalog files on cold start; `/galaxies/stats` returns `ready: false` until done
- `allGalaxies.push(...g)` with 500k elements causes stack overflow — must use a for loop
- WebGL requires GPU; Replit's preview iframe has no GPU. Use deploy or open in GPU browser tab to see 3D
- Never import `@workspace/db` in api-server; no database is provisioned for this project

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
