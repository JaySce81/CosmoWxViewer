import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function EarthMarker() {
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + 0.08 * Math.sin(t * 1.5));
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.3;
    }
  });

  // Create spoke geometries once, not every render
  const spokeGeos = useMemo(() => {
    return [0, 60, 120, 180, 240, 300].map((angle) => {
      const rad = (angle * Math.PI) / 180;
      const pts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.055 * Math.cos(rad), 0.055 * Math.sin(rad), 0),
      ];
      return new THREE.BufferGeometry().setFromPoints(pts);
    });
  }, []);

  const spokeMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#4da6ff", transparent: true, opacity: 0.3 }),
    []
  );

  return (
    <group position={[0, 0, 0]}>
      {/* Core — Earth */}
      <mesh>
        <sphereGeometry args={[0.012, 32, 32]} />
        <meshPhongMaterial color="#1a6bff" emissive="#003399" emissiveIntensity={1.0} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.024, 32, 32]} />
        <meshPhongMaterial color="#4da6ff" transparent opacity={0.15} side={THREE.BackSide} />
      </mesh>

      {/* Equatorial ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.030, 0.033, 64]} />
        <meshBasicMaterial color="#4da6ff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Radial spokes — use primitive to avoid JSX <line> vs HTML <line> ambiguity */}
      {spokeGeos.map((geo, i) => (
        <primitive key={i} object={new THREE.Line(geo, spokeMaterial)} />
      ))}

      {/* Local point light */}
      <pointLight color="#2266ff" intensity={0.6} distance={0.6} />
    </group>
  );
}
