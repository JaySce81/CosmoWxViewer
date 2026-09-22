import * as THREE from "three";
import { useMemo } from "react";

interface Props {
  SCALE: number;
}

export function ScaleGrid({ SCALE }: Props) {
  const shellMpc = [500, 1000, 1500, 2000, 2500, 3000, 3500];

  // Build all geometry objects in useMemo — avoids new objects every frame
  const { spokePrimitives, equatorMesh } = useMemo(() => {
    const spokeMat = new THREE.LineBasicMaterial({ color: "#0a1a3a", transparent: true, opacity: 0.2 });
    const prims: THREE.Line[] = [];

    // 12 equatorial spokes
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 4000 * SCALE;
      const pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(r * Math.cos(angle), 0, r * Math.sin(angle)),
      ];
      prims.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), spokeMat));
    }

    // 2 polar spokes
    const poleR = 4000 * SCALE;
    const poleMat = new THREE.LineBasicMaterial({ color: "#0a1a4a", transparent: true, opacity: 0.15 });
    prims.push(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, poleR, 0)]),
      poleMat
    ));
    prims.push(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -poleR, 0)]),
      poleMat
    ));

    return { spokePrimitives: prims, equatorMesh: null };
  }, [SCALE]);

  return (
    <group>
      {/* Concentric shell wireframes */}
      {shellMpc.map((mpc, i) => (
        <mesh key={mpc}>
          <sphereGeometry args={[mpc * SCALE, 32, 24]} />
          <meshBasicMaterial
            color={i === 0 ? "#1a3050" : "#0d1a30"}
            wireframe
            transparent
            opacity={i === 0 ? 0.12 : 0.06}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Equatorial ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3990 * SCALE, 4000 * SCALE, 128]} />
        <meshBasicMaterial color="#1a3a6a" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>

      {/* Radial spokes — primitive avoids JSX <line> vs HTML/SVG <line> ambiguity */}
      {spokePrimitives.map((obj, i) => (
        <primitive key={i} object={obj} />
      ))}
    </group>
  );
}
