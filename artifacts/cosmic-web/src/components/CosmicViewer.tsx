import { useRef, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import { GalaxyPoints } from "./GalaxyPoints";
import { FlowField, DensityContours } from "./FlowField";
import { EarthMarker } from "./EarthMarker";
import { ScaleGrid } from "./ScaleGrid";

const SCALE = 1 / 1000;

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!ctx;
  } catch {
    return false;
  }
}

interface Galaxy {
  x: number; y: number; z: number;
  density: number; redshift: number; dataset: string;
}
interface FlowCell {
  x: number; y: number; z: number;
  density: number; vx: number; vy: number; vz: number;
}
interface Layers {
  galaxies: boolean;
  flowField: boolean;
  densityContours: boolean;
  grid: boolean;
  stars: boolean;
  earth: boolean;
}

interface Props {
  galaxies: Galaxy[];
  flowCells: FlowCell[];
  layers: Layers;
  colorMode: "density" | "redshift" | "dataset";
  pointSize: number;
  isPlaying: boolean;
  playSpeed: number;
  futureOffset: number;
  onFutureOffsetChange: (v: number) => void;
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
      const newOffset = futureOffset + elapsed.current;
      elapsed.current = 0;
      if (newOffset >= 5.0) {
        onFutureOffsetChange(0);
      } else {
        onFutureOffsetChange(newOffset);
      }
    }
  });
  return null;
}

function WebGLFallback({ galaxyCount }: { galaxyCount: number }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at center, #04081e 0%, #020510 70%)",
      color: "rgba(100,150,220,0.8)",
      textAlign: "center",
      gap: 20,
    }}>
      {/* Animated star field background using CSS */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.4 }}>
        {Array.from({ length: 80 }, (_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: i % 5 === 0 ? 2 : 1,
            height: i % 5 === 0 ? 2 : 1,
            background: "white",
            borderRadius: "50%",
            left: `${(i * 137.5) % 100}%`,
            top: `${(i * 73.7) % 100}%`,
            opacity: 0.3 + (i % 7) * 0.1,
            animation: `pulse ${2 + (i % 4)}s ease-in-out infinite`,
            animationDelay: `${(i * 0.4) % 3}s`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{ fontSize: "4rem" }}>✦</div>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#6eb5ff", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
            Cosmic Web Visualizer
          </div>
          <div style={{ fontSize: "0.78rem", color: "rgba(140,180,240,0.6)" }}>
            DESI Survey · {galaxyCount.toLocaleString()} galaxies loaded · z=0.6–1.1
          </div>
        </div>

        <div style={{
          background: "rgba(10,20,50,0.8)",
          border: "1px solid rgba(94,186,255,0.2)",
          borderRadius: 12,
          padding: "20px 30px",
          maxWidth: 440,
          fontSize: "0.82rem",
          lineHeight: 1.7,
          color: "rgba(160,190,240,0.8)",
        }}>
          <div style={{ color: "#ffc140", fontWeight: 700, marginBottom: 10, fontSize: "0.85rem" }}>
            ⚠ WebGL Not Available
          </div>
          <div>
            The 3D visualization requires WebGL (GPU rendering). This preview environment lacks GPU access.
          </div>
          <div style={{ marginTop: 12, color: "rgba(140,180,240,0.6)", fontSize: "0.75rem" }}>
            To view the full visualization:<br />
            <strong style={{ color: "#6eb5ff" }}>Deploy the app</strong> and open it in a GPU-enabled browser, or open the preview URL in a new browser tab with hardware acceleration enabled.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: "0.7rem", color: "rgba(100,140,200,0.5)" }}>
          <span>H₀ = 70 km/s/Mpc</span>
          <span>Ω<sub>m</sub> = 0.3</span>
          <span>Ω<sub>Λ</sub> = 0.7</span>
          <span>ΛCDM</span>
        </div>
      </div>
    </div>
  );
}

export function CosmicViewer({
  galaxies, flowCells, layers, colorMode, pointSize, isPlaying,
  playSpeed, futureOffset, onFutureOffsetChange,
}: Props) {
  const controlsRef = useRef<OrbitControlsType>(null);

  // Check WebGL availability BEFORE mounting Canvas — prevents the error overlay
  const webglAvailable = useMemo(() => detectWebGL(), []);

  if (!webglAvailable) {
    return <WebGLFallback galaxyCount={galaxies.length} />;
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#020510" }}>
      <Canvas
        camera={{ position: [0, 2, 6], near: 0.001, far: 200, fov: 55 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
      >
        <ambientLight intensity={0.1} />
        <directionalLight position={[5, 10, 5]} intensity={0.3} />

        <AnimationController
          isPlaying={isPlaying}
          playSpeed={playSpeed}
          futureOffset={futureOffset}
          onFutureOffsetChange={onFutureOffsetChange}
        />

        <Suspense fallback={null}>
          {layers.stars && <RotatingStarfield />}
          {layers.earth && <EarthMarker />}
          {layers.grid && <ScaleGrid SCALE={SCALE} />}

          {layers.galaxies && galaxies.length > 0 && (
            <GalaxyPoints
              galaxies={galaxies}
              colorMode={colorMode}
              pointSize={pointSize * SCALE * 1000}
              futureOffset={futureOffset}
              densityGrid={flowCells.length > 0 ? { cells: flowCells } : undefined}
              SCALE={SCALE}
            />
          )}

          {layers.flowField && flowCells.length > 0 && (
            <FlowField cells={flowCells} SCALE={SCALE} opacity={0.55} minDensityShow={-0.3} />
          )}

          {layers.densityContours && flowCells.length > 0 && (
            <DensityContours cells={flowCells} SCALE={SCALE} opacity={0.3} />
          )}
        </Suspense>

        <OrbitControls
          ref={controlsRef}
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
