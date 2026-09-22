import { useMemo } from "react";
import * as THREE from "three";
import type { Galaxy } from "./GalaxyPoints";

interface Props {
  galaxies: Galaxy[];
  SCALE: number;
  opacity?: number;
  stride?: number;
}

// Motion vectors are sampled from individual catalog records. Arrow length is
// logarithmic for legibility; the color still encodes each vector's measured
// magnitude, so no redshift shell or spatially smoothed field is introduced.
export function FlowField({ galaxies, SCALE, opacity = 0.65, stride = 40 }: Props) {
  const { positions, colors } = useMemo(() => {
    const selected: Galaxy[] = [];
    for (let i = 0; i < galaxies.length; i += stride) selected.push(galaxies[i]);
    const positions = new Float32Array(selected.length * 6);
    const colors = new Float32Array(selected.length * 6);
    const maxSpeed = Math.max(...selected.map(galaxy => galaxy.speedKms), 1);

    selected.forEach((galaxy, index) => {
      const magnitude = Math.sqrt(galaxy.vx ** 2 + galaxy.vy ** 2 + galaxy.vz ** 2);
      const direction = magnitude > 0 ? [galaxy.vx / magnitude, galaxy.vy / magnitude, galaxy.vz / magnitude] : [0, 0, 0];
      const normalized = Math.log1p(galaxy.speedKms) / Math.log1p(maxSpeed);
      const arrowLength = (8 + normalized * 72) * SCALE;
      const start = [galaxy.x * SCALE, galaxy.y * SCALE, galaxy.z * SCALE];
      const end = [
        start[0] + direction[0] * arrowLength,
        start[1] + direction[1] * arrowLength,
        start[2] + direction[2] * arrowLength,
      ];
      const r = normalized;
      const g = 0.85 - normalized * 0.5;
      const b = 1 - normalized * 0.7;
      positions.set([...start, ...end], index * 6);
      colors.set([r, g, b, r, g, b], index * 6);
    });
    return { positions, colors };
  }, [galaxies, SCALE, stride]);

  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [positions, colors]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}