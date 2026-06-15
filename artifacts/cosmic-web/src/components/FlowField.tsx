import { useMemo } from "react";
import * as THREE from "three";

interface FlowCell {
  x: number; y: number; z: number;
  density: number;
  vx: number; vy: number; vz: number;
}

interface Props {
  cells: FlowCell[];
  SCALE: number;
  opacity?: number;
  minDensityShow?: number;
}

export function FlowField({ cells, SCALE, opacity = 0.6, minDensityShow = -0.5 }: Props) {
  const { linePositions, lineColors } = useMemo(() => {
    // Draw flow as line segments (arrows without arrowheads for performance)
    const relevant = cells.filter(c => c.density > minDensityShow);

    // Compute max velocity magnitude for normalization
    let maxMag = 0;
    for (const c of relevant) {
      const mag = Math.sqrt(c.vx * c.vx + c.vy * c.vy + c.vz * c.vz);
      if (mag > maxMag) maxMag = mag;
    }
    if (maxMag === 0) maxMag = 1;

    const N = relevant.length;
    const positions = new Float32Array(N * 6); // 2 points per line
    const colors = new Float32Array(N * 6);

    for (let i = 0; i < N; i++) {
      const c = relevant[i];
      const mag = Math.sqrt(c.vx * c.vx + c.vy * c.vy + c.vz * c.vz);
      const t = mag / maxMag; // 0=low velocity, 1=high velocity

      // Normalize velocity and scale arrow length
      const arrowLen = 80 * SCALE * (0.3 + 0.7 * t);
      const nx = c.vx / (mag || 1);
      const ny = c.vy / (mag || 1);
      const nz = c.vz / (mag || 1);

      const x0 = c.x * SCALE;
      const y0 = c.y * SCALE;
      const z0 = c.z * SCALE;

      positions[i * 6 + 0] = x0;
      positions[i * 6 + 1] = y0;
      positions[i * 6 + 2] = z0;
      positions[i * 6 + 3] = x0 + nx * arrowLen;
      positions[i * 6 + 4] = y0 + ny * arrowLen;
      positions[i * 6 + 5] = z0 + nz * arrowLen;

      // Color: blue=low flow, yellow=medium, red=high flow (like steering chart)
      const r = t;
      const g = 0.6 * (1 - Math.abs(t - 0.5) * 2);
      const b = 1 - t;

      colors[i * 6 + 0] = r;     colors[i * 6 + 1] = g;     colors[i * 6 + 2] = b;
      colors[i * 6 + 3] = r;     colors[i * 6 + 4] = g;     colors[i * 6 + 5] = b;
    }

    return { linePositions: positions, lineColors: colors };
  }, [cells, SCALE, minDensityShow]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    return geo;
  }, [linePositions, lineColors]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

// Streamline contour overlay (like UW tropical steering chart isobars)
export function DensityContours({ cells, SCALE, opacity = 0.25 }: Props) {
  const { positions, colors } = useMemo(() => {
    // Connect cells at similar density levels with lines
    // Simplified: just draw points sized by |density| as a heatmap
    const N = cells.length;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      const c = cells[i];
      pos[i * 3 + 0] = c.x * SCALE;
      pos[i * 3 + 1] = c.y * SCALE;
      pos[i * 3 + 2] = c.z * SCALE;

      // Density coloring: same Saffir-Simpson scale as galaxies
      const d = c.density;
      let r = 0, g = 0, b = 0;
      if (d < -0.8) { r=0.69; g=0.88; b=0.90; }
      else if (d < -0.5) { r=0.37; g=0.73; b=1.0; }
      else if (d < 0) { r=0.00; g=0.98; b=0.96; }
      else if (d < 1) { r=1.00; g=1.00; b=0.80; }
      else if (d < 3) { r=1.00; g=0.76; b=0.25; }
      else if (d < 7) { r=1.00; g=0.56; b=0.13; }
      else { r=1.00; g=0.38; b=0.38; }

      col[i * 3 + 0] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }

    return { positions: pos, colors: col };
  }, [cells, SCALE]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.018}
        vertexColors
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
