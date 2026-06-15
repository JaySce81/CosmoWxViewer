import { useMemo, useRef } from "react";
import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { densityToColor } from "../lib/cosmicColors";

extend({ Points: THREE.Points, BufferGeometry: THREE.BufferGeometry });

interface Galaxy {
  x: number; y: number; z: number;
  density: number;
  redshift: number;
  dataset: string;
}

interface Props {
  galaxies: Galaxy[];
  colorMode: "density" | "redshift" | "dataset";
  pointSize: number;
  futureOffset: number; // 0 = present, positive = futurecast steps
  densityGrid?: { cells: Array<{x:number,y:number,z:number,vx:number,vy:number,vz:number,density:number}> };
  SCALE: number;
}

const DATASET_COLORS_VEC: Record<string, [number,number,number]> = {
  lrg60:  [0.43, 0.71, 1.00],
  lrg70:  [0.00, 0.90, 0.82],
  lrg80:  [0.66, 0.88, 0.39],
  lrg90:  [1.00, 0.80, 0.38],
  lrg100: [1.00, 0.60, 0.38],
  lrg2:   [0.88, 0.50, 1.00],
};

export function GalaxyPoints({ galaxies, colorMode, pointSize, futureOffset, densityGrid, SCALE }: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const N = galaxies.length;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);

    // Build velocity lookup if we have a density grid
    const velLookup = new Map<string, [number,number,number]>();
    if (densityGrid && futureOffset > 0) {
      for (const cell of densityGrid.cells) {
        const key = `${Math.round(cell.x / 200)},${Math.round(cell.y / 200)},${Math.round(cell.z / 200)}`;
        velLookup.set(key, [cell.vx, cell.vy, cell.vz]);
      }
    }

    for (let i = 0; i < N; i++) {
      const g = galaxies[i];
      let x = g.x, y = g.y, z = g.z;

      // Apply futurecast displacement
      if (futureOffset > 0 && densityGrid) {
        const key = `${Math.round(x / 200)},${Math.round(y / 200)},${Math.round(z / 200)}`;
        const vel = velLookup.get(key);
        if (vel) {
          const speedMpc = 300; // Mpc per futurecast unit
          x += vel[0] * futureOffset * speedMpc;
          y += vel[1] * futureOffset * speedMpc;
          z += vel[2] * futureOffset * speedMpc;
        }
      }

      pos[i * 3 + 0] = x * SCALE;
      pos[i * 3 + 1] = y * SCALE;
      pos[i * 3 + 2] = z * SCALE;

      // Color selection
      let r = 1, g2 = 1, b = 1;
      if (colorMode === "density") {
        const c = densityToColor(g.density);
        r = c.r; g2 = c.g; b = c.b;
      } else if (colorMode === "redshift") {
        // Blue=near, red=far
        const t = Math.max(0, Math.min(1, (g.redshift - 0.6) / 0.5));
        r = 0.2 + 0.8 * t;
        g2 = 0.5 - 0.3 * t;
        b = 1.0 - 0.8 * t;
      } else if (colorMode === "dataset") {
        const dc = DATASET_COLORS_VEC[g.dataset] ?? [1, 1, 1];
        r = dc[0]; g2 = dc[1]; b = dc[2];
      }

      col[i * 3 + 0] = r;
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
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
