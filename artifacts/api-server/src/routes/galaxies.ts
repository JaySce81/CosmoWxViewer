import { Router } from "express";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { logger } from "../lib/logger";

const router = Router();

// ─── Cosmology ───────────────────────────────────────────────────────────────
const H0 = 70;           // km/s/Mpc
const OMEGA_M = 0.3;
const OMEGA_L = 0.7;
const C_LIGHT = 299792.458; // km/s

function E(z: number): number {
  return Math.sqrt(OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);
}

// Comoving distance via 1000-step Riemann integration (accurate to ~0.01%)
function comovingDistance(z: number): number {
  if (z <= 0) return 0;
  const N = 1000;
  const dz = z / N;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    sum += 1 / E((i + 0.5) * dz);
  }
  return (C_LIGHT / H0) * sum * dz;
}

// Pre-compute lookup table for speed
const Z_TABLE_N = 2000;
const Z_TABLE_MAX = 1.5;
const zTable: Float64Array = new Float64Array(Z_TABLE_N);
for (let i = 0; i < Z_TABLE_N; i++) {
  zTable[i] = comovingDistance((i / Z_TABLE_N) * Z_TABLE_MAX);
}

function fastComovingDistance(z: number): number {
  const idx = (z / Z_TABLE_MAX) * Z_TABLE_N;
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, Z_TABLE_N - 1);
  const frac = idx - i0;
  return zTable[i0] * (1 - frac) + zTable[i1] * frac;
}

// ─── Dataset Definitions ─────────────────────────────────────────────────────
const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const DATA_DIR = path.resolve(workspaceRoot, "attached_assets");

const DATASETS = [
  { name: "lrg60",  file: "Desielg60-70_1781560104885.csv",  zMin: 0.60, zMax: 0.70, label: "DESI LRG z=0.6–0.7" },
  { name: "lrg70",  file: "Desielg70-80_1781560104877.csv",  zMin: 0.70, zMax: 0.80, label: "DESI LRG z=0.7–0.8" },
  { name: "lrg80",  file: "Desielg80-90_1781560104869.csv",  zMin: 0.80, zMax: 0.90, label: "DESI LRG z=0.8–0.9" },
  { name: "lrg90",  file: "Desielg90-100_1781560104860.csv", zMin: 0.90, zMax: 1.00, label: "DESI LRG z=0.9–1.0" },
  { name: "lrg100", file: "Desielg100-110_1781560104894.csv",zMin: 1.00, zMax: 1.10, label: "DESI LRG z=1.0–1.1" },
  { name: "lrg2",   file: "Desilrg2_1781560104852.csv",      zMin: 0.75, zMax: 1.10, label: "DESI LRG2 z=0.75–1.1" },
];

// ─── Galaxy Record ────────────────────────────────────────────────────────────
interface GalaxyRaw {
  ra: number;   // degrees
  dec: number;  // degrees
  z: number;    // redshift
  x: number;    // Mpc (comoving)
  y: number;
  zc: number;   // z-cartesian (named zc to avoid collision with redshift z)
  dist: number; // comoving Mpc
  dataset: string;
}

// ─── In-memory Galaxy Store ──────────────────────────────────────────────────
const galaxyStore: Map<string, GalaxyRaw[]> = new Map();
let totalLoaded = 0;
let storeReady = false;
let densityGridCache: ReturnType<typeof buildDensityGrid> | null = null;

// ─── CSV Parsing ──────────────────────────────────────────────────────────────
async function parseCSV(filePath: string, datasetName: string): Promise<GalaxyRaw[]> {
  return new Promise((resolve, reject) => {
    const results: GalaxyRaw[] = [];
    if (!fs.existsSync(filePath)) {
      logger.warn({ filePath }, "Dataset file not found, skipping");
      resolve([]);
      return;
    }

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let firstLine = true;
    let raIdx = 0, decIdx = 1, zIdx = 2;

    rl.on("line", (line) => {
      if (firstLine) {
        firstLine = false;
        const headers = line.split(",").map(h => h.trim().toLowerCase());
        raIdx = headers.indexOf("ra");
        decIdx = headers.indexOf("dec");
        zIdx = headers.indexOf("z");
        if (raIdx < 0) raIdx = 0;
        if (decIdx < 0) decIdx = 1;
        if (zIdx < 0) zIdx = 2;
        return;
      }

      const parts = line.split(",");
      if (parts.length < 3) return;

      const ra = parseFloat(parts[raIdx]);
      const dec = parseFloat(parts[decIdx]);
      const z = parseFloat(parts[zIdx]);

      if (isNaN(ra) || isNaN(dec) || isNaN(z)) return;
      if (z <= 0 || z > 2.0) return;

      const dist = fastComovingDistance(z);
      const raRad = (ra * Math.PI) / 180;
      const decRad = (dec * Math.PI) / 180;
      const cosDec = Math.cos(decRad);

      results.push({
        ra, dec, z,
        x: dist * cosDec * Math.cos(raRad),
        y: dist * cosDec * Math.sin(raRad),
        zc: dist * Math.sin(decRad),
        dist,
        dataset: datasetName,
      });
    });

    rl.on("close", () => resolve(results));
    rl.on("error", reject);
  });
}

