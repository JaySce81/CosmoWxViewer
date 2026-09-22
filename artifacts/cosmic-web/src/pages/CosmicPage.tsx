import { useState, useCallback, useEffect } from "react";
import {
  useGetGalaxies,
  useGetGalaxyStats,
  getGetGalaxyStatsQueryKey,
  getGetGalaxiesQueryKey,
} from "@workspace/api-client-react";
import { CosmicViewer } from "../components/CosmicViewer";
import { ControlPanel } from "../components/ControlPanel";
import { Legend } from "../components/Legend";
import { GalaxyInfoCard } from "../components/GalaxyInfoCard";
import type { ColorMode, Galaxy } from "../components/GalaxyPoints";

interface Layers {
  galaxies: boolean;
  motionField: boolean;
  grid: boolean;
  stars: boolean;
  earth: boolean;
}

export function CosmicPage() {
  const [layers, setLayers] = useState<Layers>({
    galaxies: true,
    motionField: false,
    grid: true,
    stars: true,
    earth: true,
  });
  const [colorMode, setColorMode] = useState<ColorMode>("lineOfSight");
  const [pointSize, setPointSize] = useState(1.8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [futureOffset, setFutureOffset] = useState(0);
  const [datasetFilter, setDatasetFilter] = useState("all");
  const [selectedGalaxy, setSelectedGalaxy] = useState<Galaxy | null>(null);
  const [scaleMpc, setScaleMpc] = useState(1000);

  const { data: statsData } = useGetGalaxyStats({
    query: {
      queryKey: getGetGalaxyStatsQueryKey(),
      refetchInterval: query => (query.state.data as { ready?: boolean })?.ready ? false : 3000,
      staleTime: 5000,
    },
  });
  const serverReady = statsData?.ready === true;
  const galaxyParams = { sample: 80000, dataset: datasetFilter };
  const { data: galaxyData, isLoading: galaxiesLoading } = useGetGalaxies(galaxyParams, {
    query: {
      queryKey: getGetGalaxiesQueryKey(galaxyParams),
      enabled: serverReady,
      staleTime: 60000,
    },
  });

  const handleLayerToggle = useCallback((key: keyof Layers) => {
    setLayers(previous => ({ ...previous, [key]: !previous[key] }));
  }, []);
  const galaxies = (galaxyData?.galaxies ?? []) as Galaxy[];
  const handleCameraScale = useCallback((mpc: number) => setScaleMpc(mpc), []);

  useEffect(() => {
    document.title = "Cosmic Universe Model";
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <CosmicViewer
          galaxies={galaxies}
          layers={layers}
          colorMode={colorMode}
          pointSize={pointSize}
          isPlaying={isPlaying}
          playSpeed={playSpeed}
          futureOffset={futureOffset}
          onFutureOffsetChange={setFutureOffset}
          selectedGalaxy={selectedGalaxy}
          onSelectGalaxy={setSelectedGalaxy}
          onCameraScale={handleCameraScale}
        />
        <GalaxyInfoCard galaxy={selectedGalaxy} onClose={() => setSelectedGalaxy(null)} />
      </div>

      <div
        className="panel-glass"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 44, display: "flex",
          alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 10,
          borderTop: "none", borderLeft: "none", borderRight: "none", borderRadius: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6eb5ff", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            ✦ Cosmic Universe Model
          </span>
          <span style={{ fontSize: "0.62rem", color: "rgba(130,160,210,0.5)" }}>
            DESI catalog · true 3-D comoving space
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: "0.62rem", color: "rgba(140,170,220,0.6)" }}>
          <span>H₀=67.4 km/s/Mpc</span><span>Ωₘ=0.315</span><span>ΩΛ=0.685</span><span>ΛCDM</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.62rem" }}>
          {!serverReady && <span className="loading-pulse" style={{ color: "#ffc140" }}>Indexing catalog…</span>}
          {serverReady && galaxiesLoading && <span className="loading-pulse" style={{ color: "#a0d0ff" }}>Loading…</span>}
          {serverReady && !galaxiesLoading && galaxies.length > 0 && (
            <span style={{ color: "rgba(100,220,100,0.8)" }}>● {galaxies.length.toLocaleString()} galaxies</span>
          )}
          {futureOffset > 0 && <span style={{ color: "#ffc140", fontWeight: 600 }}>⟳ +{futureOffset.toFixed(2)} Gyr</span>}
        </div>
      </div>

      <div style={{ position: "absolute", top: 52, left: 16, zIndex: 10, pointerEvents: "none", maxHeight: "calc(100vh - 70px)", overflowY: "auto" }}>
        <ControlPanel
          layers={layers}
          onLayerToggle={handleLayerToggle}
          colorMode={colorMode}
          onColorMode={setColorMode}
          pointSize={pointSize}
          onPointSize={setPointSize}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying(value => !value)}
          playSpeed={playSpeed}
          onPlaySpeed={setPlaySpeed}
          futureOffset={futureOffset}
          onFutureOffset={setFutureOffset}
          totalGalaxies={galaxyData?.total ?? statsData?.totalGalaxies ?? 0}
          loadedGalaxies={galaxies.length}
          isLoading={!serverReady || galaxiesLoading}
          stats={statsData}
          datasetFilter={datasetFilter}
          onDatasetFilter={setDatasetFilter}
        />
      </div>

      <div style={{ position: "absolute", top: 52, right: 16, zIndex: 10, width: 250 }}>
        <Legend stats={statsData} />
      </div>

      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: "0.6rem", color: "rgba(120,160,210,0.5)" }}>
          <div style={{ width: 1, height: 8, background: "rgba(120,160,210,0.4)" }} />
          <div style={{ width: 200, height: 2, background: "rgba(120,160,210,0.4)" }} />
          <div style={{ width: 1, height: 8, background: "rgba(120,160,210,0.4)" }} />
          <span style={{ marginLeft: 6 }}>≈ {scaleMpc < 10 ? scaleMpc.toFixed(1) : Math.round(scaleMpc).toLocaleString()} comoving Mpc</span>
        </div>
      </div>
    </div>
  );
}