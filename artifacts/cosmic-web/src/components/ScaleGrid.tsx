import * as THREE from "three";
import { useMemo } from "react";

interface Props {
  SCALE: number;
}

export function ScaleGrid({ SCALE }: Props) {
  // Concentric shells at 500, 1000, 1500, 2000, 2500, 3000 Mpc
  const shellMpc = [500, 1000, 1500, 2000, 2500, 3000];

  // Radial spokes
  const spokes = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    // 12 radial lines from origin outward in equatorial plane
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 3200 * SCALE;
      lines.push([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(r * Math.cos(angle), 0, r * Math.sin(angle)),
      ]);
    }
    // Also 3 polar spokes
    lines.push([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3200 * SCALE, 0)]);
    lines.push([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -3200 * SCALE, 0)]);
    return lines;
  }, [SCALE]);

  return (
    <group>
      {/* Concentric shell wireframes */}
      {shellMpc.map((mpc) => (
        <mesh key={mpc}>
          <sphereGeometry args={[mpc * SCALE, 32, 24]} />
          <meshBasicMaterial
            color="#1a2a4a"
            wireframe
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Equatorial reference ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3190 * SCALE, 3200 * SCALE, 128]} />
        <meshBasicMaterial color="#1a3a6a" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Radial spokes */}
      {spokes.map((pts, i) => {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <line key={i} geometry={geo}>
            <lineBasicMaterial color="#0a1a3a" transparent opacity={0.2} />
          </line>
        );
      })}
    </group>
  );
}
