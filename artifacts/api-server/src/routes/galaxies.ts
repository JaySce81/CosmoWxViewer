import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { logger } from "../lib/logger";

const router = Router();

// ─── Flat ΛCDM cosmology ──────────────────────────────────────────────────────
// All positions are present-day comoving coordinates in Mpc.
const H0 = 67.4; // km/s/Mpc
const OMEGA_M = 0.315;
const OMEGA_L = 0.685;
const C_LIGHT = 299792.458; // km/s

function expansionRate(z: number): number {
  return Math.sqrt(OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);
}

// Midpoint integration avoids a redshift-bin approximation while keeping
// per-galaxy conversion fast after startup.
const Z_TABLE_N = 6000;
const Z_TABLE_MAX = 3;
const DISTANCE_TABLE = new Float64Array(Z_TABLE_N + 1);
for (let i = 1; i <= Z_TABLE_N; i++) {
  const z = (i / Z_TABLE_N) * Z_TABLE_MAX;
  const previousZ = ((i - 1) / Z_TABLE_N) * Z_TABLE_MAX;
  const dz = z - previousZ;
  const midpoint = previousZ + dz / 2;
  DISTANCE_TABLE[i] =
    DISTANCE_TABLE[i - 1] + (C_LIGHT / H0) * (dz / expansionRate(midpoint));
}

function comovingDistance(z: number): number {
  if (z <= 0) return 0;
  if (z >= Z_TABLE_MAX) return DISTANCE_TABLE[Z_TABLE_N];
  const position = (z / Z_TABLE_MAX) * Z_TABLE_N;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return DISTANCE_TABLE[lower] +
    fraction * (DISTANCE_TABLE[lower + 1] - DISTANCE_TABLE[lower]);
}

// Relativistic radial velocity corresponding to the measured spectroscopic
// redshift. It is the only velocity available in the attached DESI files.
function radialVelocityFromRedshift(z: number): number {
  const onePlusZ = 1 + z;
  return C_LIGHT * ((onePlusZ * onePlusZ - 1) / (onePlusZ * onePlusZ + 1));
}

// ─── Dataset discovery ────────────────────────────────────────────────────────
const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const DATA_DIR = path.resolve(workspaceRoot, "attached_assets");

type DatasetClass = "ELG" | "BGS" | "LRG" | "SPARC";

interface DatasetDefinition {
  name: string;
  file: string;
  datasetClass: DatasetClass;
  zMin: number;
  zMax: number;
  label: string;
  diameterKpc: number;
}

function classFromFilename(file: string): DatasetClass | null {
  const lower = file.toLowerCase();
  if (lower.includes("sparc")) return "SPARC";
  if (lower.includes("elg")) return "ELG";
  if (lower.includes("bgs")) return "BGS";
  if (lower.includes("lrg")) return "LRG";
  return null;
}

function typicalDiameterKpc(datasetClass: DatasetClass): number {
  // These are display-size fallbacks only. A catalog diameter, when present,
  // always replaces them. They are marked as typical in every API record.
  switch (datasetClass) {
    case "ELG": return 12;
    case "BGS": return 20;
    case "SPARC": return 18;
    case "LRG": return 30;
  }
}

function inferRedshiftRange(file: string): { min: number; max: number } {
  const match = file.match(/(?:elg|lrg|bgs)[_-]?(\d{2,3})[-_](\d{2,3})/i);
  if (match) {
    const min = Number(match[1]) / 100;
    const max = Number(match[2]) / 100;
    return { min, max };
  }
  return { min: 0, max: 3 };
}

function discoverDatasets(): DatasetDefinition[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR)
    .filter(file => file.toLowerCase().endsWith(".csv"))
    .map(file => ({ file, datasetClass: classFromFilename(file) }))
    .filter((entry): entry is { file: string; datasetClass: DatasetClass } => entry.datasetClass !== null);

  return files.sort((a, b) => a.file.localeCompare(b.file)).map(({ file, datasetClass }) => {
    const range = inferRedshiftRange(file);
    const stem = file.replace(/\.csv$/i, "").toLowerCase();
    const rangeLabel = range.max > range.min ? ` z=${range.min.toFixed(2)}–${range.max.toFixed(2)}` : "";
    return {
      name: `${datasetClass.toLowerCase()}-${stem}`,
      file,
      datasetClass,
      zMin: range.min,
      zMax: range.max,
      label: `${datasetClass}${rangeLabel}`,
      diameterKpc: typicalDiameterKpc(datasetClass),
    };
  });
}

