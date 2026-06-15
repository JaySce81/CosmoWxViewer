import { useMemo, useRef } from "react";
import * as THREE from "three";
import { densityToColor } from "../lib/cosmicColors";

// Flow grid constants must match backend (FLOW_RES=16, BOUNDS=3600)
const FLOW_BOUNDS = 3600; // Mpc
const FLOW_RES = 16;
const FLOW_CELL_SIZE = (FLOW_BOUNDS * 2) / FLOW_RES; // 450 Mpc

interface Galaxy {
  x: number; y: number; z: number;  // Cartesian Mpc
  density: number;
  redshift: number;
  dataset: string;
}

interface Props {
  galaxies: Galaxy[];
  colorMode: "density" | "redshift" | "dataset";
  pointSize: number;        // final world-unit size (e.g. 0.003)
  futureOffset: number;     // fractional Gyr offset (0 = now)
  densityGrid?: { cells: Array<{x:number,y:number,z:number,vx:number,vy:number,vz:number,density:number}> };
  SCALE: number;            // Mpc → world units (1/1000)
}

const DATASET_RGB: Record<string, [number,number,number]> = {
  lrg60:  [0.43, 0.71, 1.00],
  lrg70:  [0.00, 0.90, 0.82],
  lrg80:  [0.66, 0.88, 0.39],
  lrg90:  [1.00, 0.80, 0.38],
  lrg100: [1.00, 0.60, 0.38],
  lrg2:   [0.88, 0.50, 1.00],
};

// Build integer-keyed velocity grid for O(1) cell lookup
function buildVelGrid(cells: NonNullable<Props["densityGrid"]>["cells"]) {
  const grid = new Map<number, [number, number, number]>();
  for (const cell of cells) {
    const fi = Math.max(0, Math.min(FLOW_RES - 1, Math.floor((cell.x + FLOW_BOUNDS) / FLOW_CELL_SIZE)));
    const fj = Math.max(0, Math.min(FLOW_RES - 1, Math.floor((cell.y + FLOW_BOUNDS) / FLOW_CELL_SIZE)));
    const fk = Math.max(0, Math.min(FLOW_RES - 1, Math.floor((cell.z + FLOW_BOUNDS) / FLOW_CELL_SIZE)));
    grid.set(fi * FLOW_RES * FLOW_RES + fj * FLOW_RES + fk, [cell.vx, cell.vy, cell.vz]);
  }
  return grid;
}

function galaxyCellKey(gx: number, gy: number, gz: number): number {
  const fi = Math.max(0, Math.min(FLOW_RES - 1, Math.floor((gx + FLOW_BOUNDS) / FLOW_CELL_SIZE)));
  const fj = Math.max(0, Math.min(FLOW_RES - 1, Math.floor((gy + FLOW_BOUNDS) / FLOW_CELL_SIZE)));
  const fk = Math.max(0, Math.min(FLOW_RES - 1, Math.floor((gz + FLOW_BOUNDS) / FLOW_CELL_SIZE)));
  return fi * FLOW_RES * FLOW_RES + fj * FLOW_RES + fk;
}

export function GalaxyPoints({ galaxies, colorMode, pointSize, futureOffset, densityGrid, SCALE }: Props) {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const N = galaxies.length;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);

    // Pre-build velocity lookup for futurecast
    const velGrid = densityGrid && futureOffset > 0
      ? buildVelGrid(densityGrid.cells)
      : null;

    // Physical displacement per Gyr futurecast: δv ≈ gradient-velocity × scale
    // ~150 Mpc/Gyr is an upper-bound for large-scale flow
    const DISP_SCALE = 150; // Mpc per unit futureOffset per unit velocity

    for (let i = 0; i < N; i++) {
      const g = galaxies[i];
      let gx = g.x, gy = g.y, gz = g.z;

      // Futurecast: displace along flow-field vector
      if (velGrid && futureOffset > 0) {
        const key = galaxyCellKey(gx, gy, gz);
        const vel = velGrid.get(key);
        if (vel) {
          // Normalize so max displacement ≈ DISP_SCALE * futureOffset Mpc
          const mag = Math.sqrt(vel[0]*vel[0] + vel[1]*vel[1] + vel[2]*vel[2]) || 1;
          gx += (vel[0] / mag) * futureOffset * DISP_SCALE;
          gy += (vel[1] / mag) * futureOffset * DISP_SCALE;
          gz += (vel[2] / mag) * futureOffset * DISP_SCALE;
        }
      }

      pos[i * 3]     = gx * SCALE;
      pos[i * 3 + 1] = gy * SCALE;
      pos[i * 3 + 2] = gz * SCALE;

      // Color by mode
      let r = 1, g2 = 1, b = 1;
      if (colorMode === "density") {
        const c = densityToColor(g.density);
        r = c.r; g2 = c.g; b = c.b;
        // Dim void galaxies slightly so structure pops
        const dim = g.density < 0 ? 0.55 + 0.45 * ((g.density + 1) / 1) : 1;
        r *= dim; g2 *= dim; b *= dim;
      } else if (colorMode === "redshift") {
        const t = Math.max(0, Math.min(1, (g.redshift - 0.6) / 0.5));
        r = 0.2 + 0.8 * t;
        g2 = 0.5 - 0.3 * t;
        b = 1.0 - 0.7 * t;
      } else if (colorMode === "dataset") {
        const dc = DATASET_RGB[g.dataset] ?? [1, 1, 1];
        r = dc[0]; g2 = dc[1]; b = dc[2];
      }

      col[i * 3]     = r;
      col[i * 3 + 1] = g2;
      col[i * 3 + 2] = b;
    }

    return { positions: pos, colors: col };
  }, [galaxies, colorMode, futureOffset, densityGrid, SCALE]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
