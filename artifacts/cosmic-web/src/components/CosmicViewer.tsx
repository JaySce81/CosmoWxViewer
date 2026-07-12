import { useRef, Suspense, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { GalaxyPoints, type Galaxy } from "./GalaxyPoints";
import { FlowField, DensityContours } from "./FlowField";
import { EarthMarker } from "./EarthMarker";
import { ScaleGrid } from "./ScaleGrid";
import { ClusterMarkers } from "./ClusterMarkers";

const SCALE = 1 / 1000; // 1 Mpc = 0.001 world units

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    return !!ctx;
  } catch {
    return false;
  }
}

interface FlowCell {
  x: number; y: number; z: number;
  density: number; vx: number; vy: number; vz: number;
}
interface Cluster {
  x: number; y: number; z: number;
  density: number;
  estimatedCount: number;
}
interface Layers {
  galaxies: boolean; flowField: boolean; densityContours: boolean;
  grid: boolean; stars: boolean; earth: boolean;
}

interface Props {
  galaxies: Galaxy[];
  flowCells: FlowCell[];
  clusters: Cluster[];
  layers: Layers;
  colorMode: "density" | "redshift" | "dataset";
  pointSize: number;
  isPlaying: boolean;
  playSpeed: number;
  futureOffset: number;
  onFutureOffsetChange: (v: number) => void;
  selectedGalaxy: Galaxy | null;
  onSelectGalaxy: (g: Galaxy | null) => void;
  selectedCluster: Cluster | null;
  onSelectCluster: (c: Cluster | null) => void;
}

function RotatingStarfield() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.005;
  });
  return (
    <group ref={ref}>
      <Stars radius={50} depth={80} count={12000} factor={4} saturation={0.3} fade speed={0.3} />
    </group>
  );
}

function AnimationController({
  isPlaying, playSpeed, futureOffset, onFutureOffsetChange
}: {
  isPlaying: boolean; playSpeed: number; futureOffset: number; onFutureOffsetChange: (v: number) => void;
}) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!isPlaying) return;
    elapsed.current += delta * playSpeed * 0.02;
    if (elapsed.current > 0.01) {
      const next = futureOffset + elapsed.current;
      elapsed.current = 0;
      onFutureOffsetChange(next >= 5.0 ? 0 : next);
    }
  });
  return null;
}

// Click raycaster: project ray through mouse and find nearest galaxy point or cluster
function ClickRaycaster({ galaxies, clusters, onSelectGalaxy, onSelectCluster, SCALE }: {
  galaxies: Galaxy[];
  clusters: Cluster[];
  onSelectGalaxy: (g: Galaxy | null) => void;
  onSelectCluster: (c: Cluster | null) => void;
  SCALE: number;
}) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  const handleClick = useCallback((event: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // First try galaxy points (larger search radius since they're small)
    if (galaxies.length > 0) {
      const pointGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(galaxies.length * 3);
      for (let i = 0; i < galaxies.length; i++) {
        pos[i * 3] = galaxies[i].x * SCALE;
        pos[i * 3 + 1] = galaxies[i].y * SCALE;
        pos[i * 3 + 2] = galaxies[i].z * SCALE;
      }
      pointGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const points = new THREE.Points(pointGeo);
      const hits = raycaster.intersectObject(points);
      if (hits.length > 0 && hits[0].index != null) {
        const idx = hits[0].index;
        if (idx >= 0 && idx < galaxies.length) {
          onSelectGalaxy(galaxies[idx]);
          onSelectCluster(null);
          return;
        }
      }
    }

    // Then try cluster markers (spheres, easier to hit)
    if (clusters.length > 0) {
      const clusterGroup = new THREE.Group();
      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i];
        const radius = 0.008 + Math.min(0.024, c.density * 0.004);
        const geo = new THREE.SphereGeometry(radius, 8, 8);
        const mat = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(c.x * SCALE, c.y * SCALE, c.z * SCALE);
        mesh.userData = { index: i, cluster: c };
        clusterGroup.add(mesh);
      }
      const clusterHits = raycaster.intersectObjects(clusterGroup.children);
      if (clusterHits.length > 0) {
        const hit = clusterHits[0];
        const c = hit.object.userData.cluster as Cluster;
        if (c) {
          onSelectCluster(c);
          onSelectGalaxy(null);
          return;
        }
      }
    }

    // Clicked empty space — deselect
    onSelectGalaxy(null);
    onSelectCluster(null);
  }, [camera, gl, raycaster, mouse, galaxies, clusters, SCALE, onSelectGalaxy, onSelectCluster]);

  useEffect(() => {
    gl.domElement.addEventListener("click", handleClick);
    return () => gl.domElement.removeEventListener("click", handleClick);
  }, [gl, handleClick]);

  return null;
}

