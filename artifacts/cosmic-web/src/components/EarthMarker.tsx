import { useRef } from "react";
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

  return (
    <group position={[0, 0, 0]}>
      {/* Core - Earth */}
      <mesh>
        <sphereGeometry args={[0.012, 32, 32]} />
        <meshPhongMaterial color="#1a6bff" emissive="#0033aa" emissiveIntensity={0.8} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.022, 32, 32]} />
        <meshPhongMaterial
          color="#4da6ff"
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Orbit ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.032, 0.035, 64]} />
        <meshBasicMaterial color="#4da6ff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* "Origin" label via radial lines */}
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x2 = 0.055 * Math.cos(rad);
        const y2 = 0.055 * Math.sin(rad);
        const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(x2, y2, 0)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <line key={angle} geometry={geo}>
            <lineBasicMaterial color="#4da6ff" transparent opacity={0.3} />
          </line>
        );
      })}

      {/* Point light to illuminate nearby scene */}
      <pointLight color="#2266ff" intensity={0.5} distance={0.5} />
    </group>
  );
}