// ─── Density Grid ────────────────────────────────────────────────────────────
const GRID_RES = 48; // grid cells per axis

function buildDensityGrid(allGalaxies: GalaxyRaw[]) {
  if (allGalaxies.length === 0) {
    return { cells: [], resolution: GRID_RES, bounds: { min: -3500, max: 3500 } };
  }

  const BOUNDS = 3500; // Mpc — covers z~1.1
  const cellSize = (BOUNDS * 2) / GRID_RES;

  // 3D count grid
  const counts = new Float32Array(GRID_RES * GRID_RES * GRID_RES);
  const idx3d = (ix: number, iy: number, iz: number) =>
    ix * GRID_RES * GRID_RES + iy * GRID_RES + iz;

  for (const g of allGalaxies) {
    const ix = Math.floor((g.x + BOUNDS) / cellSize);
    const iy = Math.floor((g.y + BOUNDS) / cellSize);
    const iz = Math.floor((g.zc + BOUNDS) / cellSize);
    if (ix >= 0 && ix < GRID_RES && iy >= 0 && iy < GRID_RES && iz >= 0 && iz < GRID_RES) {
      counts[idx3d(ix, iy, iz)]++;
    }
  }

  // Mean count per occupied cell
  let occupied = 0;
  let total = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) { occupied++; total += counts[i]; }
  }
  const mean = occupied > 0 ? total / occupied : 1;

  // Build flow-vector cells — only return non-empty cells for flow overlay
  // Flow approximated by density gradient (∇δ): matter flows toward overdensities
  const cells: Array<{x:number,y:number,z:number,density:number,vx:number,vy:number,vz:number}> = [];

  // Resolution for flow (coarser)
  const FLOW_RES = 16;
  const flowStep = Math.floor(GRID_RES / FLOW_RES);

  for (let fi = 0; fi < FLOW_RES; fi++) {
    for (let fj = 0; fj < FLOW_RES; fj++) {
      for (let fk = 0; fk < FLOW_RES; fk++) {
        const i = Math.min(fi * flowStep + Math.floor(flowStep / 2), GRID_RES - 1);
        const j = Math.min(fj * flowStep + Math.floor(flowStep / 2), GRID_RES - 1);
        const k = Math.min(fk * flowStep + Math.floor(flowStep / 2), GRID_RES - 1);

        const c = counts[idx3d(i, j, k)];
        const delta = c / mean - 1;

        // Central differences for gradient
        const ip = Math.min(i + 1, GRID_RES - 1);
        const im = Math.max(i - 1, 0);
        const jp = Math.min(j + 1, GRID_RES - 1);
        const jm = Math.max(j - 1, 0);
        const kp = Math.min(k + 1, GRID_RES - 1);
        const km = Math.max(k - 1, 0);

        // Gradient (flow goes TOWARD overdense regions, i.e. +gradient direction)
        const gx = (counts[idx3d(ip, j, k)] - counts[idx3d(im, j, k)]) / (2 * mean);
        const gy = (counts[idx3d(i, jp, k)] - counts[idx3d(i, jm, k)]) / (2 * mean);
        const gz = (counts[idx3d(i, j, kp)] - counts[idx3d(i, j, km)]) / (2 * mean);

        // World position of this flow cell center
        const wx = (i + 0.5) * cellSize - BOUNDS;
        const wy = (j + 0.5) * cellSize - BOUNDS;
        const wz = (k + 0.5) * cellSize - BOUNDS;

        cells.push({ x: wx, y: wy, z: wz, density: delta, vx: gx, vy: gy, vz: gz });
      }
    }
  }

  return { cells, resolution: FLOW_RES, bounds: { min: -BOUNDS, max: BOUNDS } };
}

