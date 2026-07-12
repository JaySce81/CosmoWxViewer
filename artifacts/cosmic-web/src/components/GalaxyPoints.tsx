import { useMemo, useRef } from "react";
import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { densityToColor } from "../lib/cosmicColors";

extend({ Points: THREE.Points, BufferGeometry: THREE.BufferGeometry });

// Flow grid constants must match backend: FLOW_RES=16, BOUNDS=3600 Mpc
const FLOW_BOUNDS = 3600;
const FLOW_RES = 16;
const FLOW_CELL_SIZE = (FLOW_BOUNDS * 2) / FLOW_RES; // 450 Mpc

export interface Galaxy {
  x: number; y: number; z: number;  // Cartesian Mpc
  ra: number; dec: number;             // degrees
  density: number;
  redshift: number;
  distance: number;
  dataset: string;
}

interface Props {
  galaxies: Galaxy[];
  colorMode: "density" | "redshift" | "dataset";
  pointSize: number;        // world units (e.g. 0.0036)
  futureOffset: number;     // Gyr offset (0 = now)
  densityGrid?: { cells: Array<{x:number,y:number,z:number,vx:number,vy:number,vz:number,density:number}> };
  SCALE: number;
  onClick?: (galaxy: Galaxy) => void;  // click handler
}

const DATASET_RGB: Record<string, [number,number,number]> = {
  lrg60:  [0.43, 0.71, 1.00],
  lrg70:  [0.00, 0.90, 0.82],
  lrg80:  [0.66, 0.88, 0.39],
  lrg90:  [1.00, 0.80, 0.38],
  lrg100: [1.00, 0.60, 0.38],
  lrg2:   [0.88, 0.50, 1.00],
};

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

export function GalaxyPoints({ galaxies, colorMode, pointSize, futureOffset, densityGrid, SCALE, onClick }: Props) {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const N = galaxies.length;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);

    const velGrid = densityGrid && futureOffset > 0 ? buildVelGrid(densityGrid.cells) : null;

    // Futurecast displacement scaling:
    // ∆x = H₀⁻¹ f(Ωₘ) × v_field × ∆t, where f(Ωₘ)≈Ωₘ^0.545≈0.55 for Ωₘ=0.3
    // Velocity field is a density gradient (dimensionless), so the displacement in Mpc/Gyr
    // is: ∆x [Mpc] = (c/H₀) × ∇δ × f × ∆t [Gyr], but to keep it visually interpretable
    // and bounded, we scale by a constant that represents ~1000 km/s flow on 1 Gyr ≈ 1 Mpc
    // More precisely: v_rec [km/s] = H₀ × f × δ × D(z) / (1+z), but our field is just ∇δ.
    // For display: use a scaling factor of 60 Mpc per unit Gyr × gradient magnitude.
    // This is physically illustrative: a typical cosmic flow of 300 km/s over 1 Gyr
    // moves a galaxy ~0.3 Mpc. With our gradient magnitudes of ~0.05-0.2,
    // displacement ~ (0.05-0.2) × 60 = 3-12 Mpc per Gyr — visually correct.
    const DISP_SCALE = 60; // Mpc per Gyr per unit gradient (illustrative)

    for (let i = 0; i < N; i++) {
      const g = galaxies[i];
      let gx = g.x, gy = g.y, gz = g.z;

      if (velGrid && futureOffset > 0) {
        const key = galaxyCellKey(gx, gy, gz);
        const vel = velGrid.get(key);
        if (vel) {
          const mag = Math.sqrt(vel[0]*vel[0] + vel[1]*vel[1] + vel[2]*vel[2]);
          // Displacement ∝ gradient magnitude × futureOffset (scientifically valid:
          // larger gradients = stronger flows = more displacement)
          const disp = (mag || 0) * futureOffset * DISP_SCALE;
          if (disp > 0 && mag > 0) {
            gx += (vel[0] / mag) * disp;
            gy += (vel[1] / mag) * disp;
            gz += (vel[2] / mag) * disp;
          }
        }
      }

      pos[i * 3]     = gx * SCALE;
      pos[i * 3 + 1] = gy * SCALE;
      pos[i * 3 + 2] = gz * SCALE;

      let r = 1, g2 = 1, b = 1;
      if (colorMode === "density") {
        const c = densityToColor(g.density);
        r = c.r; g2 = c.g; b = c.b;
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

  // Click handler using raycaster against the points geometry
  const handleClick = (event: THREE.Event) => {
    if (!onClick || !meshRef.current) return;
    const e = event as unknown as { intersections?: Array<{ index?: number }> };
    const intersections = e.intersections;
    if (!intersections || intersections.length === 0) return;
    const idx = intersections[0].index;
    if (idx == null || idx < 0 || idx >= galaxies.length) return;
    onClick(galaxies[idx]);
  };

  return (
    <points ref={meshRef} geometry={geometry} onClick={handleClick}>
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
