import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Cluster {
  x: number; y: number; z: number;
  density: number;
  estimatedCount: number;
}

interface Props {
  clusters: Cluster[];
  SCALE: number;
  onClick?: (cluster: Cluster) => void;
  selectedId?: number | null;
}

export function ClusterMarkers({ clusters, SCALE, onClick, selectedId }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // Create mesh objects for each cluster in useMemo
  const meshes = useMemo(() => {
    const result: THREE.Mesh[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const radius = 0.008 + Math.min(0.024, c.density * 0.004);
      const geo = new THREE.SphereGeometry(radius, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: c.density > 3 ? "#ff5050" : c.density > 1 ? "#ffc140" : "#ff8f20",
        transparent: true,
        opacity: 0.5 + Math.min(0.4, c.density * 0.05),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(c.x * SCALE, c.y * SCALE, c.z * SCALE);
      mesh.userData = { index: i, cluster: c };
      result.push(mesh);
    }
    return result;
  }, [clusters, SCALE]);

  // Pulse animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const c = clusters[i];
      const baseScale = 1 + 0.15 * Math.sin(t * 2 + i * 0.7);
      const selectedBoost = selectedId === i ? 1.3 : 1;
      mesh.scale.setScalar(baseScale * selectedBoost);
      // Update opacity for selected
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = selectedId === i ? 0.85 : (0.5 + Math.min(0.4, c.density * 0.05));
    });
  });

  return (
    <group ref={groupRef}>
      {meshes.map((mesh, i) => (
        <primitive
          key={i}
          object={mesh}
          onClick={() => onClick?.(clusters[i])}
        />
      ))}
    </group>
  );
}
