import { Router } from "express";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { logger } from "../lib/logger";

const router = Router();

// ─── ΛCDM Cosmology ──────────────────────────────────────────────────────────
const H0 = 70;             // km/s/Mpc
const OMEGA_M = 0.3;
const OMEGA_L = 0.7;
const C_LIGHT = 299792.458; // km/s

function E(z: number): number {
  return Math.sqrt(OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);
}

// Pre-compute comoving distance lookup table for speed (1000-step integration)
const Z_TABLE_N = 4000;
const Z_TABLE_MAX = 1.6;
const zTable: Float64Array = new Float64Array(Z_TABLE_N);
for (let i = 0; i < Z_TABLE_N; i++) {
  const z = (i / Z_TABLE_N) * Z_TABLE_MAX;
  if (z <= 0) { zTable[i] = 0; continue; }
  const N = 1000;
  const dz = z / N;
  let sum = 0;
  for (let j = 0; j < N; j++) sum += 1 / E((j + 0.5) * dz);
  zTable[i] = (C_LIGHT / H0) * sum * dz;
}

function comovingDistance(z: number): number {
  if (z <= 0) return 0;
  if (z >= Z_TABLE_MAX) return zTable[Z_TABLE_N - 1];
  const idx = (z / Z_TABLE_MAX) * Z_TABLE_N;
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, Z_TABLE_N - 1);
  return zTable[i0] + (idx - i0) * (zTable[i1] - zTable[i0]);
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

// ─── Galaxy Record (internal) ─────────────────────────────────────────────────
interface GalaxyRaw {
  ra: number;    // degrees [0, 360)
  dec: number;   // degrees [-90, 90]
  z: number;     // spectroscopic redshift
  x: number;     // comoving Mpc
  y: number;
  zc: number;    // z-axis (comoving Mpc) — named "zc" to avoid clash with redshift z
  dist: number;  // comoving distance Mpc
  dataset: string;
  density: number; // δ = ρ/ρ̄ − 1, pre-computed at load time
}

// ─── State ────────────────────────────────────────────────────────────────────
const galaxyStore: Map<string, GalaxyRaw[]> = new Map();
let totalLoaded = 0;
let storeReady = false;

interface FlowCell {
  x: number; y: number; z: number;
  density: number;
  vx: number; vy: number; vz: number;
}
interface DensityGridResult {
  cells: FlowCell[];
  resolution: number;
  bounds: { min: number; max: number };
}
let densityGridCache: DensityGridResult | null = null;

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
      if (!line.trim()) return;
      if (firstLine) {
        firstLine = false;
        const headers = line.split(",").map(h => h.trim().toLowerCase());
        const ri = headers.indexOf("ra");
        const di = headers.indexOf("dec");
        const zi = headers.indexOf("z");
        if (ri >= 0) raIdx = ri;
        if (di >= 0) decIdx = di;
        if (zi >= 0) zIdx = zi;
        return;
      }

      const parts = line.split(",");
      if (parts.length <= Math.max(raIdx, decIdx, zIdx)) return;

      const ra = parseFloat(parts[raIdx]);
      const dec = parseFloat(parts[decIdx]);
      const z = parseFloat(parts[zIdx]);

      if (!isFinite(ra) || !isFinite(dec) || !isFinite(z)) return;
      if (z <= 0.01 || z > 1.5) return;

      const dist = comovingDistance(z);
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
        density: 0, // filled in during pre-annotation
      });
    });

    rl.on("close", () => resolve(results));
    rl.on("error", reject);
  });
}

// ─── Density Grid + Pre-annotation ───────────────────────────────────────────
const GRID_RES = 64;
const BOUNDS = 3600; // Mpc — covers z≈1.15

