import { useRef, Suspense, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { GalaxyPoints, type ColorMode, type Galaxy } from "./GalaxyPoints";
import { FlowField } from "./FlowField";
import { EarthMarker } from "./EarthMarker";
import { ScaleGrid } from "./ScaleGrid";

const SCALE = 1; // one world unit = one comoving Mpc

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface Layers {
  galaxies: boolean;
  motionField: boolean;
  grid: boolean;
  stars: boolean;
  earth: boolean;
}

interface Props {
  galaxies: Galaxy[];
  layers: Layers;
  colorMode: ColorMode;
  pointSize: number;
  isPlaying: boolean;
  playSpeed: number;
  futureOffset: number;
  onFutureOffsetChange: (value: number) => void;
  selectedGalaxy: Galaxy | null;
  onSelectGalaxy: (galaxy: Galaxy | null) => void;
  onCameraScale?: (mpc: number) => void;
}

function RotatingStarfield() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.005;
  });
  return (
    <group ref={ref}>
      <Stars radius={8000} depth={6000} count={5000} factor={10} saturation={0.3} fade speed={0.1} />
    </group>
  );
}

function AnimationController({
  isPlaying,
  playSpeed,
  futureOffset,
  onFutureOffsetChange,
}: {
  isPlaying: boolean;
  playSpeed: number;
  futureOffset: number;
  onFutureOffsetChange: (value: number) => void;
}) {
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!isPlaying) return;
    elapsed.current += delta * playSpeed * 0.02;
    if (elapsed.current > 0.01) {
      const next = futureOffset + elapsed.current;
      elapsed.current = 0;
      onFutureOffsetChange(next >= 5 ? 0 : next);
    }
  });
  return null;
}

function CameraScaleTracker({
  controlsRef,
  onScale,
}: {
  controlsRef: React.RefObject<any>;
  onScale: (mpc: number) => void;
}) {
  const { camera, gl } = useThree();
  const lastScale = useRef<number | null>(null);

  useFrame(() => {
    const target = controlsRef.current?.target ?? new THREE.Vector3();
    const distance = camera.position.distanceTo(target);
    const height = gl.domElement.clientHeight;
    if (height <= 0 || distance <= 0) return;
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 55;
    const worldHeight = 2 * distance * Math.tan((fov * Math.PI) / 360);
    const mpc = 200 / (height / worldHeight);
    if (lastScale.current == null || Math.abs(mpc - lastScale.current) / mpc > 0.02) {
      lastScale.current = mpc;
      onScale(mpc);
    }
  });
  return null;
}

function SelectedGalaxyMarker({ galaxy }: { galaxy: Galaxy | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y += 0.02;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 1.2) * 0.3;
    }
  });
  if (!galaxy) return null;
  return (
    <group position={[galaxy.x, galaxy.y, galaxy.z]}>
      <mesh ref={ref}>
        <ringGeometry args={[10, 14, 32]} />
        <meshBasicMaterial color="#ffc140" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-16, 0, 0, 16, 0, 0, 0, -16, 0, 0, 16, 0, 0, 0, -16, 0, 0, 16]), 3]}
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
      color: "rgba(100,150,220,0.8)", textAlign: "center", gap: 20,
    }}>
      <div style={{ fontSize: "3.5rem" }}>✦</div>
      <div>
        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#6eb5ff", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Cosmic Universe Model
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(140,180,240,0.6)", marginTop: 6 }}>
          DESI catalog · {count.toLocaleString()} galaxies · true comoving space
        </div>
      </div>
      <div style={{
        background: "rgba(10,20,50,0.8)", border: "1px solid rgba(94,186,255,0.2)",
        borderRadius: 12, padding: "20px 28px", maxWidth: 420,
        fontSize: "0.82rem", lineHeight: 1.7, color: "rgba(160,190,240,0.8)",
      }}>
        <div style={{ color: "#ffc140", fontWeight: 700, marginBottom: 8 }}>⚠ WebGL Unavailable</div>
        <div>The 3D visualization requires GPU rendering. This preview environment lacks GPU access.</div>
        <div style={{ marginTop: 10, color: "rgba(140,180,240,0.6)", fontSize: "0.75rem" }}>
          Open the published URL in a GPU-enabled browser to view the catalog.
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, fontSize: "0.7rem", color: "rgba(100,140,200,0.5)" }}>
        <span>H₀=67.4 km/s/Mpc</span><span>Ωₘ=0.315</span><span>ΩΛ=0.685</span><span>ΛCDM</span>
      </div>
    </div>
  );
}

export function CosmicViewer({
  galaxies,
  layers,
  colorMode,
  pointSize,
  isPlaying,
  playSpeed,
  futureOffset,
  onFutureOffsetChange,
  selectedGalaxy,
  onSelectGalaxy,
  onCameraScale,
}: Props) {
  const webglAvailable = useMemo(() => detectWebGL(), []);
  const controlsRef = useRef<any>(null);
  const handleGalaxyClick = useCallback((galaxy: Galaxy) => onSelectGalaxy(galaxy), [onSelectGalaxy]);

  if (!webglAvailable) return <WebGLFallback count={galaxies.length} />;

  return (
    <div style={{ width: "100%", height: "100%", background: "#020510" }}>
      <Canvas
        camera={{ position: [0, 2500, 10000], near: 1, far: 80000, fov: 55 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", logarithmicDepthBuffer: true }}
        onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))}
        onPointerMissed={() => onSelectGalaxy(null)}
      >
        <ambientLight intensity={0.1} />
        <AnimationController
          isPlaying={isPlaying}
          playSpeed={playSpeed}
          futureOffset={futureOffset}
          onFutureOffsetChange={onFutureOffsetChange}
        />
        {onCameraScale && <CameraScaleTracker controlsRef={controlsRef} onScale={onCameraScale} />}

        <Suspense fallback={null}>
          {layers.stars && <RotatingStarfield />}
          {layers.earth && <EarthMarker SCALE={SCALE} />}
          {layers.grid && <ScaleGrid SCALE={SCALE} />}
          {layers.galaxies && galaxies.length > 0 && (
            <GalaxyPoints
              galaxies={galaxies}
              colorMode={colorMode}
              pointSize={pointSize}
              futureOffset={futureOffset}
              SCALE={SCALE}
              onClick={handleGalaxyClick}
            />
          )}
          {layers.motionField && galaxies.length > 0 && (
            <FlowField galaxies={galaxies} SCALE={SCALE} opacity={0.55} stride={Math.max(1, Math.floor(galaxies.length / 1800))} />
          )}
          <SelectedGalaxyMarker galaxy={selectedGalaxy} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.3}
          zoomSpeed={1.2}
          panSpeed={0.8}
          minDistance={1}
          maxDistance={40000}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        />
      </Canvas>
    </div>
  );
}