// ─── Per-galaxy density annotation ──────────────────────────────────────────
function annotateGalaxyDensities(
  galaxies: GalaxyRaw[],
  grid: ReturnType<typeof buildDensityGrid>
): Array<GalaxyRaw & { density: number }> {
  if (!grid || grid.cells.length === 0) {
    return galaxies.map(g => ({ ...g, density: 0 }));
  }

  const BOUNDS = 3500;
  const FULL_RES = GRID_RES;
  const cellSize = (BOUNDS * 2) / FULL_RES;

  // Rebuild count grid for annotation (reuse if possible)
  const counts = new Float32Array(FULL_RES * FULL_RES * FULL_RES);
  const idx3d = (ix: number, iy: number, iz: number) =>
    ix * FULL_RES * FULL_RES + iy * FULL_RES + iz;

  for (const g of galaxies) {
    const ix = Math.floor((g.x + BOUNDS) / cellSize);
    const iy = Math.floor((g.y + BOUNDS) / cellSize);
    const iz = Math.floor((g.zc + BOUNDS) / cellSize);
    if (ix >= 0 && ix < FULL_RES && iy >= 0 && iy < FULL_RES && iz >= 0 && iz < FULL_RES) {
      counts[idx3d(ix, iy, iz)]++;
    }
  }

  let occupied = 0, total = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) { occupied++; total += counts[i]; }
  }
  const mean = occupied > 0 ? total / occupied : 1;

  return galaxies.map(g => {
    const ix = Math.min(Math.max(Math.floor((g.x + BOUNDS) / cellSize), 0), FULL_RES - 1);
    const iy = Math.min(Math.max(Math.floor((g.y + BOUNDS) / cellSize), 0), FULL_RES - 1);
    const iz = Math.min(Math.max(Math.floor((g.zc + BOUNDS) / cellSize), 0), FULL_RES - 1);
    const cnt = counts[idx3d(ix, iy, iz)];
    return { ...g, density: cnt / mean - 1 };
  });
}

// ─── Data Loading ────────────────────────────────────────────────────────────
async function loadAllData() {
  logger.info("Loading galaxy datasets...");
  for (const ds of DATASETS) {
    const filePath = path.join(DATA_DIR, ds.file);
    try {
      const galaxies = await parseCSV(filePath, ds.name);
      galaxyStore.set(ds.name, galaxies);
      totalLoaded += galaxies.length;
      logger.info({ dataset: ds.name, count: galaxies.length }, "Dataset loaded");
    } catch (err) {
      logger.error({ err, dataset: ds.name }, "Failed to load dataset");
      galaxyStore.set(ds.name, []);
    }
  }

  logger.info({ totalLoaded }, "All datasets loaded, building density grid...");

  const allGalaxies: GalaxyRaw[] = [];
  for (const galaxies of galaxyStore.values()) {
    for (const g of galaxies) allGalaxies.push(g);
  }
  densityGridCache = buildDensityGrid(allGalaxies);

  logger.info({ cells: densityGridCache.cells.length }, "Density grid built");
  storeReady = true;
}

// Start loading immediately
loadAllData().catch(err => logger.error({ err }, "Fatal: failed to load galaxy data"));

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/galaxies
router.get("/galaxies", (req, res) => {
  if (!storeReady) {
    res.status(503).json({ error: "Data loading, please try again shortly" });
    return;
  }

  const sampleSize = Math.min(parseInt(String(req.query.sample ?? "80000"), 10), 200000);
  const zmin = parseFloat(String(req.query.zmin ?? "0"));
  const zmax = parseFloat(String(req.query.zmax ?? "1.5"));
  const datasetFilter = String(req.query.dataset ?? "all");

  // Gather relevant galaxies
  let pool: GalaxyRaw[] = [];
  for (const [name, galaxies] of galaxyStore.entries()) {
    if (datasetFilter !== "all" && name !== datasetFilter) continue;
    for (const g of galaxies) {
      if (g.z >= zmin && g.z <= zmax) pool.push(g);
    }
  }

  const total = pool.length;

  // Uniform spatial sampling
  let sampled: GalaxyRaw[];
  if (total <= sampleSize) {
    sampled = pool;
  } else {
    const step = total / sampleSize;
    sampled = [];
    for (let i = 0; i < sampleSize; i++) {
      sampled.push(pool[Math.floor(i * step)]);
    }
  }

  // Annotate with density
  const annotated = annotateGalaxyDensities(sampled, densityGridCache!);

  res.json({
    galaxies: annotated.map(g => ({
      x: g.x,
      y: g.y,
      z: g.zc,
      ra: g.ra,
      dec: g.dec,
      redshift: g.z,
      distance: g.dist,
      density: g.density,
      dataset: g.dataset,
    })),
    total,
    returned: sampled.length,
    cosmology: { H0, OmegaM: OMEGA_M, OmegaL: OMEGA_L },
  });
});

// GET /api/galaxies/stats
router.get("/galaxies/stats", (_req, res) => {
  const datasets = DATASETS.map(ds => {
    const galaxies = galaxyStore.get(ds.name) ?? [];
    return {
      name: ds.name,
      count: galaxies.length,
      zMin: ds.zMin,
      zMax: ds.zMax,
      label: ds.label,
    };
  });

  res.json({
    datasets,
    totalGalaxies: totalLoaded,
    zRange: { min: 0.6, max: 1.1 },
    ready: storeReady,
  });
});

// GET /api/density-grid
router.get("/density-grid", (_req, res) => {
  if (!storeReady || !densityGridCache) {
    res.status(503).json({ error: "Data not ready" });
    return;
  }
  res.json(densityGridCache);
});

export default router;
