import { useMemo, useRef } from "react";
import * as THREE from "three";

export type ColorMode =
  | "rotationSpeed"
  | "rotationDirection"
  | "lineOfSight"
  | "transverse"
  | "dataset";

export interface Galaxy {
  x: number;
  y: number;
  z: number;
  ra: number;
  dec: number;
  redshift: number;
  distance: number;
  scaleFactor: number;
  physicalDistanceAtEmissionMpc: number;
  dataset: string;
  datasetClass: "ELG" | "BGS" | "LRG" | "SPARC";
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

interface Props {
  galaxies: Galaxy[];
  colorMode: ColorMode;
  pointSize: number;
  futureOffset: number;
  SCALE: number;
  onClick?: (galaxy: Galaxy) => void;
}

const DATASET_RGB: Record<string, [number, number, number]> = {
  ELG: [0.18, 0.84, 1.0],
  BGS: [0.42, 1.0, 0.48],
  LRG: [1.0, 0.58, 0.24],
  SPARC: [0.92, 0.46, 1.0],
};

function scalarColor(value: number, min: number, max: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (value - min) / Math.max(1e-9, max - min)));
  return [0.18 + 0.82 * t, 0.72 - 0.52 * t, 1 - 0.72 * t];
}

function colorForGalaxy(galaxy: Galaxy, mode: ColorMode): [number, number, number] {
  if (mode === "dataset") return DATASET_RGB[galaxy.datasetClass] ?? [0.8, 0.86, 1];
  if (mode === "rotationSpeed") {
    return galaxy.rotationSpeedKms == null
      ? [0.28, 0.34, 0.48]
      : scalarColor(galaxy.rotationSpeedKms, 0, 350);
  }
  if (mode === "rotationDirection") {
    if (galaxy.rotationDirection === "CW") return [1.0, 0.52, 0.2];
    if (galaxy.rotationDirection === "CCW") return [0.2, 0.82, 1.0];
    return [0.28, 0.34, 0.48];
  }
  if (mode === "transverse") {
    return galaxy.transverseVelocityKms == null
      ? [0.28, 0.34, 0.48]
      : scalarColor(galaxy.transverseVelocityKms, 0, 500);
  }
  return scalarColor(galaxy.lineOfSightVelocityKms, 0, 260000);
}

export function GalaxyPoints({ galaxies, colorMode, pointSize, futureOffset, SCALE, onClick }: Props) {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const position = new Float32Array(galaxies.length * 3);
    const color = new Float32Array(galaxies.length * 3);
    const size = new Float32Array(galaxies.length);

    // 1 km/s × 1 Gyr = 0.001022 Mpc. This preview is based only on the
    // measured radial velocity vector; no unmeasured transverse component is added.
    const MpcPerKmsGyr = 0.001022;

    for (let i = 0; i < galaxies.length; i++) {
      const galaxy = galaxies[i];
      position[i * 3] = (galaxy.x + galaxy.vx * futureOffset * MpcPerKmsGyr) * SCALE;
      position[i * 3 + 1] = (galaxy.y + galaxy.vy * futureOffset * MpcPerKmsGyr) * SCALE;
      position[i * 3 + 2] = (galaxy.z + galaxy.vz * futureOffset * MpcPerKmsGyr) * SCALE;

      const [r, g, b] = colorForGalaxy(galaxy, colorMode);
      color[i * 3] = r;
      color[i * 3 + 1] = g;
      color[i * 3 + 2] = b;

      // The catalog diameter is in kpc. The lower bound keeps a real-size
      // galaxy visible at survey distances while preserving diameter ratios.
      size[i] = Math.max(0.8, Math.min(48, (galaxy.diameterKpc / 30) * pointSize * 18));
    }

    return { positions: position, colors: color, sizes: size };
  }, [galaxies, colorMode, pointSize, futureOffset, SCALE]);

  const geometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }, [positions, colors, sizes]);

  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {},
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * 420.0 / max(1.0, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float radius = length(centered);
        if (radius > 0.5) discard;
        float alpha = smoothstep(0.5, 0.08, radius);
        gl_FragColor = vec4(vColor, alpha * 0.92);
      }
    `,
  }), []);

  const handleClick = (event: THREE.Event) => {
    if (!onClick) return;
    const intersections = (event as unknown as { intersections?: Array<{ index?: number }> }).intersections;
    const index = intersections?.[0]?.index;
    if (index != null && index >= 0 && index < galaxies.length) onClick(galaxies[index]);
  };

  return <points ref={meshRef} geometry={geometry} material={material} onClick={handleClick} />;
}