const DATASETS = discoverDatasets();

// ─── Galaxy record ─────────────────────────────────────────────────────────────
interface GalaxyRecord {
  ra: number;
  dec: number;
  redshift: number;
  distance: number;
  scaleFactor: number;
  physicalDistanceAtEmissionMpc: number;
  x: number;
  y: number;
  z: number;
  dataset: string;
  datasetClass: DatasetClass;
  diameterKpc: number;
  diameterSource: "catalog" | "typical-class-range";
  rotationSpeedKms: number | null;
  rotationDirection: "CW" | "CCW" | null;
  lineOfSightVelocityKms: number;
  transverseVelocityKms: number | null;
  vx: number;
  vy: number;
  vz: number;
  speedKms: number;
  velocitySource: "spectroscopic-redshift";
}

const galaxyStore = new Map<string, GalaxyRecord[]>();
let totalLoaded = 0;
let storeReady = false;

function headerIndexes(headers: string[]) {
  const normalized = headers.map(header => header.trim().toLowerCase());
  const find = (...names: string[]) => {
    for (const name of names) {
      const index = normalized.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  return {
    ra: find("ra", "right_ascension"),
    dec: find("dec", "declination"),
    redshift: find("z", "redshift"),
    diameterKpc: find("diameter_kpc", "diameter", "size_kpc"),
    rotationSpeedKms: find("rotation_speed_kms", "vflat", "vmax", "vrot"),
    rotationDirection: find("rotation_direction", "spin_direction", "handedness"),
    transverseVelocityKms: find("transverse_velocity_kms", "vtrans", "proper_motion_velocity"),
  };
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRotationDirection(value: string | undefined): "CW" | "CCW" | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "cw" || normalized === "clockwise") return "CW";
  if (normalized === "ccw" || normalized === "counterclockwise" || normalized === "counter-clockwise") return "CCW";
  return null;
}

async function parseDataset(dataset: DatasetDefinition): Promise<GalaxyRecord[]> {
  const filePath = path.join(DATA_DIR, dataset.file);
  return new Promise((resolve, reject) => {
    const results: GalaxyRecord[] = [];
    if (!fs.existsSync(filePath)) {
      logger.warn({ filePath }, "Dataset file not found, skipping");
      resolve(results);
      return;
    }

    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let indexes: ReturnType<typeof headerIndexes> | null = null;

    rl.on("line", line => {
      if (!line.trim()) return;
      if (!indexes) {
        indexes = headerIndexes(line.split(","));
        if (indexes.ra < 0 || indexes.dec < 0 || indexes.redshift < 0) {
          logger.warn({ file: dataset.file }, "Dataset lacks ra/dec/redshift columns, skipping");
          rl.close();
        }
        return;
      }

      const parts = line.split(",");
      const ra = Number(parts[indexes.ra]);
      const dec = Number(parts[indexes.dec]);
      const redshift = Number(parts[indexes.redshift]);
      if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(redshift) || redshift < 0 || redshift > Z_TABLE_MAX) return;

      const distance = comovingDistance(redshift);
      const scaleFactor = 1 / (1 + redshift);
      const raRadians = (ra * Math.PI) / 180;
      const decRadians = (dec * Math.PI) / 180;
      const direction = [
        Math.cos(decRadians) * Math.cos(raRadians),
        Math.cos(decRadians) * Math.sin(raRadians),
        Math.sin(decRadians),
      ];
      const lineOfSightVelocityKms = radialVelocityFromRedshift(redshift);
      const diameterFromCatalog = parseOptionalNumber(parts[indexes.diameterKpc]);
      const rotationSpeedKms = parseOptionalNumber(parts[indexes.rotationSpeedKms]);
      const transverseVelocityKms = parseOptionalNumber(parts[indexes.transverseVelocityKms]);
      const radialVector = direction.map(component => component * lineOfSightVelocityKms);
      const transverseSpeed = transverseVelocityKms ?? 0;

      results.push({
        ra,
        dec,
        redshift,
        distance,
        scaleFactor,
        physicalDistanceAtEmissionMpc: distance * scaleFactor,
        x: distance * direction[0],
        y: distance * direction[1],
        z: distance * direction[2],
        dataset: dataset.name,
        datasetClass: dataset.datasetClass,
        diameterKpc: diameterFromCatalog ?? dataset.diameterKpc,
        diameterSource: diameterFromCatalog == null ? "typical-class-range" : "catalog",
        rotationSpeedKms,
        rotationDirection: parseRotationDirection(parts[indexes.rotationDirection]),
        lineOfSightVelocityKms,
        transverseVelocityKms,
        vx: radialVector[0],
        vy: radialVector[1],
        vz: radialVector[2],
        speedKms: Math.sqrt(lineOfSightVelocityKms ** 2 + transverseSpeed ** 2),
        velocitySource: "spectroscopic-redshift",
      });
    });

    rl.on("close", () => resolve(results));
    rl.on("error", reject);
  });
}