function buildDensityAndAnnotate(allGalaxies: GalaxyRaw[]): DensityGridResult {
  const CELL_SIZE = (BOUNDS * 2) / GRID_RES;
  const GRID_VOL = GRID_RES * GRID_RES * GRID_RES;
  const counts = new Float32Array(GRID_VOL);

  const cellOf = (v: number) =>
    Math.max(0, Math.min(GRID_RES - 1, Math.floor((v + BOUNDS) / CELL_SIZE)));
  const idx3 = (ix: number, iy: number, iz: number) =>
    ix * GRID_RES * GRID_RES + iy * GRID_RES + iz;

  // Count galaxies per cell
  for (const g of allGalaxies) {
    const ix = cellOf(g.x);
    const iy = cellOf(g.y);
    const iz = cellOf(g.zc);
    counts[idx3(ix, iy, iz)]++;
  }

  // Compute mean count over occupied cells
  let occupied = 0, total = 0;
  for (let i = 0; i < GRID_VOL; i++) {
    if (counts[i] > 0) { occupied++; total += counts[i]; }
  }
  const meanCount = occupied > 0 ? total / occupied : 1;

  // Pre-annotate EVERY galaxy with its local density δ = count/mean − 1
  logger.info({ galaxies: allGalaxies.length, meanCount: meanCount.toFixed(2) }, "Pre-annotating galaxy densities");
  for (const g of allGalaxies) {
    const ix = cellOf(g.x);
    const iy = cellOf(g.y);
    const iz = cellOf(g.zc);
    g.density = counts[idx3(ix, iy, iz)] / meanCount - 1;
  }

  // Build coarser 16³ flow-field grid via density gradient
  const FLOW_RES = 16;
  const flowStep = GRID_RES / FLOW_RES;
  const cells: FlowCell[] = [];

  for (let fi = 0; fi < FLOW_RES; fi++) {
    for (let fj = 0; fj < FLOW_RES; fj++) {
      for (let fk = 0; fk < FLOW_RES; fk++) {
        const i = Math.round(fi * flowStep + flowStep / 2);
        const j = Math.round(fj * flowStep + flowStep / 2);
        const k = Math.round(fk * flowStep + flowStep / 2);
        const ci = Math.min(i, GRID_RES - 1);
        const cj = Math.min(j, GRID_RES - 1);
        const ck = Math.min(k, GRID_RES - 1);

        const cnt = counts[idx3(ci, cj, ck)];
        const delta = cnt / meanCount - 1;

        // Central difference gradient — flow toward overdense regions
        const ip = Math.min(ci + 1, GRID_RES - 1);
        const im = Math.max(ci - 1, 0);
        const jp = Math.min(cj + 1, GRID_RES - 1);
        const jm = Math.max(cj - 1, 0);
        const kp = Math.min(ck + 1, GRID_RES - 1);
        const km = Math.max(ck - 1, 0);

        const gx = (counts[idx3(ip, cj, ck)] - counts[idx3(im, cj, ck)]) / (2 * meanCount);
        const gy = (counts[idx3(ci, jp, ck)] - counts[idx3(ci, jm, ck)]) / (2 * meanCount);
        const gz = (counts[idx3(ci, cj, kp)] - counts[idx3(ci, cj, km)]) / (2 * meanCount);

        // World-space center of this flow cell
        const wx = (ci + 0.5) * CELL_SIZE - BOUNDS;
        const wy = (cj + 0.5) * CELL_SIZE - BOUNDS;
        const wz = (ck + 0.5) * CELL_SIZE - BOUNDS;

        cells.push({ x: wx, y: wy, z: wz, density: delta, vx: gx, vy: gy, vz: gz });
      }
    }
  }

  return { cells, resolution: FLOW_RES, bounds: { min: -BOUNDS, max: BOUNDS } };
}

// ─── Data Loading ────────────────────────────────────────────────────────────
async function loadAllData() {
  logger.info("Loading galaxy datasets…");
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

  logger.info({ totalLoaded }, "All datasets loaded — building density grid & annotating…");

  const allGalaxies: GalaxyRaw[] = [];
  for (const galaxies of galaxyStore.values()) {
    for (const g of galaxies) allGalaxies.push(g);
  }

  try {
    densityGridCache = buildDensityAndAnnotate(allGalaxies);
    logger.info({ flowCells: densityGridCache.cells.length }, "Density grid built, all galaxies annotated");
  } catch (err) {
    logger.error({ err }, "Failed to build density grid");
    densityGridCache = { cells: [], resolution: 16, bounds: { min: -BOUNDS, max: BOUNDS } };
  }

  storeReady = true;
}

loadAllData().catch(err => logger.error({ err }, "Fatal: failed to load galaxy data"));

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/galaxies
router.get("/galaxies", (req, res) => {
  if (!storeReady) {
    res.status(503).json({ error: "Data loading, please try again shortly" });
    return;
  }

  const sampleSize = Math.min(parseInt(String(req.query.sample ?? "80000"), 10), 300000);
  const zmin = parseFloat(String(req.query.zmin ?? "0"));
  const zmax = parseFloat(String(req.query.zmax ?? "1.5"));
  const datasetFilter = String(req.query.dataset ?? "all");

  // Collect matching galaxies
  const pool: GalaxyRaw[] = [];
  for (const [name, galaxies] of galaxyStore.entries()) {
    if (datasetFilter !== "all" && name !== datasetFilter) continue;
    for (const g of galaxies) {
      if (g.z >= zmin && g.z <= zmax) pool.push(g);
    }
  }

  const total = pool.length;

  // Uniform-stride spatial sampling
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

  res.json({
    galaxies: sampled.map(g => ({
      x: g.x,
      y: g.y,
      z: g.zc,
      ra: g.ra,
      dec: g.dec,
      redshift: g.z,
      distance: g.dist,
      density: g.density,  // pre-cached — accurate from full 3M galaxy count
      dataset: g.dataset,
    })),
    total,
    returned: sampled.length,
    cosmology: { H0, OmegaM: OMEGA_M, OmegaL: OMEGA_L },
  });
});

// GET /api/galaxies/stats
router.get("/galaxies/stats", (_req, res) => {
  const datasets = DATASETS.map(ds => ({
    name: ds.name,
    count: galaxyStore.get(ds.name)?.length ?? 0,
    zMin: ds.zMin,
    zMax: ds.zMax,
    label: ds.label,
  }));

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