// Highlight ring around selected galaxy
function SelectedGalaxyMarker({ galaxy, SCALE }: { galaxy: Galaxy | null; SCALE: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y += 0.02;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 1.2) * 0.3;
    }
  });
  if (!galaxy) return null;
  const x = galaxy.x * SCALE;
  const y = galaxy.y * SCALE;
  const z = galaxy.z * SCALE;
  return (
    <group position={[x, y, z]}>
      <mesh ref={ref}>
        <ringGeometry args={[0.018, 0.022, 32]} />
        <meshBasicMaterial color="#ffc140" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Crosshair lines using buffer geometry to avoid JSX <line> ambiguity */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              -0.025, 0, 0,  0.025, 0, 0,
              0, -0.025, 0,  0, 0.025, 0,
              0, 0, -0.025,  0, 0, 0.025,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffc140" transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

function WebGLFallback({ count }: { count: number }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at center, #04081e 0%, #020510 70%)",
      color: "rgba(100,150,220,0.8)", textAlign: "center", gap: 20, position: "relative",
    }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.3 }}>
        {Array.from({ length: 80 }, (_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: i % 5 === 0 ? 2 : 1, height: i % 5 === 0 ? 2 : 1,
            background: "white", borderRadius: "50%",
            left: `${(i * 137.5) % 100}%`, top: `${(i * 73.7) % 100}%`,
            opacity: 0.3 + (i % 7) * 0.1,
          }} />
        ))}
      </div>
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{ fontSize: "3.5rem" }}>✦</div>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#6eb5ff", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Cosmic Web Visualizer
          </div>
          <div style={{ fontSize: "0.78rem", color: "rgba(140,180,240,0.6)", marginTop: 6 }}>
            DESI Survey · {count.toLocaleString()} galaxies loaded · z=0.6–1.1
          </div>
        </div>
        <div style={{
          background: "rgba(10,20,50,0.8)", border: "1px solid rgba(94,186,255,0.2)",
          borderRadius: 12, padding: "20px 28px", maxWidth: 420,
          fontSize: "0.82rem", lineHeight: 1.7, color: "rgba(160,190,240,0.8)",
        }}>
          <div style={{ color: "#ffc140", fontWeight: 700, marginBottom: 8 }}>⚠ WebGL Unavailable</div>
          <div>The 3D visualization requires GPU rendering (WebGL). This preview environment lacks GPU access.</div>
          <div style={{ marginTop: 10, color: "rgba(140,180,240,0.6)", fontSize: "0.75rem" }}>
            <strong style={{ color: "#6eb5ff" }}>Deploy the app</strong> or open the published URL in any GPU-enabled browser to see the full 3D cosmic web.
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: "0.7rem", color: "rgba(100,140,200,0.5)" }}>
          <span>H₀=70 km/s/Mpc</span><span>Ωₘ=0.3</span><span>Ω_Λ=0.7</span><span>ΛCDM</span>
        </div>
      </div>
    </div>
  );
}

export function CosmicViewer({
  galaxies, flowCells, clusters, layers, colorMode, pointSize, isPlaying,
  playSpeed, futureOffset, onFutureOffsetChange,
  selectedGalaxy, onSelectGalaxy, selectedCluster, onSelectCluster,
}: Props) {
  const webglAvailable = useMemo(() => detectWebGL(), []);

  if (!webglAvailable) {
    return <WebGLFallback count={galaxies.length} />;
  }

  const selectedClusterIndex = selectedCluster
    ? clusters.findIndex(c => c.x === selectedCluster.x && c.y === selectedCluster.y && c.z === selectedCluster.z)
    : -1;

  return (
    <div style={{ width: "100%", height: "100%", background: "#020510" }}>
      <Canvas
        camera={{ position: [0, 2, 6], near: 0.001, far: 200, fov: 55 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
        onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))}
      >
        <ambientLight intensity={0.1} />
        <directionalLight position={[5, 10, 5]} intensity={0.3} />

        <AnimationController
          isPlaying={isPlaying} playSpeed={playSpeed}
          futureOffset={futureOffset} onFutureOffsetChange={onFutureOffsetChange}
        />

        {/* Global click handler for selection */}
        {layers.galaxies && (galaxies.length > 0 || clusters.length > 0) && (
          <ClickRaycaster
            galaxies={galaxies}
            clusters={clusters}
            onSelectGalaxy={onSelectGalaxy}
            onSelectCluster={onSelectCluster}
            SCALE={SCALE}
          />
        )}

        <Suspense fallback={null}>
          {layers.stars && <RotatingStarfield />}
          {layers.earth && <EarthMarker />}
          {layers.grid && <ScaleGrid SCALE={SCALE} />}

          {layers.galaxies && galaxies.length > 0 && (
            <GalaxyPoints
              galaxies={galaxies}
              colorMode={colorMode}
              pointSize={pointSize * 0.002}
              futureOffset={futureOffset}
              densityGrid={flowCells.length > 0 ? { cells: flowCells } : undefined}
              SCALE={SCALE}
            />
          )}

          {/* Cluster markers */}
          {clusters.length > 0 && (
            <ClusterMarkers
              clusters={clusters}
              SCALE={SCALE}
              selectedId={selectedClusterIndex >= 0 ? selectedClusterIndex : null}
            />
          )}

          <SelectedGalaxyMarker galaxy={selectedGalaxy} SCALE={SCALE} />

          {layers.flowField && flowCells.length > 0 && (
            <FlowField cells={flowCells} SCALE={SCALE} opacity={0.55} minDensityShow={-0.3} />
          )}

          {layers.densityContours && flowCells.length > 0 && (
            <DensityContours cells={flowCells} SCALE={SCALE} opacity={0.3} />
          )}
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.4}
          zoomSpeed={0.8}
          panSpeed={0.5}
          minDistance={0.05}
          maxDistance={40}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
      </Canvas>
    </div>
  );
}