async function loadAllData() {
  logger.info({ datasets: DATASETS.length }, "Loading DESI and SPARC datasets");
  for (const dataset of DATASETS) {
    try {
      const records = await parseDataset(dataset);
      galaxyStore.set(dataset.name, records);
      totalLoaded += records.length;
      logger.info({ dataset: dataset.name, class: dataset.datasetClass, count: records.length }, "Dataset loaded");
    } catch (error) {
      logger.error({ error, dataset: dataset.name }, "Failed to load dataset");
      galaxyStore.set(dataset.name, []);
    }
  }
  storeReady = true;
  logger.info({ totalLoaded }, "All catalog datasets loaded");
}

void loadAllData().catch(error => logger.error({ error }, "Fatal: failed to load galaxy data"));

router.get("/galaxies", (req, res) => {
  if (!storeReady) {
    res.status(503).json({ error: "Data loading, please try again shortly" });
    return;
  }

  const sampleSize = Math.min(Math.max(parseInt(String(req.query.sample ?? "80000"), 10) || 80000, 1), 300000);
  const zmin = Number.isFinite(Number(req.query.zmin)) ? Number(req.query.zmin) : 0;
  const zmax = Number.isFinite(Number(req.query.zmax)) ? Number(req.query.zmax) : Z_TABLE_MAX;
  const datasetFilter = String(req.query.dataset ?? "all");
  const pool: GalaxyRecord[] = [];

  for (const [name, records] of galaxyStore) {
    if (datasetFilter !== "all" && name !== datasetFilter) continue;
    for (const galaxy of records) {
      if (galaxy.redshift >= zmin && galaxy.redshift <= zmax) pool.push(galaxy);
    }
  }

  const sampled: GalaxyRecord[] = [];
  const step = pool.length > sampleSize ? pool.length / sampleSize : 1;
  for (let i = 0; i < pool.length && sampled.length < sampleSize; i += step) {
    sampled.push(pool[Math.floor(i)]);
  }

  res.json({
    galaxies: sampled,
    total: pool.length,
    returned: sampled.length,
    cosmology: { H0, OmegaM: OMEGA_M, OmegaL: OMEGA_L, C_LIGHT },
    dataAvailability: {
      rotation: sampled.some(galaxy => galaxy.rotationSpeedKms != null),
      transverseMotion: sampled.some(galaxy => galaxy.transverseVelocityKms != null),
      diameter: sampled.some(galaxy => galaxy.diameterSource === "catalog"),
    },
  });
});

router.get("/galaxies/stats", (_req, res) => {
  let minimumRedshift = Number.POSITIVE_INFINITY;
  let maximumRedshift = Number.NEGATIVE_INFINITY;
  for (const records of galaxyStore.values()) {
    for (const record of records) {
      if (record.redshift < minimumRedshift) minimumRedshift = record.redshift;
      if (record.redshift > maximumRedshift) maximumRedshift = record.redshift;
    }
  }
  res.json({
    datasets: DATASETS.map(dataset => ({
      name: dataset.name,
      count: galaxyStore.get(dataset.name)?.length ?? 0,
      datasetClass: dataset.datasetClass,
      zMin: dataset.zMin,
      zMax: dataset.zMax,
      label: dataset.label,
    })),
    totalGalaxies: totalLoaded,
    zRange: {
      min: Number.isFinite(minimumRedshift) ? minimumRedshift : 0,
      max: Number.isFinite(maximumRedshift) ? maximumRedshift : 0,
    },
    cosmology: { H0, OmegaM: OMEGA_M, OmegaL: OMEGA_L },
    availableMeasurements: {
      rotationSpeed: [...galaxyStore.values()].some(records => records.some(g => g.rotationSpeedKms != null)),
      rotationDirection: [...galaxyStore.values()].some(records => records.some(g => g.rotationDirection != null)),
      transverseMotion: [...galaxyStore.values()].some(records => records.some(g => g.transverseVelocityKms != null)),
      catalogDiameter: [...galaxyStore.values()].some(records => records.some(g => g.diameterSource === "catalog")),
    },
    ready: storeReady,
  });
});

export default router;